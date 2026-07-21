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
  choiceInterval?: number;
  /** UI 없이 자동 진행할 때 선택지를 고르는 함수(밸런스 테스트용) */
  autoChoice?: (choices: ChoiceDef[], world: World) => string | null;
}

/**
 * 시뮬레이션 루프 오케스트레이션.
 * 고정 타임스텝 + 시드 재현. 렌더링 의존성 없음 -> 헤드리스 구동 가능.
 */
export class Game {
  readonly world: World;
  readonly choices: ChoiceSystem;
  readonly seed: number;
  readonly stepDt: number;

  phase: GamePhase = 'running';
  speed: Speed = 1;
  pendingChoices: ChoiceDef[] = [];
  /** 지금까지 적용된 선택 이력 (도움말/진화 조회 UI에서 사용) */
  appliedChoices: ChoiceDef[] = [];

  private accumulator = 0;
  private choiceTimer = 0;
  private autoChoice?: GameOptions['autoChoice'];

  // UI 훅
  onChoicesReady: ((choices: ChoiceDef[]) => void) | null = null;
  onGameOver: ((snapshot: WorldSnapshot) => void) | null = null;
  onChoiceResolved: ((choice: ChoiceDef) => void) | null = null;

  constructor(opts: GameOptions) {
    const cfg = opts.config ?? environmentConfig;
    this.seed = opts.seed;
    this.world = new World(opts.seed, cfg);
    this.choices = new ChoiceSystem(this.world, opts.choiceInterval ?? 18);
    this.stepDt = 1 / cfg.simRate;
    this.autoChoice = opts.autoChoice;
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
      this.choiceTimer += this.stepDt;
      guard++;

      if (this.world.gameOver) {
        this.phase = 'gameover';
        this.onGameOver?.(this.world.snapshot());
        return;
      }
      if (this.choiceTimer >= this.choices.interval) {
        this.offerChoices();
        return; // 선택 대기(일시정지)
      }
    }
  }

  private offerChoices(): void {
    const choices = this.choices.generate(3);
    if (choices.length === 0) {
      this.choiceTimer = 0;
      return;
    }
    this.pendingChoices = choices;

    // 헤드리스 자동 진행
    if (this.autoChoice) {
      const id = this.autoChoice(choices, this.world);
      if (id) this.resolveChoice(id);
      else this.choiceTimer = 0;
      return;
    }

    this.phase = 'choosing';
    this.onChoicesReady?.(choices);
  }

  resolveChoice(choiceId: string): void {
    const def = this.pendingChoices.find((c) => c.id === choiceId);
    this.choices.apply(choiceId);
    if (def) this.appliedChoices.push(def);
    this.pendingChoices = [];
    this.choiceTimer = 0;
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
