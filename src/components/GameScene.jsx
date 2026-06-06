import { Environment, Line, Sky, Text, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore.js';
export function simulateHitBallPhysics(animation) {
  if (!animation) return [];
  const runs = animation.result?.runs ?? 0;
  const swing = animation.swing ?? {};
  const [swingDx = 0, swingDy = -0.2] = swing.gestureDirection ?? swing.direction ?? [];
  const angle = Math.atan2(swingDy, swingDx || 0.001);
  const isBehind = swingDy > 0.065 || Math.abs(angle) > 2.35;

  // --- Compute direction unit vector toward shot target ---
  let horizontalAngle;
  if (isBehind) {
    horizontalAngle = Math.PI / 2 + swingDx * 1.6;
  } else {
    horizontalAngle = -Math.PI / 2 + swingDx * 1.6;
  }
  const dirX = Math.cos(horizontalAngle);
  const dirZ = Math.sin(horizontalAngle);

  // --- Calibrated physics parameters per run outcome ---
  // Boundary sits at radius ~41.5 from centre [0,-11].
  // Impact point: z=2.75 → straight distance to boundary ≈ 50 units.
  let speed, launchAngle, rollingDecel, restitution, airResistance;

  if (runs === 6) {
    // Aerial six — must carry over boundary rope (~50 units away)
    // High loft, very high speed so ball is still airborne when it crosses boundary
    speed = 38 + Math.random() * 5;        // 38-43 units/s
    launchAngle = 0.72 + Math.random() * 0.10; // ~41-48° — classic lofted six
    rollingDecel = 2.0;
    restitution = 0.58;
    airResistance = 0.055;                 // Low drag so ball carries all the way
  } else if (runs === 4) {
    // Ground drive / cut — ball must roll all the way to boundary
    speed = 26 + Math.random() * 4;        // 26-30 units/s
    launchAngle = 0.08 + Math.random() * 0.08; // ~5-9° — flat drive
    rollingDecel = 0.65;                   // Very low friction — rolls to rope
    restitution = 0.44;
    airResistance = 0.075;
  } else if (runs === 3) {
    // Middled into the gap — stops ~22-30 units out
    speed = 17 + Math.random() * 3;
    launchAngle = 0.20 + Math.random() * 0.10;
    rollingDecel = 2.0;
    restitution = 0.50;
    airResistance = 0.095;
  } else if (runs === 2) {
    // Good hit, fielded — stops ~13-20 units out
    speed = 12 + Math.random() * 3;
    launchAngle = 0.18 + Math.random() * 0.10;
    rollingDecel = 2.4;
    restitution = 0.50;
    airResistance = 0.095;
  } else {
    // 1 run / dot — trickles or pushes ~5-12 units
    speed = 6 + Math.random() * 4;
    launchAngle = 0.16 + Math.random() * 0.12;
    rollingDecel = 3.0;
    restitution = 0.48;
    airResistance = 0.12;
  }

  let vx = dirX * speed * Math.cos(launchAngle);
  let vz = dirZ * speed * Math.cos(launchAngle);
  let vy = speed * Math.sin(launchAngle);

  const points = [];
  let x = animation.impact?.ballLine ?? 0;
  let y = 0.78; // batsman contact height
  let z = 2.75;
  let t = 0;
  const dt = 1 / 120; // high precision physics steps
  const g = 11.5; // gravity (m/s^2)
  const groundY = 0.15; // ground surface height

  points.push({ x, y, z, t: 0 });

  const maxDuration = 4.0;
  while (t < maxDuration) {
    t += dt;
    
    // Apply gravity
    vy -= g * dt;
    
    // Apply air drag
    const drag = 1 - airResistance * dt;
    vx *= drag;
    vy *= drag;
    vz *= drag;
    
    // Update position
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    
    // Ground collision
    if (y <= groundY) {
      y = groundY;
      if (Math.abs(vy) > 0.4) {
        // Bounce
        vy = -vy * restitution;
        // Friction on impact
        vx *= 0.85;
        vz *= 0.85;
      } else {
        // Rolling decay
        vy = 0;
        const speed2d = Math.hypot(vx, vz);
        if (speed2d > 0.05) {
          const decel = rollingDecel * dt;
          const newSpeed = Math.max(0, speed2d - decel);
          const ratio = newSpeed / speed2d;
          vx *= ratio;
          vz *= ratio;
        } else {
          vx = 0;
          vz = 0;
        }
      }
    }
    
    points.push({ x, y, z, t });
    
    // Stop condition: stationary on the ground
    if (y === groundY && vx === 0 && vz === 0) {
      break;
    }
    
    // Boundary check: center of field is at [0, -11], boundary radius is 41.5
    const distToCenter = Math.hypot(x, z - (-11));
    if (distToCenter >= 41.5) {
      if (runs === 4) {
        // Stop exactly at boundary
        const angleToCenter = Math.atan2(z - (-11), x);
        x = Math.cos(angleToCenter) * 41.5;
        z = -11 + Math.sin(angleToCenter) * 41.5;
        points.push({ x, y: groundY, z, t });
        break;
      } else if (runs === 6) {
        // Allow to fly past boundary into stands (cap at radius 50)
        if (distToCenter >= 50.0) {
          const angleToCenter = Math.atan2(z - (-11), x);
          x = Math.cos(angleToCenter) * 50.0;
          z = -11 + Math.sin(angleToCenter) * 50.0;
          points.push({ x, y, z, t });
          break;
        }
      } else {
        // Runs 1-3 shouldn't cross the boundary. If they do due to random speed, clamp at boundary boundary minus 1m
        const angleToCenter = Math.atan2(z - (-11), x);
        x = Math.cos(angleToCenter) * 40.5;
        z = -11 + Math.sin(angleToCenter) * 40.5;
        points.push({ x, y: groundY, z, t });
        break;
      }
    }
  }

  return points;
}

export function getPhysicsPosition(points, elapsed) {
  if (!points || points.length === 0) return { x: 0, y: 0.78, z: 2.75 };
  if (elapsed <= 0) return points[0];
  if (elapsed >= points[points.length - 1].t) return points[points.length - 1];
  
  let low = 0;
  let high = points.length - 1;
  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if (points[mid].t < elapsed) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  const p0 = points[low];
  const p1 = points[high];
  const tDiff = p1.t - p0.t;
  const t = tDiff > 0 ? (elapsed - p0.t) / tDiff : 0;
  
  return {
    x: THREE.MathUtils.lerp(p0.x, p1.x, t),
    y: THREE.MathUtils.lerp(p0.y, p1.y, t),
    z: THREE.MathUtils.lerp(p0.z, p1.z, t)
  };
}

function CreaseCamera() {
  const { camera } = useThree();
  const hitAnimation = useGameStore((s) => s.hitAnimation);
  const wicketAnimation = useGameStore((s) => s.wicketAnimation);
  const catchAnimation = useGameStore((s) => s.catchAnimation);
  const delivery = useGameStore((s) => s.delivery);
  const ballPhase = useGameStore((s) => s.ballPhase);

  const [lastDeliveryId, setLastDeliveryId] = useState(null);
  const [resolvedTime, setResolvedTime] = useState(null);

  const currentLookAt = useRef(new THREE.Vector3(0, 0.85, -20));

  useEffect(() => {
    camera.position.set(0, 1.62, 5.2);
    camera.lookAt(0, 0.85, -20);
  }, [camera]);

  useEffect(() => {
    if (delivery && delivery.id !== lastDeliveryId) {
      setLastDeliveryId(delivery.id);
    }
  }, [delivery, lastDeliveryId]);

  useEffect(() => {
    if (ballPhase === 'resolved' && !hitAnimation && !wicketAnimation && !catchAnimation) {
      setResolvedTime(performance.now());
    } else {
      setResolvedTime(null);
    }
  }, [ballPhase, hitAnimation, wicketAnimation, catchAnimation]);

  useFrame(() => {
    const now = performance.now();
    let posTarget = new THREE.Vector3(0, 1.62, 5.2);
    let lookTarget = new THREE.Vector3(0, 0.85, -20);
    let targetFov = 58;
    let lerpSpeed = 0.055;
    let lookLerpSpeed = 0.055;
    let shake = 0;

    if (wicketAnimation) {
      // 1. Wicket Animation (Bowled Stump Orbit Cam)
      const elapsed = (now - wicketAnimation.createdAt) / 1000;
      if (elapsed < 0.45) {
        const decay = Math.pow(1 - (elapsed / 0.45), 2.0);
        shake = Math.sin(elapsed * 55) * 0.15 * decay;
      }
      const orbitRadius = 1.8;
      const angle = elapsed * 2.5; // Rotate around stumps
      posTarget.set(
        orbitRadius * Math.sin(angle),
        0.58 + elapsed * 0.14,
        3.25 + orbitRadius * Math.cos(angle)
      );
      lookTarget.set(0, 0.55, 3.25);
      targetFov = 42;
      lerpSpeed = 0.095;
      lookLerpSpeed = 0.095;
    } else if (catchAnimation) {
      // 2. Catch Animation (Fielder Zoom Cam)
      const elapsed = (now - catchAnimation.createdAt) / 1000;
      const base = shotFlightTarget(catchAnimation);
      const fielders = catchAnimation.fielders ?? [];
      const fielderIndex = nearestFielderIndex(fielders, base);
      const [fx = base.x, fz = base.z] = fielders[fielderIndex] ?? [base.x, base.z];
      const catchX = THREE.MathUtils.lerp(base.x, fx, 0.72);
      const catchZ = THREE.MathUtils.lerp(base.z, fz, 0.72);
      const startX = catchAnimation.impact?.ballLine ?? 0;

      const catchProgress = Math.min(1, elapsed / 1.55);
      const ease = 1 - Math.pow(1 - catchProgress, 3);
      const ballX = THREE.MathUtils.lerp(startX, catchX, ease);
      const ballZ = THREE.MathUtils.lerp(2.75, catchZ, ease);
      const ballY = 0.82 + Math.sin(catchProgress * Math.PI) * Math.max(4.6, base.peak * 0.75);

      if (elapsed < 1.45) {
        // Track the ball in flight towards the fielder
        posTarget.set(
          THREE.MathUtils.lerp(0, catchX * 0.45, elapsed / 1.45),
          7.2,
          THREE.MathUtils.lerp(5.2, catchZ * 0.45 + 4.5, elapsed / 1.45)
        );
        lookTarget.set(ballX, ballY, ballZ);
        targetFov = 48;
        lerpSpeed = 0.08;
        lookLerpSpeed = 0.12;
      } else {
        // Dynamic zoom close-up on the fielder catching/reacting
        posTarget.set(catchX + 2.6, 1.4, catchZ + 3.0);
        lookTarget.set(catchX, 1.1, catchZ);
        targetFov = 36;
        lerpSpeed = 0.07;
        lookLerpSpeed = 0.09;
      }
    } else if (hitAnimation) {
      // 3. Hit Animation (Boundary or Standard Runs)
      const elapsed = (now - hitAnimation.createdAt) / 1000;
      if (elapsed < 0.45) {
        const shakeAmplitude = hitAnimation.result?.runs === 6 ? 0.12 : hitAnimation.result?.runs === 4 ? 0.08 : 0.05;
        const decay = Math.pow(1 - (elapsed / 0.45), 2.5);
        shake = Math.sin(elapsed * 42) * shakeAmplitude * decay;
      }
      const target = shotFlightTarget(hitAnimation);
      const trajectoryPoints = simulateHitBallPhysics(hitAnimation);
      const pos = getPhysicsPosition(trajectoryPoints, elapsed);

      const isBoundary = hitAnimation.result?.runs === 4 || hitAnimation.result?.runs === 6;
      if (isBoundary) {
        const heightFactor = Math.max(0, Math.min(1, (pos.y - 0.78) / 8.0));
        const side = Math.sign(target.x || 1);
        const drift = Math.min(10, Math.abs(target.x) * 0.16);
        posTarget.set(
          pos.x - side * (4.8 + drift),
          THREE.MathUtils.clamp(pos.y + 2.8, 3.2, 8.8),
          pos.z + (hitAnimation.result?.runs === 6 ? 7.2 : 6.0)
        );
        lookTarget.set(pos.x, pos.y, pos.z);
        targetFov = hitAnimation.result?.runs === 6 ? 48 - heightFactor * 8 : 48;
        lerpSpeed = 0.045;
        lookLerpSpeed = 0.075;
      } else {
        // Standard Runs / Non-boundary hit tracking
        const progress = Math.min(1, elapsed / 2.2);
        posTarget.set(
          THREE.MathUtils.lerp(0, target.x * 0.38, progress),
          4.5,
          THREE.MathUtils.lerp(5.2, target.z * 0.38 + 5.5, progress)
        );
        lookTarget.set(pos.x, pos.y, pos.z);
        targetFov = 52;
        lerpSpeed = 0.07;
        lookLerpSpeed = 0.095;
      }
    } else if (ballPhase === 'bowling') {
      posTarget.set(0, 1.62, 5.2);
      lookTarget.set(0, 0.85, -20);
      targetFov = 58;
      lerpSpeed = 0.16;
      lookLerpSpeed = 0.16;
    } else if (resolvedTime && ballPhase === 'resolved') {
      // 5. Beaten / Dot Ball / Play & Miss (Batsman Reaction Cam)
      posTarget.set(-2.2, 1.35, 3.65);
      lookTarget.set(0, 0.9, 2.85);
      targetFov = 44;
      lerpSpeed = 0.075;
      lookLerpSpeed = 0.075;
    } else {
      // Default idle view
      camera.userData.bowlingStart = null;
      posTarget.set(0, 1.62, 5.2);
      lookTarget.set(0, 0.85, -20);
      targetFov = 58;
      lerpSpeed = 0.06;
      lookLerpSpeed = 0.06;
    }

    // Smoothly apply position, lookAt target, and FOV
    camera.position.lerp(posTarget, lerpSpeed);

    // Apply camera shake if active
    if (shake !== 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
    }

    currentLookAt.current.lerp(lookTarget, lookLerpSpeed);
    camera.lookAt(currentLookAt.current);

    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.075);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

// Crowd spectator component — each stand gets its own animated spectators
function StandCrowd({ hitAnimation }) {
  const crowdRows = useMemo(() => {
    const rows = [
      { z: -1.9, y: -0.6, count: 9, spreadX: 15.5 },
      { z: -0.6, y: 0.05, count: 9, spreadX: 15.5 },
      { z: 0.7, y: 0.75, count: 8, spreadX: 14.2 },
      { z: 2.0, y: 1.45, count: 8, spreadX: 14.2 },
      { z: 3.2, y: 2.15, count: 7, spreadX: 12.8 },
    ];
    const palette = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#ffffff','#facc15','#06b6d4'];
    const specs = [];
    rows.forEach((row, ri) => {
      const step = row.spreadX / (row.count - 1);
      for (let i = 0; i < row.count; i++) {
        specs.push({
          id: `${ri}-${i}`,
          x: -row.spreadX / 2 + i * step + (Math.random() - 0.5) * 0.12,
          baseY: row.y,
          z: row.z + (Math.random() - 0.5) * 0.08,
          color: palette[Math.floor(Math.random() * palette.length)],
          phase: Math.random() * Math.PI * 2,
          scale: 0.88 + Math.random() * 0.24,
        });
      }
    });
    return specs;
  }, []);

  const refs = useRef([]);
  const isCelebrating = hitAnimation && (hitAnimation.result?.runs === 4 || hitAnimation.result?.runs === 6);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    crowdRows.forEach((spec, idx) => {
      const el = refs.current[idx];
      if (!el) return;
      if (isCelebrating) {
        el.position.y = spec.baseY + Math.abs(Math.sin(t * 10 + spec.phase * 3)) * 0.48;
        el.rotation.z = Math.sin(t * 8 + spec.phase) * 0.18;
      } else {
        el.position.y = spec.baseY + Math.sin(t * 1.8 + spec.phase) * 0.03;
        el.rotation.z = 0;
      }
    });
  });

  return (
    <group>
      {crowdRows.map((spec, idx) => (
        <group
          key={spec.id}
          ref={el => { refs.current[idx] = el; }}
          position={[spec.x, spec.baseY, spec.z]}
          scale={spec.scale}
        >
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 0.4, 6]} />
            <meshStandardMaterial color={spec.color} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <sphereGeometry args={[0.105, 7, 7]} />
            <meshStandardMaterial color="#d4956a" roughness={0.85} />
          </mesh>
          {/* Left arm */}
          <mesh 
            position={isCelebrating ? [-0.14, 0.42, 0] : [-0.13, 0.22, 0]} 
            rotation-z={isCelebrating ? 0.8 : 0.15}
          >
            <cylinderGeometry args={[0.024, 0.024, 0.28, 5]} />
            <meshStandardMaterial color="#d4956a" roughness={0.85} />
          </mesh>
          {/* Right arm */}
          <mesh 
            position={isCelebrating ? [0.14, 0.42, 0] : [0.13, 0.22, 0]} 
            rotation-z={isCelebrating ? -0.8 : -0.15}
          >
            <cylinderGeometry args={[0.024, 0.024, 0.28, 5]} />
            <meshStandardMaterial color="#d4956a" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FloodlightTower({ pos, castShadow, towerIndex }) {
  const lightRef = useRef();
  const hitAnimation = useGameStore((s) => s.hitAnimation);

  useFrame(() => {
    if (!lightRef.current) return;
    const now = performance.now();
    let currentIntensity = 5.5;

    if (hitAnimation) {
      const runs = hitAnimation.result?.runs ?? 0;
      const isCelebration = runs === 4 || runs === 6;
      if (isCelebration) {
        const elapsed = (now - hitAnimation.createdAt) / 1000;
        if (elapsed < 2.5) {
          // Sequenced flashing light show based on towerIndex
          const offset = towerIndex * 0.16;
          const localElapsed = Math.max(0, elapsed - offset);
          currentIntensity = 5.5 + Math.abs(Math.sin(localElapsed * 15.0)) * 6.5;
        }
      }
    }
    
    lightRef.current.intensity = currentIntensity;
  });

  return (
    <group position={pos}>
      {/* Base plinth */}
      <mesh receiveShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[1.2, 0.7, 1.2]} />
        <meshStandardMaterial color="#0e1518" roughness={0.85} />
      </mesh>
      {/* Main pole */}
      <mesh castShadow position={[0, 9.5, 0]}>
        <cylinderGeometry args={[0.18, 0.38, 19, 8]} />
        <meshStandardMaterial color="#252f35" metalness={0.75} roughness={0.28} />
      </mesh>
      {/* Cross arm */}
      <mesh castShadow position={[0, 18.8, 0]}>
        <boxGeometry args={[4.5, 0.3, 0.3]} />
        <meshStandardMaterial color="#1e282d" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Light housing */}
      <group position={[0, 19.1, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.8, 1.2, 0.55]} />
          <meshStandardMaterial color="#111a1e" roughness={0.5} />
        </mesh>
        {/* Individual lamp bulbs */}
        {[-1.4, -0.7, 0, 0.7, 1.4].map((bx) =>
          [-0.32, 0.32].map((by) => (
            <mesh key={`${bx}-${by}`} position={[bx, by, 0.3]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.14, 0.14, 0.12, 10]} />
              <meshBasicMaterial color="#e8f4ff" />
            </mesh>
          ))
        )}
        {/* Main floodlight beam */}
        <spotLight
          ref={lightRef}
          castShadow={castShadow}
          position={[0, 0, 0.5]}
          intensity={5.5}
          angle={Math.PI / 3.5}
          penumbra={0.7}
          distance={100}
          color="#ddeeff"
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0005}
        />
      </group>
    </group>
  );
}

