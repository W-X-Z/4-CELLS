import { environmentSchema } from './schema';
import type { Resources, SpeciesId } from '../simulation/types';

export interface EnvironmentConfig {
  width: number;
  height: number;
  simRate: number;
  maxCells: number;
  initialResources: Resources;
  displayCaps: Resources;
  ambientHeat: number;
  heatDissipation: number;
  toxicityDecay: number;
  // 호흡: 살아있는 모든 세포가 기초대사(upkeep)에 비례해 O₂를 소비하고 CO₂를 배출한다.
  respirationRate: number; // upkeep 1당 초당 O₂ 소비량
  respirationCo2Ratio: number; // 소비한 O₂ 대비 배출 CO₂ 비율
  suffocationPenalty: number; // O₂ 부족 시 부족분에 비례해 추가로 잃는 에너지 배수(질식)
  // 시체 시스템
  initialCorpses: number; // 시작 시 흩뿌리는 잔해(분해자 부트스트랩용)
  corpseRotRate: number; // 초당 부패로 사라지는 시체 질량(방치 시 독성 방출)
  // 진화 페이싱 (점진적으로 간격이 늘어남)
  divisionsPerChoice: number; // 첫 진화까지 필요한 누적 분열 수(기준 간격)
  divisionsGrowth: number; // 진화가 한 번 일어날 때마다 다음 간격에 더해지는 분열 수
  initialCounts: Record<SpeciesId, number>;
}

/**
 * 초기 환경/월드 설정.
 * 자원은 전역 풀(oxygen·co2·heat·toxicity)이고, 유기물은 시체 엔티티로 분리 관리한다.
 */
export const environmentConfig: EnvironmentConfig = environmentSchema.parse({
  width: 1200,
  height: 750,
  simRate: 15, // 초당 시뮬레이션 틱
  maxCells: 1200, // 성능 상한(디바이스에 따라 런타임에서 하향 조정)

  initialResources: {
    oxygen: 500,
    co2: 520,
    heat: 250,
    toxicity: 20,
  },
  // HUD 카드 위험 판정/정규화 기준
  displayCaps: {
    oxygen: 1200,
    co2: 1200,
    heat: 1000,
    toxicity: 800,
  },

  ambientHeat: 200,
  heatDissipation: 0.1, // 열 소산을 빠르게 — 열이 곧바로 상한에 붙지 않도록
  toxicityDecay: 2,
  respirationRate: 0.9,
  respirationCo2Ratio: 0.6, // O₂ 소비 대비 CO₂ 환원 — CO₂를 광합성의 제한 요소로 유지하되 급붕괴 방지
  suffocationPenalty: 2.2,

  initialCorpses: 45, // 시작 잔해: 분해/소비 세포가 초반에 굶지 않도록
  corpseRotRate: 0.3, // 방치된 시체가 서서히 부패하며 독성을 방출(느릴수록 분해자가 찾을 시간이 늘어남)

  // 적은 수로 시작해 키워나간다. 진화는 처음엔 자주, 갈수록 뜸하게(점진적 간격).
  divisionsPerChoice: 40, // 첫 진화까지 40회 분열
  divisionsGrowth: 30, // 이후 진화마다 필요한 분열 간격이 +30씩 늘어남

  initialCounts: {
    photosynth: 34,
    consumer: 9,
    predator: 3,
    decomposer: 8,
  },
}) as EnvironmentConfig;
