import { eff } from '../genetics';
import type { World } from '../World';

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
    if (c.energy < eff(def, c, 'divideEnergy')) continue;

    // 분열 비용을 먼저 소각(무한 증식 방지) 후 남은 에너지를 자식과 절반씩 나눈다.
    // => 먹이(광합성/포식/분해)로 순수익을 내지 못하면 divideEnergy에 다시 도달하지 못해 분열이 멈춘다.
    const remaining = c.energy - def.divideCost;
    if (remaining <= 0) continue;
    const childEnergy = remaining / 2;
    c.energy = childEnergy;
    c.divideTimer = def.divideCooldown;
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
