import { eff } from '../genetics';
import type { World } from '../World';
import { RESOURCE_KEYS, type ResourceKey, type Resources } from '../types';

/**
 * 대사 시스템: 자원 소비/생산 및 에너지 수지.
 *
 * 자원 배분은 "비례 배분"이다. 세포를 배열 순서대로 처리하며 그때그때 남은 자원으로
 * 판정하면, 앞쪽 세포가 자원을 독차지하고 뒤쪽 세포는 굶는 순서 의존적 불공정이 생긴다.
 * 대신 먼저 전체 수요를 집계해, 공급이 모자라면 모든 세포가 "같은 확보 비율"을 받는다.
 * => CO₂가 부족할 때 광합성 세포가 다 함께 조금씩만 광합성하므로 개체군이 부드럽게 평형에 든다.
 *
 * 에너지 모델:
 *  - 광합성 세포: 호흡하지 않는다. CO₂를 소비해 O₂를 만들며 에너지를 쌓는다.
 *  - 그 외 세포: 호흡한다(O₂ 소비→CO₂ 배출). 에너지는 포식/섭취(다른 시스템)로 얻는다.
 *  - 모든 세포는 매초 upkeep만큼 에너지를 잃는다 → 0이 되면 사망(수명 없음).
 */
export function runMetabolism(world: World, dt: number): void {
  const { cells, env, cfg } = world;

  // ── 1) 자원별 총 수요 집계 → 공정한 확보 비율(순서 무관) ──
  const demand: Resources = { oxygen: 0, co2: 0, heat: 0, toxicity: 0 };
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (amt) demand[key] += amt * dt;
    }
    if (def.respires) demand.oxygen += eff(def, c, 'upkeep') * cfg.respirationRate * dt; // 호흡 O₂ 수요
  }
  const supply: Resources = { oxygen: 1, co2: 1, heat: 1, toxicity: 1 };
  for (const key of RESOURCE_KEYS) {
    supply[key] = demand[key] > 0 ? Math.min(1, env.resources[key] / demand[key]) : 1;
  }

  // ── 2) 각 세포 처리: 모든 세포가 같은 확보 비율(supply)을 적용 ──
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.alive) continue;
    const def = world.species[c.species];

    const energyFromIntake = eff(def, c, 'energyFromIntake');
    const upkeep = eff(def, c, 'upkeep');
    const maxEnergy = eff(def, c, 'maxEnergy');

    // intake 확보 비율 = 이 세포가 쓰는 자원들 중 최소(모든 세포 공통 배분)
    let satisfaction = 1;
    for (const key of RESOURCE_KEYS) {
      if (def.intake[key]) satisfaction = Math.min(satisfaction, supply[key]);
    }
    c.feed = satisfaction; // 분열 판정에서 사용(자원 부족 시 분열 억제)

    // 소비 + 생산 (확보 비율에 비례)
    for (const key of RESOURCE_KEYS) {
      const amt = def.intake[key];
      if (amt) env.consume(key as ResourceKey, amt * dt * satisfaction);
    }
    for (const key of RESOURCE_KEYS) {
      const amt = def.output[key];
      if (amt) env.add(key as ResourceKey, amt * dt * satisfaction);
    }

    // 기회적 정화(scavenge): 남아 있으면 소비하고 보너스 에너지 (현재 사용 종 없음)
    let scavengeEnergy = 0;
    for (const key of RESOURCE_KEYS) {
      const amt = def.scavenge[key];
      if (!amt) continue;
      const ratio = env.consume(key as ResourceKey, amt * dt);
      scavengeEnergy += def.energyFromScavenge * ratio * dt;
    }

    // 대사열
    env.add('heat', (energyFromIntake * satisfaction + def.energyFromScavenge) * dt * 0.09);

    // 에너지 수지(열 과잉 시 기초대사 증가)
    const heatPenalty = 1 + Math.max(0, env.resources.heat - 600) / 1200;
    c.energy += energyFromIntake * satisfaction * dt + scavengeEnergy;
    c.energy -= upkeep * heatPenalty * dt;

    // 호흡: 광합성 세포는 하지 않음. 그 외 세포만 O₂ 소비 → CO₂ 배출, 부족 시 질식.
    if (def.respires) {
      const o2Need = upkeep * cfg.respirationRate * dt;
      if (o2Need > 0) {
        const breathe = supply.oxygen; // 비례 배분된 O₂ 확보율
        env.consume('oxygen', o2Need * breathe);
        env.add('co2', o2Need * breathe * cfg.respirationCo2Ratio);
        if (breathe < 1) c.energy -= upkeep * (1 - breathe) * cfg.suffocationPenalty * dt;
      }
    }

    if (c.energy > maxEnergy) c.energy = maxEnergy;
  }
}
