import { World } from '../simulation/World';
import { ChoiceSystem } from '../rules/ChoiceSystem';
import { environmentConfig, type EnvironmentConfig } from '../data/environments';
import type { ChoiceDef } from '../rules/types';
import type { WorldSnapshot } from '../simulation/types';

export type GamePhase = 'running' | 'paused' | 'choosing' | 'gameover';
export type Speed = 1 | 2 | 4;

export interface GameOptions {
  seed: number;
  config?: EnvironmentConfig;
  /** 첫 진화까지 필요한 누적 분열 수(미지정 시 config 값) */
  divisionsPerChoice?: number;
  /** 진화마다 다음 간격에 더해지는 분열 수(미지정 시 config 값) */
  divisionsGrowth?: number;
  /** UI 없이 자동 진행할 때 선택지를 고르는 함수(밸런스 테스트용) */
  autoChoice?: (choices: ChoiceDef[], world: World) => string | null;
}

/**
 * 시뮬레이션 루프 오케스트레이션.
 * 고정 타임스텝 + 시드 재현. 렌더링 의존성 없음 -> 헤드리스 구동 가능.
 * 진화 트리거: 시간이 아니라 "누적 세포 분열 수". 번성해서 분열이 많을수록 더 자주 진화한다.
 */
export class Game {
  readonly world: World;
  readonly choices: ChoiceSystem;
  readonly seed: number;
  readonly stepDt: number;
  /** 첫 진화까지 필요한 누적 분열 수(기준 간격) */
  readonly divisionsPerChoice: number;
  /** 진화가 한 번 일어날 때마다 다음 간격에 더해지는 분열 수(점진적으로 뜸해짐) */
  readonly divisionsGrowth: number;
  /** 지금까지 제시된 진화 횟수 */
  evolutionCount = 0;

  /** 진화 1회당 선택지 리롤(다시 뽑기) 허용 횟수 */
  readonly maxRerolls = 2;
  /** 이번 진화에서 남은 리롤 횟수 */
  rerollsLeft = 0;

  phase: GamePhase = 'running';
  speed: Speed = 1;
  pendingChoices: ChoiceDef[] = [];
  /** 지금까지 적용된 선택 이력 (도움말/진화 조회 UI에서 사용) */
  appliedChoices: ChoiceDef[] = [];

  private accumulator = 0;
  private lastChoiceDivisions = 0;
  private autoChoice?: GameOptions['autoChoice'];

  // UI 훅
  onChoicesReady: ((choices: ChoiceDef[]) => void) | null = null;
  onGameOver: ((snapshot: WorldSnapshot) => void) | null = null;
  onChoiceResolved: ((choice: ChoiceDef) => void) | null = null;

  constructor(opts: GameOptions) {
    const cfg = opts.config ?? environmentConfig;
    this.seed = opts.seed;
    this.world = new World(opts.seed, cfg);
    this.choices = new ChoiceSystem(this.world);
    this.stepDt = 1 / cfg.simRate;
    this.divisionsPerChoice = Math.max(1, opts.divisionsPerChoice ?? cfg.divisionsPerChoice);
    this.divisionsGrowth = Math.max(0, opts.divisionsGrowth ?? cfg.divisionsGrowth);
    this.autoChoice = opts.autoChoice;
  }

  /** 다음 진화까지 필요한 분열 간격(진화가 진행될수록 점진적으로 커진다) */
  divisionsUntilNext(): number {
    return this.divisionsPerChoice + this.divisionsGrowth * this.evolutionCount;
  }

  /** 실시간 프레임에서 호출. realDtMs = 지난 프레임의 실제 경과(ms). */
  advance(realDtMs: number): void {
    if (this.phase === 'paused' || this.phase === 'choosing' || this.phase === 'gameover') return;
    // 폭주 방지: 한 프레임 최대 0.25초 상당
    const realDt = Math.min(realDtMs / 1000, 0.25);
    this.accumulator += realDt * this.speed;

    let guard = 0;
    while (this.accumulator >= this.stepDt && guard < 240) {
      this.world.step(this.stepDt);
      this.accumulator -= this.stepDt;
      guard++;

      if (this.world.gameOver) {
        this.phase = 'gameover';
        this.onGameOver?.(this.world.snapshot());
        return;
      }
      if (this.world.divisions - this.lastChoiceDivisions >= this.divisionsUntilNext()) {
        this.offerChoices();
        return; // 선택 대기(일시정지)
      }
    }
  }

  private offerChoices(): void {
    // 다음 트리거 기준점을 미리 갱신(선택이 없어도 같은 프레임에 재제시되지 않도록)
    this.lastChoiceDivisions = this.world.divisions;
    const choices = this.choices.generate(3);
    if (choices.length === 0) return;
    this.evolutionCount++; // 다음 진화 간격이 divisionsGrowth만큼 늘어난다
    this.pendingChoices = choices;
    this.rerollsLeft = this.maxRerolls; // 이번 진화의 리롤 횟수 초기화

    // 헤드리스 자동 진행
    if (this.autoChoice) {
      const id = this.autoChoice(choices, this.world);
      if (id) this.resolveChoice(id);
      return;
    }

    this.phase = 'choosing';
    this.onChoicesReady?.(choices);
  }

  /**
   * 선택지 다시 뽑기(리롤). 진화 대기 중일 때만, 남은 횟수 안에서 새 후보 3개를 뽑는다.
   * 선택을 아직 고르지 않았으므로 유전자풀은 바뀌지 않는다(진화 카운트/간격도 그대로).
   */
  reroll(): boolean {
    if (this.phase !== 'choosing' || this.rerollsLeft <= 0) return false;
    const choices = this.choices.generate(3);
    if (choices.length === 0) return false;
    this.rerollsLeft--;
    this.pendingChoices = choices;
    this.onChoicesReady?.(choices);
    return true;
  }

  resolveChoice(choiceId: string): void {
    const def = this.pendingChoices.find((c) => c.id === choiceId);
    this.choices.apply(choiceId);
    if (def) this.appliedChoices.push(def);
    this.pendingChoices = [];
    this.lastChoiceDivisions = this.world.divisions;
    if (this.phase === 'choosing') this.phase = 'running';
    if (def) this.onChoiceResolved?.(def);
  }

  setSpeed(s: Speed): void {
    this.speed = s;
  }

  togglePause(): void {
    if (this.phase === 'running') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'running';
  }

  snapshot(): WorldSnapshot {
    return this.world.snapshot();
  }
}
