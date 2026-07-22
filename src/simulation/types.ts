/**
 * 환경 자원 4종 (전역 풀 방식).
 * 빛은 "항상 존재하는 배경 조건"으로 취급 — 제한 자원이 아니므로 추적하지 않는다.
 * 유기물은 더 이상 전역 수치가 아니다 — 죽은 세포가 남기는 "시체(Corpse)" 엔티티로 관리한다.
 */
export const RESOURCE_KEYS = [
  'oxygen', // 산소
  'co2', // 이산화탄소
  'heat', // 열
  'toxicity', // 독성
] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export type Resources = Record<ResourceKey, number>;

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  oxygen: '산소',
  co2: '이산화탄소',
  heat: '열',
  toxicity: '독성',
};

/** 세포 종 식별자 */
export type SpeciesId = 'photosynth' | 'consumer' | 'predator' | 'decomposer';

/**
 * 유전자로 스케일 가능한(돌연변이 대상) 수치 필드.
 * 돌연변이는 이 필드에 대한 곱 배율로 표현되며, 개체별로 birth 시점에 확정(freeze)된다.
 */
export type GeneField =
  | 'moveSpeed'
  | 'vision'
  | 'energyFromIntake'
  | 'upkeep'
  | 'attackEnergy'
  | 'divideEnergy'
  | 'maxEnergy'
  | 'toxicityTolerance'
  | 'energyFromCorpse';

/**
 * 유전자풀에 등록되는 돌연변이 하나.
 * 선택지가 종 전체를 즉시 바꾸는 대신, 이 돌연변이를 유전자풀에 넣는다.
 * 신생아는 rate 확률로 이 형질을 발현하며, 발현하면 자손에게 유전된다(등장률로 확산 속도 조절).
 */
export interface Mutation {
  id: number; // 유전자풀 내 고유 (같은 형질을 두 번 골라도 별개로 누적)
  species: SpeciesId;
  field: GeneField;
  value: number; // 곱 배율 (>0). 예: 1.3 강화, 0.8 절감.
  rate: number; // 0..1 신생아 발현 확률(등장률)
}

/** 데이터로 정의되는 세포 종 명세 */
export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  color: number; // 0xRRGGBB (렌더러 tint)
  shape: 'circle' | 'triangle' | 'ring' | 'diamond'; // 색약 대응: 색 + 모양
  radius: number; // 시각/충돌 반경 (px)

  moveSpeed: number; // px/s 기준 최고 속도
  moveMode: 'drift' | 'seekResource' | 'seekPrey'; // 이동 방식(seekResource=시체 탐색)
  vision: number; // 먹이/시체 탐지 반경(px). drift 종은 미사용.

  // 대사: 초당 자원 소비/생산 (에너지 획득 포함)
  intake: Partial<Resources>; // 풀에서 소비 (양수). 부족하면 비례 축소. 필수 원료 — 하나라도 0이면 대사 정지.
  output: Partial<Resources>; // 풀로 생산 (양수)
  energyFromIntake: number; // intake 충족 비율에 곱해 얻는 초당 에너지
  // 기회적 정화: 있으면 소비(정화)하고 보너스 에너지를 얻지만, 없어도 굶지 않는다(satisfaction 미관여).
  scavenge: Partial<Resources>;
  energyFromScavenge: number; // scavenge 충족 비율에 곱해 얻는 초당 에너지
  upkeep: number; // 초당 에너지 소모(기초 대사=에너지 감소). 밸런싱의 핵심 파라미터.
  // 호흡 여부. 광합성 세포는 false(호흡 안 함, 광합성으로만 에너지). 나머지는 true(O₂ 소비→CO₂ 배출).
  respires: boolean;

  // 시체 섭식: 근접한 시체에서 유기물 질량을 먹어 에너지를 얻는다(소비/분해 세포).
  corpseAppetite: number; // 초당 먹을 수 있는 시체 질량
  energyFromCorpse: number; // 먹은 질량 1당 얻는 에너지

  // 포식: seekPrey 종이 접촉 시 잡아먹는 대상
  preyOn: SpeciesId[];
  attackEnergy: number; // 포식 성공 시 얻는 에너지
  eatCooldown: number; // 한 번 먹은 뒤 다시 먹기까지 소화 시간(초). 0이면 제약 없음(배부름 관리).

  // 분열
  divideEnergy: number; // 이 에너지 이상이면 분열 가능
  divideCost: number; // 분열 시 소모(소각)되는 에너지. 무한 증식 방지 — 실제 먹이 순수익이 있어야 지속 분열.
  divideCooldown: number; // 분열 후 재분열까지 최소 초
  maxEnergy: number;

  // 사망 (수명 없음 — 에너지가 0이 되면 사망)
  toxicityTolerance: number; // 이 독성 이상이면 초당 피해

  // 사망 시 남기는 시체의 유기물 질량 / 독성 총량
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
  divideTimer: number;
  eatTimer: number; // 소화 쿨다운. 0보다 크면 아직 못 먹는다(배부름).
  alive: boolean;
  // 렌더링 피드백용 순간 이벤트 플래그 (렌더러가 소비 후 리셋)
  flash: number; // 0..1, 최근 상호작용 강조
  // 유전: birth 시점에 확정된 형질 배율(없으면 야생형). carried는 이미 발현한 돌연변이 id.
  genes?: Partial<Record<GeneField, number>>;
  carried?: number[];
}

/** 죽은 세포가 남기는 유기물 덩어리. 분해/소비 세포가 근접 섭식하며, 방치되면 부패해 독성을 방출한다. */
export interface Corpse {
  id: number;
  x: number;
  y: number;
  mass: number; // 남은 유기물 질량
  tox: number; // 남은(부패 시 방출될) 독성 총량
  flash: number; // 섭식 강조(렌더)
}

/** 시뮬레이션에서 발생한 순간 이벤트 (렌더러가 시각 효과용으로 소비) */
export interface SimEvent {
  type: 'predation' | 'decompose';
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
  corpseCount: number;
  corpseMass: number;
  divisions: number;
  score: number;
  biodiversity: number;
  biomass: number;
  gameOver: boolean;
}
