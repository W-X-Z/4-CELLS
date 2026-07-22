import { dist2 } from '../../core/math';
import { eff } from '../genetics';
import type { World } from '../World';

const neighbors: number[] = [];
const sepNeighbors: number[] = [];

/** 동종 회피(분산): 같은 종끼리 밀어내는 반경/강도 — 뭉침을 막아 생태계를 고르게 퍼뜨린다. */
const SEP_RADIUS = 26;
const SEP_STRENGTH = 0.5;

/**
 * 조향 반응 속도(1/s). 현재 속도를 '원하는 속도'로 수렴시키는 빠르기.
 * 클수록 민첩(급회전), 작을수록 관성이 커져 부드럽게 휜다. 프레임률과 무관하게 동작.
 */
const STEER_HUNT = 3.0; // 사냥꾼: 먹이를 쫓되 즉각 방향을 꺾지 않음(자연스러운 추적)
const STEER_WANDER = 1.5; // 배회: 느긋하게 방향을 틀어 곡선 궤적을 그림
/** 배회 시 진행 방향이 초당 최대 얼마나 회전하는지(rad/s) — 무작위지만 매끄럽게 휘어진다. */
const WANDER_TURN = 2.2;
/** 벽 근처에서 안쪽으로 부드럽게 되도는 여백(px)과 강도 — 하드 반사 대신 자연스러운 선회. */
const EDGE_MARGIN = 64;
const EDGE_PUSH = 0.6;

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

/**
 * 이동 시스템 (조향 기반).
 * 각 세포의 '원하는 속도(desired)'를 상황(추적/배회/벽 회피/동종 회피)에서 합성한 뒤,
 * 현재 속도를 그 방향으로 '부드럽게' 수렴시킨다(관성). 속도를 즉시 스냅하지 않아
 * 로봇처럼 각진 움직임 대신 곡선을 그리는 자연스러운 이동이 된다.
 */
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

    // ── 원하는 속도(desired velocity) 합성 ──
    let dvx = 0;
    let dvy = 0;
    let steerRate = STEER_WANDER;
    let chasing = false;

    if (def.moveMode === 'seekPrey' && def.preyOn.length > 0 && hungry) {
      const vision = eff(def, c, 'vision');
      world.spatial.query(c.x, c.y, vision, neighbors);
      let bestD = vision * vision;
      let tx = 0;
      let ty = 0;
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
          chasing = true;
        }
      }
      if (chasing) {
        const d = Math.hypot(tx - c.x, ty - c.y) || 1;
        dvx = ((tx - c.x) / d) * speed;
        dvy = ((ty - c.y) / d) * speed;
        steerRate = STEER_HUNT;
      }
    } else if (def.moveMode === 'seekResource' && hungry) {
      const vision = eff(def, c, 'vision');
      world.corpseHash.query(c.x, c.y, vision, neighbors);
      let bestD = vision * vision;
      let tx = 0;
      let ty = 0;
      for (let n = 0; n < neighbors.length; n++) {
        const co = world.corpses[neighbors[n]];
        if (!co || co.mass <= 0) continue;
        const d = dist2(c.x, c.y, co.x, co.y);
        if (d < bestD) {
          bestD = d;
          tx = co.x;
          ty = co.y;
          chasing = true;
        }
      }
      if (chasing) {
        const d = Math.hypot(tx - c.x, ty - c.y) || 1;
        dvx = ((tx - c.x) / d) * speed;
        dvy = ((ty - c.y) / d) * speed;
        steerRate = STEER_HUNT;
      }
    }

    if (!chasing) {
      // 매끄러운 배회: 현재 진행각을 조금씩 무작위로 틀어 곡선을 그린다(백색소음 흔들림 X).
      let ang = Math.atan2(c.vy, c.vx);
      if (!Number.isFinite(ang) || (c.vx === 0 && c.vy === 0)) ang = rng.range(-Math.PI, Math.PI);
      ang += rng.range(-1, 1) * WANDER_TURN * dt;
      // 표류(drift) 종(광합성)은 아주 느리게 떠돌고, 그 외는 순항 속도로 탐색한다.
      const cruise = def.moveMode === 'drift' ? speed * 0.4 : speed * 0.72;
      dvx = Math.cos(ang) * cruise;
      dvy = Math.sin(ang) * cruise;
    }

    // 벽 회피: 경계에 가까울수록 안쪽으로 부드럽게 미는 힘(하드 반사 대신 자연스러운 선회)
    if (c.x < EDGE_MARGIN) dvx += (1 - c.x / EDGE_MARGIN) * speed * EDGE_PUSH;
    else if (c.x > cfg.width - EDGE_MARGIN) dvx -= (1 - (cfg.width - c.x) / EDGE_MARGIN) * speed * EDGE_PUSH;
    if (c.y < EDGE_MARGIN) dvy += (1 - c.y / EDGE_MARGIN) * speed * EDGE_PUSH;
    else if (c.y > cfg.height - EDGE_MARGIN) dvy -= (1 - (cfg.height - c.y) / EDGE_MARGIN) * speed * EDGE_PUSH;

    // 동종 회피(분산): 같은 종 이웃에게서 멀어지는 힘을 desired에 더한다(뭉침 방지 → 고른 분산).
    world.spatial.query(c.x, c.y, SEP_RADIUS, sepNeighbors);
    let sx = 0;
    let sy = 0;
    let sn = 0;
    for (let k = 0; k < sepNeighbors.length; k++) {
      const j = sepNeighbors[k];
      if (j === i) continue;
      const o = cells[j];
      if (!o || !o.alive || o.species !== c.species) continue;
      const ddx = c.x - o.x;
      const ddy = c.y - o.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 > 0 && d2 < SEP_RADIUS * SEP_RADIUS) {
        const inv = 1 / d2; // 가까울수록 강한 반발
        sx += ddx * inv;
        sy += ddy * inv;
        sn++;
      }
    }
    if (sn > 0) {
      const sl = Math.hypot(sx, sy) || 1;
      dvx += (sx / sl) * speed * SEP_STRENGTH;
      dvy += (sy / sl) * speed * SEP_STRENGTH;
    }

    // ── 부드러운 조향: 현재 속도를 desired로 수렴(프레임률 독립적 관성) ──
    const turn = 1 - Math.exp(-steerRate * dt);
    c.vx += (dvx - c.vx) * turn;
    c.vy += (dvy - c.vy) * turn;
    // 최고 속도 제한
    const sp = Math.hypot(c.vx, c.vy);
    if (sp > speed) {
      c.vx = (c.vx / sp) * speed;
      c.vy = (c.vy / sp) * speed;
    }

    // 위치 적분 + 경계 처리(벽 회피가 있어 하드 반사는 최소화 — 부딪혀도 속도를 죽여 미끄러지듯)
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.x < 0) { c.x = 0; if (c.vx < 0) c.vx = -c.vx * 0.5; }
    else if (c.x > cfg.width) { c.x = cfg.width; if (c.vx > 0) c.vx = -c.vx * 0.5; }
    if (c.y < 0) { c.y = 0; if (c.vy < 0) c.vy = -c.vy * 0.5; }
    else if (c.y > cfg.height) { c.y = cfg.height; if (c.vy > 0) c.vy = -c.vy * 0.5; }
  }
}
