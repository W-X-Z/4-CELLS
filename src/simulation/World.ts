import { Rng } from '../core/prng';
import { SpatialHash } from '../core/spatial-hash';
import { clamp } from '../core/math';
import type { EnvironmentConfig } from '../data/environments';
import { speciesDefs } from '../data/species';
import { Environment } from './Environment';
import type { Cell, SimEvent, SpeciesDef, SpeciesId, WorldSnapshot } from './types';
import { runMovement } from './systems/Movement';
import { runMetabolism } from './systems/Metabolism';
import { runInteraction } from './systems/Interaction';
import { runReproduction } from './systems/Reproduction';
import { runDeath } from './systems/Death';

const SPECIES_ORDER: SpeciesId[] = ['photosynth', 'consumer', 'predator', 'decomposer'];

export interface TrendSample {
  time: number;
  counts: Record<SpeciesId, number>;
  resources: Record<string, number>;
}

/**
 * 시뮬레이션 세계. 렌더링/DOM 의존성 없음 -> 헤드리스로 완전히 구동 가능.
 */
export class World {
  readonly cfg: EnvironmentConfig;
  readonly env: Environment;
  readonly rng: Rng;
  readonly spatial: SpatialHash;

  cells: Cell[] = [];
  /** 런타임 종 명세 (선택지 Effect로 변경되므로 원본을 깊은 복사) */
  species: Record<SpeciesId, SpeciesDef>;

  time = 0;
  tick = 0;
  gameOver = false;
  private nextId = 1;
  private births: Cell[] = [];

  /** 추세 그래프용 히스토리 (제한 길이 링) */
  trend: TrendSample[] = [];
  private trendAccum = 0;

  /** 순간 이벤트 버퍼. 렌더러가 drainEvents()로 소비. 소비자가 없어도(헤드리스) 상한에서 멈춘다. */
  private events: SimEvent[] = [];

  constructor(seed: number, cfg: EnvironmentConfig) {
    this.cfg = cfg;
    this.rng = new Rng(seed);
    this.env = new Environment(cfg);
    this.spatial = new SpatialHash(48);
    this.species = deepCloneSpecies();
    this.seedInitialCells();
    this.recordTrend();
  }

  private seedInitialCells(): void {
    for (const id of SPECIES_ORDER) {
      const n = Math.round(this.cfg.initialCounts[id] ?? 0);
      const def = this.species[id];
      for (let i = 0; i < n; i++) {
        this.spawn(id, this.rng.range(0, this.cfg.width), this.rng.range(0, this.cfg.height), def.startEnergy);
      }
    }
  }

  spawn(species: SpeciesId, x: number, y: number, energy: number): Cell | null {
    if (this.cells.length + this.births.length >= this.cfg.maxCells) return null;
    const cell: Cell = {
      id: this.nextId++,
      species,
      x: clamp(x, 0, this.cfg.width),
      y: clamp(y, 0, this.cfg.height),
      vx: this.rng.range(-1, 1) * 4,
      vy: this.rng.range(-1, 1) * 4,
      energy,
      age: 0,
      divideTimer: 0,
      alive: true,
      flash: 0,
    };
    this.cells.push(cell);
    return cell;
  }

  /** Reproduction 시스템이 자식을 예약 (반복 중 배열 변형 방지) */
  queueBirth(species: SpeciesId, x: number, y: number, energy: number): void {
    if (this.cells.length + this.births.length >= this.cfg.maxCells) return;
    this.births.push({
      id: this.nextId++,
      species,
      x: clamp(x, 0, this.cfg.width),
      y: clamp(y, 0, this.cfg.height),
      vx: this.rng.range(-1, 1) * 4,
      vy: this.rng.range(-1, 1) * 4,
      energy,
      age: 0,
      divideTimer: this.species[species].divideCooldown,
      alive: true,
      flash: 0.6,
    });
  }

