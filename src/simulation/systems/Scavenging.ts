import { dist2 } from '../../core/math';
import { eff } from '../genetics';
import type { World } from '../World';

const neighbors: number[] = [];

/** 시체 질량 1을 대사할 때 풀로 되돌리는 CO₂ 양 (탄소 순환 복귀) */
export const CORPSE_CO2_PER_MASS = 0.3;

/**
 * 시체 섭식 시스템: corpseAppetite가 있는 세포(소비/분해)가 근접한 시체에서 유기물을 먹는다.
 * 분해 세포가 시체를 먹어치우면 그만큼 부패 독성이 방출되지 않으므로, 청소부 역할을 한다.
 */
export function runScavenging(world: World, dt: number): void {
  const { cells, env } = world;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];
    if (def.corpseAppetite <= 0) continue;
    if (c.eatTimer > 0) continue; // 소화 중(배부름)
    const maxE = eff(def, c, 'maxEnergy');
    if (c.energy >= maxE * 0.95) continue; // 거의 배부르면 섭식 안 함

    const reach = def.radius + 12;
    world.corpseHash.query(c.x, c.y, reach, neighbors);

    // 가장 가까운 유효 시체 하나를 먹는다(틱당 1개)
    let best = -1;
    let bestD = reach * reach;
    for (let n = 0; n < neighbors.length; n++) {
      const idx = neighbors[n];
      const co = world.corpses[idx];
      if (!co || co.mass <= 0) continue;
      const rSum = def.radius + corpseRadius(co.mass) + 4;
      const d = dist2(c.x, c.y, co.x, co.y);
      if (d <= rSum * rSum && d < bestD) {
        bestD = d;
        best = idx;
      }
    }
    if (best < 0) continue;

    const co = world.corpses[best];
    const eat = Math.min(co.mass, def.corpseAppetite * dt);
    const ratio = co.mass > 0 ? eat / co.mass : 0;
    // 먹은 만큼의 잠재 독성은 방출되지 않고 중화된다(청소).
    co.tox -= co.tox * ratio;
    co.mass -= eat;
    co.flash = 1;

    const energyFromCorpse = eff(def, c, 'energyFromCorpse');
    c.energy = Math.min(maxE, c.energy + eat * energyFromCorpse);
    if (def.eatCooldown > 0) c.eatTimer = def.eatCooldown;
    c.flash = Math.max(c.flash, 0.7);
    env.add('heat', eat * energyFromCorpse * dt * 0.1);
    // 분해: 시체(고정된 탄소)를 대사하며 CO₂를 되돌린다 → 탄소 순환을 닫는다
    env.add('co2', eat * CORPSE_CO2_PER_MASS);
    world.pushEvent({ type: 'decompose', x: co.x, y: co.y });
  }
}

/** 시체 질량 -> 시각/충돌 반경 (렌더러와 동일 공식) */
export function corpseRadius(mass: number): number {
  return 2 + Math.sqrt(Math.max(0, mass)) * 1.1;
}
