import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.js';

export default function EffectOverlay() {
  const notification = useGameStore((s) => s.notification);
  const lastBallResult = useGameStore((s) => s.lastBallResult);
  if (!notification) return null;

  const resultText = lastBallResult?.out
    ? 'WICKET'
    : lastBallResult?.runs === 0
      ? 'DOT BALL'
      : `+${lastBallResult?.runs} RUN${lastBallResult?.runs === 1 ? '' : 'S'}`;
  const style = {
    FOUR: 'text-cyan-200 bg-cyan-400/15',
    SIX: 'text-amber-200 bg-amber-300/20',
    OUT: 'text-red-100 bg-red-600/25',
    'PERFECT TIMING': 'text-white bg-white/20'
  }[notification] ?? 'text-white bg-black/10';

  return (
    <motion.div
      key={lastBallResult?.id || notification}
      initial={{ opacity: 0, scale: 0.45, y: 60, rotate: -2 }}
      animate={{
        opacity: 1,
        scale: [0.45, 1.14, 1],
        y: 0,
        rotate: [notification === 'OUT' ? -4 : 2, 0]
      }}
      exit={{ opacity: 0, scale: 1.25, y: -40 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className={`pointer-events-none absolute inset-0 grid place-items-end justify-items-center pb-24 ${notification === 'OUT' ? 'animate-pulse' : ''}`}
    >
      <div className={`min-w-56 rounded-[2rem] px-8 py-4 text-center shadow-2xl backdrop-blur-sm ${style}`}>
        <div className="hud-text font-arcade text-5xl leading-none sm:text-7xl">{resultText}</div>
        <div className="mt-2 font-arcade text-xl text-white sm:text-2xl">{notification}</div>
      </div>
    </motion.div>
  );
}
