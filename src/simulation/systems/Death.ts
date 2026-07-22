import { eff } from '../genetics';
import type { World } from '../World';

/**
 * 사망 시스템: 에너지가 0이 되면 사망 (수명 없음 — 에너지가 남아 있으면 계속 생존).
 * 독성이 내성을 넘으면 초당 에너지 피해 → 결국 아사로 이어진다.
 * 사망 세포는 유기물/독성을 담은 시체를 남긴다.
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

    // 독성 피해 (내성 초과분에 비례해 에너지 감소)
    const tolerance = eff(def, c, 'toxicityTolerance');
    if (toxicity > tolerance) {
      const overflow = (toxicity - tolerance) / tolerance;
      c.energy -= overflow * 6 * dt;
    }

    // 사망: 에너지 고갈
    if (c.energy <= 0) {
      c.alive = false;
      world.spawnCorpse(c.x, c.y, def.corpseOrganic, def.corpseToxicity);
    }
  }
}
