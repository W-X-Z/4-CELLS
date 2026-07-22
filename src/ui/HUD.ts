import type { WorldSnapshot, SpeciesId, ResourceKey } from '../simulation/types';
import { RESOURCE_KEYS, RESOURCE_LABELS } from '../simulation/types';
import { speciesDefs } from '../data/species';
import type { Speed } from '../game/Game';

/** 자원별 위험 판정 — 카드 강조용 (밸런스 수치는 choices.ts의 부스트 조건과 맞춤) */
const DANGER: Partial<Record<ResourceKey, (v: number) => boolean>> = {
  oxygen: (v) => v < 250,
  co2: (v) => v < 200,
  heat: (v) => v > 700,
  toxicity: (v) => v > 400,
};

/** 시체가 너무 쌓이면 부패 독성 위험 */
const CORPSE_DANGER = 120;

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

/**
 * 모바일 우선 HUD.
 * 상단: 플레이 시간 + 배속/일시정지. 그 아래: 환경 자원 숫자 카드.
 * 하단: 종별 개체수 바 — 탭하면 해당 종의 도움말 모달이 열린다.
 */
export class HUD {
  private prev: WorldSnapshot | null = null;
  private timeEl!: HTMLElement;
  private resEls: Record<string, { card: HTMLElement; val: HTMLElement; delta: HTMLElement }> = {};
  private corpseEls!: { card: HTMLElement; val: HTMLElement };
  private speciesEls: Record<string, { chip: HTMLElement; count: HTMLElement }> = {};
  private speedBtns: HTMLButtonElement[] = [];
  private pauseBtn!: HTMLButtonElement;

  constructor(
    private root: HTMLElement,
    private handlers: {
      onSpeed: (s: Speed) => void;
      onPause: () => void;
      onSpeciesClick: (id: SpeciesId) => void;
    },
  ) {
    this.build();
  }

  private build(): void {
    // ── 상단 바: 시간 + 배속 ──
    const top = document.createElement('div');
    top.className = 'hud-top';
    top.innerHTML = `
      <div class="hud-time">⏱ <b id="s-time">0:00</b></div>
      <div class="controls">
        <button class="btn" data-speed="1">1×</button>
        <button class="btn" data-speed="2">2×</button>
        <button class="btn" data-speed="4">4×</button>
        <button class="btn btn-pause" id="btn-pause">⏸</button>
      </div>`;
    this.root.appendChild(top);
    this.timeEl = top.querySelector('#s-time')!;
    this.pauseBtn = top.querySelector('#btn-pause')!;
    this.pauseBtn.onclick = () => this.handlers.onPause();
    top.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
      this.speedBtns.push(b);
      b.onclick = () => {
        const s = Number(b.dataset.speed) as Speed;
        this.handlers.onSpeed(s);
        this.setActiveSpeed(s);
      };
    });

    // ── 환경 자원 카드 (숫자만) ──
    const cards = document.createElement('div');
    cards.className = 'res-cards';
    for (const key of RESOURCE_KEYS) {
      const card = document.createElement('div');
      card.className = 'res-card';
      card.innerHTML = `
        <span class="res-card-name">${RESOURCE_LABELS[key]}</span>
        <span class="res-card-body"><b class="res-card-val">0</b><span class="res-card-delta"></span></span>`;
      cards.appendChild(card);
      this.resEls[key] = {
        card,
        val: card.querySelector('.res-card-val')!,
        delta: card.querySelector('.res-card-delta')!,
      };
    }
    // 유기물은 전역 수치가 아니라 시체로 관리 — 시체 개수 카드
    {
      const card = document.createElement('div');
      card.className = 'res-card';
      card.innerHTML = `
        <span class="res-card-name">사체</span>
        <span class="res-card-body"><b class="res-card-val">0</b></span>`;
      cards.appendChild(card);
      this.corpseEls = { card, val: card.querySelector('.res-card-val')! };
    }
    this.root.appendChild(cards);

    // ── 하단 세포 바 (탭 → 도움말) ──
    const bar = document.createElement('div');
    bar.className = 'sp-bar';
    for (const def of speciesDefs) {
      const chip = document.createElement('button');
      chip.className = 'sp-chip';
      chip.innerHTML = `
        <span class="sp-glyph" style="color:${hex(def.color)}">${SHAPE_GLYPH[def.shape]}</span>
        <span class="sp-chip-name">${def.name.replace(' 세포', '')}</span>
        <b class="sp-chip-count">0</b>`;
      chip.onclick = () => this.handlers.onSpeciesClick(def.id);
      bar.appendChild(chip);
      this.speciesEls[def.id] = { chip, count: chip.querySelector('.sp-chip-count')! };
    }
    this.root.appendChild(bar);

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
      el.val.textContent = v.toFixed(0);
      el.card.classList.toggle('danger', DANGER[key]?.(v) ?? false);
      if (this.prev) {
        const d = v - this.prev.resources[key];
        el.delta.textContent = Math.abs(d) < 0.5 ? '' : d > 0 ? '▲' : '▼';
        el.delta.className = 'res-card-delta ' + (d > 0 ? 'up' : 'down');
      }
    }

    this.corpseEls.val.textContent = String(snap.corpseCount);
    this.corpseEls.card.classList.toggle('danger', snap.corpseCount > CORPSE_DANGER);

    for (const def of speciesDefs) {
      const el = this.speciesEls[def.id];
      el.count.textContent = String(snap.counts[def.id]);
      el.chip.classList.toggle('empty', snap.counts[def.id] === 0);
    }
    this.prev = snap;
  }
}