function StadiumStructure() {
  const hitAnimation = useGameStore((s) => s.hitAnimation);

  const boardsCount = 42;
  const boardRadius = 41.5;
  const boardWidth = 6.2;
  const boardHeight = 0.75;

  const boundaryBoards = useMemo(() => {
    return Array.from({ length: boardsCount }).map((_, i) => {
      const angle = (i / boardsCount) * Math.PI * 2;
      const x = Math.cos(angle) * boardRadius;
      const z = -11 + Math.sin(angle) * boardRadius;
      return {
        id: i,
        position: [x, boardHeight / 2, z],
        rotation: [0, -angle + Math.PI / 2, 0],
        color: i % 2 ? '#0fd483' : '#0e1518',
      };
    });
  }, []);

  const standsCount = 18;
  const standsRadius = 50.0;
  const standWidth = 18.0;
  const standHeight = 6.5;
  const standDepth = 7.5;

  const stands = useMemo(() => {
    return Array.from({ length: standsCount }).map((_, i) => {
      const angle = (i / standsCount) * Math.PI * 2;
      if (angle > Math.PI * 1.33 && angle < Math.PI * 1.67) return null;
      const x = Math.cos(angle) * standsRadius;
      const z = -11 + Math.sin(angle) * standsRadius;
      return { id: i, x, z, angle };
    }).filter(Boolean);
  }, []);

  const towers = [
    { pos: [36, 0, -33], castShadow: true },
    { pos: [-36, 0, -33], castShadow: false },
    { pos: [36, 0, 11], castShadow: true },
    { pos: [-36, 0, 11], castShadow: false },
  ];

  return (
    <group>
      {/* Boundary Boards */}
      {boundaryBoards.map((board) => (
        <group key={board.id} position={board.position} rotation={board.rotation}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[boardWidth, boardHeight, 0.2]} />
            <meshStandardMaterial color={board.color} roughness={0.6} />
          </mesh>
          {/* LED top stripe */}
          <mesh position={[0, boardHeight / 2 + 0.04, 0]}>
            <boxGeometry args={[boardWidth, 0.06, 0.22]} />
            <meshBasicMaterial color={board.id % 2 ? '#27e8ff' : '#0fd483'} />
          </mesh>
        </group>
      ))}

      {/* Stadium Stands — layered structure with stepped tiers + crowd */}
      {stands.map((stand) => {
        const rot = [0, -stand.angle + Math.PI / 2, 0];
        const basePos = [stand.x, 0, stand.z];
        return (
          <group key={stand.id} position={basePos} rotation={rot}>
            {/* Lower concrete base */}
            <mesh receiveShadow castShadow position={[0, 1.2, 0]}>
              <boxGeometry args={[standWidth, 2.4, standDepth]} />
              <meshStandardMaterial color="#151d21" roughness={0.9} />
            </mesh>
            {/* Upper tier back wall */}
            <mesh receiveShadow castShadow position={[0, 4.5, 1.2]}>
              <boxGeometry args={[standWidth, 3.8, standDepth * 0.55]} />
              <meshStandardMaterial color="#1a2428" roughness={0.9} />
            </mesh>
            {/* Roof overhang */}
            <mesh receiveShadow castShadow position={[0, 6.65, -0.6]}>
              <boxGeometry args={[standWidth + 0.4, 0.28, standDepth * 0.85]} />
              <meshStandardMaterial color="#0e1518" roughness={0.75} metalness={0.2} />
            </mesh>
            {/* Roof support pillars */}
            {[-standWidth * 0.42, 0, standWidth * 0.42].map((px) => (
              <mesh key={px} castShadow position={[px, 4.0, -standDepth * 0.32]}>
                <cylinderGeometry args={[0.14, 0.14, 5.4, 8]} />
                <meshStandardMaterial color="#1e282d" metalness={0.5} roughness={0.4} />
              </mesh>
            ))}
            {/* Green LED top band */}
            <mesh position={[0, 6.82, -0.6]}>
              <boxGeometry args={[standWidth + 0.4, 0.06, standDepth * 0.85]} />
              <meshBasicMaterial color="#0fd483" />
            </mesh>
            {/* Stepped seating tiers — dark seats */}
            {[0, 1, 2, 3].map((tier) => (
              <mesh key={tier} receiveShadow position={[0, tier * 1.2 + 0.2, -2.8 + tier * 0.9]}>
                <boxGeometry args={[standWidth - 0.3, 0.18, standDepth * 0.55]} />
                <meshStandardMaterial color={tier % 2 ? '#1e3a30' : '#102a22'} roughness={0.9} />
              </mesh>
            ))}
            {/* Animated crowd spectators */}
            <StandCrowd hitAnimation={hitAnimation} />
          </group>
        );
      })}

      {/* Floodlight Towers */}
      {towers.map((tower, idx) => (
        <FloodlightTower
          key={idx}
          pos={tower.pos}
          castShadow={tower.castShadow}
          towerIndex={idx}
        />
      ))}
    </group>
  );
}

