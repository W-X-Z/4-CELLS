import { eff } from '../genetics';
import type { World } from '../World';
import { RESOURCE_KEYS, type ResourceKey } from '../types';

/**
 * 자기 그늘(self-shading) 수용력.
 * 광합성 세포가 붐빌수록 빛/공간 경쟁으로 효율이 떨어져, 개체군이 무한 폭주하지 않고
 * 일정 수준에서 안정된다(로지스틱 성장). 값이 클수록 더 많은 개체까지 허용.
 */
const PHOTO_CARRYING = 130;

/**
 * 대사 시스템: 자원 소비/생산 및 에너지 수지.
 * 확보 비율(satisfaction)이 생산량과 에너지 획득에 함께 곱해져
 * 자원이 마르면 생산도 함께 줄어드는 연쇄가 발생한다.
 * 유전 형질(genes)이 있으면 개체별로 효율/기초대사/최대에너지가 달라진다.
 */
export function runMetabolism(world: World, dt: number): void {
  const { cells, env, cfg } = world;
  // 광합성 자기 그늘: 개체가 많을수록 효율↓ (붐빌수록 빛/공간 경쟁)
  const photoShade = PHOTO_CARRYING / (PHOTO_CARRYING + world.photoCount);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];
    const shade = c.species === 'photosynth' ? photoShade : 1;

    const energyFromIntake = eff(def, c, 'energyFromIntake') * shade;
    const upkeep = eff(def, c, 'upkeep');
    const maxEnergy = eff(def, c, 'maxEnergy');

    // 1) 확보 비율 = 모든 intake 자원 중 가장 부족한 것에 의해 제한
    let satisfaction = 1;
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (!amt) continue;
      const avail = env.resources[key];
      const requested = amt * dt;
      const ratio = requested > 0 ? Math.min(1, avail / requested) : 1;
      if (ratio < satisfaction) satisfaction = ratio;
    }

    // 2) 실제 소비 (자기 그늘 반영)
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (!amt) continue;
      env.consume(key as ResourceKey, amt * dt * satisfaction * shade);
    }

    // 3) 생산(확보 비율 + 자기 그늘에 비례)
    for (const key of RESOURCE_KEYS) {
      const amt = def.output[key];
      if (!amt) continue;
      env.add(key as ResourceKey, amt * dt * satisfaction * shade);
    }

    // 3.5) 기회적 정화(scavenge): 있으면 소비하고 보너스 에너지, 없어도 굶지 않음
    let scavengeEnergy = 0;
    for (const key of RESOURCE_KEYS) {
      const amt = def.scavenge[key];
      if (!amt) continue;
      const ratio = env.consume(key as ResourceKey, amt * dt); // 확보한 만큼만 정화, 비율 반환
      scavengeEnergy += def.energyFromScavenge * ratio * dt;
    }

    // 4) 대사열 발생
    env.add('heat', (energyFromIntake * satisfaction + def.energyFromScavenge) * dt * 0.09);

    // 5) 에너지 수지 (열 과잉 시 기초대사 증가)
    const heatPenalty = 1 + Math.max(0, env.resources.heat - 600) / 1200;
    c.energy += energyFromIntake * satisfaction * dt + scavengeEnergy;
    c.energy -= upkeep * heatPenalty * dt;

    // 6) 호흡: 살아있는 모든 세포가 O₂를 소비하고 CO₂를 배출한다(기초 대사).
    //    O₂가 부족하면 질식 — 부족분에 비례해 에너지를 급격히 잃는다.
    //    => 광합성이 무너져 O₂가 마르면 전 세포가 함께 질식하는 도미노.
    const o2Need = upkeep * cfg.respirationRate * dt;
    if (o2Need > 0) {
      const breathe = env.consume('oxygen', o2Need); // 확보 비율 0..1
      env.add('co2', o2Need * breathe * cfg.respirationCo2Ratio);
      if (breathe < 1) {
        c.energy -= upkeep * (1 - breathe) * cfg.suffocationPenalty * dt;
      }
    }

    if (c.energy > maxEnergy) c.energy = maxEnergy;
  }
}
