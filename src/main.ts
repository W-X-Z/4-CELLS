import { Game, type Speed } from './game/Game';
import { PixiRenderer } from './rendering/PixiRenderer';
import { HUD } from './ui/HUD';
import { ChoicePanel } from './ui/ChoicePanel';
import { GameOverPanel } from './ui/GameOverPanel';
import { FeedbackLayer } from './ui/FeedbackLayer';
import { InfoModal } from './ui/InfoModal';
import { EnvModal } from './ui/EnvModal';
import { CellModal } from './ui/CellModal';
import { HelpModal } from './ui/HelpModal';
import { StartScreen } from './ui/StartScreen';
import type { Cell, SpeciesId } from './simulation/types';
import { computeWorldSize, detectQuality } from './core/device';
import { environmentConfig } from './data/environments';
import { choiceDefs } from './data/choices';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const stageWrap = document.getElementById('stage-wrap') as HTMLElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;
const hudTop = document.getElementById('hud-top') as HTMLElement;
const hudBottom = document.getElementById('hud-bottom') as HTMLElement;

// 월드 크기의 기준이 되는 "보이는 캔버스 영역"(상/하단 UI 제외). 레이아웃 전이면 창 크기로 대체.
function viewSize(): { w: number; h: number } {
  return {
    w: stageWrap.clientWidth || window.innerWidth,
    h: stageWrap.clientHeight || window.innerHeight,
  };
}

// 시드: URL ?seed= 로 재현 가능. 없으면 생성 후 URL에 기록.
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : Math.floor(Math.random() * 0xffffffff);
if (!params.has('seed')) {
  params.set('seed', String(seed));
  history.replaceState(null, '', `?${params.toString()}`);
}

const quality = detectQuality();
// 월드 크기를 "보이는 캔버스" 비율에 맞춤 (면적은 유지 → 밀도/밸런스 보존, 레터박스 제거)
const initialView = viewSize();
const worldSize = computeWorldSize(initialView.w, initialView.h);
const config = { ...environmentConfig, maxCells: quality.maxCells, ...worldSize };

const game = new Game({ seed, config });
const renderer = new PixiRenderer();

// 렌더러 초기화가 멈추더라도 빈 화면만 남지 않도록 상태를 표시하고 타임아웃 처리한다.
const startupStatus = document.createElement('div');
startupStatus.className = 'startup-status';
startupStatus.textContent = '세포 생태계를 불러오는 중…';
uiRoot.appendChild(startupStatus);

