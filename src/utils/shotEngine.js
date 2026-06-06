export function randomDelivery() {
  const pace = ['FAST', 'MEDIUM', 'SLOW'][Math.floor(Math.random() * 3)];
  const speedMap = { FAST: 12.5, MEDIUM: 10.2, SLOW: 8.1 };
  return {
    id: crypto.randomUUID(),
    pace,
    speed: speedMap[pace] + Math.random() * 1.6,
    line: (Math.random() - 0.5) * 1.15,
    length: -2.8 - Math.random() * 4.6,
    seam: Math.random() > 0.5 ? 1 : -1
  };
}

function averagePoint(samples, start, end) {
  const slice = samples.slice(start, end);
  const total = slice.reduce(
    (acc, sample) => ({
      x: acc.x + sample.x,
      y: acc.y + sample.y,
      elbowX: acc.elbowX + (sample.elbowX ?? sample.x),
      elbowY: acc.elbowY + (sample.elbowY ?? sample.y)
    }),
    { x: 0, y: 0, elbowX: 0, elbowY: 0 }
  );
  const count = Math.max(1, slice.length);
  return {
    x: total.x / count,
    y: total.y / count,
    elbowX: total.elbowX / count,
    elbowY: total.elbowY / count
  };
}

export function detectSwing(samples, bodyScale = 0.18) {
  if (samples.length < 6) return { swingDetected: false, swingStrength: 'none', velocity: 0, direction: [0, 0] };
  const latest = samples[samples.length - 1];
  const previous = samples[samples.length - 5];
  const early = averagePoint(samples, 0, Math.max(2, samples.length - 5));
  const recent = averagePoint(samples, Math.max(0, samples.length - 4), samples.length);
  const dt = Math.max(24, latest.t - previous.t);
  const dx = recent.x - early.x;
  const dy = recent.y - early.y;
  const prevVelocity = Math.hypot(previous.x - early.x, previous.y - early.y) / Math.max(24, previous.t - samples[0].t);
  const displacement = Math.hypot(dx, dy);
  const velocity = displacement / dt;
  const acceleration = Math.max(0, velocity - prevVelocity);

  // Scale-invariant normalized metrics
  const normDisplacement = displacement / bodyScale;
  const normVelocity = velocity / bodyScale;
  const normAcceleration = acceleration / bodyScale;

  const elbowExtension = Math.hypot(recent.x - recent.elbowX, recent.y - recent.elbowY);
  const laneFromWrist = (0.5 - recent.x) * 1.7;
  const laneFromMotion = -dx * 1.8;
  const batLane = THREE_LANE_CLAMP(laneFromWrist + laneFromMotion);
  const batAngle = Math.atan2(recent.y - recent.elbowY, recent.x - recent.elbowX);
  const gestureDirection = normalizeGesture(dx, dy);
  const shotAngle = Math.atan2(gestureDirection[1], gestureDirection[0] || 0.001);

  if ((normVelocity < 0.003 && normAcceleration < 0.0006) || normDisplacement < 0.30 || elbowExtension < 0.04) {
    return { swingDetected: false, swingStrength: 'none', velocity, acceleration, displacement, direction: [dx, dy], gestureDirection, shotAngle, batLane, batAngle };
  }

  const swingStrength = normVelocity > 0.008 || normAcceleration > 0.0022 ? 'power' : normVelocity > 0.004 || normAcceleration > 0.0010 ? 'medium' : 'light';
  return { swingDetected: true, swingStrength, velocity, acceleration, displacement, direction: [dx, dy], gestureDirection, shotAngle, batLane, batAngle };
}

function THREE_LANE_CLAMP(value) {
  return Math.max(-1.05, Math.min(1.05, value));
}

function normalizeGesture(dx, dy) {
  const magnitude = Math.max(0.001, Math.hypot(dx, dy));
  return [
    Math.max(-1, Math.min(1, dx / magnitude)),
    Math.max(-1, Math.min(1, dy / magnitude))
  ];
}

