import type { World } from '../simulation/World';
import type { SpeciesDef } from '../simulation/types';
import type { Effect, Op } from './types';

function applyOp(current: number, op: Op, value: number): number {
  switch (op) {
    case 'add': return current + value;
    case 'mul': return current * value;
    case 'set': return value;
  }
}

/** 단일 Effect를 월드에 적용. 모든 선택지는 이 함수들의 조합으로 실행된다. */
export function applyEffect(world: World, effect: Effect): void {
  switch (effect.kind) {
    case 'resource': {
      const r = world.env.resources;
      r[effect.key] = Math.max(0, applyOp(r[effect.key], effect.op, effect.value));
      break;
    }
    case 'resourceRegen': {
      const g = world.env.regen;
      g[effect.key] = applyOp(g[effect.key], effect.op, effect.value);
      break;
    }
    case 'species': {
      const def = world.species[effect.species] as SpeciesDef & Record<string, number>;
      def[effect.field] = Math.max(0, applyOp(def[effect.field] as number, effect.op, effect.value));
      break;
    }
    case 'metabolism': {
      const def = world.species[effect.species];
      const map = effect.io === 'intake' ? def.intake : def.output;
      const cur = map[effect.key] ?? 0;
      map[effect.key] = Math.max(0, applyOp(cur, effect.op, effect.value));
      break;
    }
    case 'moveMode': {
      world.species[effect.species].moveMode = effect.value;
      break;
    }
    case 'predation': {
      const list = world.species[effect.species].preyOn;
      if (effect.op === 'add') {
        if (!list.includes(effect.target)) list.push(effect.target);
      } else {
        const idx = list.indexOf(effect.target);
        if (idx >= 0) list.splice(idx, 1);
      }
      break;
    }
    case 'spawn': {
      const def = world.species[effect.species];
      for (let i = 0; i < effect.count; i++) {
        world.spawn(
          effect.species,
          world.rng.range(0, world.cfg.width),
          world.rng.range(0, world.cfg.height),
          def.startEnergy,
        );
      }
      break;
    }
  }
}

export function applyEffects(world: World, effects: Effect[]): void {
  for (const e of effects) applyEffect(world, e);
}
