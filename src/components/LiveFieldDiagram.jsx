import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.js';

function mapPoint([x, z]) {
  return {
    x: 50 + x * 0.88,
    y: 50 + (z + 11) * 0.88
  };
}

function latestShotPath(animation) {
  if (!animation) return null;
  const [dx = 0, dy = -0.2] = animation.swing?.gestureDirection ?? animation.swing?.direction ?? [];
  const side = dx >= 0 ? 'OFF SIDE' : 'LEG SIDE';
  const endX = 50 + Math.max(-34, Math.min(34, dx * 34));
  const runs = animation.result?.runs ?? 1;
  const behind = dy > 0.2;
  const endY = behind ? 78 : runs >= 4 ? 16 : 26;
  return { side: behind ? 'BEHIND' : side, endX, endY, color: behind ? '#f472b6' : dx >= 0 ? '#35e7ff' : '#ffcf4a' };
}

export default function LiveFieldDiagram() {
  const fielders = useGameStore((s) => s.fielders);
  const hitAnimation = useGameStore((s) => s.hitAnimation);
  const fieldShot = useGameStore((s) => s.fieldShot);
  const activeShot = hitAnimation || fieldShot;
  const path = latestShotPath(activeShot);

  return (
    <div className="absolute right-4 top-20 h-32 w-32 sm:right-7 sm:top-20 sm:h-40 sm:w-40">
      <div className="glass-pill relative h-full w-full rounded-full p-2">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="47" fill="rgba(14,18,21,.72)" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
          <path d="M50 50 L28 20 A38 38 0 0 1 72 20 Z" fill="rgba(44,229,255,.22)" />
          <path d="M50 50 L27 75 A38 38 0 0 0 73 75 Z" fill="rgba(255,205,74,.16)" />
          <line x1="50" y1="26" x2="50" y2="75" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
          <rect x="46" y="42" width="8" height="22" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
          <circle cx="50" cy="64" r="2.8" fill="#25d9ff" />
          {fielders.map((fielder, index) => {
            const point = mapPoint(fielder);
            return (
              <motion.circle
                key={index}
                animate={{ cx: point.x, cy: point.y }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                r={index === 0 ? 3 : 2.5}
                fill={index === 0 ? '#ffef8a' : 'rgba(255,255,255,.82)'}
              />
            );
          })}
          {path && (
            <motion.g key={activeShot.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.path
                d={`M50 64 Q50 40 ${path.endX} ${path.endY}`}
                fill="none"
                stroke={path.color}
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
              <motion.circle
                cx={path.endX}
                cy={path.endY}
                r="4"
                fill={path.color}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.25, 1] }}
                transition={{ duration: 0.55 }}
              />
            </motion.g>
          )}
        </svg>
        <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[9px] font-black tracking-wide text-cyan-100">OFF</div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-wide text-amber-100">LEG</div>
        {path && (
          <motion.div
            key={activeShot.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="hud-text absolute -bottom-6 left-1/2 w-32 -translate-x-1/2 text-center font-arcade text-sm"
            style={{ color: path.color }}
          >
            {path.side}
          </motion.div>
        )}
      </div>
    </div>
  );
}
