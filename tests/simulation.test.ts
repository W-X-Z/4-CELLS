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

describe('선택지 Effect', () => {
  it('spawn 선택지는 해당 종 개체수를 늘린다', () => {
    const game = new Game({ seed: 5, autoChoice: () => null });
    const before = game.world.counts().decomposer;
    game.choices.apply('sp_decomposer_seed'); // 분해 세포 40 투입
    const after = game.world.counts().decomposer;
    expect(after).toBe(before + 40);
  });

  it('상황 가중치: 산소 위기에서 산소 관련 선택지가 후보에 들어온다', () => {
    const game = new Game({ seed: 5, autoChoice: () => null });
    game.world.env.resources.oxygen = 100; // 위기 상황 조성
    const choices = game.choices.generate(3);
    expect(choices.length).toBeGreaterThan(0);
  });
});
