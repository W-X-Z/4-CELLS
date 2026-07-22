import { eff } from '../genetics';
import type { World } from '../World';

/**
 * 사망 시스템: 아사(에너지 0)·수명·독성 피해로 사망 처리.
 * 사망 세포는 유기물/독성을 담은 "시체(Corpse)"를 남긴다 -> 자원 순환의 마지막 고리.
 * 독성은 즉시 풀에 더해지지 않고, 시체가 방치되어 부패할 때 서서히 방출된다.
 */
export function runDeath(world: World, dt: number): void {
  const { cells, env } = world;
  const toxicity = env.resources.toxicity;

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const def = world.species[c.species];

    // 이미 포식으로 죽은 세포: 포식자가 절반을 섭취했다고 보고 축소된 시체를 남긴다.
    if (!c.alive) {
      world.spawnCorpse(c.x, c.y, def.corpseOrganic * 0.5, def.corpseToxicity);
      continue;
    }

    // 독성 피해
    const tolerance = eff(def, c, 'toxicityTolerance');
    if (toxicity > tolerance) {
      const overflow = (toxicity - tolerance) / tolerance;
      c.energy -= overflow * 6 * dt;
    }

    // 사망 조건
    if (c.energy <= 0 || c.age >= eff(def, c, 'lifespan')) {
      c.alive = false;
      world.spawnCorpse(c.x, c.y, def.corpseOrganic, def.corpseToxicity);
    }
  }
}
