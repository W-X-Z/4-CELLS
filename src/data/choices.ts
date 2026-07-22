import { choiceListSchema } from './schema';
import type { ChoiceDef } from '../rules/types';

/**
 * 진화 선택지 = 돌연변이 (게임의 핵심 전략 축).
 * 종 전체를 즉시 바꾸지 않는다. 해당 종의 유전자풀에 형질(field ×value)을 넣으면,
 * 이후 태어나는 개체 일부가 rate(등장률) 확률로 발현하고 자손에게 유전한다.
 *
 * 설계 원칙:
 *  - 종마다 '생존(upkeep·내독성·최대에너지) / 힘(포식·효율) / 성장(번식·시야·속도)' 축을 고르게.
 *  - boostWhen으로 현재 위기에 맞는 선택지가 자주 등장 → 플레이어의 대응 전략을 유도.
 *  - 분해 세포는 이제 CO₂(광합성 원료)와 독성 관리의 핵심 → 전략적 비중을 크게.
 */
const rawChoices: ChoiceDef[] = [
  // ── 광합성 세포 (생태계의 에너지·산소 기반) ──────────────
  {
    id: 'photo_chloroplast',
    title: '엽록체 강화',
    description: '같은 CO₂로 더 많은 에너지를 얻어 빠르게 번식하는 광합성 개체.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'energyFromIntake', value: 1.4, rate: 0.5 }],
    baseWeight: 8,
    boostWhen: [
      { when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 40 }, multiplier: 3 },
      { when: { kind: 'resource', key: 'oxygen', cmp: 'lt', value: 300 }, multiplier: 2 },
    ],
  },
  {
    id: 'photo_hardy',
    title: '내독성 세포막',
    description: '독성에 잘 견디는 광합성 개체 — 시체·독성이 쌓인 환경에서 버틴다.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'toxicityTolerance', value: 1.6, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 55 }, multiplier: 4 }],
  },
  {
    id: 'photo_thrifty',
    title: '저에너지 대사',
    description: '기초 에너지 소모가 적어 CO₂가 부족한 시기에도 오래 버티는 광합성 개체.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'upkeep', value: 0.75, rate: 0.45 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 30 }, multiplier: 3 }],
  },

  // ── 소비 세포 (광합성을 뜯는 초식자) ──────────────────────
  {
    id: 'consumer_hardy',
    title: '강인한 세포질',
    description: '최대 에너지가 크고 기초대사가 낮아 굶주림·포식을 잘 버티는 소비 개체.',
    category: 'consumer',
    effects: [
      { kind: 'mutation', species: 'consumer', field: 'maxEnergy', value: 1.3, rate: 0.5 },
      { kind: 'mutation', species: 'consumer', field: 'upkeep', value: 0.85, rate: 0.5 },
    ],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 15 }, multiplier: 4 }],
  },
  {
    id: 'consumer_jaws',
    title: '예리한 이빨',
    description: '광합성 세포를 뜯을 때 더 많은 에너지를 얻어 빠르게 번식하는 소비 개체.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'attackEnergy', value: 1.45, rate: 0.45 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 12 }, multiplier: 3 }],
  },
  {
    id: 'consumer_breeder',
    title: '왕성한 번식',
    description: '더 적은 에너지로도 분열해 개체수를 빠르게 회복하는 소비 개체.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'divideEnergy', value: 0.75, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 10 }, multiplier: 4 }],
  },

  // ── 포식 세포 (소비 세포를 사냥) ──────────────────────────
  {
    id: 'predator_frenzy',
    title: '광폭화',
    description: '더 빠르고 사냥 효율이 높은 포식 개체 — 소비 세포가 넘칠 때 강력하다.',
    category: 'predator',
    effects: [
      { kind: 'mutation', species: 'predator', field: 'moveSpeed', value: 1.35, rate: 0.4 },
      { kind: 'mutation', species: 'predator', field: 'attackEnergy', value: 1.3, rate: 0.4 },
    ],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'gt', value: 120 }, multiplier: 3 }],
  },
  {
    id: 'predator_eyes',
    title: '매의 눈',
    description: '시야가 넓어 드물게 흩어진 소비 세포도 추적하는 포식 개체.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'vision', value: 1.5, rate: 0.4 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'predator', cmp: 'lt', value: 5 }, multiplier: 3 }],
  },
  {
    id: 'predator_hardy',
    title: '끈질긴 포식자',
    description: '최대 에너지가 크고 기초대사가 낮아 먹이가 드문 시기를 버티는 포식 개체.',
    category: 'predator',
    effects: [
      { kind: 'mutation', species: 'predator', field: 'maxEnergy', value: 1.3, rate: 0.45 },
      { kind: 'mutation', species: 'predator', field: 'upkeep', value: 0.85, rate: 0.45 },
    ],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'predator', cmp: 'lt', value: 4 }, multiplier: 4 }],
  },

  // ── 분해 세포 (시체→CO₂ 재순환 + 독성 관리의 핵심) ─────────
  {
    id: 'decomposer_gut',
    title: '강화 소화',
    description: '시체에서 더 많은 에너지를 얻어 번성하는 분해 개체 — 번성할수록 CO₂ 재순환과 청소가 빨라진다.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'energyFromCorpse', value: 1.5, rate: 0.5 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 60 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_swift',
    title: '신속 기동',
    description: '더 빠르고 시야가 넓어 시체를 신속히 치우는 분해 개체 — 독성 폭증을 막는다.',
    category: 'decomposer',
    effects: [
      { kind: 'mutation', species: 'decomposer', field: 'moveSpeed', value: 1.4, rate: 0.45 },
      { kind: 'mutation', species: 'decomposer', field: 'vision', value: 1.25, rate: 0.45 },
    ],
    baseWeight: 7,
    boostWhen: [
      { when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 60 }, multiplier: 4 },
      { when: { kind: 'corpses', cmp: 'gt', value: 100 }, multiplier: 2 },
    ],
  },
  {
    id: 'decomposer_thrifty',
    title: '내핍 대사',
    description: '기초대사가 낮아 시체가 드문 시기에도 살아남는 분해 개체.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'upkeep', value: 0.75, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'decomposer', cmp: 'lt', value: 8 }, multiplier: 3 }],
  },
];

export const choiceDefs: ChoiceDef[] = choiceListSchema.parse(rawChoices) as ChoiceDef[];
