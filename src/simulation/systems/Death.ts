import { eff } from '../genetics';
import type { World } from '../World';

/**
 * 질병(감염) 파라미터.
 * 독성이 내성 대비 높을수록 세포가 "감기처럼" 병에 걸린다(확률적). 병중엔 대사 부담으로
 * 에너지를 더 소모하고, 시간이 지나면 회복한다. 독성이 전역 에너지를 조용히 깎는 대신,
 * 눈에 보이는(보라색) 질병 상태로 표현해 독성의 위험을 인지할 수 있게 한다.
 */
const INFECT_THRESHOLD = 0.6; // 독성/내성 비가 이 값을 넘으면 감염 시작
const INFECT_RATE = 0.5; // 감염 확률 스케일(초당). 초과분에 비례.
const SICK_DRAIN = 3.0; // 병중 초당 추가 에너지 소모(대사 부담)
const SICK_RECOVER = 0.12; // 초당 회복 확률(면역) — 평균 ~8초 앓음

/**
 * 사망 시스템: 에너지가 0이 되면 사망 (수명 없음 — 에너지가 남아 있으면 계속 생존).
 * 독성이 높으면 세포가 병들어(감염) 에너지를 더 소모하다 결국 아사로 이어질 수 있다.
 * 사망 세포는 유기물/독성을 담은 시체를 남긴다.
 */
export function runDeath(world: World, dt: number): void {
  const { cells, env, rng } = world;
  const toxicity = env.resources.toxicity;

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const def = world.species[c.species];

    // 이미 포식으로 죽은 세포: 포식자가 절반을 섭취했다고 보고 축소된 시체를 남긴다.
    if (!c.alive) {
      world.spawnCorpse(c.x, c.y, def.corpseOrganic * 0.5, def.corpseToxicity);
      continue;
    }

    // 질병: 독성이 내성 대비 높을수록 감염 확률↑. 병중이면 에너지 소모↑ + 회복 판정.
    const tolerance = eff(def, c, 'toxicityTolerance');
    const risk = tolerance > 0 ? toxicity / tolerance : 0;
    if (!c.sick) {
      if (risk > INFECT_THRESHOLD) {
        const p = Math.min(0.8, risk - INFECT_THRESHOLD) * INFECT_RATE * dt;
        if (rng.chance(p)) c.sick = true;
      }
    } else {
      c.energy -= SICK_DRAIN * dt; // 앓는 동안 대사 부담
      if (rng.chance(SICK_RECOVER * dt)) c.sick = false; // 면역으로 회복
    }

    // 사망: 에너지 고갈
    if (c.energy <= 0) {
      c.alive = false;
      world.spawnCorpse(c.x, c.y, def.corpseOrganic, def.corpseToxicity);
    }
  }
}
