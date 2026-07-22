import { clamp, damp } from '../core/math';
import type { EnvironmentConfig } from '../data/environments';
import { RESOURCE_KEYS, type ResourceKey, type Resources } from './types';

/** 전역 환경 자원 풀 + 자연 변화(회복/소산/감쇠) */
export class Environment {
  resources: Resources;
  /** 초당 자연 회복량 (선택지의 resourceRegen Effect가 변경) */
  regen: Resources;

  constructor(private cfg: EnvironmentConfig) {
    this.resources = { ...(cfg.initialResources as Resources) };
    this.regen = { oxygen: 0, co2: 0, heat: 0, toxicity: 0 };
  }

  update(dt: number): void {
    const r = this.resources;
    // 자원별 자연 회복
    for (const key of RESOURCE_KEYS) {
      if (this.regen[key] !== 0) r[key] += this.regen[key] * dt;
    }
    // 대기 교환: O₂·CO₂가 대기 기준값을 향해 수렴 (CO₂ 고갈 완충 + O₂ 폭주 억제)
    r.oxygen = damp(r.oxygen, this.cfg.o2Atmosphere, this.cfg.atmExchange, dt);
    r.co2 = damp(r.co2, this.cfg.co2Atmosphere, this.cfg.atmExchange, dt);
    // 열 소산(주변 온도로 수렴)
    r.heat = damp(r.heat, this.cfg.ambientHeat, this.cfg.heatDissipation, dt);
    // 독성 자연 감쇠
    r.toxicity -= this.cfg.toxicityDecay * dt;
    // 하한만 0으로 고정(상한 없음 — 실제 축적을 그대로 반영). displayCaps는 HUD 위험표시용.
    for (const key of RESOURCE_KEYS) {
      if (r[key] < 0) r[key] = 0;
    }
  }

  add(key: ResourceKey, v: number): void {
    this.resources[key] = Math.max(0, this.resources[key] + v);
  }

  /** 세포가 소비: 요청량 중 실제 확보 가능한 만큼만 차감하고 확보 비율을 반환 */
  consume(key: ResourceKey, requested: number): number {
    if (requested <= 0) return 1;
    const avail = this.resources[key];
    const taken = Math.min(avail, requested);
    this.resources[key] = avail - taken;
    return taken / requested;
  }

  clampDisplay(key: ResourceKey): number {
    const cap = this.cfg.displayCaps[key];
    return clamp(this.resources[key] / cap, 0, 1);
  }
}
