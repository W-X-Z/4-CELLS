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
  initialCounts: Record<SpeciesId, number>;
}

/**
 * 초기 환경/월드 설정.
 * 자원은 전역 풀(global pool) 방식 — MVP 밸런싱과 헤드리스 테스트를 단순하게 유지.
 */
export const environmentConfig: EnvironmentConfig = environmentSchema.parse({
  width: 1200,
  height: 750,
  simRate: 15, // 초당 시뮬레이션 틱
  maxCells: 1200, // 성능 상한(디바이스에 따라 런타임에서 하향 조정)

  initialResources: {
    oxygen: 500,
    co2: 520,
    organic: 340,
    heat: 250,
    toxicity: 20,
  },
  // HUD 카드 위험 판정/정규화 기준
  displayCaps: {
    oxygen: 1200,
    co2: 1200,
    organic: 1000,
    heat: 1000,
    toxicity: 800,
  },

  ambientHeat: 200,
  heatDissipation: 0.05,
  toxicityDecay: 2,
  respirationRate: 0.9,
  respirationCo2Ratio: 0.5, // O₂ 소비 대비 CO₂ 환원을 낮게 — CO₂를 광합성의 제한 요소로 유지
  suffocationPenalty: 2.2,

  initialCounts: {
    photosynth: 66,
    consumer: 16,
    predator: 5,
    decomposer: 12,
  },
}) as EnvironmentConfig;
