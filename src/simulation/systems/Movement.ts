import { dist2 } from '../../core/math';
import { eff } from '../genetics';
import type { World } from '../World';

const neighbors: number[] = [];

/**
 * 열에 따른 이동속도 배율(언덕형 곡선).
 * 미지근할수록 대사가 활발해져 빨라지고(최적 온도에서 정점), 너무 뜨거워지면 급격히 둔해진다.
 *   ambient(200) → 1.0, optimal(≈535) → 1.35, max(1000) → 0.4
 */
export function heatSpeedFactor(heat: number, ambient: number, maxHeat: number): number {
  const optimal = ambient + (maxHeat - ambient) * 0.42;
  if (heat <= optimal) {
    const t = Math.max(0, (heat - ambient) / (optimal - ambient)); // 0..1
    return 1 + t * 0.35; // 1.0 → 1.35
  }
  const t = Math.min(1, (heat - optimal) / (maxHeat - optimal)); // 0..1
  return Math.max(0.4, 1.35 - t * 0.95); // 1.35 → 0.4 (과열 시 둔화)
}

/** 이동 시스템: 이동 방식에 따라 속도를 결정하고 위치를 적분한다. */
export function runMovement(world: World, dt: number): void {
  const { cells, rng, cfg, env } = world;
  // 열은 전역 자원 → 모든 세포에 동일하게 작용하는 이동속도 배율
  const heatFactor = heatSpeedFactor(env.resources.heat, cfg.ambientHeat, cfg.displayCaps.heat);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const def = world.species[c.species];
    const speed = eff(def, c, 'moveSpeed') * heatFactor;
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
      else roam(c, speed, dt, rng, cfg.width, cfg.height);
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
      else roam(c, speed, dt, rng, cfg.width, cfg.height);
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

/**
 * 배회: 먹이를 못 찾은 사냥꾼이 무작정 벽에 부딪히지 않고, 월드 중앙 쪽으로 약하게
 * 이끌리며 넓게 탐색한다. 구석/화면 밖에 갇히지 않고 개체가 모이는 중앙으로 유도된다.
 */
function roam(
  c: { x: number; y: number; vx: number; vy: number },
  speed: number,
  dt: number,
  rng: { range(a: number, b: number): number },
  width: number,
  height: number,
): void {
  const dx = width / 2 - c.x;
  const dy = height / 2 - c.y;
  const len = Math.hypot(dx, dy) || 1;
  const bias = 0.35; // 중앙 유인 강도(0=순수 무작위, 1=곧장 중앙)
  c.vx = c.vx * 0.94 + ((dx / len) * bias + rng.range(-1, 1)) * speed * dt * 6;
  c.vy = c.vy * 0.94 + ((dy / len) * bias + rng.range(-1, 1)) * speed * dt * 6;
  const sp = Math.hypot(c.vx, c.vy);
  if (sp > speed) {
    c.vx = (c.vx / sp) * speed;
    c.vy = (c.vy / sp) * speed;
  }
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
