import { dist2 } from '../../core/math';
import { eff } from '../genetics';
import type { World } from '../World';

const neighbors: number[] = [];

/** 이동 시스템: 이동 방식에 따라 속도를 결정하고 위치를 적분한다. */
export function runMovement(world: World, dt: number): void {
  const { cells, rng, cfg } = world;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const def = world.species[c.species];
    const speed = eff(def, c, 'moveSpeed');
    const maxE = eff(def, c, 'maxEnergy');
    const hungry = c.energy < maxE * 0.7;

    if (def.moveMode === 'seekPrey' && def.preyOn.length > 0 && hungry) {
      // 가장 가까운 먹이를 향해 조향 (종별 시야)
      const vision = eff(def, c, 'vision');
      world.spatial.query(c.x, c.y, vision, neighbors);
      let bestD = vision * vision;
      let tx = 0;
      let ty = 0;
      let found = false;
      for (let n = 0; n < neighbors.length; n++) {
        const j = neighbors[n];
        if (j === i) continue;
        const other = cells[j];
        if (!other || !other.alive) continue;
        if (!def.preyOn.includes(other.species)) continue;
        const d = dist2(c.x, c.y, other.x, other.y);
        if (d < bestD) {
          bestD = d;
          tx = other.x;
          ty = other.y;
          found = true;
        }
      }
      if (found) steer(c, tx, ty, speed);
      else randomWalk(c, speed, dt, rng);
    } else if (def.moveMode === 'seekResource' && hungry) {
      // 가장 가까운 시체를 향해 조향 (분해 세포)
      const vision = eff(def, c, 'vision');
      world.corpseHash.query(c.x, c.y, vision, neighbors);
      let bestD = vision * vision;
      let tx = 0;
      let ty = 0;
      let found = false;
      for (let n = 0; n < neighbors.length; n++) {
        const co = world.corpses[neighbors[n]];
        if (!co || co.mass <= 0) continue;
        const d = dist2(c.x, c.y, co.x, co.y);
        if (d < bestD) {
          bestD = d;
          tx = co.x;
          ty = co.y;
          found = true;
        }
      }
      if (found) steer(c, tx, ty, speed);
      else randomWalk(c, speed, dt, rng);
    } else {
      randomWalk(c, speed, dt, rng);
    }

    // 위치 적분 + 벽 반사
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.x < 0) { c.x = 0; c.vx = -c.vx; }
    else if (c.x > cfg.width) { c.x = cfg.width; c.vx = -c.vx; }
    if (c.y < 0) { c.y = 0; c.vy = -c.vy; }
    else if (c.y > cfg.height) { c.y = cfg.height; c.vy = -c.vy; }
  }
}

function steer(c: { x: number; y: number; vx: number; vy: number }, tx: number, ty: number, speed: number): void {
  const dx = tx - c.x;
  const dy = ty - c.y;
  const len = Math.hypot(dx, dy) || 1;
  c.vx = (dx / len) * speed;
  c.vy = (dy / len) * speed;
}

function randomWalk(c: { vx: number; vy: number }, speed: number, dt: number, rng: { range(a: number, b: number): number }): void {
  c.vx = c.vx * 0.96 + rng.range(-1, 1) * speed * dt * 6;
  c.vy = c.vy * 0.96 + rng.range(-1, 1) * speed * dt * 6;
  const sp = Math.hypot(c.vx, c.vy);
  if (sp > speed) {
    c.vx = (c.vx / sp) * speed;
    c.vy = (c.vy / sp) * speed;
  }
}
