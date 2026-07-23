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
  // 대기 교환: O₂·CO₂가 대기 기준값을 향해 서서히 수렴한다(CO₂ 고갈·O₂ 폭주를 완충).
  o2Atmosphere: number;
  co2Atmosphere: number;
  atmExchange: number; // 기준값으로 수렴하는 속도(0~1, 클수록 빠름)
  initialSpawnSpread: number; // 초기 세포를 가운데 영역에만 배치하는 비율(0~1)
  // 시체 시스템
  initialCorpses: number; // 시작 시 흩뿌리는 잔해(분해자 부트스트랩용)
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
    toxicity: 150,
  },

  ambientHeat: 200,
  heatDissipation: 0.1, // 열 소산을 빠르게 — 열이 곧바로 상한에 붙지 않도록
  toxicityDecay: 0.04, // 비례 감쇠율(0~1). 시체 독성 방출량에 맞춰 평형 형성
  respirationRate: 0.9,
  respirationCo2Ratio: 0.8, // O₂ 소비 대비 CO₂ 환원 — 호흡이 탄소를 되돌린다(대기 공급 없으므로 높게)
  suffocationPenalty: 2.2,
  // 대기 교환 없음(0) — CO₂는 오직 다른 세포의 호흡·분해로만 공급된다.
  // => 광합성 세포는 소비·포식·분해 세포에 의존하고, 그 종들이 무너지면 함께 붕괴한다(상호의존).
  o2Atmosphere: 500,
  co2Atmosphere: 500,
  atmExchange: 0,

  // 적은 초기 세포를 가운데에 바짝 모아 서로 쉽게 만나게 한다(줌인 배율과 맞춤).
  initialSpawnSpread: 0.4,
  initialCorpses: 0, // 시작 시 시체 없음 — 시체는 세포가 죽어야 생긴다(분해 세포는 초기 사망으로 공급)

  // 적은 수로 시작해 키워나간다. 진화는 처음엔 자주, 갈수록 뜸하게(점진적 간격).
  divisionsPerChoice: 40, // 첫 진화까지 40회 분열
  divisionsGrowth: 30, // 이후 진화마다 필요한 분열 간격이 +30씩 늘어남

  // 적은 수로 가운데에서 시작해 키운다.
  initialCounts: {
    photosynth: 8,
    consumer: 3,
    predator: 2,
    decomposer: 1,
  },
}) as EnvironmentConfig;
