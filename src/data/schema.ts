import { z } from 'zod';
import { RESOURCE_KEYS } from '../simulation/types';

const resourceKey = z.enum(RESOURCE_KEYS);
const speciesId = z.enum(['photosynth', 'consumer', 'predator', 'decomposer']);
const partialResources = z.record(resourceKey, z.number()).default({});

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
  preyOn: z.array(speciesId).default([]),
  attackEnergy: z.number().nonnegative(),
  divideEnergy: z.number().positive(),
  divideCooldown: z.number().nonnegative(),
  maxEnergy: z.number().positive(),
  lifespan: z.number().positive(),
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
  initialCounts: z.record(speciesId, z.number()),
});

const cmp = z.enum(['lt', 'lte', 'gt', 'gte']);
const op = z.enum(['add', 'mul', 'set']);

const conditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }),
  z.object({ kind: z.literal('resource'), key: resourceKey, cmp, value: z.number() }),
  z.object({ kind: z.literal('count'), species: speciesId, cmp, value: z.number() }),
  z.object({ kind: z.literal('totalCells'), cmp, value: z.number() }),
  z.object({ kind: z.literal('time'), cmp, value: z.number() }),
]);

const effectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resource'), op, key: resourceKey, value: z.number() }),
  z.object({ kind: z.literal('resourceRegen'), op, key: resourceKey, value: z.number() }),
  z.object({
    kind: z.literal('species'),
    op,
    species: speciesId,
    field: z.enum([
      'moveSpeed', 'radius', 'energyFromIntake', 'upkeep', 'attackEnergy',
      'divideEnergy', 'divideCooldown', 'maxEnergy', 'lifespan', 'toxicityTolerance',
    ]),
    value: z.number(),
  }),
  z.object({
    kind: z.literal('metabolism'), op, species: speciesId,
    io: z.enum(['intake', 'output']), key: resourceKey, value: z.number(),
  }),
  z.object({ kind: z.literal('moveMode'), species: speciesId, value: z.enum(['drift', 'seekResource', 'seekPrey']) }),
  z.object({ kind: z.literal('predation'), op: z.enum(['add', 'remove']), species: speciesId, target: speciesId }),
  z.object({ kind: z.literal('spawn'), species: speciesId, count: z.number().int() }),
]);

export const choiceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(['environment', 'ability', 'behavior', 'metabolism', 'spawn']),
  effects: z.array(effectSchema).min(1),
  baseWeight: z.number().positive(),
  requires: z.array(conditionSchema).optional(),
  boostWhen: z.array(z.object({ when: conditionSchema, multiplier: z.number().positive() })).optional(),
});

export const speciesListSchema = z.array(speciesSchema);
export const choiceListSchema = z.array(choiceSchema);
