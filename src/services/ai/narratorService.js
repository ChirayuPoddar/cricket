import { generateWithGemini } from './aiProvider.js';

export function getOverNarration({ runs, wickets, balls, recent }) {
  return generateWithGemini(
    `Write one compact over summary for an arcade cricket game. Runs ${runs}, wickets ${wickets}, balls ${balls}, recent event ${recent}. Max 18 words.`,
    () => `Over complete: ${runs}-${wickets}. The batter is ${recent === 'SIX' ? 'surging' : 'settling'} into the chase.`
  );
}