function CricketGround() {
  const pitchTexture = useTexture('/textures/pitch.svg');
  const wicketAnimation = useGameStore((s) => s.wicketAnimation);
  pitchTexture.wrapS = pitchTexture.wrapT = THREE.RepeatWrapping;
  pitchTexture.repeat.set(1.2, 8);

  return (
    <group>
      <Sky sunPosition={[80, 5, -50]} turbidity={3} rayleigh={0.5} />
      <ambientLight intensity={0.55} />
      <directionalLight castShadow position={[18, 5, -15]} intensity={0.7} color="#ffd8a8" shadow-mapSize={[1024, 1024]} />
      <StadiumStructure />
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.02, -11]}>
        <circleGeometry args={[54, 96]} />
        <meshStandardMaterial color="#3f8232" roughness={0.92} />
      </mesh>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0.01, -9]}>
        <planeGeometry args={[5.4, 39]} />
        <meshStandardMaterial map={pitchTexture} color="#c7ad80" roughness={0.98} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 1.6]}>
        <ringGeometry args={[0.95, 1.05, 64]} />
        <meshBasicMaterial color="#27e8ff" transparent opacity={0.75} />
      </mesh>
      <PowerZone />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, -6.2]}>
        <ringGeometry args={[1.05, 1.18, 64]} />
        <meshBasicMaterial color="#27e8ff" transparent opacity={0.65} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, -11]}>
        <ringGeometry args={[42, 42.25, 128]} />
        <meshBasicMaterial color="#f2f2df" />
      </mesh>
      {!wicketAnimation && <Stumps position={[0, 0.45, 3.25]} />}
      <Stumps position={[0, 0.45, -19.5]} />
      <WicketCrash />
      <StadiumScreen />
      <Trees />
    </group>
  );
}

