import type { Rng } from '../core/prng';
import type { Cell, GeneField, Mutation, SpeciesDef } from './types';

/**
 * 유전 형질 반영: 종 기본 수치에 개체의 유전자 배율을 곱한 실효 수치.
 * 야생형(genes 없음)은 종 기본값을 그대로 사용한다.
 */
export function eff(def: SpeciesDef, cell: Cell, field: GeneField): number {
  const base = (def as unknown as Record<GeneField, number>)[field];
  const g = cell.genes;
  const mul = g ? g[field] : undefined;
  return mul === undefined ? base : base * mul;
}

/**
 * 자손의 유전형 계산.
 * 부모 형질을 그대로 물려받고, 유전자풀의 각 돌연변이 중 아직 없는 것을 rate 확률로 새로 발현한다.
 * => 유익한 형질은 생존/번식을 통해 세대가 지날수록 개체군에 퍼진다(등장률=확산 속도).
 */
export function deriveChildGenetics(
  pool: Mutation[],
  parent: Cell,
  rng: Rng,
): { genes?: Partial<Record<GeneField, number>>; carried?: number[] } {
  const genes: Partial<Record<GeneField, number>> = parent.genes ? { ...parent.genes } : {};
  const carried: number[] = parent.carried ? parent.carried.slice() : [];

  for (let i = 0; i < pool.length; i++) {
    const m = pool[i];
    if (carried.includes(m.id)) continue;
    if (rng.chance(m.rate)) {
      carried.push(m.id);
      genes[m.field] = (genes[m.field] ?? 1) * m.value;
    }
  }

  return {
    genes: Object.keys(genes).length ? genes : undefined,
    carried: carried.length ? carried : undefined,
  };
}
