import { eff } from '../genetics';
import type { World } from '../World';
import { RESOURCE_KEYS, type ResourceKey } from '../types';

/**
 * 대사 시스템: 자원 소비/생산 및 에너지 수지.
 *
 * 에너지 모델:
 *  - 광합성 세포: 호흡하지 않는다. CO₂를 소비해 O₂를 만들며 에너지를 쌓는다(satisfaction=CO₂ 확보율).
 *  - 그 외 세포: 호흡한다. O₂를 소비하고 CO₂를 배출하며, 에너지는 포식/섭취(다른 시스템)로 얻는다.
 *  - 모든 세포는 매초 upkeep(에너지 감소)만큼 잃는다 → 에너지가 0이 되면 사망(수명 없음).
 *  - CO₂는 광합성만 소비하고 호흡하는 세포가 배출하므로, 두 무리가 서로의 자원을 공급하는 순환이 된다.
 */
export function runMetabolism(world: World, dt: number): void {
  const { cells, env, cfg } = world;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];

    const energyFromIntake = eff(def, c, 'energyFromIntake');
    const upkeep = eff(def, c, 'upkeep');
    const maxEnergy = eff(def, c, 'maxEnergy');

    // 1) 확보 비율 = 모든 intake 자원 중 가장 부족한 것에 의해 제한 (광합성=CO₂)
    let satisfaction = 1;
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (!amt) continue;
      const avail = env.resources[key];
      const requested = amt * dt;
      const ratio = requested > 0 ? Math.min(1, avail / requested) : 1;
      if (ratio < satisfaction) satisfaction = ratio;
    }

    // 2) 실제 소비
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (!amt) continue;
      env.consume(key as ResourceKey, amt * dt * satisfaction);
    }

    // 3) 생산(확보 비율에 비례) — 광합성의 O₂ 등
    for (const key of RESOURCE_KEYS) {
      const amt = def.output[key];
      if (!amt) continue;
      env.add(key as ResourceKey, amt * dt * satisfaction);
    }

    // 3.5) 기회적 정화(scavenge): 있으면 소비하고 보너스 에너지, 없어도 굶지 않음 (분해자 독성 정화)
    let scavengeEnergy = 0;
    for (const key of RESOURCE_KEYS) {
      const amt = def.scavenge[key];
      if (!amt) continue;
      const ratio = env.consume(key as ResourceKey, amt * dt);
      scavengeEnergy += def.energyFromScavenge * ratio * dt;
    }

    // 4) 대사열 발생
    env.add('heat', (energyFromIntake * satisfaction + def.energyFromScavenge) * dt * 0.09);

    // 5) 에너지 수지: 광합성 획득 + 정화 보너스 − 기초대사(열 과잉 시 증가)
    const heatPenalty = 1 + Math.max(0, env.resources.heat - 600) / 1200;
    c.energy += energyFromIntake * satisfaction * dt + scavengeEnergy;
    c.energy -= upkeep * heatPenalty * dt;

    // 6) 호흡: 광합성 세포는 호흡하지 않는다. 그 외 세포만 O₂를 소비하고 CO₂를 배출.
    //    O₂가 부족하면 질식 — 부족분에 비례해 에너지를 급격히 잃는다.
    if (def.respires) {
      const o2Need = upkeep * cfg.respirationRate * dt;
      if (o2Need > 0) {
        const breathe = env.consume('oxygen', o2Need); // 확보 비율 0..1
        env.add('co2', o2Need * breathe * cfg.respirationCo2Ratio);
        if (breathe < 1) {
          c.energy -= upkeep * (1 - breathe) * cfg.suffocationPenalty * dt;
        }
      }
    }

    if (c.energy > maxEnergy) c.energy = maxEnergy;
  }
}
