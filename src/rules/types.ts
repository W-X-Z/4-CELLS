import type { GeneField, ResourceKey, SpeciesId } from '../simulation/types';

/**
 * 원자적 Effect 어휘.
 * 모든 진화 선택지는 개별 코드 시나리오가 아니라 이 Effect의 조합(JSON)으로 표현된다.
 *
 * 핵심: 선택은 종 전체를 즉시 바꾸지 않는다. 해당 종의 "유전자풀"에 돌연변이를 넣어,
 * 이후 태어나는 개체 일부(rate=등장률)가 형질을 발현하고 자손에게 유전시킨다.
 */
export type Effect =
  // 종의 유전자풀에 돌연변이 추가 — field 배율 value, 신생아 발현 확률 rate
  { kind: 'mutation'; species: SpeciesId; field: GeneField; value: number; rate: number };

/** 조건 어휘 — 선택지 등장 가능 여부 및 상황 가중치 부스트에 사용 */
export type Cmp = 'lt' | 'lte' | 'gt' | 'gte';

export type Condition =
  | { kind: 'always' }
  | { kind: 'resource'; key: ResourceKey; cmp: Cmp; value: number }
  | { kind: 'count'; species: SpeciesId; cmp: Cmp; value: number }
  | { kind: 'totalCells'; cmp: Cmp; value: number }
  | { kind: 'corpses'; cmp: Cmp; value: number }
  | { kind: 'time'; cmp: Cmp; value: number };

/** 선택지 분류 — 어떤 종의 유전자를 건드리는지로 구분(UI 색/글리프에 사용) */
export type ChoiceCategory = SpeciesId;

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
