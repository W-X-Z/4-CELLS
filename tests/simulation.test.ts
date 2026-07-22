import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/Game';
import { World } from '../src/simulation/World';
import { environmentConfig } from '../src/data/environments';
import { RESOURCE_KEYS } from '../src/simulation/types';

function runWorld(seed: number, ticks: number): World {
  const w = new World(seed, environmentConfig);
  for (let i = 0; i < ticks; i++) w.step(1 / environmentConfig.simRate);
  return w;
}

describe('결정론(시드 재현성)', () => {
  it('같은 시드 -> 같은 결과', () => {
    const a = runWorld(999, 600).snapshot();
    const b = runWorld(999, 600).snapshot();
    expect(a).toEqual(b);
  });

  it('다른 시드 -> 다른 전개', () => {
    const a = runWorld(1, 600).snapshot();
    const b = runWorld(2, 600).snapshot();
    // 개체수 분포나 시간이 완전히 동일할 확률은 사실상 0
    expect(JSON.stringify(a.counts) === JSON.stringify(b.counts) && a.totalCells === b.totalCells).toBe(false);
  });
});

describe('시뮬레이션 건전성', () => {
  it('자원에 NaN/음수가 없다', () => {
    const w = runWorld(42, 800);
    for (const k of RESOURCE_KEYS) {
      expect(Number.isFinite(w.env.resources[k])).toBe(true);
      expect(w.env.resources[k]).toBeGreaterThanOrEqual(0);
    }
  });

  it('초기 4종이 초반(45초)까지 공존한다', () => {
    const w = runWorld(12345, 45 * environmentConfig.simRate);
    const c = w.counts();
    expect(c.photosynth).toBeGreaterThan(0);
    expect(c.decomposer).toBeGreaterThan(0);
    // 소비/포식 중 최소 하나는 생존
    expect(c.consumer + c.predator).toBeGreaterThan(0);
  });

  it('개입이 없으면 결국 붕괴한다(생태계 취약성)', () => {
    const w = runWorld(777, 600 * environmentConfig.simRate); // 최대 600초
    expect(w.gameOver).toBe(true);
  });
});

describe('시체(Corpse) 시스템', () => {
  it('세포가 죽으면 시체가 생기고, 유기물은 전역 자원이 아니다', () => {
    const w = runWorld(2024, 300);
    // 자원 키에 organic이 없다
    expect((RESOURCE_KEYS as readonly string[]).includes('organic')).toBe(false);
    // 300틱(20초)이면 사망이 발생해 시체가 존재
    expect(w.corpses.length).toBeGreaterThan(0);
    for (const co of w.corpses) expect(co.mass).toBeGreaterThan(0);
  });
});

describe('돌연변이(유전자풀) 선택지', () => {
  it('돌연변이 선택지는 유전자풀에 등록되고, 이후 태어난 개체 일부가 발현한다', () => {
    const game = new Game({ seed: 5, autoChoice: () => null });
    game.choices.apply('photo_chloroplast'); // 광합성 효율 돌연변이 등장률 50%
    expect(game.world.genePool.photosynth.length).toBe(1);
    const mutId = game.world.genePool.photosynth[0].id;

    // 여러 세대 진행 -> 신생아가 돌연변이를 발현(carried)해야 한다
    for (let i = 0; i < 400; i++) game.world.step(game.stepDt);
    const carriers = game.world.cells.filter(
      (c) => c.species === 'photosynth' && c.carried?.includes(mutId),
    );
    expect(carriers.length).toBeGreaterThan(0);
  });

  it('상황 가중치: 산소 위기에서 대응 돌연변이가 후보에 들어온다', () => {
    const game = new Game({ seed: 5, autoChoice: () => null });
    game.world.env.resources.oxygen = 100; // 위기 상황 조성
    const choices = game.choices.generate(3);
    expect(choices.length).toBeGreaterThan(0);
  });
});

describe('진화 트리거(분열 기반)', () => {
  it('분열이 누적되면 선택지가 제시된다(시간이 아니라 분열 수)', () => {
    let offered = 0;
    // autoChoice를 주지 않아야 UI 경로(onChoicesReady)로 제시된다
    const game = new Game({ seed: 5, divisionsPerChoice: 20 });
    game.onChoicesReady = () => { offered++; };
    // advance를 여러 번 호출해 분열이 쌓이도록
    for (let i = 0; i < 400 && offered === 0; i++) game.advance(1000 / environmentConfig.simRate);
    expect(game.world.divisions).toBeGreaterThanOrEqual(20);
    expect(offered).toBeGreaterThan(0);
  });

  it('진화 간격이 점진적으로 늘어난다(선형 아님)', () => {
    const game = new Game({ seed: 5, divisionsPerChoice: 40, divisionsGrowth: 30 });
    expect(game.divisionsUntilNext()).toBe(40); // 첫 진화
    game.evolutionCount = 1;
    expect(game.divisionsUntilNext()).toBe(70); // 두 번째는 +30
    game.evolutionCount = 2;
    expect(game.divisionsUntilNext()).toBe(100); // 세 번째는 또 +30
  });
});
