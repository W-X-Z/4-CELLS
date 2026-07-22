import { Rng } from '../core/prng';
import { SpatialHash } from '../core/spatial-hash';
import { clamp } from '../core/math';
import type { EnvironmentConfig } from '../data/environments';
import { speciesDefs } from '../data/species';
import { Environment } from './Environment';
import type { Cell, Corpse, GeneField, Mutation, SimEvent, SpeciesDef, SpeciesId, WorldSnapshot } from './types';
import { deriveChildGenetics } from './genetics';
import { runMovement } from './systems/Movement';
import { runMetabolism } from './systems/Metabolism';
import { runInteraction } from './systems/Interaction';
import { runScavenging } from './systems/Scavenging';
import { runReproduction } from './systems/Reproduction';
import { runDeath } from './systems/Death';
import { runCorpseDecay } from './systems/Corpse';

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
  readonly corpseHash: SpatialHash;

  cells: Cell[] = [];
  corpses: Corpse[] = [];
  /** 런타임 종 명세 (기본값). 개체별 변이는 cell.genes로 표현되므로 여기선 야생형만 유지. */
  species: Record<SpeciesId, SpeciesDef>;
  /** 종별 유전자풀 — 선택지가 넣은 돌연변이. 신생아가 등장률에 따라 발현. */
  genePool: Record<SpeciesId, Mutation[]>;

  time = 0;
  tick = 0;
  divisions = 0; // 누적 분열 수(진화 트리거)
  gameOver = false;
  private nextId = 1;
  private nextCorpseId = 1;
  private nextMutationId = 1;
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
    this.corpseHash = new SpatialHash(48);
    this.species = deepCloneSpecies();
    this.genePool = { photosynth: [], consumer: [], predator: [], decomposer: [] };
    this.seedInitialCells();
    this.seedInitialCorpses();
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

  private seedInitialCorpses(): void {
    const n = Math.round(this.cfg.initialCorpses ?? 0);
    for (let i = 0; i < n; i++) {
      this.spawnCorpse(this.rng.range(0, this.cfg.width), this.rng.range(0, this.cfg.height), this.rng.range(4, 8), 0);
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
      divideTimer: 0,
      eatTimer: 0,
      alive: true,
      flash: 0,
    };
    this.cells.push(cell);
    return cell;
  }

  /** Reproduction 시스템이 자식을 예약 (반복 중 배열 변형 방지). 부모 유전 + 유전자풀 발현 반영. */
  queueBirth(parent: Cell, x: number, y: number, energy: number): void {
    if (this.cells.length + this.births.length >= this.cfg.maxCells) return;
    const { genes, carried } = deriveChildGenetics(this.genePool[parent.species], parent, this.rng);
    this.births.push({
      id: this.nextId++,
      species: parent.species,
      x: clamp(x, 0, this.cfg.width),
      y: clamp(y, 0, this.cfg.height),
      vx: this.rng.range(-1, 1) * 4,
      vy: this.rng.range(-1, 1) * 4,
      energy,
      divideTimer: this.species[parent.species].divideCooldown,
      eatTimer: 0,
      alive: true,
      flash: 0.6,
      genes,
      carried,
    });
  }

  /** 시체 생성 (사망/포식/초기 잔해) */
  spawnCorpse(x: number, y: number, mass: number, tox: number): void {
    if (mass <= 0) return;
    // 시체는 영구히 남으므로 성능 안전장치로 상한을 두고, 넘치면 가장 오래된 것을 제거한다.
    if (this.corpses.length >= 2000) this.corpses.shift();
    this.corpses.push({
      id: this.nextCorpseId++,
      x: clamp(x, 0, this.cfg.width),
      y: clamp(y, 0, this.cfg.height),
      mass,
      tox,
      flash: 0,
    });
  }

  /** 유전자풀에 돌연변이 추가 (선택지 Effect에서 호출). 같은 형질을 두 번 골라도 별개로 누적된다. */
  addMutation(species: SpeciesId, field: GeneField, value: number, rate: number): Mutation {
    const m: Mutation = { id: this.nextMutationId++, species, field, value, rate };
    this.genePool[species].push(m);
    return m;
  }

  step(dt: number): void {
    if (this.gameOver) return;

    // 1) 공간 해시 재구성(배열 인덱스를 id로 사용)
    this.spatial.clear();
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      this.spatial.insert(i, c.x, c.y);
    }
    // 시체 해시 (이동/섭식 조회용)
    this.corpseHash.clear();
    for (let i = 0; i < this.corpses.length; i++) {
      const co = this.corpses[i];
      this.corpseHash.insert(i, co.x, co.y);
    }

    // 2) 타이머 갱신
    for (const c of this.cells) {
      if (c.divideTimer > 0) c.divideTimer -= dt;
      if (c.eatTimer > 0) c.eatTimer -= dt;
      if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 2);
    }
    for (const co of this.corpses) {
      if (co.flash > 0) co.flash = Math.max(0, co.flash - dt * 2);
    }

    // 3) 시스템 파이프라인 (렌더링과 분리)
    runMovement(this, dt);
    runMetabolism(this, dt);
    runInteraction(this, dt);
    runScavenging(this, dt);
    runReproduction(this, dt);
    runDeath(this, dt);
    runCorpseDecay(this, dt);

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
    // 소진된 시체 정리
    if (this.corpses.some((co) => co.mass <= 0.01)) {
      this.corpses = this.corpses.filter((co) => co.mass > 0.01);
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

  /**
   * 월드 경계 변경 (뷰포트 회전/리사이즈 대응).
   * 기존 세포/시체는 새 경계 안으로 클램프.
   */
  resize(width: number, height: number): void {
    if (width === this.cfg.width && height === this.cfg.height) return;
    this.cfg.width = width;
    this.cfg.height = height;
    for (const c of this.cells) {
      c.x = clamp(c.x, 0, width);
      c.y = clamp(c.y, 0, height);
    }
    for (const co of this.corpses) {
      co.x = clamp(co.x, 0, width);
      co.y = clamp(co.y, 0, height);
    }
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
    let corpseMass = 0;
    for (const co of this.corpses) corpseMass += co.mass;
    // 점수: 생존시간 × (다양성 가중 + 개체수 가중)
    const score = Math.round(this.time * (1 + biodiversity) + biomass * 0.05 + total * 0.5);
    return {
      time: this.time,
      tick: this.tick,
      resources: { ...this.env.resources },
      counts,
      totalCells: total,
      corpseCount: this.corpses.length,
      corpseMass: Math.round(corpseMass),
      divisions: this.divisions,
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
      scavenge: { ...s.scavenge },
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
