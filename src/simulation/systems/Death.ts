import type { World } from '../World';

/**
 * 사망 시스템: 아사(에너지 0)·수명·독성 피해로 사망 처리.
 * 사망 세포는 유기물/독성을 환경 풀로 환원(사체) -> 자원 순환의 마지막 고리.
 */
export function runDeath(world: World, dt: number): void {
  const { cells, env } = world;
  const toxicity = env.resources.toxicity;

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const def = world.species[c.species];

    // 이미 포식으로 죽은 세포도 사체 환원
    if (!c.alive) {
      env.add('organic', def.corpseOrganic);
      env.add('toxicity', def.corpseToxicity);
      continue;
    }

    // 독성 피해
    if (toxicity > def.toxicityTolerance) {
      const overflow = (toxicity - def.toxicityTolerance) / def.toxicityTolerance;
      c.energy -= overflow * 6 * dt;
    }

    // 사망 조건
    if (c.energy <= 0 || c.age >= def.lifespan) {
      c.alive = false;
      env.add('organic', def.corpseOrganic);
      env.add('toxicity', def.corpseToxicity);
    }
  }
}
