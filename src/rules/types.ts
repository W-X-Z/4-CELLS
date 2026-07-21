import type { ResourceKey, SpeciesId } from '../simulation/types';

/**
 * 원자적 Effect 어휘.
 * 모든 선택지는 개별 코드 시나리오가 아니라 이 Effect들의 조합(JSON)으로 표현된다.
 * 새로운 표현이 필요하면 여기에 kind를 추가하고 EffectExecutor에 처리기를 더한다.
 */
export type Op = 'add' | 'mul' | 'set';

export type Effect =
  // 환경 자원 풀 즉시 변경
  | { kind: 'resource'; op: Op; key: ResourceKey; value: number }
  // 환경 자원의 초당 자연 회복(baseline) 변경 — 예: 태양광 세기 조절
  | { kind: 'resourceRegen'; op: Op; key: ResourceKey; value: number }
  // 종의 수치 능력치 변경 (moveSpeed, divideEnergy, attackEnergy, upkeep 등)
  | { kind: 'species'; op: Op; species: SpeciesId; field: SpeciesNumericField; value: number }
  // 종의 대사 자원 계수 변경 (intake/output)
  | { kind: 'metabolism'; op: Op; species: SpeciesId; io: 'intake' | 'output'; key: ResourceKey; value: number }
  // 이동 방식(행동 규칙) 변경
  | { kind: 'moveMode'; species: SpeciesId; value: 'drift' | 'seekResource' | 'seekPrey' }
  // 포식 관계(행동 규칙) 추가/제거
  | { kind: 'predation'; op: 'add' | 'remove'; species: SpeciesId; target: SpeciesId }
  // 신규 세포 투입
  | { kind: 'spawn'; species: SpeciesId; count: number };

/** species Effect가 변경 가능한 숫자 필드 화이트리스트 */
export type SpeciesNumericField =
  | 'moveSpeed'
  | 'radius'
  | 'energyFromIntake'
  | 'upkeep'
  | 'attackEnergy'
  | 'divideEnergy'
  | 'divideCooldown'
  | 'maxEnergy'
  | 'lifespan'
  | 'toxicityTolerance';

/** 조건 어휘 — 선택지 등장 가능 여부 및 상황 가중치 부스트에 사용 */
export type Cmp = 'lt' | 'lte' | 'gt' | 'gte';

export type Condition =
  | { kind: 'always' }
  | { kind: 'resource'; key: ResourceKey; cmp: Cmp; value: number }
  | { kind: 'count'; species: SpeciesId; cmp: Cmp; value: number }
  | { kind: 'totalCells'; cmp: Cmp; value: number }
  | { kind: 'time'; cmp: Cmp; value: number };

export type ChoiceCategory =
  | 'environment' // 환경 수치 변경
  | 'ability' // 세포 능력치 변경
  | 'behavior' // 행동 규칙 추가/제거
  | 'metabolism' // 자원 생산/소비 관계 변경
  | 'spawn'; // 신규 세포/오브젝트 생성

export interface ChoiceDef {
  id: string;
  title: string;
  description: string;
  category: ChoiceCategory;
  effects: Effect[];
  /** 기본 등장 가중치 */
  baseWeight: number;
  /** 등장 최소 조건 (모두 만족해야 후보가 됨). 비우면 항상 후보. */
  requires?: Condition[];
  /** 상황 부스트: 조건 만족 시 가중치에 곱해질 배수 */
  boostWhen?: { when: Condition; multiplier: number }[];
}
