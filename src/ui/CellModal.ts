import type { World } from '../simulation/World';
import type { Cell, GeneField } from '../simulation/types';
import { eff } from '../simulation/genetics';
import { GENE_LABELS } from './FeedbackLayer';

/** 종별 모양 글리프 (색약 대응: 색 + 모양) — HUD와 동일 */
const SHAPE_GLYPH: Record<string, string> = {
  circle: '●',
  diamond: '◆',
  triangle: '▲',
  ring: '○',
};

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/**
 * 개체 상세 모달. 캔버스의 세포를 탭하면 열린다(일시정지 없이도 가능).
 * 정적 구조(종·세대·유전자)는 한 번만 그리고, 매 프레임 변하는 값(상태·에너지·
 * 포만도·위치)만 refresh()로 갱신한다 → 재생 중에도 실시간으로 상태를 볼 수 있다.
 */
export class CellModal {
  private el: HTMLElement;
  visible = false;

  private cell: Cell | null = null;
  private world: World | null = null;
  // refresh로 갱신할 값 노드들
  private statusEl?: HTMLElement;
  private energyEl?: HTMLElement;
  private feedEl?: HTMLElement;
  private posEl?: HTMLElement;

  constructor(
    private root: HTMLElement,
    private onClose: () => void,
  ) {
    this.el = document.createElement('div');
    // 전체를 덮는 어두운 오버레이가 아니라, 캔버스 위에 떠 있는 작은 패널(재생 중에도 뒤 생태계가 보임).
    this.el.className = 'cell-panel hidden';
    this.root.appendChild(this.el);
  }

  show(cell: Cell, world: World): void {
    this.cell = cell;
    this.world = world;
    const def = world.species[cell.species];

    // 보유 돌연변이(발현 형질): 종 기본 대비 배율을 %로 표기 — 개체 고정값(정적)
    const geneRows = cell.genes
      ? (Object.keys(cell.genes) as GeneField[]).map((f) => {
          const mul = cell.genes![f] ?? 1;
          const pct = Math.round((mul - 1) * 100);
          const sign = pct > 0 ? '+' : '';
          return `<div class="modal-row"><span>${GENE_LABELS[f]}</span><b>${sign}${pct}%</b></div>`;
        })
      : [];

    // 체질(개체 편차): 분열 문턱 배율을 표준 대비 %로 — 개체 고정값(정적)
    const vigorPct = Math.round((cell.jitter - 1) * 100);
    const vigorSign = vigorPct > 0 ? '+' : '';

    this.el.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <span class="modal-glyph" style="color:${hex(def.color)}">${SHAPE_GLYPH[def.shape]}</span>
          <div class="modal-title">${def.name} <span style="color:var(--muted);font-size:14px;font-weight:600">#${cell.id}</span></div>
          <button class="btn modal-close">✕</button>
        </div>

        <div class="modal-section">개체 정보</div>
        <div class="modal-rows">
          <div class="modal-row"><span>상태</span><b class="cm-status"></b></div>
          <div class="modal-row"><span>세대</span><b>${cell.gen}세대</b></div>
          <div class="modal-row"><span>에너지</span><b class="cm-energy"></b></div>
          <div class="modal-row"><span>포만도</span><b class="cm-feed"></b></div>
          <div class="modal-row"><span>체질(분열 문턱)</span><b>${vigorSign}${vigorPct}%</b></div>
          <div class="modal-row"><span>위치</span><b class="cm-pos"></b></div>
        </div>

        <div class="modal-section">보유 돌연변이</div>
        <div class="modal-rows">
          ${geneRows.length ? geneRows.join('') : '<div class="modal-empty">야생형 — 발현한 돌연변이 없음</div>'}
        </div>
      </div>`;
    this.el.querySelector<HTMLButtonElement>('.modal-close')!.onclick = () => this.hide();
    this.statusEl = this.el.querySelector<HTMLElement>('.cm-status')!;
    this.energyEl = this.el.querySelector<HTMLElement>('.cm-energy')!;
    this.feedEl = this.el.querySelector<HTMLElement>('.cm-feed')!;
    this.posEl = this.el.querySelector<HTMLElement>('.cm-pos')!;
    this.el.classList.remove('hidden');
    this.visible = true;
    this.refresh();
  }

  /** 변동 값만 갱신(재생 중 실시간 반영). 선택 세포가 죽었으면 true 반환(호출측이 닫음). */
  refresh(): boolean {
    if (!this.visible || !this.cell || !this.world) return false;
    const cell = this.cell;
    if (!cell.alive) return true; // 죽음 → 호출측이 닫도록
    const def = this.world.species[cell.species];
    const maxE = eff(def, cell, 'maxEnergy');
    if (this.statusEl) {
      this.statusEl.textContent = cell.sick ? '병듦(감염)' : '건강';
      this.statusEl.style.color = cell.sick ? '#c084fc' : '#4ade80';
    }
    if (this.energyEl) {
      this.energyEl.textContent = `${cell.energy.toFixed(0)} / ${maxE.toFixed(0)} (${Math.round((cell.energy / maxE) * 100)}%)`;
    }
    if (this.feedEl) this.feedEl.textContent = `${Math.round(cell.feed * 100)}%`;
    if (this.posEl) this.posEl.textContent = `${cell.x.toFixed(0)}, ${cell.y.toFixed(0)}`;
    return false;
  }

  hide(): void {
    if (!this.visible) return;
    this.el.classList.add('hidden');
    this.visible = false;
    this.cell = null;
    this.world = null;
    this.onClose();
  }
}
