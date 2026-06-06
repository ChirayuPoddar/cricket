import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.js';

function ballText(ball) {
  if (ball.out) return 'W';
  if (ball.runs === 0) return '0';
  return String(ball.runs);
}

export default function OverSummaryOverlay() {
  const summary = useGameStore((s) => s.overSummary);
  if (!summary) return null;

  return (
    <motion.div
      key={summary.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/42 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ scale: 0.86, y: 34 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 1.05, y: -20 }}
        transition={{ type: 'spring', stiffness: 230, damping: 20 }}
        className="w-[min(620px,88vw)] rounded-[2rem] border border-white/20 bg-black/82 px-7 py-6 text-center shadow-2xl"
      >
        <div className="font-arcade text-xl tracking-wide text-cyan-200">OVER {summary.over} COMPLETE</div>
        <div className="hud-text mt-2 font-arcade text-6xl leading-none text-white sm:text-7xl">
          {summary.runs}/{summary.wickets}
        </div>
        <div className="mt-1 text-sm font-black uppercase tracking-[0.24em] text-white/70">This Over</div>

        <div className="mt-5 flex justify-center gap-2">
          {summary.balls.map((ball) => (
            <div
              key={ball.id}
              className={`grid h-12 w-12 place-items-center rounded-full border text-xl font-black shadow-lg ${
                ball.out
                  ? 'border-red-300 bg-red-600 text-white'
                  : ball.runs >= 4
                    ? 'border-amber-200 bg-amber-300 text-black'
                    : 'border-white/25 bg-white/12 text-white'
              }`}
            >
              {ballText(ball)}
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-white">
          <SummaryStat label="FOURS" value={summary.boundaries} />
          <SummaryStat label="SIXES" value={summary.sixes} />
          <SummaryStat label="SCORE" value={summary.score} />
        </div>

        <div className="mt-5 min-h-6 text-base font-semibold text-white/85">
          {summary.narration || 'The bowler walks back. The batter resets at the crease.'}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3">
      <div className="font-arcade text-2xl text-white">{value}</div>
      <div className="mt-1 text-[10px] font-black tracking-widest text-white/55">{label}</div>
    </div>
  );
}
