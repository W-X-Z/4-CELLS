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
    intake: { co2: 1.0 }, // CO₂를 적게 써야 제한된 CO₂ 공급으로 더 많은 광합성이 유지된다
    output: { oxygen: 2.0 }, // o2out×respirationCo2Ratio ≈ co2in 이 되도록(탄소 균형점)
    energyFromIntake: 6,
    scavenge: {},
    energyFromScavenge: 0,
    upkeep: 2,
    respires: false, // 광합성: 호흡하지 않고 광합성으로만 에너지
    corpseAppetite: 0,
    energyFromCorpse: 0,
    preyOn: [],
    attackEnergy: 0,
    eatCooldown: 0,
    divideEnergy: 58,
    divideCost: 12, // 분열마다 에너지 소각 → CO₂(광합성 원료)가 마르면 분열도 멈춘다
    divideCooldown: 5,
    maxEnergy: 100,
    toxicityTolerance: 70, // 실제 독성 규모(~40~90)에 맞춤 — 독성이 오르면 감염 시작
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
    moveSpeed: 24,
    moveMode: 'seekPrey', // 광합성 세포를 뜯어먹는 초식자
    vision: 170, // 먹이 탐지와 피난처(과도한 절멸 방지)의 절충
    intake: {},
    output: {},
    energyFromIntake: 0,
    scavenge: {},
    energyFromScavenge: 0,
    upkeep: 1.0, // 낮은 기초대사 → 먹이 부족 시기를 더 잘 버팀
    respires: true,
    corpseAppetite: 0, // 시체는 먹지 않는다(분해 세포의 역할) — 오직 광합성 세포 포식으로만 산다
    energyFromCorpse: 0,
    preyOn: ['photosynth'],
    attackEnergy: 22, // 포식 1회당 에너지↑ → 번식 여유
    eatCooldown: 3.5, // 소화 시간(배부름)↑ — 분열 직후 광합성 세포를 급속히 뜯어먹지 않도록
    divideEnergy: 38, // 적은 초기 수(3)에서 빨리 번식해 포식 압력 전에 개체군을 세우도록 하향
    divideCost: 6,
    divideCooldown: 6,
    maxEnergy: 110,
    toxicityTolerance: 65,
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
    moveSpeed: 28, // 시야·속도를 낮춰 소비 세포에 공간적 피난처를 준다(적은 수의 소비 세포 조기 절멸 방지)
    moveMode: 'seekPrey',
    vision: 160, // 시야를 크게 낮춰 소비 세포가 초반에 숨을 여지를 준다(돌연변이 '매의 눈'으로 회복 가능)
    intake: {},
    output: {},
    energyFromIntake: 0,
    scavenge: {},
    energyFromScavenge: 0,
    upkeep: 1.6,
    respires: true,
    corpseAppetite: 0,
    energyFromCorpse: 0,
    preyOn: ['consumer'],
    attackEnergy: 24,
    eatCooldown: 6.0, // 소화가 오래 걸림 → 소비 세포를 과도하게 사냥해 절멸시키지 않도록(쿨↑)
    divideEnergy: 72, // 느린 사냥으로도 도달 가능하게 하향 — 먹이를 잡으면 이따금 번식
    divideCost: 10,
    divideCooldown: 14,
    maxEnergy: 120,
    toxicityTolerance: 55, // 내성이 낮아 오염에 가장 먼저 병든다
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
    scavenge: {}, // 독성을 직접 흡수하지 않는다 — 시체를 먹어 독성의 '원천'을 제거하는 방식으로 정화
    energyFromScavenge: 0,
    upkeep: 0.9,
    respires: true,
    corpseAppetite: 5, // 시체를 먹어 유기물을 순환 — 시체를 치워 독성 방출을 막는 청소부
    energyFromCorpse: 2.4,
    preyOn: [],
    attackEnergy: 0,
    eatCooldown: 0, // 청소부 역할 유지 위해 시체 섭식엔 소화 제약을 두지 않음
    divideEnergy: 62,
    divideCost: 10,
    divideCooldown: 7,
    maxEnergy: 90,
    toxicityTolerance: 140, // 오물 속에서 일하는 분해 세포는 독성에 강함
    corpseOrganic: 4,
    corpseToxicity: 0,
    startEnergy: 25,
  },
];

export const speciesDefs: SpeciesDef[] = speciesListSchema.parse(rawSpecies) as SpeciesDef[];

export const speciesById: Record<string, SpeciesDef> = Object.fromEntries(
  speciesDefs.map((s) => [s.id, s]),
);
