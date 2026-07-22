/**
 * 그래픽 없이 시뮬레이션만 구동하는 밸런스 테스트 러너.
 *   npm run sim -- <seed> <seconds> <strategy>
 *   strategy: none | random | crisis(기본)
 *
 * 진화 트리거는 시간이 아니라 누적 분열 수(world.divisions) 기반.
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
  // crisis: 개체수가 적은 종을 돕는 돌연변이를 선호
  const s = world.snapshot();
  const scoreChoice = (c: ChoiceDef): number => {
    let sc = 0;
    for (const e of c.effects) {
      if (e.kind !== 'mutation') continue;
      const scarce = s.counts[e.species] < 30 ? 3 : 1;
      const help = Math.abs(e.value - 1); // 배율이 1에서 멀수록 강한 형질
      sc += scarce * help * e.rate;
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

const game = new Game({ seed, autoChoice: pick });

const simRate = game.world.cfg.simRate;
const totalTicks = seconds * simRate;
let lastReport = 0;
let lastChoiceDivisions = 0;
let evoCount = 0;

while (!game.world.gameOver && game.world.tick < totalTicks) {
  // 헤드리스: advance 대신 직접 스텝(속도 배수 무의미)
  game.world.step(game.stepDt);
  // 진화 트리거: 누적 분열 수 기반(진화가 진행될수록 간격이 점진적으로 늘어남)
  const gap = game.divisionsPerChoice + game.divisionsGrowth * evoCount;
  if (game.world.divisions - lastChoiceDivisions >= gap) {
    lastChoiceDivisions = game.world.divisions;
    const choices = game.choices.generate(3);
    if (choices.length) {
      evoCount++;
      const id = pick(choices, game.world);
      if (id) game.choices.apply(id);
    }
  }
  if (game.world.time - lastReport >= 15) {
    lastReport = game.world.time;
    const s = game.world.snapshot();
    console.log(
      `t=${s.time.toFixed(0)}s cells=${s.totalCells} ` +
        `[광합성 ${s.counts.photosynth} 소비 ${s.counts.consumer} 포식 ${s.counts.predator} 분해 ${s.counts.decomposer}] ` +
        `O2=${s.resources.oxygen.toFixed(0)} CO2=${s.resources.co2.toFixed(0)} ` +
        `시체=${s.corpseCount} 독성=${s.resources.toxicity.toFixed(0)} ` +
        `분열=${s.divisions} 점수=${s.score}`,
    );
  }
}

const final = game.world.snapshot();
console.log('\n=== 종료 ===');
console.log(`시드 ${seed} / 생존 ${final.time.toFixed(1)}s / 최종 개체수 ${final.totalCells} / 누적분열 ${final.divisions} / 점수 ${final.score}`);
console.log(game.world.gameOver ? '결과: 전멸(게임오버)' : '결과: 시간 만료까지 생존');
