import type { World } from '../simulation/World';
import type { Cell, GeneField } from '../simulation/types';
import { eff } from '../simulation/genetics';

/** 종별 모양 글리프 (색약 대응: 색 + 모양) — HUD와 동일 */
const SHAPE_GLYPH: Record<string, string> = {
  circle: '●',
  diamond: '◆',
  triangle: '▲',
  ring: '○',
};

/** 유전 형질 필드 → 한글 라벨 (보유 돌연변이 표시용) */
const GENE_LABEL: Record<GeneField, string> = {
  moveSpeed: '이동 속도',
  vision: '시야',
  energyFromIntake: '광합성 효율',
  upkeep: '기초 대사',
  attackEnergy: '포식 효율',
  divideEnergy: '분열 에너지',
  maxEnergy: '최대 에너지',
  toxicityTolerance: '독성 내성',
  energyFromCorpse: '분해 효율',
};

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/**
 * 개체 상세 모달. 일시정지 중 캔버스의 세포를 탭하면 열린다.
 * 선택 시점의 상태를 스냅샷으로 보여준다(일시정지 상태라 값이 고정).
 * 세포/환경 도움말(InfoModal·EnvModal)과 같은 스타일을 공유한다.
 */
export class CellModal {
  private el: HTMLElement;
  visible = false;

  constructor(
    private root: HTMLElement,
    private onClose: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'modal-overlay hidden';
    this.el.addEventListener('click', (ev) => {
      if (ev.target === this.el) this.hide();
    });
    this.root.appendChild(this.el);
  }

  show(cell: Cell, world: World): void {
    const def = world.species[cell.species];
    const maxE = eff(def, cell, 'maxEnergy');
    const energyPct = Math.round((cell.energy / maxE) * 100);

    // 보유 돌연변이(발현 형질): 종 기본 대비 배율을 %로 표기
    const geneRows = cell.genes
      ? (Object.keys(cell.genes) as GeneField[]).map((f) => {
          const mul = cell.genes![f] ?? 1;
          const pct = Math.round((mul - 1) * 100);
          const sign = pct > 0 ? '+' : '';
          return `<div class="modal-row"><span>${GENE_LABEL[f]}</span><b>${sign}${pct}%</b></div>`;
        })
      : [];

    // 체질(개체 편차): 분열 문턱 배율을 표준 대비 %로
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
          <div class="modal-row"><span>세대</span><b>${cell.gen}세대</b></div>
          <div class="modal-row"><span>에너지</span><b>${cell.energy.toFixed(0)} / ${maxE.toFixed(0)} (${energyPct}%)</b></div>
          <div class="modal-row"><span>포만도</span><b>${Math.round(cell.feed * 100)}%</b></div>
          <div class="modal-row"><span>체질(분열 문턱)</span><b>${vigorSign}${vigorPct}%</b></div>
          <div class="modal-row"><span>위치</span><b>${cell.x.toFixed(0)}, ${cell.y.toFixed(0)}</b></div>
        </div>

        <div class="modal-section">보유 돌연변이</div>
        <div class="modal-rows">
          ${geneRows.length ? geneRows.join('') : '<div class="modal-empty">야생형 — 발현한 돌연변이 없음</div>'}
        </div>
      </div>`;
    this.el.querySelector<HTMLButtonElement>('.modal-close')!.onclick = () => this.hide();
    this.el.classList.remove('hidden');
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) return;
    this.el.classList.add('hidden');
    this.visible = false;
    this.onClose();
  }
}
