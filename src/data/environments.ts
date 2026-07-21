import { environmentSchema } from './schema';
import type { Resources, SpeciesId } from '../simulation/types';

export interface EnvironmentConfig {
  width: number;
  height: number;
  simRate: number;
  maxCells: number;
  initialResources: Resources;
  displayCaps: Resources;
  lightRegen: number;
  lightCap: number;
  ambientHeat: number;
  heatDissipation: number;
  toxicityDecay: number;
  initialCounts: Record<SpeciesId, number>;
}

/**
 * 초기 환경/월드 설정.
 * 자원은 전역 풀(global pool) 방식 — MVP 밸런싱과 헤드리스 테스트를 단순하게 유지.
 */
export const environmentConfig: EnvironmentConfig = environmentSchema.parse({
  width: 1600,
  height: 900,
  simRate: 15, // 초당 시뮬레이션 틱
  maxCells: 2000, // 성능 상한(디바이스에 따라 런타임에서 하향 조정)

  initialResources: {
    light: 1000,
    oxygen: 1000,
    co2: 700,
    organic: 500,
    heat: 300,
    toxicity: 40,
  },
  // HUD 바 정규화 기준(초과분은 바에서 clamp)
  displayCaps: {
    light: 1600,
    oxygen: 1600,
    co2: 1600,
    organic: 1600,
    heat: 1000,
    toxicity: 1000,
  },

  lightRegen: 110, // 태양광 자연 회복 /s
  lightCap: 1600,
  ambientHeat: 200,
  heatDissipation: 0.05,
  toxicityDecay: 2,

  initialCounts: {
    photosynth: 100,
    consumer: 90,
    predator: 12,
    decomposer: 45,
  },
}) as EnvironmentConfig;
