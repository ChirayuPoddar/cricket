import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore.js';

export function useKeyboardSwing() {
  useEffect(() => {
    const onKeyDown = (event) => {
      const softCatchTest = event.key.toLowerCase() === 'c';
      if (event.code !== 'Space' && !softCatchTest) return;
      const lateral = event.altKey ? -0.78 : event.metaKey || event.ctrlKey ? 0.78 : Math.random() - 0.5;
      const behind = event.shiftKey && (event.altKey || event.metaKey || event.ctrlKey);
      const direction = [lateral, behind ? 0.22 : -0.22];
      const magnitude = Math.max(0.001, Math.hypot(direction[0], direction[1]));
      useGameStore.getState().registerSwing({
        swingDetected: true,
        swingStrength: softCatchTest ? 'light' : event.shiftKey ? 'power' : 'medium',
        velocity: softCatchTest ? 0.0028 : event.shiftKey ? 0.007 : 0.0045,
        acceleration: softCatchTest ? 0.00035 : event.shiftKey ? 0.0016 : 0.0008,
        displacement: softCatchTest ? 0.09 : 0.2,
        direction,
        gestureDirection: [direction[0] / magnitude, direction[1] / magnitude],
        shotAngle: Math.atan2(direction[1], direction[0] || 0.001),
        batLane: 0,
        batAngle: -0.35,
        forceCatch: softCatchTest
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
