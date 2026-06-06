import { generateJsonWithGemini } from './aiProvider.js';

const VALID_STRENGTHS = new Set(['light', 'medium', 'power']);
const VALID_INTENTS = new Set([
  'STRAIGHT DRIVE',
  'COVER DRIVE',
  'PULL SHOT',
  'SWEEP SHOT',
  'LEG GLANCE',
  'CUT SHOT',
  'BEHIND SQUARE'
]);

function fallbackAnalysis(swing) {
  const [dx = 0, dy = 0] = swing.gestureDirection ?? swing.direction ?? [];
  const intent = dy > 0.42
    ? dx >= 0 ? 'CUT SHOT' : 'LEG GLANCE'
    : dx > 0.22
      ? 'COVER DRIVE'
      : dx < -0.22
        ? 'PULL SHOT'
        : 'STRAIGHT DRIVE';
  return {
    aiEnhanced: false,
    swingStrength: swing.swingStrength,
    shotIntent: intent,
    timingHint: 'Track the ball longer and swing through the line.',
    confidence: Math.round(Math.min(96, 62 + (swing.velocity ?? 0) * 5200)),
    batLaneOffset: swing.batLane ?? 0
  };
}

export function analyzeSwingWithAI({ swing, delivery, score }) {
  const fallback = () => fallbackAnalysis(swing);
  const prompt = `
You are the computer-vision swing analyst inside an arcade cricket game.
Use the pose-derived motion metrics to refine the batter swing. Return JSON only.

Allowed swingStrength values: light, medium, power.
Allowed shotIntent values: STRAIGHT DRIVE, COVER DRIVE, PULL SHOT, SWEEP SHOT, LEG GLANCE, CUT SHOT, BEHIND SQUARE.

Input:
${JSON.stringify({
  score,
  delivery,
  swing: {
    hand: swing.hand,
    wristVelocity: swing.velocity,
    acceleration: swing.acceleration,
    displacement: swing.displacement,
    direction: swing.direction,
    gestureDirection: swing.gestureDirection,
    shotAngle: swing.shotAngle,
    batLane: swing.batLane,
    batAngle: swing.batAngle
  }
})}

Return:
{
  "aiEnhanced": true,
  "swingStrength": "light|medium|power",
  "shotIntent": "one allowed shotIntent",
  "timingHint": "max 10 words",
  "confidence": 0-100,
  "batLaneOffset": -1.05 to 1.05
}`;

  return generateJsonWithGemini(prompt, fallback).then((analysis) => {
    const base = fallback();
    const swingStrength = VALID_STRENGTHS.has(analysis.swingStrength) ? analysis.swingStrength : base.swingStrength;
    const shotIntent = VALID_INTENTS.has(analysis.shotIntent) ? analysis.shotIntent : base.shotIntent;
    const confidence = Number.isFinite(analysis.confidence)
      ? Math.max(0, Math.min(100, Math.round(analysis.confidence)))
      : base.confidence;
    const batLaneOffset = Number.isFinite(analysis.batLaneOffset)
      ? Math.max(-1.05, Math.min(1.05, analysis.batLaneOffset))
      : base.batLaneOffset;

    return {
      aiEnhanced: Boolean(analysis.aiEnhanced),
      swingStrength,
      shotIntent,
      timingHint: typeof analysis.timingHint === 'string' ? analysis.timingHint.slice(0, 80) : base.timingHint,
      confidence,
      batLaneOffset
    };
  });
}
