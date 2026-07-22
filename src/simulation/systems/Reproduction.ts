import { eff } from '../genetics';
import type { World } from '../World';

/**
 * 자원(intake)이 이 확보율 미만이면 분열하지 않는다.
 * 광합성 세포가 비축 에너지로 CO₂ 부족 상황에서도 분열해 과증식→집단 아사하는 것을 막는다.
 * (intake가 없는 종은 feed=1이라 영향 없음 — 포식/섭취로 얻은 에너지로 정상 분열.)
 */
const MIN_FEED_TO_DIVIDE = 0.75;

/**
 * 번식 시스템: 에너지가 분열 임계 이상이고 쿨다운이 끝난 세포가 분열한다.
 * 부모 에너지를 자식과 절반씩 나눈다. 신생아는 births 버퍼에 예약(유전 반영).
 * 분열이 일어날 때마다 world.divisions를 증가 -> 진화 선택지 트리거.
 */
export function runReproduction(world: World, _dt: number): void {
  const { cells, rng } = world;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];
    if (c.divideTimer > 0) continue;
    if (c.feed < MIN_FEED_TO_DIVIDE) continue; // 자원 부족 시 분열 억제(과증식 방지)
    // 개체 편차(jitter)를 문턱에 곱해 같은 종이라도 분열 시점이 흩어지게 한다(한꺼번에 분열 방지).
    if (c.energy < eff(def, c, 'divideEnergy') * c.jitter) continue;

    // 분열 비용을 먼저 소각(무한 증식 방지) 후 남은 에너지를 자식과 절반씩 나눈다.
    // => 먹이(광합성/포식/분해)로 순수익을 내지 못하면 divideEnergy에 다시 도달하지 못해 분열이 멈춘다.
    const remaining = c.energy - def.divideCost;
    if (remaining <= 0) continue;
    const childEnergy = remaining / 2;
    c.energy = childEnergy;
    c.divideTimer = def.divideCooldown;
    // 분열 직후엔 소화(배부름) 쿨을 부여해 곧바로 먹이를 뜯지 못하게 한다.
    // (소비 세포가 분열하자마자 광합성 세포를 급속히 절멸시키던 연쇄를 완화)
    if (def.eatCooldown > 0) c.eatTimer = Math.max(c.eatTimer, def.eatCooldown);
    c.flash = 0.6;

    const offset = def.radius * 2;
    world.queueBirth(
      c,
      c.x + rng.range(-offset, offset),
      c.y + rng.range(-offset, offset),
      childEnergy,
    );
    world.divisions++;
  }
}
