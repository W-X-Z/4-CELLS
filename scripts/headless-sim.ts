/**
 * 그래픽 없이 시뮬레이션만 구동하는 밸런스 테스트 러너.
 *   npm run sim -- <seed> <seconds> <strategy>
 *   strategy: none | random | crisis(기본)
 */
import { Game } from '../src/game/Game';
import type { ChoiceDef } from '../src/rules/types';
import type { World } from '../src/simulation/World';

const seed = Number(process.argv[2] ?? 12345);
const seconds = Number(process.argv[3] ?? 180);
const strategy = (process.argv[4] ?? 'crisis') as 'none' | 'random' | 'crisis';

function pick(choices: ChoiceDef[], world: World): string | null {
  if (choices.length === 0) return null;
  if (strategy === 'none') return null;
  if (strategy === 'random') return choices[world.rng.int(0, choices.length - 1)].id;
  // crisis: 위기 대응 우선 — 가장 부족한 종/자원을 돕는 선택지 선호
  const s = world.snapshot();
  const scoreChoice = (c: ChoiceDef): number => {
    let sc = 0;
    for (const e of c.effects) {
      if (e.kind === 'spawn') sc += (s.counts[e.species] < 30 ? 5 : 1) * e.count * 0.1;
      if (e.kind === 'resource' && e.op === 'add') sc += e.value * 0.002;
      if (e.kind === 'resource' && e.key === 'toxicity' && e.op === 'mul') sc += s.resources.toxicity > 300 ? 5 : 0;
    }
    return sc;
  };
  let best = choices[0];
  let bestScore = -Infinity;
  for (const c of choices) {
    const sc = scoreChoice(c);
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  return best.id;
}

const game = new Game({ seed, choiceInterval: 18, autoChoice: pick });

const simRate = game.world.cfg.simRate;
const totalTicks = seconds * simRate;
let lastReport = 0;

while (!game.world.gameOver && game.world.tick < totalTicks) {
  // 헤드리스: advance 대신 직접 스텝(속도 배수 무의미)
  game.world.step(game.stepDt);
  // 선택지 타이밍 수동 처리
  if (game.world.tick % Math.round(game.choices.interval * simRate) === 0 && game.world.tick > 0) {
    const choices = game.choices.generate(3);
    const id = pick(choices, game.world);
    if (id) game.choices.apply(id);
  }
  if (game.world.time - lastReport >= 15) {
    lastReport = game.world.time;
    const s = game.world.snapshot();
    console.log(
      `t=${s.time.toFixed(0)}s cells=${s.totalCells} ` +
        `[광합성 ${s.counts.photosynth} 소비 ${s.counts.consumer} 포식 ${s.counts.predator} 분해 ${s.counts.decomposer}] ` +
        `O2=${s.resources.oxygen.toFixed(0)} CO2=${s.resources.co2.toFixed(0)} ` +
        `유기물=${s.resources.organic.toFixed(0)} 독성=${s.resources.toxicity.toFixed(0)} ` +
        `점수=${s.score}`,
    );
  }
}

const final = game.world.snapshot();
console.log('\n=== 종료 ===');
console.log(`시드 ${seed} / 생존 ${final.time.toFixed(1)}s / 최종 개체수 ${final.totalCells} / 점수 ${final.score}`);
console.log(game.world.gameOver ? '결과: 전멸(게임오버)' : '결과: 시간 만료까지 생존');
