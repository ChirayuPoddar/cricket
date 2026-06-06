import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { AnimatePresence } from 'framer-motion';
import GameScene from '../components/GameScene.jsx';
import HUD from '../components/HUD.jsx';
import WebcamOverlay from '../components/WebcamOverlay.jsx';
import EffectOverlay from '../components/EffectOverlay.jsx';
import CommentaryTicker from '../components/CommentaryTicker.jsx';
import OverSummaryOverlay from '../components/OverSummaryOverlay.jsx';
import { useKeyboardSwing } from '../hooks/useKeyboardSwing.js';

export default function GamePage() {
  useKeyboardSwing();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-sky-300">
      <KeyboardControls map={[{ name: 'swing', keys: ['Space'] }]}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 1.62, 5.2], fov: 58, near: 0.1, far: 140 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <GameScene />
        </Canvas>
      </KeyboardControls>
      <HUD />
      <WebcamOverlay />
      <CommentaryTicker />
      <AnimatePresence>
        <EffectOverlay />
      </AnimatePresence>
      <AnimatePresence>
        <OverSummaryOverlay />
      </AnimatePresence>
    </main>
  );
}
