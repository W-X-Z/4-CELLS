import { choiceListSchema } from './schema';
import type { ChoiceDef } from '../rules/types';

/**
 * 진화 선택지 = 돌연변이 (게임의 핵심 전략 축).
 * 종 전체를 즉시 바꾸지 않는다. 해당 종의 유전자풀에 형질(field ×value)을 넣으면,
 * 이후 태어나는 개체 일부가 rate(등장률) 확률로 발현하고 자손에게 유전한다.
 *
 * 설계 원칙:
 *  - 종마다 9종(총 36종). '순수 강화 / 트레이드오프 / 위험(강한 대가)' 세 결을 섞는다.
 *  - 트레이드오프: 한 형질을 올리는 대신 다른 형질을 내린다(예: 느리지만 효율↑).
 *  - value < 1 은 하향(비용 형질 upkeep·divideCost·eatCooldown 은 낮을수록 이득).
 *  - boostWhen 으로 현재 위기에 맞는 선택지가 자주 등장 → 플레이어의 대응 전략을 유도.
 */
const rawChoices: ChoiceDef[] = [
  // ══════════ 광합성 세포 (에너지·산소 기반) ══════════
  {
    id: 'photo_chloroplast',
    title: '엽록체 강화',
    description: '같은 CO₂로 더 많은 에너지를 얻어 빠르게 번식하는 광합성 개체.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'energyFromIntake', value: 1.4, rate: 0.5 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 40 }, multiplier: 3 }],
  },
  {
    id: 'photo_thrifty',
    title: '저에너지 대사',
    description: '기초 에너지 소모가 적어 CO₂가 부족한 시기에도 오래 버티는 광합성 개체.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'upkeep', value: 0.72, rate: 0.5 }],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'resource', key: 'co2', cmp: 'lt', value: 250 }, multiplier: 3 }],
  },
  {
    id: 'photo_immune',
    title: '내독성 세포막',
    description: '독성에 잘 견뎌 오염된 환경에서도 병에 잘 걸리지 않는 광합성 개체.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'toxicityTolerance', value: 1.8, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 55 }, multiplier: 4 }],
  },
  {
    id: 'photo_breeder',
    title: '왕성한 번식',
    description: '더 적은 에너지로도 분열해 개체수를 빠르게 불리는 광합성 개체.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'divideEnergy', value: 0.75, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 30 }, multiplier: 3 }],
  },
  {
    id: 'photo_frugal_split',
    title: '절약 분열',
    description: '분열에 드는 에너지 소각이 적어 손실 없이 자주 나뉘는 광합성 개체.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'divideCost', value: 0.55, rate: 0.5 }],
    baseWeight: 5,
  },
  {
    id: 'photo_giant',
    title: '거대 엽록체 (트레이드오프)',
    description: '최대 에너지가 크게 늘지만 몸집이 커진 만큼 기초대사도 늘어난다.',
    category: 'photosynth',
    effects: [
      { kind: 'mutation', species: 'photosynth', field: 'maxEnergy', value: 1.5, rate: 0.45 },
      { kind: 'mutation', species: 'photosynth', field: 'upkeep', value: 1.25, rate: 0.45 },
    ],
    baseWeight: 5,
  },
  {
    id: 'photo_deep',
    title: '심층 광합성 (트레이드오프)',
    description: '광합성 효율이 크게 오르는 대신 그만큼 기초대사 부담도 커진다.',
    category: 'photosynth',
    effects: [
      { kind: 'mutation', species: 'photosynth', field: 'energyFromIntake', value: 1.6, rate: 0.45 },
      { kind: 'mutation', species: 'photosynth', field: 'upkeep', value: 1.3, rate: 0.45 },
    ],
    baseWeight: 5,
  },
  {
    id: 'photo_extremophile',
    title: '극한 내성 (트레이드오프)',
    description: '독성 내성이 매우 강해지지만 에너지 효율이 약간 떨어지는 광합성 개체.',
    category: 'photosynth',
    effects: [
      { kind: 'mutation', species: 'photosynth', field: 'toxicityTolerance', value: 2.0, rate: 0.45 },
      { kind: 'mutation', species: 'photosynth', field: 'energyFromIntake', value: 0.85, rate: 0.45 },
    ],
    baseWeight: 4,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 70 }, multiplier: 3 }],
  },
  {
    id: 'photo_colony',
    title: '밀집 군체 (위험)',
    description: '분열 비용이 절반으로 줄어 폭발적으로 늘지만, 개체가 약해져 쉽게 죽는다.',
    category: 'photosynth',
    effects: [
      { kind: 'mutation', species: 'photosynth', field: 'divideCost', value: 0.5, rate: 0.4 },
      { kind: 'mutation', species: 'photosynth', field: 'maxEnergy', value: 0.8, rate: 0.4 },
    ],
    baseWeight: 4,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 20 }, multiplier: 3 }],
  },

  // ══════════ 소비 세포 (광합성을 뜯는 초식자) ══════════
  {
    id: 'consumer_jaws',
    title: '예리한 이빨',
    description: '광합성 세포를 뜯을 때 더 많은 에너지를 얻는 소비 개체.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'attackEnergy', value: 1.45, rate: 0.5 }],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 12 }, multiplier: 3 }],
  },
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
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 15 }, multiplier: 3 }],
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
  {
    id: 'consumer_eyes',
    title: '매의 시야',
    description: '시야가 넓어 드물게 흩어진 광합성 세포도 찾아내는 소비 개체.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'vision', value: 1.5, rate: 0.45 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 30 }, multiplier: 2 }],
  },
  {
    id: 'consumer_immune',
    title: '면역 세포막',
    description: '독성 내성이 높아 오염 속에서도 병에 잘 걸리지 않는 소비 개체.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'toxicityTolerance', value: 1.8, rate: 0.5 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 55 }, multiplier: 4 }],
  },
  {
    id: 'consumer_ascetic',
    title: '굼벵이 대사 (트레이드오프)',
    description: '이동이 느려지는 대신 기초대사가 크게 줄어 오래 버티는 소비 개체.',
    category: 'consumer',
    effects: [
      { kind: 'mutation', species: 'consumer', field: 'moveSpeed', value: 0.6, rate: 0.45 },
      { kind: 'mutation', species: 'consumer', field: 'upkeep', value: 0.6, rate: 0.45 },
    ],
    baseWeight: 5,
  },
  {
    id: 'consumer_sprinter',
    title: '날렵한 유영 (트레이드오프)',
    description: '이동이 빨라 먹이를 잘 쫓지만, 그만큼 몸이 약해 최대 에너지가 준다.',
    category: 'consumer',
    effects: [
      { kind: 'mutation', species: 'consumer', field: 'moveSpeed', value: 1.4, rate: 0.45 },
      { kind: 'mutation', species: 'consumer', field: 'maxEnergy', value: 0.85, rate: 0.45 },
    ],
    baseWeight: 5,
  },
  {
    id: 'consumer_glutton',
    title: '게걸스러움 (트레이드오프)',
    description: '소화가 빨라 자주 먹지만, 왕성한 대사로 기초 에너지 소모가 커진다.',
    category: 'consumer',
    effects: [
      { kind: 'mutation', species: 'consumer', field: 'eatCooldown', value: 0.55, rate: 0.45 },
      { kind: 'mutation', species: 'consumer', field: 'upkeep', value: 1.3, rate: 0.45 },
    ],
    baseWeight: 5,
  },
  {
    id: 'consumer_bigbite',
    title: '대식 포식 (트레이드오프)',
    description: '한 번에 얻는 에너지가 크게 늘지만 소화가 느려져 자주 먹지 못한다.',
    category: 'consumer',
    effects: [
      { kind: 'mutation', species: 'consumer', field: 'attackEnergy', value: 1.7, rate: 0.4 },
      { kind: 'mutation', species: 'consumer', field: 'eatCooldown', value: 1.6, rate: 0.4 },
    ],
    baseWeight: 4,
  },

  // ══════════ 포식 세포 (소비 세포를 사냥) ══════════
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
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'gt', value: 80 }, multiplier: 3 }],
  },
  {
    id: 'predator_eyes',
    title: '매의 눈',
    description: '시야가 넓어 드물게 흩어진 소비 세포도 추적하는 포식 개체.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'vision', value: 1.5, rate: 0.45 }],
    baseWeight: 6,
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
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'predator', cmp: 'lt', value: 4 }, multiplier: 4 }],
  },
  {
    id: 'predator_breeder',
    title: '번식 특화',
    description: '더 적은 에너지로 분열해 사냥에 성공하면 빠르게 불어나는 포식 개체.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'divideEnergy', value: 0.78, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'predator', cmp: 'lt', value: 5 }, multiplier: 3 }],
  },
  {
    id: 'predator_frugal_split',
    title: '절약 분열',
    description: '분열 시 소각 에너지가 적어 새끼를 낳아도 손실이 적은 포식 개체.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'divideCost', value: 0.5, rate: 0.5 }],
    baseWeight: 5,
  },
  {
    id: 'predator_rapid',
    title: '속성 소화 (트레이드오프)',
    description: '소화가 빨라 소비 세포를 자주 사냥하지만 기초대사 부담이 커진다.',
    category: 'predator',
    effects: [
      { kind: 'mutation', species: 'predator', field: 'eatCooldown', value: 0.55, rate: 0.45 },
      { kind: 'mutation', species: 'predator', field: 'upkeep', value: 1.35, rate: 0.45 },
    ],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'gt', value: 100 }, multiplier: 2 }],
  },
  {
    id: 'predator_ambush',
    title: '은신 사냥 (트레이드오프)',
    description: '느리게 움직이는 대신 한 번의 사냥으로 훨씬 큰 에너지를 얻는 포식 개체.',
    category: 'predator',
    effects: [
      { kind: 'mutation', species: 'predator', field: 'moveSpeed', value: 0.65, rate: 0.45 },
      { kind: 'mutation', species: 'predator', field: 'attackEnergy', value: 1.6, rate: 0.45 },
    ],
    baseWeight: 5,
  },
  {
    id: 'predator_immune',
    title: '면역 세포막',
    description: '독성 내성이 높아 오염 속에서도 병에 잘 걸리지 않는 포식 개체.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'toxicityTolerance', value: 1.8, rate: 0.5 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 50 }, multiplier: 4 }],
  },
  {
    id: 'predator_titan',
    title: '거대 포식자 (위험)',
    description: '최대 에너지가 크게 늘지만 몸이 무거워져 이동이 느려지는 포식 개체.',
    category: 'predator',
    effects: [
      { kind: 'mutation', species: 'predator', field: 'maxEnergy', value: 1.6, rate: 0.4 },
      { kind: 'mutation', species: 'predator', field: 'moveSpeed', value: 0.75, rate: 0.4 },
    ],
    baseWeight: 4,
  },

  // ══════════ 분해 세포 (시체→CO₂ 재순환 + 독성 관리의 핵심) ══════════
  {
    id: 'decomposer_gut',
    title: '강화 소화',
    description: '시체에서 더 많은 에너지를 얻어 번성하는 분해 개체 — CO₂ 재순환·청소가 빨라진다.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'energyFromCorpse', value: 1.5, rate: 0.5 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 60 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_swift',
    title: '신속 기동',
    description: '더 빠르고 시야가 넓어 시체를 신속히 찾아 치우는 분해 개체.',
    category: 'decomposer',
    effects: [
      { kind: 'mutation', species: 'decomposer', field: 'moveSpeed', value: 1.4, rate: 0.45 },
      { kind: 'mutation', species: 'decomposer', field: 'vision', value: 1.25, rate: 0.45 },
    ],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 100 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_thrifty',
    title: '내핍 대사',
    description: '기초대사가 낮아 시체가 드문 시기에도 살아남는 분해 개체.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'upkeep', value: 0.72, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'decomposer', cmp: 'lt', value: 8 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_breeder',
    title: '번식 특화',
    description: '더 적은 에너지로 분열해 시체가 쌓일 때 빠르게 개체수를 늘리는 분해 개체.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'divideEnergy', value: 0.78, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 80 }, multiplier: 2 }],
  },
  {
    id: 'decomposer_frugal_split',
    title: '절약 분열',
    description: '분열 소각 에너지가 적어 손실 없이 자주 나뉘는 분해 개체.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'divideCost', value: 0.55, rate: 0.5 }],
    baseWeight: 5,
  },
  {
    id: 'decomposer_maw',
    title: '대식가 (트레이드오프)',
    description: '시체를 훨씬 빨리 먹어치우지만, 왕성한 대사로 기초 에너지 소모가 커진다.',
    category: 'decomposer',
    effects: [
      { kind: 'mutation', species: 'decomposer', field: 'corpseAppetite', value: 1.7, rate: 0.45 },
      { kind: 'mutation', species: 'decomposer', field: 'upkeep', value: 1.2, rate: 0.45 },
    ],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 60 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_slowclean',
    title: '굼벵이 청소부 (트레이드오프)',
    description: '이동이 느려지는 대신 시체 한 덩이에서 훨씬 많은 에너지를 뽑아내는 분해 개체.',
    category: 'decomposer',
    effects: [
      { kind: 'mutation', species: 'decomposer', field: 'moveSpeed', value: 0.6, rate: 0.45 },
      { kind: 'mutation', species: 'decomposer', field: 'energyFromCorpse', value: 1.5, rate: 0.45 },
    ],
    baseWeight: 5,
  },
  {
    id: 'decomposer_extremophile',
    title: '극한 내성',
    description: '독성에 매우 강해져 최악의 오염 속에서도 묵묵히 시체를 치우는 분해 개체.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'toxicityTolerance', value: 1.6, rate: 0.5 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 80 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_gorge',
    title: '폭식 분해 (위험)',
    description: '시체를 폭발적으로 치우지만, 대신 개체가 약해져 최대 에너지가 크게 준다.',
    category: 'decomposer',
    effects: [
      { kind: 'mutation', species: 'decomposer', field: 'corpseAppetite', value: 2.0, rate: 0.4 },
      { kind: 'mutation', species: 'decomposer', field: 'maxEnergy', value: 0.8, rate: 0.4 },
    ],
    baseWeight: 4,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 120 }, multiplier: 3 }],
  },
];

export const choiceDefs: ChoiceDef[] = choiceListSchema.parse(rawChoices) as ChoiceDef[];