// top-level await 금지: Pixi가 init 중 동적 import하는 환경 청크(browserAll)가 번들에서는
// 이 모듈이 포함된 메인 청크를 다시 import한다. 모듈 평가가 await로 멈춰 있으면 서로를
// 기다리는 데드락이 되어 프로덕션 빌드에서만 초기화가 영원히 끝나지 않는다.
void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    await withTimeout(renderer.init(canvas, game.world, quality), 12_000);
    startupStatus.remove();
  } catch (error) {
    console.error('Renderer initialization failed:', error);
    startupStatus.classList.add('startup-error');
    startupStatus.innerHTML = `
    <strong>그래픽 초기화에 실패했습니다.</strong>
    <span>Chrome의 하드웨어 가속 또는 WebGL 사용 가능 여부를 확인한 뒤 새로고침해 주세요.</span>`;
    return;
  }

  const feedback = new FeedbackLayer(uiRoot);

  // 시작 화면을 먼저(DOM 아래에) 만들어, 나중에 만드는 도움말 모달이 그 위에 뜨도록 한다.
  const startScreen = new StartScreen(uiRoot, {
    onStart: () => {
      if (game.phase === 'paused') {
        game.togglePause();
        hud.setPaused(false);
      }
    },
    onHelp: () => helpModal.show(),
  });

  // ── 개체 선택(탭): 재생 중에도 캔버스의 세포를 탭해 상태를 실시간으로 본다(패널은 뒤가 보이는 비차단형) ──
  // cell-panel을 큰 모달들보다 먼저 만들어 DOM 순서상 아래에 두면, 도움말/선택지 오버레이가 위를 덮는다.
  const clearSelection = (): void => {
    cellModal.hide(); // hide가 onClose를 호출해 강조 해제 + 재개까지 처리
  };
  const cellModal = new CellModal(uiRoot, () => {
    renderer.setSelected(null);
    onModalClose(); // 개체 조회를 닫으면 (다른 상세 뷰가 없을 때) 게임 재개
  });
  renderer.onTap = (clientX, clientY) => {
    if (game.phase === 'choosing' || game.phase === 'gameover') return; // 선택지/게임오버 중엔 무시
    const { x, y } = renderer.screenToWorld(clientX, clientY);
    const cell = pickCell(game.world, x, y);
    if (cell) {
      pauseForModal(); // 개체를 모달로 조회할 때는 게임을 일시정지
      renderer.setSelected(cell);
      cellModal.show(cell, game.world);
    } else {
      clearSelection(); // 빈 곳을 탭하면 선택 해제
    }
  };

  // 상세 뷰(개체·세포·환경·도움말) 중 하나라도 열려 있는지
  const anyDetailOpen = (): boolean =>
    infoModal.visible || envModal.visible || helpModal.visible || cellModal.visible;

  // 모달을 닫으면 (열기 전에 돌아가고 있었고, 다른 상세 뷰가 남아 있지 않으면) 재개
  let resumeOnModalClose = false;
  const onModalClose = (): void => {
    if (anyDetailOpen()) return; // 다른 상세 뷰가 아직 열려 있으면 재개하지 않음
    if (resumeOnModalClose && game.phase === 'paused') {
      game.togglePause();
      hud.setPaused(false);
    }
    resumeOnModalClose = false;
  };

  // 세포 추가 CTA (하단 세포 도움말 모달에서 호출 — 추후 광고 보상 연동 지점)
  const ADD_COUNT = 5;
  const addCells = (id: SpeciesId): void => {
    const def = game.world.species[id];
    let added = 0;
    for (let i = 0; i < ADD_COUNT; i++) {
      const c = game.world.spawn(id, game.world.rng.range(0, game.world.cfg.width), game.world.rng.range(0, game.world.cfg.height), def.startEnergy);
      if (c) added++;
    }
    feedback.notify(`➕ ${def.name} +${added}`, added < ADD_COUNT ? '개체 상한에 도달했습니다' : `${added}마리를 생태계에 추가했습니다`);
  };

  const infoModal = new InfoModal(uiRoot, onModalClose, addCells);
  const envModal = new EnvModal(uiRoot, onModalClose);
  const helpModal = new HelpModal(uiRoot, onModalClose);

  // 상세 뷰를 열 때: 실행 중이면 멈추고 재개 플래그를 세운다.
  // 이미 (다른 상세 뷰로) 멈춰 있으면 플래그를 덮어쓰지 않아, 상세 뷰를 연달아 열어도 재개 상태가 유지된다.
  const pauseForModal = (): void => {
    if (game.phase === 'running') {
      resumeOnModalClose = true;
      game.togglePause();
      hud.setPaused(true);
    }
  };

  const hud = new HUD(hudTop, hudBottom, {
    onSpeed: (s: Speed) => game.setSpeed(s),
    onPause: () => {
      game.togglePause();
      hud.setPaused(game.phase === 'paused');
    },
    onSpeciesClick: (id) => {
      if (game.phase === 'choosing' || game.phase === 'gameover') return;
      pauseForModal();
      infoModal.show(id, game.world);
    },
    onEnvClick: (key) => {
      if (game.phase === 'choosing' || game.phase === 'gameover') return;
      pauseForModal();
      envModal.show(key, game.world);
    },
    onHelp: () => {
      if (game.phase === 'choosing' || game.phase === 'gameover') return;
      pauseForModal();
      helpModal.show();
    },
  });

  const choicePanel = new ChoicePanel(uiRoot, (id) => {
    const def = choiceDefs.find((c) => c.id === id);
    if (def) feedback.showEffects(def.title, def.effects);
    game.resolveChoice(id);
  });
  // 다시 뽑기: 진화 대기 중 남은 횟수만큼 후보를 새로 뽑는다(선택 전이라 유전자풀 불변).
  choicePanel.onReroll = () => game.reroll();

  const gameOver = new GameOverPanel(uiRoot, () => {
    // 새 시드로 재시작(깔끔한 상태 초기화)
    const p = new URLSearchParams();
    p.set('seed', String(Math.floor(Math.random() * 0xffffffff)));
    location.search = p.toString();
  });

  game.onChoicesReady = (choices) => choicePanel.show(choices, game.rerollsLeft);
  game.onGameOver = (snap) => gameOver.show(snap, seed);

  // ── 메인 루프 (렌더는 app.ticker, 시뮬은 고정 타임스텝) ──
  let hudAccum = 0;
  renderer.app.ticker.add((ticker) => {
    game.advance(ticker.deltaMS);
    renderer.render();
    hudAccum += ticker.deltaMS;
    if (hudAccum >= 100) {
      hudAccum = 0;
      hud.update(game.snapshot());
      // 선택된 세포 패널을 실시간 갱신(재생 중에도). 세포가 죽었으면 닫는다.
      if (cellModal.visible && cellModal.refresh()) clearSelection();
    }
  });

  // ── 입력 ──
  window.addEventListener('keydown', (e) => {
    if (infoModal.visible || envModal.visible || helpModal.visible || cellModal.visible) {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        infoModal.hide();
        envModal.hide();
        helpModal.hide();
        cellModal.hide();
      }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      game.togglePause();
      const paused = game.phase === 'paused';
      hud.setPaused(paused);
      if (!paused) clearSelection(); // 재개하면 선택 해제
    } else if (e.key === '1' || e.key === '2' || e.key === '4') {
      const s = Number(e.key) as Speed;
      game.setSpeed(s);
      hud.setActiveSpeed(s);
    }
  });

  // ── 리사이즈/회전: 월드 경계를 "보이는 캔버스" 비율로 갱신 ──
  let resizeTimer = 0;
  const syncWorldToView = (): void => {
    const view = viewSize();
    const { width, height } = computeWorldSize(view.w, view.h);
    game.world.resize(width, height);
  };
  const scheduleSync = (): void => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(syncWorldToView, 150);
  };
  window.addEventListener('resize', scheduleSync);
  // HUD가 상/하단 바를 채운 뒤 캔버스 영역이 확정되므로, 그 크기에 맞춰 월드를 즉시 재동기화.
  syncWorldToView();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(scheduleSync).observe(stageWrap);
  }

  // ── 백그라운드 자동 일시정지 ──
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.phase === 'running') {
      game.togglePause();
      hud.setPaused(true);
    }
  });

  // 초기 HUD 1회 갱신
  hud.update(game.snapshot());

  // ── 시작 화면 표시: 바로 시작하지 않고 대기. 그동안 시뮬레이션 정지 ──
  if (game.phase === 'running') game.togglePause();
  hud.setPaused(true);
  startScreen.show();

  // 개발 콘솔 디버그 핸들 (밸런스 튜닝/검증용)
  if (import.meta.env.DEV) {
    (window as unknown as { __game: Game; __renderer: PixiRenderer }).__game = game;
    (window as unknown as { __game: Game; __renderer: PixiRenderer }).__renderer = renderer;
  }
}

/** 월드 좌표 (wx,wy)에서 탭 반경 안에 있는 가장 가까운 세포를 찾는다(없으면 null). */
function pickCell(world: Game['world'], wx: number, wy: number): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  for (const c of world.cells) {
    const dx = c.x - wx;
    const dy = c.y - wy;
    const d = dx * dx + dy * dy;
    const r = world.species[c.species].radius + 8; // 손가락 탭 여유
    if (d <= r * r && d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`Renderer initialization timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
