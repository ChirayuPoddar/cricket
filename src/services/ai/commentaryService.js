import { generateWithGemini } from './aiProvider.js';

const fallbackLines = [
  'What a magnificent cover drive!',
  'Straight through the line and racing away.',
  'The bowler asks the question, but the batter survives.',
  'That is arcade cricket at full volume.',
  'Timed beautifully, the fielders barely moved.'
];

export function getCommentary({ score, shot, result }) {
  return generateWithGemini(
    `Write one short energetic cricket commentary line for score ${score}. Shot: ${shot.shotType}. Result: ${result.label}. Max 14 words.`,
    () => fallbackLines[Math.floor(Math.random() * fallbackLines.length)]
  );
}