export function classifyShot({ batAngle = 0, swing }) {
  if (swing?.shotIntent) {
    const confidence = Math.max(70, Math.min(98, swing.aiConfidence ?? 84));
    return { shotType: swing.shotIntent, confidence, quality: confidence > 88 ? 'perfect' : confidence > 78 ? 'good' : 'ok' };
  }

  const [dx = 0, dy = 0] = swing?.gestureDirection ?? swing?.direction ?? [];
  const angle = swing?.batAngle ?? batAngle;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  let shotType = 'STRAIGHT DRIVE';

  if (dy > 0.42 && dx > 0.18) shotType = 'CUT SHOT';
  else if (dy > 0.42 && dx < -0.18) shotType = 'LEG GLANCE';
  else if (absX > absY * 0.82 && dx > 0) shotType = 'COVER DRIVE';
  else if (absX > absY * 0.82 && dx < 0) shotType = 'PULL SHOT';
  if (angle < -0.45 || dy > 0.68) shotType = 'SWEEP SHOT';

  let confidenceBonus = 0;
  if (swing?.swingStrength === 'power') confidenceBonus = 18;
  else if (swing?.swingStrength === 'medium') confidenceBonus = 10;

  const baseConfidence = 66 + Math.round((swing?.velocity ?? 0.002) * 8000) + Math.round((swing?.acceleration ?? 0) * 12000);
  const confidence = Math.min(96, baseConfidence + confidenceBonus);
  return { shotType, confidence, quality: confidence > 88 ? 'perfect' : confidence > 78 ? 'good' : 'ok' };
}

export function calculateRuns({ contact, shot, swing, missedBy, powerZone = false }) {
  if (!contact) {
    return Math.abs(missedBy ?? 1) < 0.22 && Math.random() < 0.32
      ? { runs: 0, out: true, wicketKind: 'BOWLED', label: 'OUT', sound: 'wicket' }
      : { runs: 0, out: false, label: 'PLAYED & MISSED', sound: 'miss' };
  }

  const strength = swing?.swingStrength ?? 'light';
  const roll = Math.random();
  if (swing?.forceCatch) return { runs: 0, out: true, wicketKind: 'CATCH', label: 'OUT', sound: 'wicket' };
  if (powerZone && strength === 'power') return roll > 0.42 ? { runs: 6, out: false, label: 'SIX', sound: 'six' } : { runs: 4, out: false, label: 'FOUR', sound: 'four' };
  if (powerZone && strength === 'medium') return roll > 0.34 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : { runs: 2, out: false, label: shot.shotType, sound: 'hit' };
  if (swing?.timingQuality === 'perfect' && strength !== 'light') return roll > 0.64 ? { runs: 6, out: false, label: 'SIX', sound: 'six' } : roll > 0.24 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : { runs: 2, out: false, label: shot.shotType, sound: 'hit' };
  if (swing?.timingQuality === 'perfect' && strength === 'light') return roll > 0.75 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : { runs: 2, out: false, label: shot.shotType, sound: 'hit' };
  if (strength === 'light' && shot.quality === 'ok' && roll < 0.04) return { runs: 0, out: true, wicketKind: 'CATCH', label: 'OUT', sound: 'wicket' };
  if (strength === 'medium' && shot.quality === 'ok' && roll < 0.025) return { runs: 0, out: true, wicketKind: 'CATCH', label: 'OUT', sound: 'wicket' };
  if (shot.quality === 'perfect' && strength === 'power') return roll > 0.36 ? { runs: 6, out: false, label: 'SIX', sound: 'six' } : { runs: 4, out: false, label: 'FOUR', sound: 'four' };
  if (shot.quality === 'perfect') return roll > 0.22 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : { runs: 2, out: false, label: shot.shotType, sound: 'hit' };
  if (shot.quality === 'good' && strength === 'power') return roll > 0.55 ? { runs: 6, out: false, label: 'SIX', sound: 'six' } : roll > 0.15 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : { runs: 2, out: false, label: shot.shotType, sound: 'hit' };
  if (shot.quality === 'good' && strength === 'medium') return roll > 0.45 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : { runs: 2, out: false, label: shot.shotType, sound: 'hit' };
  if (shot.quality === 'good' && strength === 'light') return roll > 0.85 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : roll > 0.35 ? { runs: 2, out: false, label: shot.shotType, sound: 'hit' } : { runs: 1, out: false, label: shot.shotType, sound: 'hit' };
  if (strength === 'power') return roll > 0.48 ? { runs: 4, out: false, label: 'FOUR', sound: 'four' } : roll > 0.18 ? { runs: 2, out: false, label: shot.shotType, sound: 'hit' } : { runs: 1, out: false, label: shot.shotType, sound: 'hit' };
  if (strength === 'medium') return { runs: roll > 0.7 ? 3 : roll > 0.36 ? 2 : roll > 0.08 ? 1 : 0, out: false, label: shot.shotType, sound: 'hit' };
  return { runs: roll > 0.72 ? 2 : roll > 0.22 ? 1 : 0, out: false, label: shot.shotType, sound: 'hit' };
}

export function oversFromBalls(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}
