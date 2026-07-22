import { z } from 'zod';
import { RESOURCE_KEYS } from '../simulation/types';

const resourceKey = z.enum(RESOURCE_KEYS);
const speciesId = z.enum(['photosynth', 'consumer', 'predator', 'decomposer']);
const partialResources = z.record(resourceKey, z.number()).default({});

const geneField = z.enum([
  'moveSpeed', 'vision', 'energyFromIntake', 'upkeep', 'attackEnergy',
  'divideEnergy', 'maxEnergy', 'toxicityTolerance', 'energyFromCorpse',
  'eatCooldown', 'divideCost', 'corpseAppetite',
]);

export const speciesSchema = z.object({
  id: speciesId,
  name: z.string(),
  color: z.number().int().nonnegative(),
  shape: z.enum(['circle', 'triangle', 'ring', 'diamond']),
  radius: z.number().positive(),
  moveSpeed: z.number().nonnegative(),
  moveMode: z.enum(['drift', 'seekResource', 'seekPrey']),
  vision: z.number().nonnegative().default(0),
  intake: partialResources,
  output: partialResources,
  energyFromIntake: z.number().nonnegative(),
  scavenge: partialResources,
  energyFromScavenge: z.number().nonnegative().default(0),
  upkeep: z.number().nonnegative(),
  respires: z.boolean().default(true),
  corpseAppetite: z.number().nonnegative().default(0),
  energyFromCorpse: z.number().nonnegative().default(0),
  preyOn: z.array(speciesId).default([]),
  attackEnergy: z.number().nonnegative(),
  eatCooldown: z.number().nonnegative().default(0),
  divideEnergy: z.number().positive(),
  divideCost: z.number().nonnegative().default(0),
  divideCooldown: z.number().nonnegative(),
  maxEnergy: z.number().positive(),
  toxicityTolerance: z.number().nonnegative(),
  corpseOrganic: z.number().nonnegative(),
  corpseToxicity: z.number().nonnegative(),
  startEnergy: z.number().nonnegative(),
});

export const environmentSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  simRate: z.number().positive(),
  maxCells: z.number().positive(),
  initialResources: z.record(resourceKey, z.number()),
  displayCaps: z.record(resourceKey, z.number()),
  ambientHeat: z.number(),
  heatDissipation: z.number(),
  toxicityDecay: z.number(),
  respirationRate: z.number(),
  respirationCo2Ratio: z.number(),
  suffocationPenalty: z.number(),
  o2Atmosphere: z.number().nonnegative().default(0),
  co2Atmosphere: z.number().nonnegative().default(0),
  atmExchange: z.number().nonnegative().default(0),
  // 시체 시스템
  initialCorpses: z.number().nonnegative().default(0),
  // 진화 페이싱: 첫 진화까지의 분열 수 + 진화마다 늘어나는 간격
  divisionsPerChoice: z.number().positive().default(40),
  divisionsGrowth: z.number().nonnegative().default(0),
  initialCounts: z.record(speciesId, z.number()),
});

const cmp = z.enum(['lt', 'lte', 'gt', 'gte']);

const conditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }),
  z.object({ kind: z.literal('resource'), key: resourceKey, cmp, value: z.number() }),
  z.object({ kind: z.literal('count'), species: speciesId, cmp, value: z.number() }),
  z.object({ kind: z.literal('totalCells'), cmp, value: z.number() }),
  z.object({ kind: z.literal('corpses'), cmp, value: z.number() }),
  z.object({ kind: z.literal('time'), cmp, value: z.number() }),
]);

const effectSchema = z.object({
  kind: z.literal('mutation'),
  species: speciesId,
  field: geneField,
  value: z.number().positive(),
  rate: z.number().min(0).max(1),
});

export const choiceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: speciesId,
  effects: z.array(effectSchema).min(1),
  baseWeight: z.number().positive(),
  requires: z.array(conditionSchema).optional(),
  boostWhen: z.array(z.object({ when: conditionSchema, multiplier: z.number().positive() })).optional(),
});

export const speciesListSchema = z.array(speciesSchema);
export const choiceListSchema = z.array(choiceSchema);
