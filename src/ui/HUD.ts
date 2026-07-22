import type { WorldSnapshot, SpeciesId, ResourceKey } from '../simulation/types';
import { RESOURCE_KEYS, RESOURCE_LABELS } from '../simulation/types';
import { speciesDefs } from '../data/species';
import type { Speed } from '../game/Game';

/** 환경 대시보드에서 클릭 가능한 항목 (자원) */
export type EnvKey = ResourceKey;

/** 자원별 위험 판정 — 카드 강조용 (밸런스 수치는 choices.ts의 부스트 조건과 맞춤) */
const DANGER: Partial<Record<ResourceKey, (v: number) => boolean>> = {
  oxygen: (v) => v < 250,
  co2: (v) => v < 200,
  heat: (v) => v > 700,
  toxicity: (v) => v > 70,
};

/** 종별 모양 글리프 (색약 대응: 색 + 모양) */
const SHAPE_GLYPH: Record<string, string> = {
  circle: '●',
  diamond: '◆',
  triangle: '▲',
  ring: '○',
};

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 상한이 없어 커질 수 있는 자원 값을 카드에 맞게 축약 (1200, 12.3k, 105k) */
function formatNum(v: number): string {
  if (v >= 100000) return Math.round(v / 1000) + 'k';
  if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
  return Math.round(v).toString();
}

/**
 * 모바일 우선 HUD.
 * 상단(top 컨테이너): 플레이 시간 + 배속/일시정지, 환경 자원 카드(탭 → 도움말).
 * 하단(bottom 컨테이너): 종별 개체수 바 — 탭하면 해당 종의 도움말 모달이 열린다.
 * 캔버스 영역과 분리되어 있어 상/하단 UI는 팬/줌 제스처를 가로채지 않는다.
 */
export class HUD {
  private timeEl!: HTMLElement;
  private resEls: Record<string, { card: HTMLElement; val: HTMLElement }> = {};
  private speciesEls: Record<string, { chip: HTMLElement; count: HTMLElement }> = {};
  private speedBtns: HTMLButtonElement[] = [];
  private pauseBtn!: HTMLButtonElement;

  constructor(
    private top: HTMLElement,
    private bottom: HTMLElement,
    private handlers: {
      onSpeed: (s: Speed) => void;
      onPause: () => void;
      onSpeciesClick: (id: SpeciesId) => void;
      onEnvClick: (key: EnvKey) => void;
    },
  ) {
    this.build();
  }

  private build(): void {
    // ── 상단 바: 시간 + 배속 ──
    const bar = document.createElement('div');
    bar.className = 'hud-top';
    bar.innerHTML = `
      <div class="hud-time">⏱ <b id="s-time">0:00</b></div>
      <div class="controls">
        <button class="btn" data-speed="1">1×</button>
        <button class="btn" data-speed="2">2×</button>
        <button class="btn" data-speed="4">4×</button>
        <button class="btn btn-pause" id="btn-pause">⏸</button>
      </div>`;
    this.top.appendChild(bar);
    this.timeEl = bar.querySelector('#s-time')!;
    this.pauseBtn = bar.querySelector('#btn-pause')!;
    this.pauseBtn.onclick = () => this.handlers.onPause();
    bar.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
      this.speedBtns.push(b);
      b.onclick = () => {
        const s = Number(b.dataset.speed) as Speed;
        this.handlers.onSpeed(s);
        this.setActiveSpeed(s);
      };
    });

    // ── 환경 자원 카드 (탭 → 도움말) ──
    const cards = document.createElement('div');
    cards.className = 'res-cards';
    const makeCard = (key: EnvKey, label: string): HTMLButtonElement => {
      const card = document.createElement('button');
      card.className = 'res-card';
      // 등락(▲▼) 표시는 생략 — 값이 수시로 바뀌며 폭이 흔들려 깜빡이던 문제 제거.
      card.innerHTML = `
        <span class="res-card-name">${label}</span>
        <span class="res-card-body"><b class="res-card-val">0</b></span>`;
      card.onclick = () => this.handlers.onEnvClick(key);
      cards.appendChild(card);
      return card;
    };
    for (const key of RESOURCE_KEYS) {
      const card = makeCard(key, RESOURCE_LABELS[key]);
      this.resEls[key] = { card, val: card.querySelector('.res-card-val')! };
    }
    this.top.appendChild(cards);

    // ── 하단 세포 바 (탭 → 도움말) ──
    const spbar = document.createElement('div');
    spbar.className = 'sp-bar';
    for (const def of speciesDefs) {
      const chip = document.createElement('button');
      chip.className = 'sp-chip';
      chip.innerHTML = `
        <span class="sp-glyph" style="color:${hex(def.color)}">${SHAPE_GLYPH[def.shape]}</span>
        <span class="sp-chip-name">${def.name.replace(' 세포', '')}</span>
        <b class="sp-chip-count">0</b>`;
      chip.onclick = () => this.handlers.onSpeciesClick(def.id);
      spbar.appendChild(chip);
      this.speciesEls[def.id] = { chip, count: chip.querySelector('.sp-chip-count')! };
    }
    this.bottom.appendChild(spbar);

    this.setActiveSpeed(1);
  }

  setActiveSpeed(s: Speed): void {
    this.speedBtns.forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === s));
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶' : '⏸';
  }

  update(snap: WorldSnapshot): void {
    this.timeEl.textContent = formatTime(snap.time);

    for (const key of RESOURCE_KEYS) {
      const el = this.resEls[key];
      const v = snap.resources[key];
      el.val.textContent = formatNum(v);
      el.card.classList.toggle('danger', DANGER[key]?.(v) ?? false);
    }

    for (const def of speciesDefs) {
      const el = this.speciesEls[def.id];
      el.count.textContent = String(snap.counts[def.id]);
      el.chip.classList.toggle('empty', snap.counts[def.id] === 0);
    }
  }
}
