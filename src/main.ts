import { Game, type Speed } from './game/Game';
import { PixiRenderer } from './rendering/PixiRenderer';
import { HUD } from './ui/HUD';
import { ChoicePanel } from './ui/ChoicePanel';
import { GameOverPanel } from './ui/GameOverPanel';
import { FeedbackLayer } from './ui/FeedbackLayer';
import { detectQuality } from './core/device';
import { environmentConfig } from './data/environments';
import { choiceDefs } from './data/choices';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

// 시드: URL ?seed= 로 재현 가능. 없으면 생성 후 URL에 기록.
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : Math.floor(Math.random() * 0xffffffff);
if (!params.has('seed')) {
  params.set('seed', String(seed));
  history.replaceState(null, '', `?${params.toString()}`);
}

const quality = detectQuality();
const config = { ...environmentConfig, maxCells: quality.maxCells };

const game = new Game({ seed, config });
const renderer = new PixiRenderer();
await renderer.init(canvas, game.world, quality);

const feedback = new FeedbackLayer(uiRoot);

const hud = new HUD(uiRoot, {
  onSpeed: (s: Speed) => game.setSpeed(s),
  onPause: () => {
    game.togglePause();
    hud.setPaused(game.phase === 'paused');
  },
});

const choicePanel = new ChoicePanel(uiRoot, (id) => {
  const def = choiceDefs.find((c) => c.id === id);
  if (def) feedback.showEffects(def.title, def.effects);
  game.resolveChoice(id);
});

const gameOver = new GameOverPanel(uiRoot, () => {
  // 새 시드로 재시작(깔끔한 상태 초기화)
  const p = new URLSearchParams();
  p.set('seed', String(Math.floor(Math.random() * 0xffffffff)));
  location.search = p.toString();
});

game.onChoicesReady = (choices) => choicePanel.show(choices);
game.onGameOver = (snap) => gameOver.show(snap, seed);

// ── 메인 루프 (렌더는 app.ticker, 시뮬은 고정 타임스텝) ──
let hudAccum = 0;
renderer.app.ticker.add((ticker) => {
  game.advance(ticker.deltaMS);
  renderer.render();
  hudAccum += ticker.deltaMS;
  if (hudAccum >= 100) {
    hudAccum = 0;
    hud.update(game.snapshot(), game.world.trend);
  }
});

// ── 입력 ──
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    game.togglePause();
    hud.setPaused(game.phase === 'paused');
  } else if (e.key === '1' || e.key === '2' || e.key === '4') {
    const s = Number(e.key) as Speed;
    game.setSpeed(s);
    hud.setActiveSpeed(s);
  }
});

// ── 백그라운드 자동 일시정지 ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'running') {
    game.togglePause();
    hud.setPaused(true);
  }
});

// 초기 HUD 1회 갱신
hud.update(game.snapshot(), game.world.trend);
