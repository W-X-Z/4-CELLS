import { speciesListSchema } from './schema';
import type { SpeciesDef } from '../simulation/types';

/**
 * 초기 세포 4종.
 * 자원 순환 루프:
 *   광합성: 빛+CO2 소비 -> O2 생산            (에너지 획득)
 *   소비:   유기물+O2 소비 -> CO2 생산         (에너지 획득)
 *   포식:   소비세포 포식 + O2 소비 -> CO2 생산 (포식으로 에너지 획득)
 *   분해:   유기물+독성 소비 -> CO2 생산        (에너지 획득, 독성 정화)
 *   사망:   유기물+독성을 풀로 환원
 * => 광합성이 무너지면 O2 붕괴 -> 소비/포식 연쇄 사망 -> 유기물/독성 폭증 => 연쇄 붕괴.
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
    intake: { light: 2.5, co2: 2.5 },
    output: { oxygen: 5 },
    energyFromIntake: 7,
    upkeep: 2,
    preyOn: [],
    attackEnergy: 0,
    divideEnergy: 60,
    divideCooldown: 4,
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
    moveMode: 'drift',
    intake: { organic: 3, oxygen: 1.5 },
    output: { co2: 2.5 },
    energyFromIntake: 7,
    upkeep: 2,
    preyOn: [],
    attackEnergy: 0,
    divideEnergy: 45,
    divideCooldown: 5,
    maxEnergy: 100,
    lifespan: 75,
    toxicityTolerance: 350,
    corpseOrganic: 7,
    corpseToxicity: 2,
    startEnergy: 28,
  },
  {
    id: 'predator',
    name: '포식 세포',
    color: 0xf87171,
    shape: 'triangle',
    radius: 5,
    moveSpeed: 30,
    moveMode: 'seekPrey',
    intake: { oxygen: 2 },
    output: { co2: 2 },
    energyFromIntake: 2,
    upkeep: 2.5,
    preyOn: ['consumer'],
    attackEnergy: 26,
    divideEnergy: 85,
    divideCooldown: 10,
    maxEnergy: 120,
    lifespan: 80,
    toxicityTolerance: 300,
    corpseOrganic: 9,
    corpseToxicity: 3,
    startEnergy: 40,
  },
  {
    id: 'decomposer',
    name: '분해 세포',
    color: 0xfacc15,
    shape: 'ring',
    radius: 4,
    moveSpeed: 10,
    moveMode: 'drift',
    intake: { organic: 2, toxicity: 1.5 },
    output: { co2: 1.5 },
    energyFromIntake: 7,
    upkeep: 1.2,
    preyOn: [],
    attackEnergy: 0,
    divideEnergy: 50,
    divideCooldown: 6,
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