function PowerZone() {
  return (
    <group position={[0, 0.06, 2.35]} rotation-x={-Math.PI / 2}>
      <mesh>
        <ringGeometry args={[0.46, 0.64, 64]} />
        <meshBasicMaterial color="#ffd85a" transparent opacity={0.9} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial color="#ffd85a" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function Stumps({ position }) {
  return (
    <group position={position}>
      {[-0.22, 0, 0.22].map((x) => (
        <mesh key={x} castShadow position={[x, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.9, 12]} />
          <meshStandardMaterial color="#2d2218" />
        </mesh>
      ))}
      <mesh position={[0, 0.47, 0]}>
        <boxGeometry args={[0.58, 0.035, 0.05]} />
        <meshStandardMaterial color="#f2dfb0" />
      </mesh>
    </group>
  );
}

function StadiumScreen() {
  return (
    <group position={[0, 4.5, -35]}>
      <mesh>
        <boxGeometry args={[8, 5.2, 0.25]} />
        <meshStandardMaterial color="#15191c" roughness={0.7} />
      </mesh>
      <Text position={[0, 0.2, 0.18]} fontSize={0.48} color="#e8fff7" anchorX="center">
        SHADOW CRICKET AI
      </Text>
    </group>
  );
}

function Trees() {
  const trees = useMemo(() => Array.from({ length: 28 }).map((_, i) => {
    const angle = (i / 28) * Math.PI * 2;
    const radius = 48 + Math.sin(i * 1.7) * 4;
    return {
      id: i,
      x: Math.cos(angle) * radius,
      z: -11 + Math.sin(angle) * radius,
      size: 1.1 + Math.random() * 0.45,
      color: i % 3 ? '#2f7f43' : '#3c9150'
    };
  }), []);

  return (
    <group>
      {trees.map((tree) => {
        return (
          <group key={tree.id} position={[tree.x, 0, tree.z]}>
            <mesh position={[0, 1.3, 0]}>
              <cylinderGeometry args={[0.14, 0.22, 2.6, 8]} />
              <meshStandardMaterial color="#6d4c2f" />
            </mesh>
            <mesh position={[0, 3.1, 0]}>
              <sphereGeometry args={[tree.size, 10, 10]} />
              <meshStandardMaterial color={tree.color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Bowler() {
  const ref = useRef();
  const phase = useGameStore((s) => s.bowlerPhase);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const runup = phase === 'runup' ? Math.sin(t * 7) * 0.22 : 0;
    ref.current.position.z = -19.8 + runup;
    ref.current.rotation.z = phase === 'runup' ? Math.sin(t * 8) * 0.07 : 0;
  });

  return (
    <group ref={ref} position={[0, 0, -19.8]}>
      <mesh castShadow position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#8e5f3f" />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.28, 0.72, 8, 16]} />
        <meshStandardMaterial color="#10d98b" />
      </mesh>
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} castShadow position={[x, 0.45, 0]}>
          <capsuleGeometry args={[0.08, 0.75, 6, 10]} />
          <meshStandardMaterial color="#0fd483" />
        </mesh>
      ))}
      <mesh castShadow position={[0.38, 1.22, 0.05]} rotation-z={phase === 'runup' ? -1.05 : -0.35}>
        <capsuleGeometry args={[0.07, 0.72, 6, 10]} />
        <meshStandardMaterial color="#8e5f3f" />
      </mesh>
      <mesh castShadow position={[-0.36, 1.2, 0.02]} rotation-z={0.55}>
        <capsuleGeometry args={[0.07, 0.62, 6, 10]} />
        <meshStandardMaterial color="#8e5f3f" />
      </mesh>
    </group>
  );
}

function CricketBall() {
  const mesh = useRef();
  const trail = useRef();
  const delivery = useGameStore((s) => s.delivery);
  const phase = useGameStore((s) => s.ballPhase);
  const hitAnimation = useGameStore((s) => s.hitAnimation);
  const catchAnimation = useGameStore((s) => s.catchAnimation);
  const resolveBall = useGameStore((s) => s.resolveBall);
  const startDelivery = useGameStore((s) => s.startDelivery);
  const setDeliveryStartedAt = useGameStore((s) => s.setDeliveryStartedAt);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(startDelivery, 700);
    return () => window.clearTimeout(id);
  }, [startDelivery]);

  useEffect(() => {
    if (phase === 'bowling') {
      const now = performance.now();
      setStartTime(now);
      setDeliveryStartedAt(now);
    }
  }, [phase, delivery.id, setDeliveryStartedAt]);

  useFrame(() => {
    if (!mesh.current || phase !== 'bowling' || !startTime) return;
    const elapsed = (performance.now() - startTime) / 1000;
    const z = -19.4 + elapsed * delivery.speed;
    const bounceProgress = Math.max(0, Math.min(1, (z - delivery.length) / 6));
    const y = z < delivery.length
      ? 1.65 - elapsed * 0.46
      : 0.16 + Math.sin(bounceProgress * Math.PI) * 0.9 * (1 - bounceProgress * 0.5);

    // Lateral physics: swing before pitch, and sharp cut/spin break after pitching
    let x = delivery.line;
    if (z > delivery.length) {
      const distAfterBounce = z - delivery.length;
      x = delivery.line + Math.sin(elapsed * 2.5) * 0.04 * delivery.seam + distAfterBounce * 0.08 * delivery.seam;
    } else {
      x = delivery.line + Math.sin(elapsed * 2.5) * 0.04 * delivery.seam;
    }

    mesh.current.position.set(x, Math.max(0.13, y), z);
    mesh.current.rotation.x += 0.22;
    mesh.current.rotation.z += 0.13;
    if (trail.current) trail.current.position.copy(mesh.current.position);

    if (z > 2.65) {
      const lastSwing = useGameStore.getState().lastSwing;
      const recentSwing = lastSwing && performance.now() - lastSwing.at < 1650;
      const batLane = lastSwing?.batLane ?? 0;
      const centered = Math.abs(x - batLane) < 1.12;
      
      if (recentSwing && centered) {
        resolveBall({
          contact: true,
          impact: { batAngle: lastSwing.batAngle ?? lastSwing.direction?.[0] ?? 0, ballLine: x, batLane },
          missedBy: x
        });
      } else if (z > 3.8) {
        resolveBall({
          contact: false,
          impact: { batAngle: 0, ballLine: x, batLane: 0 },
          missedBy: x
        });
      }
    }
  });

  return (
    <group>
      <mesh ref={mesh} castShadow visible={!hitAnimation && !catchAnimation} position={[delivery.line, 1.4, -19.4]}>
        <sphereGeometry args={[0.17, 32, 32]} />
        <meshStandardMaterial color="#d5121f" roughness={0.35} />
      </mesh>
      <mesh ref={trail} visible={!hitAnimation && !catchAnimation} scale={[1, 1, 1]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.172, 0.008, 8, 36]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function shotFlightTarget(animation) {
  const runs = animation?.result?.runs ?? 1;
  const strength = animation?.swing?.swingStrength ?? 'medium';
  const [swingDx = 0, swingDy = -0.2] = animation?.swing?.gestureDirection ?? animation?.swing?.direction ?? [];
  const angle = Math.atan2(swingDy, swingDx || 0.001);
  const isBehind = swingDy > 0.065 || Math.abs(angle) > 2.35;
  const squareHit = Math.abs(swingDx) > Math.max(0.11, Math.abs(swingDy) * 0.85);
  const distance = runs === 6 ? 39 : runs === 4 ? 31 : strength === 'power' ? 25 : 17;
  const lateralMultiplier = squareHit ? 118 : 72;
  const lateral = THREE.MathUtils.clamp(swingDx * lateralMultiplier + Math.sin(angle) * 7, -40, 40);
  const loft = THREE.MathUtils.clamp((-swingDy + Math.abs(swingDx) * 0.15) * 12, -1.5, 5.2);
  const zTarget = isBehind
    ? THREE.MathUtils.clamp(10 + Math.max(Math.abs(swingDy), Math.abs(swingDx) * 0.22) * 92, 11, 32)
    : THREE.MathUtils.clamp(-distance + Math.max(0, swingDy) * 16, -42, -10);
  const side = isBehind
    ? (swingDx >= 0 ? 'BEHIND OFF' : 'BEHIND LEG')
    : swingDx >= 0.18
      ? 'EXTREME OFF'
      : swingDx <= -0.18
        ? 'EXTREME LEG'
        : swingDx >= 0
          ? 'OFF SIDE'
          : 'LEG SIDE';
  return {
    x: lateral + (animation?.impact?.ballLine ?? 0) * 2.5,
    z: zTarget,
    peak: Math.max(runs === 6 ? 8.5 : runs === 4 ? 4 : 2, loft + (runs === 6 ? 5 : 1.8)),
    side,
    color: isBehind ? '#f472b6' : swingDx >= 0 ? '#35e7ff' : '#ffcf4a'
  };
}

function shotCurvePoints(animation, target) {
  const startX = animation?.impact?.ballLine ?? 0;
  const points = [];
  for (let i = 0; i <= 18; i += 1) {
    const t = i / 18;
    const ease = 1 - Math.pow(1 - t, 3);
    points.push([
      THREE.MathUtils.lerp(startX, target.x, ease),
      0.78 + Math.sin(t * Math.PI) * target.peak,
      THREE.MathUtils.lerp(2.75, target.z, ease)
    ]);
  }
  return points;
}

function HitBallFlight() {
  const animation = useGameStore((s) => s.hitAnimation);
  const ballRef = useRef();
  const shadowRef = useRef();
  const burstRef = useRef();
  
  const target = useMemo(() => shotFlightTarget(animation), [animation]);
  
  const trajectoryPoints = useMemo(() => {
    if (!animation) return [];
    return simulateHitBallPhysics(animation);
  }, [animation]);

  const curvePoints = useMemo(() => {
    if (trajectoryPoints.length === 0) return [];
    const pts = [];
    for (let i = 0; i < trajectoryPoints.length; i += 3) {
      pts.push([trajectoryPoints[i].x, trajectoryPoints[i].y, trajectoryPoints[i].z]);
    }
    const last = trajectoryPoints[trajectoryPoints.length - 1];
    pts.push([last.x, last.y, last.z]);
    return pts;
  }, [trajectoryPoints]);

  useFrame(() => {
    if (!animation || !ballRef.current) return;
    const elapsed = (performance.now() - animation.createdAt) / 1000;
    
    const pos = getPhysicsPosition(trajectoryPoints, elapsed);
    ballRef.current.position.set(pos.x, pos.y, pos.z);
    
    ballRef.current.rotation.x += 0.45;
    ballRef.current.rotation.z += 0.28;
    
    if (shadowRef.current) {
      shadowRef.current.position.set(pos.x, 0.055, pos.z);
      const heightAboveGround = pos.y - 0.17;
      const shadowScale = Math.max(0.12, 0.9 * (1 - heightAboveGround * 0.08));
      shadowRef.current.scale.setScalar(shadowScale);
    }
    
    if (burstRef.current) {
      const burstProgress = Math.min(1, elapsed / 0.6);
      burstRef.current.scale.setScalar(1 + burstProgress * 6);
      burstRef.current.material.opacity = Math.max(0, 0.75 - burstProgress);
    }
  });

  if (!animation) return null;

  const burstColor = animation.result?.runs === 6 ? '#ffd66b' : animation.result?.runs === 4 ? '#39e6ff' : target.color;
  return (
    <group>
      {curvePoints.length > 1 && (
        <Line points={curvePoints} color={target.color} lineWidth={4} transparent opacity={0.82} />
      )}
      <mesh ref={burstRef} position={[animation.impact?.ballLine ?? 0, 0.85, 2.55]} rotation-x={Math.PI / 2}>
        <ringGeometry args={[0.24, 0.34, 44]} />
        <meshBasicMaterial color={burstColor} transparent opacity={0.75} />
      </mesh>
      <mesh ref={ballRef} castShadow position={[animation.impact?.ballLine ?? 0, 0.78, 2.75]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color="#d5121f" emissive="#4b0004" emissiveIntensity={0.18} roughness={0.28} />
      </mesh>
      <mesh ref={shadowRef} rotation-x={-Math.PI / 2} position={[animation.impact?.ballLine ?? 0, 0.055, 2.75]}>
        <circleGeometry args={[0.36, 28]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
      {[0.28, 0.5, 0.72].map((offset) => (
        <mesh key={offset} position={[animation.impact?.ballLine ?? 0, 0.78, 2.75 - offset]} rotation-x={Math.PI / 2}>
          <ringGeometry args={[0.17 + offset * 0.08, 0.185 + offset * 0.08, 24]} />
          <meshBasicMaterial color={target.color} transparent opacity={0.32 / offset} />
        </mesh>
      ))}
      <Text
        position={[target.x * 0.45, Math.min(target.peak + 1.2, 6.5), -8]}
        fontSize={0.62}
        color={target.color}
        anchorX="center"
        outlineWidth={0.035}
        outlineColor="#0d1114"
      >
        {target.side}
      </Text>
    </group>
  );
}

function nearestFielderIndex(fielders, target) {
  let best = 0;
  let bestDistance = Infinity;
  fielders.forEach(([x, z], index) => {
    const distance = Math.hypot(x - target.x, z - target.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

function CatchOutAnimation() {
  const animation = useGameStore((s) => s.catchAnimation);
  const ballRef = useRef();
  const fielderRef = useRef();
  const burstRef = useRef();
  const target = useMemo(() => {
    const base = shotFlightTarget(animation);
    const fielders = animation?.fielders ?? [];
    const fielderIndex = nearestFielderIndex(fielders, base);
    const [fx = base.x, fz = base.z] = fielders[fielderIndex] ?? [base.x, base.z];
    return {
      ...base,
      fielderIndex,
      catchX: THREE.MathUtils.lerp(base.x, fx, 0.72),
      catchZ: THREE.MathUtils.lerp(base.z, fz, 0.72),
      startX: animation?.impact?.ballLine ?? 0
    };
  }, [animation]);
  const curvePoints = useMemo(() => {
    if (!animation) return [];
    const points = [];
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      const ease = 1 - Math.pow(1 - t, 3);
      points.push([
        THREE.MathUtils.lerp(target.startX, target.catchX, ease),
        0.8 + Math.sin(t * Math.PI) * Math.max(4.6, target.peak * 0.75),
        THREE.MathUtils.lerp(2.75, target.catchZ, ease)
      ]);
    }
    return points;
  }, [animation, target]);

  useFrame(() => {
    if (!animation || !ballRef.current || !fielderRef.current) return;
    const elapsed = (performance.now() - animation.createdAt) / 1000;
    const progress = Math.min(1, elapsed / 2.15);
    const catchProgress = Math.min(1, elapsed / 1.55);
    const ease = 1 - Math.pow(1 - catchProgress, 3);
    const jump = Math.sin(Math.min(1, Math.max(0, (elapsed - 1.0) / 0.55)) * Math.PI) * 0.9;
    const start = { x: target.startX, y: 0.82, z: 2.75 };
    const ballX = THREE.MathUtils.lerp(start.x, target.catchX, ease);
    const ballZ = THREE.MathUtils.lerp(start.z, target.catchZ, ease);
    const ballY = start.y + Math.sin(catchProgress * Math.PI) * Math.max(4.6, target.peak * 0.75);

    ballRef.current.position.set(ballX, progress > 0.78 ? 1.55 + jump * 0.25 : ballY, ballZ);
    ballRef.current.rotation.x += 0.32;
    ballRef.current.rotation.z += 0.2;

    const [homeX = target.catchX, homeZ = target.catchZ] = animation.fielders?.[target.fielderIndex] ?? [];
    fielderRef.current.position.set(
      THREE.MathUtils.lerp(homeX, target.catchX, Math.min(1, progress * 1.25)),
      0.55 + jump,
      THREE.MathUtils.lerp(homeZ, target.catchZ, Math.min(1, progress * 1.25))
    );
    fielderRef.current.rotation.z = Math.sin(progress * Math.PI) * 0.25;

    if (burstRef.current) {
      const caught = progress > 0.7;
      burstRef.current.visible = caught;
      burstRef.current.position.set(target.catchX, 1.65 + jump * 0.2, target.catchZ);
      burstRef.current.scale.setScalar(0.6 + Math.max(0, progress - 0.7) * 7);
      burstRef.current.material.opacity = Math.max(0, 0.78 - Math.max(0, progress - 0.7) * 2.2);
    }
  });

  if (!animation) return null;

  return (
    <group>
      <Line points={curvePoints} color="#ff5c7a" lineWidth={4} transparent opacity={0.85} />
      <mesh ref={ballRef} castShadow position={[target.startX, 0.82, 2.75]}>
        <sphereGeometry args={[0.19, 32, 32]} />
        <meshStandardMaterial color="#d5121f" emissive="#5a0007" emissiveIntensity={0.22} />
      </mesh>
      <group ref={fielderRef} position={[target.catchX, 0.55, target.catchZ]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.28, 0.75, 8, 14]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
        <mesh castShadow position={[0, 1.15, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#8e5f3f" />
        </mesh>
        <mesh castShadow position={[-0.28, 0.95, 0]} rotation-z={-0.7}>
          <capsuleGeometry args={[0.055, 0.42, 6, 10]} />
          <meshStandardMaterial color="#8e5f3f" />
        </mesh>
        <mesh castShadow position={[0.28, 0.95, 0]} rotation-z={0.7}>
          <capsuleGeometry args={[0.055, 0.42, 6, 10]} />
          <meshStandardMaterial color="#8e5f3f" />
        </mesh>
      </group>
      <mesh ref={burstRef} visible={false} rotation-x={Math.PI / 2}>
        <ringGeometry args={[0.35, 0.48, 42]} />
        <meshBasicMaterial color="#ff5c7a" transparent opacity={0.78} />
      </mesh>
      <Text
        position={[target.catchX, 2.65, target.catchZ]}
        fontSize={0.58}
        color="#ff5c7a"
        anchorX="center"
        outlineWidth={0.035}
        outlineColor="#0d1114"
      >
        CAUGHT!
      </Text>
    </group>
  );
}

function WicketCrash() {
  const animation = useGameStore((s) => s.wicketAnimation);
  const ballRef = useRef();
  const stumpRefs = useRef([]);
  const bailRefs = useRef([]);

  useFrame(() => {
    if (!animation) return;
    const elapsed = (performance.now() - animation.createdAt) / 1000;
    const progress = Math.min(1, elapsed / 0.85);
    const impact = Math.min(1, Math.max(0, (elapsed - 0.18) / 0.7));

    if (ballRef.current) {
      ballRef.current.position.set(
        THREE.MathUtils.lerp(animation.ballLine, 0, progress),
        THREE.MathUtils.lerp(0.26, 0.54, progress),
        THREE.MathUtils.lerp(-0.7, 0.08, progress)
      );
      ballRef.current.rotation.x += 0.35;
      ballRef.current.rotation.z += 0.22;
    }

    stumpRefs.current.forEach((stump, index) => {
      if (!stump) return;
      const dir = index - 1;
      stump.position.x = dir * 0.22 + dir * impact * 0.28;
      stump.position.y = 0.45 - impact * 0.18;
      stump.rotation.z = dir * impact * 1.15;
      stump.rotation.x = impact * (index === 1 ? 0.7 : 0.35);
    });
    bailRefs.current.forEach((bail, index) => {
      if (!bail) return;
      bail.position.x = (index ? 0.18 : -0.18) + (index ? 1 : -1) * impact * 0.95;
      bail.position.y = 0.92 + Math.sin(impact * Math.PI) * 0.55 - impact * 0.18;
      bail.position.z = impact * 0.42;
      bail.rotation.z = impact * (index ? 3 : -3);
    });
  });

  if (!animation) return null;

  return (
    <group position={[0, 0, 3.25]}>
      <mesh ref={ballRef} castShadow position={[animation.ballLine, 0.26, -0.7]}>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial color="#d5121f" emissive="#4b0004" emissiveIntensity={0.18} />
      </mesh>
      {[-0.22, 0, 0.22].map((x, index) => (
        <mesh key={x} ref={(node) => { stumpRefs.current[index] = node; }} castShadow position={[x, 0.45, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.9, 12]} />
          <meshStandardMaterial color="#2d2218" />
        </mesh>
      ))}
      {[-0.14, 0.14].map((x, index) => (
        <mesh key={x} ref={(node) => { bailRefs.current[index] = node; }} castShadow position={[x, 0.93, 0]}>
          <boxGeometry args={[0.35, 0.035, 0.05]} />
          <meshStandardMaterial color="#f2dfb0" />
        </mesh>
      ))}
      <Text position={[0, 1.65, 0.2]} fontSize={0.36} color="#ff3b3b" anchorX="center" outlineWidth={0.025} outlineColor="#000">
        BOWLED
      </Text>
    </group>
  );
}

function VirtualBat() {
  const ref = useRef();
  const pose = useGameStore((s) => s.pose);
  const lastSwing = useGameStore((s) => s.lastSwing);

  useFrame(() => {
    if (!ref.current) return;
    const swingPower = lastSwing && performance.now() - lastSwing.at < 500 ? 1 : 0;
    const wristX = pose?.rightWrist?.x ? (0.5 - pose.rightWrist.x) * 1.9 : 0.58;
    ref.current.position.set(wristX, 0.85 + swingPower * 0.22, 3.05);
    ref.current.rotation.set(-0.25 - swingPower * 0.6, 0, -0.42 + wristX * 0.25);
  });

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.18, 1.55, 0.08]} />
        <meshStandardMaterial color="#d6a35b" roughness={0.55} transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, -0.9, 0]}>
        <boxGeometry args={[0.11, 0.55, 0.06]} />
        <meshStandardMaterial color="#252525" />
      </mesh>
    </group>
  );
}

function Fielders() {
  const fielders = useGameStore((s) => s.fielders);
  const notification = useGameStore((s) => s.notification);

  return (
    <group>
      {fielders.map(([x, z], i) => (
        <mesh key={i} castShadow position={[x + (notification ? Math.sin(i) * 0.4 : 0), 0.55, z]}>
          <capsuleGeometry args={[0.22, 0.65, 6, 12]} />
          <meshStandardMaterial color={i === 0 ? '#ffef8a' : i % 2 ? '#f5f5f5' : '#1c6fdb'} />
        </mesh>
      ))}
    </group>
  );
}

function ShotPreview() {
  const shot = useGameStore((s) => s.lastShot);
  if (!shot || shot.shotType === 'BEATEN') return null;
  return (
    <Text position={[0, 2.65, -5.6]} fontSize={0.42} color="#fff" anchorX="center">
      {shot.shotType}  {shot.confidence}%
    </Text>
  );
}

export default function GameScene() {
  return (
    <>
      <CreaseCamera />
      <Environment preset="park" />
      <CricketGround />
      <Bowler />
      <CricketBall />
      <HitBallFlight />
      <CatchOutAnimation />
      <Fielders />
      <ShotPreview />
      <fog attach="fog" args={['#c8e7f8', 40, 95]} />
    </>
  );
}
