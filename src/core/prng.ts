/**
 * 시드 기반 결정론적 난수 생성기.
 * 같은 시드 -> 같은 난수열. (Math.random 은 시드 재현이 불가능하므로 절대 사용하지 않는다.)
 * mulberry32: 빠르고 품질이 충분한 32bit PRNG.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // splitmix 스타일로 시드를 한 번 섞어 초기 상태 편향 제거
    let s = seed >>> 0;
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = (z ^ (z >>> 16)) >>> 0;
    z = Math.imul(z, 0x21f0aaad) >>> 0;
    z = (z ^ (z >>> 15)) >>> 0;
    z = Math.imul(z, 0x735a2d97) >>> 0;
    this.state = (z ^ (z >>> 15)) >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** [min, max] 정수 */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** true 확률 p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 배열에서 가중치 기반 하나 선택. weights 합이 0이면 -1 반환. */
  weightedIndex(weights: number[]): number {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return i;
      r -= w;
    }
    return weights.length - 1;
  }

  /** 현재 상태 스냅샷 (저장/복원용) */
  snapshot(): number {
    return this.state;
  }

  restore(state: number): void {
    this.state = state >>> 0;
  }
}

/** 문자열 시드 -> 숫자 시드 */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
