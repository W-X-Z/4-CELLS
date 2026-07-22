import type { World } from '../simulation/World';
import type { Effect } from './types';

/** 단일 Effect를 월드에 적용. 모든 선택지는 이 함수들의 조합으로 실행된다. */
export function applyEffect(world: World, effect: Effect): void {
  switch (effect.kind) {
    case 'mutation': {
      world.addMutation(effect.species, effect.field, effect.value, effect.rate);
      break;
    }
  }
}

export function applyEffects(world: World, effects: Effect[]): void {
  for (const e of effects) applyEffect(world, e);
}
