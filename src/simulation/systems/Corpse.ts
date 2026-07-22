import type { World } from '../World';
import { CORPSE_CO2_PER_MASS } from './Scavenging';

/**
 * 시체 부패 시스템: 방치된 시체는 서서히 질량을 잃으며 잠재 독성을 전역 풀로 방출한다.
 * => 분해 세포가 시체를 제때 처리하지 못하면 독성이 폭증하는 압력이 생긴다.
 * (섭식으로 사라진 질량은 Scavenging에서 독성이 이미 중화되었으므로 여기서 방출되지 않는다.)
 */
export function runCorpseDecay(world: World, dt: number): void {
  const { corpses, env, cfg } = world;
  const rot = cfg.corpseRotRate * dt;
  if (rot <= 0) return;

  for (let i = 0; i < corpses.length; i++) {
    const co = corpses[i];
    if (co.mass <= 0) continue;
    const lost = Math.min(co.mass, rot);
    const ratio = co.mass > 0 ? lost / co.mass : 0;
    const toxReleased = co.tox * ratio;
    co.mass -= lost;
    co.tox -= toxReleased;
    if (toxReleased > 0) env.add('toxicity', toxReleased);
    // 부패도 탄소를 CO₂로 되돌린다(분해 세포가 못 먹고 방치된 몫)
    env.add('co2', lost * CORPSE_CO2_PER_MASS);
  }
}
