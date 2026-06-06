import { RotateCcw, Settings, Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '../stores/gameStore.js';
import { oversFromBalls } from '../utils/shotEngine.js';
import LiveFieldDiagram from './LiveFieldDiagram.jsx';

export default function HUD() {
  const { runs, wickets, balls, ballsLeft, delivery, soundOn, setSoundOn, restart, currentOverBalls, visionInsight } = useGameStore();

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-5 top-5 flex items-start gap-4 sm:left-7 sm:top-7">
        <div className="glass-pill rounded-[1.7rem] px-5 py-4">
          <div className="hud-text font-arcade text-5xl leading-none tracking-normal text-white sm:text-7xl">
            {runs}-{wickets}
          </div>
          <div className="hud-text mt-1 font-arcade text-2xl text-white sm:text-4xl">({oversFromBalls(balls)})</div>
          <div className="mt-3 flex min-h-7 gap-1.5">
            {Array.from({ length: 6 }).map((_, index) => {
              const ball = currentOverBalls[index];
              return (
                <span
                  key={ball?.id || index}
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                    ball?.out
                      ? 'bg-red-600 text-white'
                      : ball?.runs >= 4
                        ? 'bg-amber-300 text-black'
                        : ball
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-white/35'
                  }`}
                >
                  {ball ? (ball.out ? 'W' : ball.runs) : '-'}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 top-4 -translate-x-1/2 text-center sm:top-6">
        <div className="glass-pill flex min-w-52 items-center justify-center gap-3 rounded-full px-5 py-3">
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.2)]" />
          <span className="hud-text font-arcade text-3xl">{delivery.pace}</span>
        </div>
        <div className="mt-2 font-arcade text-lg text-white/95">BALLS LEFT</div>
        <div className="hud-text -mt-2 font-arcade text-7xl leading-none text-cyan-300 sm:text-8xl">{ballsLeft}</div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-5 flex gap-2 sm:right-7 sm:top-7">
        <IconButton label="Settings">
          <Settings size={22} />
        </IconButton>
        <IconButton label={soundOn ? 'Mute sound' : 'Enable sound'} onClick={() => setSoundOn(!soundOn)}>
          {soundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </IconButton>
        <IconButton label="Restart" onClick={restart}>
          <RotateCcw size={22} />
        </IconButton>
      </div>

      <LiveFieldDiagram />

      {visionInsight && (
        <div className="absolute bottom-24 left-1/2 w-[min(440px,62vw)] -translate-x-1/2 rounded-full bg-black/75 px-5 py-2.5 text-center text-xs font-black uppercase tracking-wide text-white backdrop-blur-md border border-white/10 shadow-lg sm:text-sm transition-all duration-300">
          {visionInsight.aiPending ? (
            <div className="flex items-center justify-center gap-2 text-cyan-300 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>AI analysing swing...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className={visionInsight.aiEnhanced ? 'text-amber-400' : 'text-slate-400'}>
                {visionInsight.aiEnhanced ? '✨ AI CV' : 'CV'}
              </span>
              <span className="text-white/40">|</span>
              <span className="text-white">{visionInsight.shotIntent || 'TRACKING'}</span>
              <span className="text-white/40">·</span>
              <span className="text-cyan-300">{visionInsight.swingStrength || 'reading'}</span>
              <span className="text-white/40">·</span>
              <span className="text-emerald-400">{visionInsight.confidence || 0}% Acc</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconButton({ children, label, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black"
    >
      {children}
    </button>
  );
}
