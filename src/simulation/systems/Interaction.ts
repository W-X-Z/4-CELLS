import { dist2 } from '../../core/math';
import type { World } from '../World';

const neighbors: number[] = [];

/**
 * 상호작용 시스템: 포식(거리 기반 충돌).
 * 범용 물리 엔진 없이 (반경1+반경2) 거리 검사만 사용. 공간 해시로 후보를 좁힌다.
 */
export function runInteraction(world: World, _dt: number): void {
  const { cells } = world;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];
    if (def.moveMode !== 'seekPrey' || def.preyOn.length === 0) continue;
    // 배부르면 사냥하지 않음 -> 먹이 개체군이 전멸까지 사냥당하는 것을 완화
    if (c.energy >= def.maxEnergy * 0.7) continue;

    const reach = def.radius + 8;
    world.spatial.query(c.x, c.y, reach, neighbors);
    for (let n = 0; n < neighbors.length; n++) {
      const j = neighbors[n];
      if (j === i) continue;
      const prey = cells[j];
      if (!prey || !prey.alive) continue;
      if (!def.preyOn.includes(prey.species)) continue;
      const preyDef = world.species[prey.species];
      const rSum = def.radius + preyDef.radius + 2;
      if (dist2(c.x, c.y, prey.x, prey.y) <= rSum * rSum) {
        // 포식 성공: 먹이 사망 예약(사체는 Death에서 환원)
        prey.alive = false;
        c.energy = Math.min(def.maxEnergy, c.energy + def.attackEnergy);
        c.flash = 1;
        world.pushEvent({ type: 'predation', x: prey.x, y: prey.y });
        break; // 틱당 1마리만
      }
    }
  }
}
