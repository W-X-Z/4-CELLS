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

    const childEnergy = c.energy / 2;
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
