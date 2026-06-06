import Webcam from 'react-webcam';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';

export default function WebcamOverlay() {
  const webcamRef = useRef(null);
  const detectorRef = useRef(null);
  const [ready, setReady] = useState(false);
  const setPose = useGameStore((s) => s.setPose);
  const registerSwing = useGameStore((s) => s.registerSwing);

  useEffect(() => {
    const video = webcamRef.current?.video;
    if (!ready || !video || detectorRef.current) return;
    let cancelled = false;
    import('../services/PoseDetector.js').then(({ default: PoseDetector }) => {
      if (cancelled) return;
      detectorRef.current = new PoseDetector(video, setPose, registerSwing);
      detectorRef.current.start();
    });
    return () => {
      cancelled = true;
      detectorRef.current?.stop();
      detectorRef.current = null;
    };
  }, [ready, registerSwing, setPose]);

  return (
    <div className="absolute bottom-5 left-5 w-[15vw] min-w-36 max-w-56 overflow-hidden rounded-2xl border border-white/30 bg-black/70 shadow-2xl">
      <Webcam
        ref={webcamRef}
        audio={false}
        mirrored
        videoConstraints={{ width: 320, height: 240, facingMode: 'user' }}
        onUserMedia={() => setReady(true)}
        className="aspect-[4/3] h-full w-full object-cover opacity-90"
      />
      <div className="absolute bottom-1 left-2 text-[10px] font-bold uppercase tracking-wide text-white/75">
        Pose Bat
      </div>
    </div>
  );
}
