import type { World } from '../simulation/World';
import { choiceDefs } from '../data/choices';
import type { ChoiceDef } from './types';
import { applyEffects } from './EffectExecutor';
import { contextFromWorld, evaluateAll, evaluateCondition, type EvalContext } from './ConditionEvaluator';

/**
 * 선택지 시스템.
 * - 완전 무작위가 아니라 "상황 가중치"로 후보를 뽑는다:
 *   위기(예: 산소 부족)일 때 대응 선택지의 등장 확률이 올라간다
 *   -> 플레이어가 자기 결정으로 대응했다는 감각을 강화.
 */
export class ChoiceSystem {
  constructor(
    private world: World,
    /** 선택지 등장 주기(초). 조절 가능한 핵심 페이싱 값. */
    public interval = 18,
  ) {}

  private computeWeight(ctx: EvalContext, def: ChoiceDef): number {
    let w = def.baseWeight;
    if (def.boostWhen) {
      for (const b of def.boostWhen) {
        if (evaluateCondition(ctx, b.when)) w *= b.multiplier;
      }
    }
    return w;
  }

  /** 등장 조건을 만족하는 후보 중 가중치 기반으로 n개를 중복 없이 뽑는다. */
  generate(n = 3): ChoiceDef[] {
    const ctx = contextFromWorld(this.world);
    const pool = choiceDefs.filter((d) => evaluateAll(ctx, d.requires));
    const weights = pool.map((d) => this.computeWeight(ctx, d));
    const picks: ChoiceDef[] = [];
    const available = pool.slice();
    const w = weights.slice();

    for (let k = 0; k < n && available.length > 0; k++) {
      const idx = this.world.rng.weightedIndex(w);
      if (idx < 0) break;
      picks.push(available[idx]);
      available.splice(idx, 1);
      w.splice(idx, 1);
    }
    return picks;
  }

  /** 선택 적용 */
  apply(choiceId: string): boolean {
    const def = choiceDefs.find((d) => d.id === choiceId);
    if (!def) return false;
    applyEffects(this.world, def.effects);
    return true;
  }
}