  step(dt: number): void {
    if (this.gameOver) return;

    // 1) 공간 해시 재구성(배열 인덱스를 id로 사용)
    this.spatial.clear();
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      this.spatial.insert(i, c.x, c.y);
    }

    // 2) 타이머/나이 갱신
    for (const c of this.cells) {
      c.age += dt;
      if (c.divideTimer > 0) c.divideTimer -= dt;
      if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 2);
    }

    // 3) 시스템 파이프라인 (렌더링과 분리)
    runMovement(this, dt);
    runMetabolism(this, dt);
    runInteraction(this, dt);
    runReproduction(this, dt);
    runDeath(this, dt);

    // 4) 환경 자연 변화
    this.env.update(dt);

    // 5) 사망 세포 정리 + 신생아 편입
    if (this.cells.some((c) => !c.alive)) {
      this.cells = this.cells.filter((c) => c.alive);
    }
    if (this.births.length) {
      for (const b of this.births) this.cells.push(b);
      this.births.length = 0;
    }

    this.time += dt;
    this.tick++;

    // 6) 추세 기록(0.5초 간격)
    this.trendAccum += dt;
    if (this.trendAccum >= 0.5) {
      this.trendAccum = 0;
      this.recordTrend();
    }

    // 7) 게임오버 판정
    if (this.cells.length === 0) this.gameOver = true;
  }

  pushEvent(e: SimEvent): void {
    if (this.events.length < 256) this.events.push(e);
  }

  /** 쌓인 이벤트를 반환하고 버퍼를 비운다 (렌더러 프레임마다 호출) */
  drainEvents(): SimEvent[] {
    if (this.events.length === 0) return this.events;
    const out = this.events;
    this.events = [];
    return out;
  }

  counts(): Record<SpeciesId, number> {
    const c: Record<SpeciesId, number> = { photosynth: 0, consumer: 0, predator: 0, decomposer: 0 };
    for (const cell of this.cells) c[cell.species]++;
    return c;
  }

  private recordTrend(): void {
    const counts = this.counts();
    this.trend.push({
      time: this.time,
      counts,
      resources: { ...this.env.resources },
    });
    if (this.trend.length > 240) this.trend.shift(); // 최근 120초
  }

  snapshot(): WorldSnapshot {
    const counts = this.counts();
    const total = this.cells.length;
    // 생물다양성: 종 분포의 균형도(정규화 Shannon) × 존재 종 수 보정
    const biodiversity = shannonEvenness(counts) * presentSpecies(counts);
    // 바이오매스: 총 에너지
    let biomass = 0;
    for (const c of this.cells) biomass += c.energy;
    // 점수: 생존시간 × (다양성 가중 + 개체수 가중)
    const score = Math.round(this.time * (1 + biodiversity) + biomass * 0.05 + total * 0.5);
    return {
      time: this.time,
      tick: this.tick,
      resources: { ...this.env.resources },
      counts,
      totalCells: total,
      score,
      biodiversity: Math.round(biodiversity * 100) / 100,
      biomass: Math.round(biomass),
      gameOver: this.gameOver,
    };
  }
}

function deepCloneSpecies(): Record<SpeciesId, SpeciesDef> {
  const out = {} as Record<SpeciesId, SpeciesDef>;
  for (const s of speciesDefs) {
    out[s.id] = {
      ...s,
      intake: { ...s.intake },
      output: { ...s.output },
      preyOn: [...s.preyOn],
    };
  }
  return out;
}

function presentSpecies(counts: Record<SpeciesId, number>): number {
  let n = 0;
  for (const k in counts) if (counts[k as SpeciesId] > 0) n++;
  return n;
}

function shannonEvenness(counts: Record<SpeciesId, number>): number {
  const values = Object.values(counts).filter((v) => v > 0);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0 || values.length <= 1) return 0;
  let h = 0;
  for (const v of values) {
    const p = v / total;
    h -= p * Math.log(p);
  }
  return h / Math.log(values.length); // 0..1
}
