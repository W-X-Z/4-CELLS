import type { World } from '../simulation/World';
import type { ResourceKey, SpeciesId } from '../simulation/types';
import type { Cmp, Condition } from './types';

export interface EvalContext {
  resources: Record<ResourceKey, number>;
  counts: Record<SpeciesId, number>;
  totalCells: number;
  time: number;
}

export function contextFromWorld(world: World): EvalContext {
  const counts = world.counts();
  return {
    resources: world.env.resources,
    counts,
    totalCells: world.cells.length,
    time: world.time,
  };
}

function compare(a: number, cmp: Cmp, b: number): boolean {
  switch (cmp) {
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'gt': return a > b;
    case 'gte': return a >= b;
  }
}

export function evaluateCondition(ctx: EvalContext, cond: Condition): boolean {
  switch (cond.kind) {
    case 'always': return true;
    case 'resource': return compare(ctx.resources[cond.key], cond.cmp, cond.value);
    case 'count': return compare(ctx.counts[cond.species], cond.cmp, cond.value);
    case 'totalCells': return compare(ctx.totalCells, cond.cmp, cond.value);
    case 'time': return compare(ctx.time, cond.cmp, cond.value);
  }
}

export function evaluateAll(ctx: EvalContext, conds: Condition[] | undefined): boolean {
  if (!conds || conds.length === 0) return true;
  return conds.every((c) => evaluateCondition(ctx, c));
}
