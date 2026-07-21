import { choiceListSchema } from './schema';
import type { ChoiceDef } from '../rules/types';

/**
 * MVP 선택지 풀. 개별 코드가 아니라 Effect 조합 + 상황 조건으로 정의.
 * boostWhen: 특정 위기/상황에서 그 선택지의 등장 확률을 높인다(=플레이어가 대응했다는 감각).
 */
const rawChoices: ChoiceDef[] = [
  // ── 환경 ──────────────────────────────
  {
    id: 'env_sun_boost',
    title: '태양 활성화',
    description: '빛의 자연 회복량을 크게 늘린다. 광합성 세포가 번성한다.',
    category: 'environment',
    effects: [{ kind: 'resourceRegen', op: 'add', key: 'light', value: 40 }],
    baseWeight: 10,
    boostWhen: [{ when: { kind: 'resource', key: 'light', cmp: 'lt', value: 400 }, multiplier: 3 }],
  },
  {
    id: 'env_eclipse',
    title: '일식',
    description: '빛 회복량을 줄인다. 광합성 세포가 위태로워진다.',
    category: 'environment',
    effects: [{ kind: 'resourceRegen', op: 'add', key: 'light', value: -35 }],
    baseWeight: 7,
  },
  {
    id: 'env_oxygen_inject',
    title: '산소 주입',
    description: '산소 풀을 즉시 크게 보충한다.',
    category: 'environment',
    effects: [{ kind: 'resource', op: 'add', key: 'oxygen', value: 500 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'resource', key: 'oxygen', cmp: 'lt', value: 250 }, multiplier: 4 }],
  },
  {
    id: 'env_co2_vent',
    title: '이산화탄소 분출',
    description: 'CO2를 대량 방출한다. 광합성 원료가 늘어난다.',
    category: 'environment',
    effects: [{ kind: 'resource', op: 'add', key: 'co2', value: 400 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'resource', key: 'co2', cmp: 'lt', value: 200 }, multiplier: 3 }],
  },
  {
    id: 'env_detox',
    title: '정화 파동',
    description: '독성을 절반으로 줄인다.',
    category: 'environment',
    effects: [{ kind: 'resource', op: 'mul', key: 'toxicity', value: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 300 }, multiplier: 5 }],
  },
  {
    id: 'env_heatwave',
    title: '열파',
    description: '열을 급격히 올린다. 대사 부담이 커진다.',
    category: 'environment',
    effects: [{ kind: 'resource', op: 'add', key: 'heat', value: 350 }],
    baseWeight: 5,
  },

  // ── 능력치 ──────────────────────────────
  {
    id: 'ab_photo_efficiency',
    title: '엽록체 강화',
    description: '광합성 세포의 에너지 획득 효율을 높인다.',
    category: 'ability',
    effects: [{ kind: 'species', op: 'mul', species: 'photosynth', field: 'energyFromIntake', value: 1.3 }],
    baseWeight: 9,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 40 }, multiplier: 3 }],
  },
  {
    id: 'ab_predator_frenzy',
    title: '포식자 광폭화',
    description: '포식 세포의 이동 속도와 포식 에너지를 높인다.',
    category: 'ability',
    effects: [
      { kind: 'species', op: 'mul', species: 'predator', field: 'moveSpeed', value: 1.4 },
      { kind: 'species', op: 'mul', species: 'predator', field: 'attackEnergy', value: 1.25 },
    ],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'gt', value: 300 }, multiplier: 3 }],
  },
  {
    id: 'ab_decomposer_hardy',
    title: '분해자 내성 강화',
    description: '분해 세포의 수명을 늘리고 기초 대사를 줄인다.',
    category: 'ability',
    effects: [
      { kind: 'species', op: 'mul', species: 'decomposer', field: 'lifespan', value: 1.3 },
      { kind: 'species', op: 'mul', species: 'decomposer', field: 'upkeep', value: 0.8 },
    ],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'organic', cmp: 'gt', value: 1000 }, multiplier: 3 }],
  },
  {
    id: 'ab_consumer_breeder',
    title: '소비자 번식 촉진',
    description: '소비 세포가 더 적은 에너지로도 분열한다.',
    category: 'ability',
    effects: [{ kind: 'species', op: 'mul', species: 'consumer', field: 'divideEnergy', value: 0.8 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 20 }, multiplier: 3 }],
  },

  // ── 행동 규칙 ──────────────────────────────
  {
    id: 'be_predator_hunt_photo',
    title: '포식 대상 확장',
    description: '포식 세포가 광합성 세포까지 잡아먹기 시작한다. 위험한 선택.',
    category: 'behavior',
    effects: [{ kind: 'predation', op: 'add', species: 'predator', target: 'photosynth' }],
    baseWeight: 4,
  },
  {
    id: 'be_predator_calm',
    title: '포식 본능 억제',
    description: '포식 세포가 소비 세포 사냥을 멈춘다.',
    category: 'behavior',
    effects: [{ kind: 'predation', op: 'remove', species: 'predator', target: 'consumer' }],
    baseWeight: 3,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 15 }, multiplier: 4 }],
  },

  // ── 대사 관계 ──────────────────────────────
  {
    id: 'me_photo_more_oxygen',
    title: '산소 과생산',
    description: '광합성 세포의 산소 생산량을 늘린다.',
    category: 'metabolism',
    effects: [{ kind: 'metabolism', op: 'add', species: 'photosynth', io: 'output', key: 'oxygen', value: 3 }],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'resource', key: 'oxygen', cmp: 'lt', value: 300 }, multiplier: 3 }],
  },
  {
    id: 'me_consumer_thrifty',
    title: '소비자 절약 대사',
    description: '소비 세포의 유기물 소비량을 줄인다.',
    category: 'metabolism',
    effects: [{ kind: 'metabolism', op: 'mul', species: 'consumer', io: 'intake', key: 'organic', value: 0.7 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'organic', cmp: 'lt', value: 150 }, multiplier: 3 }],
  },

  // ── 신규 세포 투입 ──────────────────────────────
  {
    id: 'sp_photo_bloom',
    title: '광합성 세포 대량 투입',
    description: '광합성 세포 60마리를 새로 투입한다.',
    category: 'spawn',
    effects: [{ kind: 'spawn', species: 'photosynth', count: 60 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 30 }, multiplier: 4 }],
  },
  {
    id: 'sp_decomposer_seed',
    title: '분해 세포 투입',
    description: '분해 세포 40마리를 투입해 유기물·독성 정화를 돕는다.',
    category: 'spawn',
    effects: [{ kind: 'spawn', species: 'decomposer', count: 40 }],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 400 }, multiplier: 4 }],
  },
  {
    id: 'sp_predator_pack',
    title: '포식 세포 투입',
    description: '포식 세포 15마리를 투입한다. 소비 세포 과잉을 억제.',
    category: 'spawn',
    effects: [{ kind: 'spawn', species: 'predator', count: 15 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'gt', value: 400 }, multiplier: 3 }],
  },
];

export const choiceDefs: ChoiceDef[] = choiceListSchema.parse(rawChoices) as ChoiceDef[];
