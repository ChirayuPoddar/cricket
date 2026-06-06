import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.js';

export default function CommentaryTicker() {
  const commentary = useGameStore((s) => s.commentary);
  const narration = useGameStore((s) => s.narration);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none absolute bottom-6 left-1/2 w-[min(620px,58vw)] -translate-x-1/2 rounded-full bg-black/60 px-5 py-3 text-center text-sm font-semibold text-white shadow-xl backdrop-blur sm:text-base"
    >
      {narration || commentary}
    </motion.div>
  );
}
