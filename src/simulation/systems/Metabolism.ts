import type { World } from '../World';
import { RESOURCE_KEYS, type ResourceKey } from '../types';

/**
 * 대사 시스템: 자원 소비/생산 및 에너지 수지.
 * 확보 비율(satisfaction)이 생산량과 에너지 획득에 함께 곱해져
 * 자원이 마르면 생산도 함께 줄어드는 연쇄가 발생한다.
 */
export function runMetabolism(world: World, dt: number): void {
  const { cells, env } = world;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];

    // 1) 확보 비율 = 모든 intake 자원 중 가장 부족한 것에 의해 제한
    let satisfaction = 1;
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (!amt) continue;
      const avail = env.resources[key];
      const requested = amt * dt;
      const ratio = requested > 0 ? Math.min(1, avail / requested) : 1;
      if (ratio < satisfaction) satisfaction = ratio;
    }

    // 2) 실제 소비
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (!amt) continue;
      env.consume(key as ResourceKey, amt * dt * satisfaction);
    }

    // 3) 생산(확보 비율에 비례)
    for (const key of RESOURCE_KEYS) {
      const amt = def.output[key];
      if (!amt) continue;
      env.add(key as ResourceKey, amt * dt * satisfaction);
    }

    // 4) 대사열 발생
    env.add('heat', def.energyFromIntake * satisfaction * dt * 0.15);

    // 5) 에너지 수지 (열 과잉 시 기초대사 증가)
    const heatPenalty = 1 + Math.max(0, env.resources.heat - 600) / 1200;
    c.energy += def.energyFromIntake * satisfaction * dt;
    c.energy -= def.upkeep * heatPenalty * dt;
    if (c.energy > def.maxEnergy) c.energy = def.maxEnergy;
  }
}
