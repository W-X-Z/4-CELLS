/**
 * 환경 자원 5종 (전역 풀 방식).
 * 빛은 "항상 존재하는 배경 조건"으로 취급 — 제한 자원이 아니므로 추적하지 않는다.
 * 광합성은 CO₂가 유일한 원료 제약이 된다.
 */
export const RESOURCE_KEYS = [
  'oxygen', // 산소
  'co2', // 이산화탄소
  'organic', // 유기물
  'heat', // 열
  'toxicity', // 독성
] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export type Resources = Record<ResourceKey, number>;

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  oxygen: '산소',
  co2: '이산화탄소',
  organic: '유기물',
  heat: '열',
  toxicity: '독성',
};

/** 세포 종 식별자 */
export type SpeciesId = 'photosynth' | 'consumer' | 'predator' | 'decomposer';

/** 데이터로 정의되는 세포 종 명세 */
export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  color: number; // 0xRRGGBB (렌더러 tint)
  shape: 'circle' | 'triangle' | 'ring' | 'diamond'; // 색약 대응: 색 + 모양
  radius: number; // 시각/충돌 반경 (px)

  moveSpeed: number; // px/s 기준 최고 속도
  moveMode: 'drift' | 'seekResource' | 'seekPrey'; // 이동 방식
  vision: number; // 먹이 탐지 반경(px). 낮을수록 먹이에 피난처가 생긴다. drift 종은 미사용.

  // 대사: 초당 자원 소비/생산 (에너지 획득 포함)
  intake: Partial<Resources>; // 풀에서 소비 (양수). 부족하면 비례 축소. 필수 원료 — 하나라도 0이면 대사 정지.
  output: Partial<Resources>; // 풀로 생산 (양수)
  energyFromIntake: number; // intake 충족 비율에 곱해 얻는 초당 에너지
  // 기회적 정화: 있으면 소비(정화)하고 보너스 에너지를 얻지만, 없어도 굶지 않는다(satisfaction 미관여).
  scavenge: Partial<Resources>;
  energyFromScavenge: number; // scavenge 충족 비율에 곱해 얻는 초당 에너지
  upkeep: number; // 초당 에너지 소모(기초 대사)

  // 포식: seekPrey 종이 접촉 시 잡아먹는 대상
  preyOn: SpeciesId[];
  attackEnergy: number; // 포식 성공 시 얻는 에너지

  // 분열
  divideEnergy: number; // 이 에너지 이상이면 분열 가능
  divideCooldown: number; // 분열 후 재분열까지 최소 초
  maxEnergy: number;

  // 사망
  lifespan: number; // 초 (수명)
  toxicityTolerance: number; // 이 독성 이상이면 초당 피해

  // 사망 시 풀로 환원되는 양
  corpseOrganic: number;
  corpseToxicity: number;

  startEnergy: number;
}

/** 개별 세포 (SoA가 아닌 AoS — MVP 가독성 우선, 수천 개 규모에서 충분) */
export interface Cell {
  id: number;
  species: SpeciesId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  divideTimer: number;
  alive: boolean;
  // 렌더링 피드백용 순간 이벤트 플래그 (렌더러가 소비 후 리셋)
  flash: number; // 0..1, 최근 상호작용 강조
}

/** 시뮬레이션에서 발생한 순간 이벤트 (렌더러가 시각 효과용으로 소비) */
export interface SimEvent {
  type: 'predation';
  x: number;
  y: number;
}

/** HUD/외부로 노출하는 읽기 전용 스냅샷 */
export interface WorldSnapshot {
  time: number;
  tick: number;
  resources: Resources;
  counts: Record<SpeciesId, number>;
  totalCells: number;
  score: number;
  biodiversity: number;
  biomass: number;
  gameOver: boolean;
}
