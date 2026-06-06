import { create } from 'zustand';
import { classifyShot, calculateRuns, randomDelivery } from '../utils/shotEngine.js';
import { playGameSound } from '../utils/audio.js';
import { getCommentary } from '../services/ai/commentaryService.js';
import { getOverNarration } from '../services/ai/narratorService.js';
import { analyzeSwingWithAI } from '../services/ai/visionSwingService.js';

const initialDelivery = randomDelivery();
let nextDeliveryTimer = null;
let clearHitTimer = null;
let clearNoticeTimer = null;
let clearSummaryTimer = null;
let clearWicketTimer = null;
let clearCatchTimer = null;

function clearTimer(timer) {
  if (timer) window.clearTimeout(timer);
}

function clearScheduledTimers() {
  clearTimer(nextDeliveryTimer);
  clearTimer(clearHitTimer);
  clearTimer(clearNoticeTimer);
  clearTimer(clearSummaryTimer);
  clearTimer(clearWicketTimer);
  clearTimer(clearCatchTimer);
  nextDeliveryTimer = null;
  clearHitTimer = null;
  clearNoticeTimer = null;
  clearSummaryTimer = null;
  clearWicketTimer = null;
  clearCatchTimer = null;
}

export const useGameStore = create((set, get) => ({
  runs: 0,
  wickets: 0,
  balls: 0,
  ballsLeft: 107,
  target: 156,
  strikeRate: 0,
  delivery: initialDelivery,
  deliveryStartedAt: null,
  ballPhase: 'idle',
  bowlerPhase: 'idle',
  lastSwing: null,
  lastShot: null,
  hitAnimation: null,
  wicketAnimation: null,
  catchAnimation: null,
  fieldShot: null,
  lastBallResult: null,
  currentOverBalls: [],
  overSummary: null,
  notification: null,
  commentary: 'Take guard. Watch the wrist, pick the length, and swing.',
  narration: '',
  visionInsight: null,
  timingFeedback: null,
  soundOn: true,
  pose: null,
  fielders: [
    [0, 4.8],
    [-18, -6],
    [18, -6],
    [-12, -20],
    [12, -20],
    [0, -34],
    [-30, 8]
  ],
  setPose: (pose) => set({ pose }),
  setSoundOn: (soundOn) => set({ soundOn }),
  setDeliveryStartedAt: (deliveryStartedAt) => set({ deliveryStartedAt }),
  startDelivery: () => {
    clearTimer(nextDeliveryTimer);
    nextDeliveryTimer = null;
    const delivery = randomDelivery();
    const dynamicFielders = [
      [0, 4.8],
      [-16 - Math.random() * 5, -5 - Math.random() * 6],
      [16 + Math.random() * 5, -5 - Math.random() * 6],
      [-10 - Math.random() * 7, -18 - Math.random() * 8],
      [10 + Math.random() * 7, -18 - Math.random() * 8],
      [(Math.random() - 0.5) * 10, -32 - Math.random() * 5],
      [Math.random() > 0.5 ? -30 : 30, 4 + Math.random() * 10]
    ];
    set({ delivery, fielders: dynamicFielders, deliveryStartedAt: performance.now(), ballPhase: 'bowling', bowlerPhase: 'runup', lastSwing: null, lastShot: null });
  },
  registerSwing: (swing) => {
    if (!swing.swingDetected) return;
    const at = performance.now();
    const { delivery, runs, wickets, balls, deliveryStartedAt } = get();
    const idealAt = deliveryStartedAt ? deliveryStartedAt + ((22.05 / Math.max(1, delivery.speed)) * 1000) : at;
    const timingMs = Math.round(at - idealAt);
    const timingQuality = Math.abs(timingMs) <= 150 ? 'perfect' : timingMs < -150 ? 'early' : 'late';
    const localSwing = { ...swing, at, aiPending: true, timingMs, timingQuality };
    set({
      lastSwing: localSwing,
      timingFeedback: {
        id: crypto.randomUUID(),
        timingMs,
        timingQuality,
        label: timingQuality === 'perfect' ? 'PERFECT' : timingQuality.toUpperCase()
      },
      visionInsight: {
        aiEnhanced: false,
        aiPending: true,
        timingHint: 'Analyzing swing...',
        confidence: 0
      }
    });

    analyzeSwingWithAI({ swing: localSwing, delivery, score: `${runs}-${wickets} (${balls})` }).then((analysis) => {
      const latest = get().lastSwing;
      if (!latest || latest.at !== at) return;
      set({
        lastSwing: {
          ...latest,
          aiPending: false,
          aiEnhanced: analysis.aiEnhanced,
          swingStrength: analysis.swingStrength,
          shotIntent: analysis.shotIntent,
          aiConfidence: analysis.confidence,
          batLane: analysis.batLaneOffset
        },
        visionInsight: {
          ...analysis,
          aiPending: false
        }
      });
    });
  },
  resolveBall: async ({ contact, impact, missedBy }) => {
    const state = get();
    if (state.ballPhase === 'resolved') return;

    const shot = contact
      ? classifyShot({ ...impact, swing: state.lastSwing })
      : { shotType: 'BEATEN', confidence: 0, quality: 'miss' };
    const powerZone = contact && Math.abs((impact?.ballLine ?? 0) - (impact?.batLane ?? 0)) < 0.42;
    const result = calculateRuns({ contact, shot, swing: state.lastSwing, missedBy, powerZone });
    const balls = state.balls + 1;
    const runs = state.runs + result.runs;
    const wickets = state.wickets + (result.out ? 1 : 0);
    const strikeRate = balls ? Math.round((runs / balls) * 100) : 0;
    const ballInOver = ((balls - 1) % 6) + 1;
    const ballResult = {
      id: crypto.randomUUID(),
      ballInOver,
      runs: result.runs,
      out: result.out,
      label: result.label,
      shotType: shot.shotType,
      pace: state.delivery.pace
    };
    const overBalls = [...state.currentOverBalls, ballResult].slice(-6);
    const overComplete = balls % 6 === 0;
    const overRuns = overBalls.reduce((total, ball) => total + ball.runs, 0);
    const overWickets = overBalls.filter((ball) => ball.out).length;
    const boundaries = overBalls.filter((ball) => ball.runs === 4).length;
    const sixes = overBalls.filter((ball) => ball.runs === 6).length;

    set({
      runs,
      wickets,
      balls,
      ballsLeft: Math.max(0, state.ballsLeft - 1),
      strikeRate,
      ballPhase: 'resolved',
      bowlerPhase: 'reset',
      lastShot: shot,
      lastBallResult: ballResult,
      currentOverBalls: overComplete ? [] : overBalls,
      overSummary: overComplete
        ? {
            id: crypto.randomUUID(),
            over: Math.floor(balls / 6),
            score: `${runs}-${wickets}`,
            runs: overRuns,
            wickets: overWickets,
            boundaries,
            sixes,
            balls: overBalls
          }
        : null,
      hitAnimation: contact && result.wicketKind !== 'CATCH'
        ? {
            id: crypto.randomUUID(),
            createdAt: performance.now(),
            result,
            shot,
            swing: state.lastSwing,
            impact
          }
        : null,
      catchAnimation: result.out && result.wicketKind === 'CATCH'
        ? {
            id: crypto.randomUUID(),
            createdAt: performance.now(),
            result,
            shot,
            swing: state.lastSwing,
            impact,
            fielders: state.fielders
          }
        : null,
      wicketAnimation: result.out && result.wicketKind === 'BOWLED'
        ? {
            id: crypto.randomUUID(),
            createdAt: performance.now(),
            ballLine: missedBy ?? 0,
            delivery: state.delivery
          }
        : null,
      fieldShot: contact
        ? {
            id: crypto.randomUUID(),
            createdAt: performance.now(),
            result,
            shot,
            swing: state.lastSwing,
            impact
          }
        : state.fieldShot,
      notification: result.label,
      commentary: '...'
    });

    playGameSound(result.sound, state.soundOn);
    getCommentary({ score: `${runs}-${wickets}`, shot, result }).then((commentary) => set({ commentary }));

    if (overComplete) {
      getOverNarration({ runs, wickets, balls, recent: result.label }).then((narration) => {
        set((latest) => ({
          narration,
          overSummary: latest.overSummary ? { ...latest.overSummary, narration } : latest.overSummary
        }));
      });
    }

    clearScheduledTimers();
    clearNoticeTimer = window.setTimeout(() => set({ notification: null, bowlerPhase: 'idle' }), 1800);
    clearHitTimer = window.setTimeout(() => set({ hitAnimation: null }), 3800);
    clearWicketTimer = window.setTimeout(() => set({ wicketAnimation: null }), 3400);
    clearCatchTimer = window.setTimeout(() => set({ catchAnimation: null }), 3800);
    if (overComplete) {
      clearSummaryTimer = window.setTimeout(() => set({ overSummary: null }), 5200);
      nextDeliveryTimer = window.setTimeout(() => get().startDelivery(), 5600);
    } else {
      nextDeliveryTimer = window.setTimeout(() => get().startDelivery(), 3900);
    }
  },
  restart: () => {
    clearScheduledTimers();
    set({
      runs: 0,
      wickets: 0,
      balls: 0,
      ballsLeft: 107,
      strikeRate: 0,
      ballPhase: 'idle',
      bowlerPhase: 'idle',
      delivery: randomDelivery(),
      deliveryStartedAt: null,
      lastSwing: null,
      lastShot: null,
      hitAnimation: null,
      wicketAnimation: null,
      catchAnimation: null,
      fieldShot: null,
      lastBallResult: null,
      currentOverBalls: [],
      overSummary: null,
      notification: null,
      commentary: 'Fresh innings. The bowler has the ball.',
      narration: '',
      visionInsight: null,
      timingFeedback: null
    });
    nextDeliveryTimer = window.setTimeout(() => get().startDelivery(), 500);
  }
}));
