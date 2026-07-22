import { speciesListSchema } from './schema';
import type { SpeciesDef } from '../simulation/types';

/**
 * 초기 세포 4종.
 * 자원 순환 루프:
 *   광합성: CO₂ 소비 -> O₂ 생산                 (에너지 획득)
 *   소비:   광합성 세포 포식 + (부족 시)시체 섭식  (에너지 획득)
 *   포식:   소비 세포 포식                        (에너지 획득)
 *   분해:   시체 섭식 + 독성 정화                  (에너지 획득, 독성 감소)
 *   사망:   시체(유기물 질량 + 잠재 독성)를 남김
 * => 광합성이 무너지면 O₂ 붕괴 -> 소비/포식 연쇄 사망 -> 시체 폭증 -> 부패 독성 => 연쇄 붕괴.
 */
const rawSpecies: SpeciesDef[] = [
  {
    id: 'photosynth',
    name: '광합성 세포',
    color: 0x4ade80,
    shape: 'circle',
    radius: 4,
    moveSpeed: 8,
    moveMode: 'drift',
    vision: 0,
    intake: { co2: 1.8 },
    output: { oxygen: 4.5 },
    energyFromIntake: 6,
    scavenge: {},
    energyFromScavenge: 0,
    upkeep: 2,
    corpseAppetite: 0,
    energyFromCorpse: 0,
    preyOn: [],
    attackEnergy: 0,
    eatCooldown: 0,
    divideEnergy: 58,
    divideCost: 12, // 분열마다 에너지 소각 → CO₂(광합성 원료)가 마르면 분열도 멈춘다
    divideCooldown: 5,
    maxEnergy: 100,
    lifespan: 90,
    toxicityTolerance: 400,
    corpseOrganic: 6,
    corpseToxicity: 1,
    startEnergy: 30,
  },
  {
    id: 'consumer',
    name: '소비 세포',
    color: 0x60a5fa,
    shape: 'diamond',
    radius: 4.5,
    moveSpeed: 22,
    moveMode: 'seekPrey', // 광합성 세포를 뜯어먹는 초식자
    vision: 150, // 좁은 시야 → 저밀도 광합성에 피난처
    intake: {},
    output: {},
    energyFromIntake: 0,
    scavenge: {},
    energyFromScavenge: 0,
    upkeep: 1.4,
    corpseAppetite: 0, // 시체는 먹지 않는다(분해 세포의 역할) — 오직 광합성 세포 포식으로만 산다
    energyFromCorpse: 0,
    preyOn: ['photosynth'],
    attackEnergy: 16,
    eatCooldown: 1.2, // 한 번 먹으면 소화 시간(배부름)
    divideEnergy: 64, // 더 많이 먹어야 분열 → 광합성을 급격히 절멸시키는 과증식 완화
    divideCost: 8,
    divideCooldown: 6,
    maxEnergy: 110,
    lifespan: 90,
    toxicityTolerance: 350,
    corpseOrganic: 7,
    corpseToxicity: 2,
    startEnergy: 45,
  },
  {
    id: 'predator',
    name: '포식 세포',
    color: 0xf87171,
    shape: 'triangle',
    radius: 5,
    moveSpeed: 30,
    moveMode: 'seekPrey',
    vision: 280, // 넓은 시야 → 드문 소비 세포도 추적, 개체군 유지
    intake: {},
    output: {},
    energyFromIntake: 0,
    scavenge: {},
    energyFromScavenge: 0,
    upkeep: 1.8,
    corpseAppetite: 0,
    energyFromCorpse: 0,
    preyOn: ['consumer'],
    attackEnergy: 24,
    eatCooldown: 2.0, // 큰 포식자일수록 소화가 오래 걸린다(배부름)
    divideEnergy: 100,
    divideCost: 14,
    divideCooldown: 14,
    maxEnergy: 120,
    lifespan: 100,
    toxicityTolerance: 300,
    corpseOrganic: 9,
    corpseToxicity: 3,
    startEnergy: 55,
  },
  {
    id: 'decomposer',
    name: '분해 세포',
    color: 0xfacc15,
    shape: 'ring',
    radius: 4,
    moveSpeed: 16,
    moveMode: 'seekResource', // 시체를 향해 이동
    vision: 260,
    intake: {},
    output: {},
    energyFromIntake: 0,
    scavenge: { toxicity: 4 }, // 전역 독성을 흡수해 정화(보너스 에너지)
    energyFromScavenge: 2,
    upkeep: 0.9,
    corpseAppetite: 5, // 시체를 먹어 유기물을 순환 — 방치 부패(독성)를 막는 청소부
    energyFromCorpse: 2.2,
    preyOn: [],
    attackEnergy: 0,
    eatCooldown: 0, // 청소부 역할 유지 위해 시체 섭식엔 소화 제약을 두지 않음
    divideEnergy: 62,
    divideCost: 10,
    divideCooldown: 7,
    maxEnergy: 90,
    lifespan: 100,
    toxicityTolerance: 800,
    corpseOrganic: 4,
    corpseToxicity: 0,
    startEnergy: 25,
  },
];

export const speciesDefs: SpeciesDef[] = speciesListSchema.parse(rawSpecies) as SpeciesDef[];

export const speciesById: Record<string, SpeciesDef> = Object.fromEntries(
  speciesDefs.map((s) => [s.id, s]),
);
