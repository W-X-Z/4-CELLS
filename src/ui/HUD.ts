import type { WorldSnapshot, SpeciesId, ResourceKey } from '../simulation/types';
import { RESOURCE_KEYS, RESOURCE_LABELS } from '../simulation/types';
import { speciesDefs } from '../data/species';
import { environmentConfig } from '../data/environments';
import type { TrendSample } from '../simulation/World';
import type { Speed } from '../game/Game';

const RES_COLORS: Record<ResourceKey, string> = {
  light: '#fde047',
  oxygen: '#38bdf8',
  co2: '#a78bfa',
  organic: '#a3e635',
  heat: '#fb923c',
  toxicity: '#f43f5e',
};

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** 상단/사이드 대시보드. 종별 개체수·환경 자원 상태 + 추세 스파크라인. */
export class HUD {
  private prev: WorldSnapshot | null = null;
  private resBars: Record<string, { fill: HTMLElement; val: HTMLElement; delta: HTMLElement; spark: HTMLCanvasElement }> = {};
  private speciesEls: Record<string, { count: HTMLElement; spark: HTMLCanvasElement }> = {};
  private stat: Record<string, HTMLElement> = {};
  private speedBtns: HTMLButtonElement[] = [];
  private pauseBtn!: HTMLButtonElement;

  constructor(
    private root: HTMLElement,
    private handlers: { onSpeed: (s: Speed) => void; onPause: () => void },
  ) {
    this.build();
  }

  private build(): void {
    const wrap = document.createElement('div');
    wrap.className = 'hud';

    // ── 상단 바 ──
    const top = document.createElement('div');
    top.className = 'hud-top';
    top.innerHTML = `
      <div class="brand">4&nbsp;Cells</div>
      <div class="stats">
        <span class="stat"><b id="s-time">0</b>초</span>
        <span class="stat">점수 <b id="s-score">0</b></span>
        <span class="stat">다양성 <b id="s-bio">0</b></span>
        <span class="stat">개체수 <b id="s-cells">0</b></span>
      </div>
      <div class="controls">
        <button class="btn" data-speed="1">1×</button>
        <button class="btn" data-speed="2">2×</button>
        <button class="btn" data-speed="4">4×</button>
        <button class="btn btn-pause" id="btn-pause">⏸</button>
      </div>`;
    wrap.appendChild(top);
    this.stat.time = top.querySelector('#s-time')!;
    this.stat.score = top.querySelector('#s-score')!;
    this.stat.bio = top.querySelector('#s-bio')!;
    this.stat.cells = top.querySelector('#s-cells')!;
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

    // ── 사이드 패널 ──
    const side = document.createElement('div');
    side.className = 'hud-side';

    const spTitle = document.createElement('div');
    spTitle.className = 'panel-title';
    spTitle.textContent = '세포 개체수';
    side.appendChild(spTitle);

    for (const def of speciesDefs) {
      const row = document.createElement('div');
      row.className = 'sp-row';
      row.innerHTML = `
        <span class="dot" style="background:${hex(def.color)}"></span>
        <span class="sp-name">${def.name}</span>
        <canvas class="spark" width="90" height="22"></canvas>
        <b class="sp-count">0</b>`;
      side.appendChild(row);
      this.speciesEls[def.id] = {
        count: row.querySelector('.sp-count')!,
        spark: row.querySelector('canvas')!,
      };
    }

    const resTitle = document.createElement('div');
    resTitle.className = 'panel-title';
    resTitle.textContent = '환경 자원';
    side.appendChild(resTitle);

    for (const key of RESOURCE_KEYS) {
      const row = document.createElement('div');
      row.className = 'res-row';
      row.innerHTML = `
        <div class="res-head">
          <span class="res-name">${RESOURCE_LABELS[key]}</span>
          <span class="res-delta"></span>
          <span class="res-val">0</span>
        </div>
        <div class="bar"><div class="bar-fill" style="background:${RES_COLORS[key]}"></div></div>
        <canvas class="spark spark-res" width="200" height="20"></canvas>`;
      side.appendChild(row);
      this.resBars[key] = {
        fill: row.querySelector('.bar-fill')!,
        val: row.querySelector('.res-val')!,
        delta: row.querySelector('.res-delta')!,
        spark: row.querySelector('canvas')!,
      };
    }

    wrap.appendChild(side);
    this.root.appendChild(wrap);
    this.setActiveSpeed(1);
  }

  setActiveSpeed(s: Speed): void {
    this.speedBtns.forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === s));
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶' : '⏸';
  }

  update(snap: WorldSnapshot, trend: TrendSample[]): void {
    this.stat.time.textContent = snap.time.toFixed(0);
    this.stat.score.textContent = String(snap.score);
    this.stat.bio.textContent = snap.biodiversity.toFixed(2);
    this.stat.cells.textContent = String(snap.totalCells);

    for (const def of speciesDefs) {
      const el = this.speciesEls[def.id];
      el.count.textContent = String(snap.counts[def.id]);
      drawSparkline(el.spark, trend.map((t) => t.counts[def.id as SpeciesId]), hex(def.color));
    }

    for (const key of RESOURCE_KEYS) {
      const b = this.resBars[key];
      const v = snap.resources[key];
      const cap = environmentConfig.displayCaps[key];
      b.fill.style.width = `${Math.min(100, (v / cap) * 100)}%`;
      b.val.textContent = v.toFixed(0);
      if (this.prev) {
        const d = v - this.prev.resources[key];
        b.delta.textContent = Math.abs(d) < 0.5 ? '·' : d > 0 ? '▲' : '▼';
        b.delta.className = 'res-delta ' + (Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'down');
      }
      drawSparkline(b.spark, trend.map((t) => t.resources[key]), RES_COLORS[key], cap);
    }
    this.prev = snap;
  }
}

function drawSparkline(canvas: HTMLCanvasElement, values: number[], color: string, max?: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (values.length < 2) return;
  const hi = max ?? Math.max(1, ...values);
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = (i / (values.length - 1)) * w;
    const y = h - (Math.min(values[i], hi) / hi) * (h - 2) - 1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
