import { choiceListSchema } from './schema';
import type { ChoiceDef } from '../rules/types';

/**
 * 진화 선택지 = 돌연변이.
 * 종 전체를 즉시 바꾸지 않는다. 해당 종의 유전자풀에 형질(field ×value)을 넣으면,
 * 이후 태어나는 개체 일부가 rate(등장률) 확률로 발현하고 자손에게 유전한다.
 * category는 어떤 종의 유전자를 건드리는지(=UI 색/글리프).
 * boostWhen: 특정 위기/상황에서 그 선택지의 등장 확률을 높인다.
 */
const rawChoices: ChoiceDef[] = [
  // ── 광합성 세포 ──────────────────────────────
  {
    id: 'photo_chloroplast',
    title: '엽록체 변이',
    description: '광합성 효율이 높은 개체가 나타나기 시작한다.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'energyFromIntake', value: 1.35, rate: 0.5 }],
    baseWeight: 9,
    boostWhen: [
      { when: { kind: 'resource', key: 'oxygen', cmp: 'lt', value: 300 }, multiplier: 3 },
      { when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 40 }, multiplier: 2 },
    ],
  },
  {
    id: 'photo_hardy',
    title: '내독성 막 변이',
    description: '독성에 잘 견디는 광합성 개체가 나타난다.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'toxicityTolerance', value: 1.5, rate: 0.45 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 300 }, multiplier: 4 }],
  },
  {
    id: 'photo_longevity',
    title: '장수 변이',
    description: '더 오래 사는 광합성 개체가 나타나 산소 공급이 안정된다.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'lifespan', value: 1.3, rate: 0.4 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 30 }, multiplier: 3 }],
  },

  // ── 소비 세포 ──────────────────────────────
  {
    id: 'consumer_breeder',
    title: '조기 분열 변이',
    description: '더 적은 에너지로도 분열하는 소비 개체가 나타난다.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'divideEnergy', value: 0.8, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 15 }, multiplier: 3 }],
  },
  {
    id: 'consumer_thrifty',
    title: '절약 대사 변이',
    description: '기초대사가 낮아 먹이 부족을 잘 버티는 소비 개체가 나타난다.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'upkeep', value: 0.75, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 15 }, multiplier: 3 }],
  },
  {
    id: 'consumer_scavenger',
    title: '시식(屍食) 변이',
    description: '시체에서 더 많은 에너지를 뽑아내는 소비 개체가 나타난다.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'energyFromCorpse', value: 1.6, rate: 0.4 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 60 }, multiplier: 3 }],
  },

  // ── 포식 세포 ──────────────────────────────
  {
    id: 'predator_frenzy',
    title: '광폭화 변이',
    description: '더 빠르고 사냥 효율이 높은 포식 개체가 나타난다.',
    category: 'predator',
    effects: [
      { kind: 'mutation', species: 'predator', field: 'moveSpeed', value: 1.35, rate: 0.4 },
      { kind: 'mutation', species: 'predator', field: 'attackEnergy', value: 1.25, rate: 0.4 },
    ],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'gt', value: 300 }, multiplier: 3 }],
  },
  {
    id: 'predator_eyes',
    title: '예민한 감각 변이',
    description: '시야가 넓어 드문 먹이도 추적하는 포식 개체가 나타난다.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'vision', value: 1.4, rate: 0.4 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'predator', cmp: 'lt', value: 6 }, multiplier: 3 }],
  },

  // ── 분해 세포 ──────────────────────────────
  {
    id: 'decomposer_gut',
    title: '강화 소화 변이',
    description: '시체에서 더 많은 에너지를 얻는 분해 개체가 나타난다.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'energyFromCorpse', value: 1.5, rate: 0.5 }],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 80 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_swift',
    title: '기동 변이',
    description: '시체를 더 빨리 찾아가는 분해 개체가 나타난다.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'moveSpeed', value: 1.4, rate: 0.45 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 350 }, multiplier: 4 }],
  },
  {
    id: 'decomposer_thrifty',
    title: '내핍 변이',
    description: '기초대사가 낮아 굶주림에 강한 분해 개체가 나타난다.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'upkeep', value: 0.75, rate: 0.5 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'decomposer', cmp: 'lt', value: 8 }, multiplier: 3 }],
  },
];

export const choiceDefs: ChoiceDef[] = choiceListSchema.parse(rawChoices) as ChoiceDef[];
