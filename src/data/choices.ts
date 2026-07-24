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
    description: '적은 CO₂로 더 많은 에너지 → 번식 빨라짐.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'energyFromIntake', value: 1.4, rate: 0.5 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 40 }, multiplier: 3 }],
  },
  {
    id: 'photo_thrifty',
    title: '저에너지 대사',
    description: '기초대사↓ — CO₂가 마를 때 오래 버팀.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'upkeep', value: 0.72, rate: 0.5 }],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'resource', key: 'co2', cmp: 'lt', value: 250 }, multiplier: 3 }],
  },
  {
    id: 'photo_immune',
    title: '내독성 세포막',
    description: '독성 내성↑ — 오염 속에서도 잘 안 병듦.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'toxicityTolerance', value: 1.8, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 55 }, multiplier: 4 }],
  },
  {
    id: 'photo_breeder',
    title: '왕성한 번식',
    description: '분열 문턱↓ — 개체수를 빨리 불림.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'divideEnergy', value: 0.75, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 30 }, multiplier: 3 }],
  },
  {
    id: 'photo_frugal_split',
    title: '절약 분열',
    description: '분열 비용↓ — 손실 없이 자주 분열.',
    category: 'photosynth',
    effects: [{ kind: 'mutation', species: 'photosynth', field: 'divideCost', value: 0.55, rate: 0.5 }],
    baseWeight: 5,
  },
  {
    id: 'photo_giant',
    title: '거대 엽록체 (트레이드오프)',
    description: '최대 에너지↑ ↔ 기초대사↑',
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
    description: '광합성 효율↑↑ ↔ 기초대사↑',
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
    description: '독성 내성↑↑ ↔ 광합성 효율 약간↓',
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
    description: '분열 비용↓↓ ↔ 최대 에너지↓ (폭증하나 약함)',
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
    description: '포식 1회 에너지↑.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'attackEnergy', value: 1.45, rate: 0.5 }],
    baseWeight: 7,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 12 }, multiplier: 3 }],
  },
  {
    id: 'consumer_hardy',
    title: '강인한 세포질',
    description: '최대 에너지↑·기초대사↓ — 굶주림에 강함.',
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
    description: '분열 문턱↓ — 개체수 빠른 회복.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'divideEnergy', value: 0.75, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'consumer', cmp: 'lt', value: 10 }, multiplier: 4 }],
  },
  {
    id: 'consumer_eyes',
    title: '매의 시야',
    description: '시야↑ — 흩어진 먹이도 탐지.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'vision', value: 1.5, rate: 0.45 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'count', species: 'photosynth', cmp: 'lt', value: 30 }, multiplier: 2 }],
  },
  {
    id: 'consumer_immune',
    title: '면역 세포막',
    description: '독성 내성↑ — 오염 속에서도 잘 안 병듦.',
    category: 'consumer',
    effects: [{ kind: 'mutation', species: 'consumer', field: 'toxicityTolerance', value: 1.8, rate: 0.5 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 55 }, multiplier: 4 }],
  },
  {
    id: 'consumer_ascetic',
    title: '굼벵이 대사 (트레이드오프)',
    description: '이동↓ ↔ 기초대사↓↓ (느리나 오래 버팀)',
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
    description: '이동↑ ↔ 최대 에너지↓ (빠르나 약함)',
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
    description: '소화 빠름 ↔ 기초대사↑ (자주 먹음)',
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
    description: '포식 에너지↑↑ ↔ 소화 느림',
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
    description: '이동↑·공격↑ — 먹이가 넘칠 때 강함.',
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
    description: '시야↑ — 흩어진 먹이도 추적.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'vision', value: 1.5, rate: 0.45 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'predator', cmp: 'lt', value: 5 }, multiplier: 3 }],
  },
  {
    id: 'predator_hardy',
    title: '끈질긴 포식자',
    description: '최대 에너지↑·기초대사↓ — 먹이 가뭄에 강함.',
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
    description: '분열 문턱↓ — 사냥 성공 시 빠른 증식.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'divideEnergy', value: 0.78, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'predator', cmp: 'lt', value: 5 }, multiplier: 3 }],
  },
  {
    id: 'predator_frugal_split',
    title: '절약 분열',
    description: '분열 비용↓ — 손실 적게 번식.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'divideCost', value: 0.5, rate: 0.5 }],
    baseWeight: 5,
  },
  {
    id: 'predator_rapid',
    title: '속성 소화 (트레이드오프)',
    description: '소화 빠름 ↔ 기초대사↑ (자주 사냥)',
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
    description: '이동↓ ↔ 공격↑↑ (한 방이 강함)',
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
    description: '독성 내성↑ — 오염 속에서도 잘 안 병듦.',
    category: 'predator',
    effects: [{ kind: 'mutation', species: 'predator', field: 'toxicityTolerance', value: 1.8, rate: 0.5 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 50 }, multiplier: 4 }],
  },
  {
    id: 'predator_titan',
    title: '거대 포식자 (위험)',
    description: '최대 에너지↑↑ ↔ 이동↓ (크나 느림)',
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
    description: '시체 섭취 효율↑ — CO₂ 재순환·청소 가속.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'energyFromCorpse', value: 1.5, rate: 0.5 }],
    baseWeight: 8,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 60 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_swift',
    title: '신속 기동',
    description: '이동↑·시야↑ — 시체를 신속히 청소.',
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
    description: '기초대사↓ — 시체가 드물 때도 생존.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'upkeep', value: 0.72, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'count', species: 'decomposer', cmp: 'lt', value: 8 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_breeder',
    title: '번식 특화',
    description: '분열 문턱↓ — 시체 쌓일 때 빠른 증식.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'divideEnergy', value: 0.78, rate: 0.5 }],
    baseWeight: 6,
    boostWhen: [{ when: { kind: 'corpses', cmp: 'gt', value: 80 }, multiplier: 2 }],
  },
  {
    id: 'decomposer_frugal_split',
    title: '절약 분열',
    description: '분열 비용↓ — 손실 없이 자주 분열.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'divideCost', value: 0.55, rate: 0.5 }],
    baseWeight: 5,
  },
  {
    id: 'decomposer_maw',
    title: '대식가 (트레이드오프)',
    description: '시체 섭식↑↑ ↔ 기초대사↑',
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
    description: '이동↓ ↔ 시체 섭취 효율↑',
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
    description: '독성 내성↑↑ — 최악의 오염도 견딤.',
    category: 'decomposer',
    effects: [{ kind: 'mutation', species: 'decomposer', field: 'toxicityTolerance', value: 1.6, rate: 0.5 }],
    baseWeight: 5,
    boostWhen: [{ when: { kind: 'resource', key: 'toxicity', cmp: 'gt', value: 80 }, multiplier: 3 }],
  },
  {
    id: 'decomposer_gorge',
    title: '폭식 분해 (위험)',
    description: '시체 섭식↑↑↑ ↔ 최대 에너지↓',
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
