import type { World } from '../World';

/** 시체가 초당 방출하는 독성 = mass × tox(종별 독성) × 이 계수 */
export const CORPSE_TOX_RATE = 0.005;

/**
 * 시체 독성 방출 시스템.
 * 시체는 자연히 사라지지 않는다 — 치우지 않으면 영구히 남아 계속 독성을 뿜는다.
 * (질량은 오직 분해 세포의 섭식으로만 줄고, 다 먹히면 사라진다.)
 * => 분해 세포가 시체를 제때 처리하지 못하면 독성이 누적되어 생태계를 압박한다.
 */
export function runCorpseDecay(world: World, dt: number): void {
  const { corpses, env } = world;
  for (let i = 0; i < corpses.length; i++) {
    const co = corpses[i];
    if (co.mass <= 0 || co.tox <= 0) continue;
    env.add('toxicity', co.mass * co.tox * CORPSE_TOX_RATE * dt);
  }
}
