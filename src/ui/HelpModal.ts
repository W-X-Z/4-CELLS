import { speciesDefs } from '../data/species';

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

const SHAPE_GLYPH: Record<string, string> = {
  circle: '●',
  diamond: '◆',
  triangle: '▲',
  ring: '○',
};

/** 종별 한 줄 요약 (간결) */
const SPECIES_ONELINE: Record<string, string> = {
  photosynth: 'CO₂→산소. 생태계의 에너지·산소 엔진',
  consumer: '광합성 세포를 먹는 초식자',
  predator: '소비 세포를 사냥하는 육식자',
  decomposer: '시체를 치워 독성을 막는 청소부',
};

const ENV_ROWS: { icon: string; color: string; name: string; desc: string }[] = [
  { icon: '○', color: '#7dd3fc', name: '산소', desc: '광합성이 생산 · 호흡 세포가 소비' },
  { icon: '◐', color: '#94a3b8', name: '이산화탄소', desc: '광합성의 원료 · 호흡·분해가 배출' },
  { icon: '△', color: '#fb923c', name: '열', desc: '대사의 부산물 · 이동 속도에 영향' },
  { icon: '✦', color: '#c084fc', name: '독성', desc: '쌓인 시체가 방출 · 높으면 세포가 병듦(보라색)' },
];

const CONTROL_ROWS: { icon: string; name: string; desc: string }[] = [
  { icon: '🔍', name: '확대 / 축소', desc: '마우스 휠 · 두 손가락 핀치' },
  { icon: '✋', name: '이동(팬)', desc: '캔버스 드래그' },
  { icon: '👆', name: '세포 정보', desc: '세포를 탭하면 상세 정보' },
  { icon: '↺', name: '화면 초기화', desc: '더블클릭 · 더블탭' },
  { icon: '⏯', name: '배속 / 일시정지', desc: '상단 바 버튼' },
];

/**
 * 게임 도움말 모달. 시작 화면(또는 상단 ❓)에서 연다.
 * 아이콘 + 짧고 간결한 설명 위주 — 세포/환경/조작을 한눈에.
 */
export class HelpModal {
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
    this.build();
  }

  private build(): void {
    const speciesRows = speciesDefs
      .map(
        (d) => `
        <div class="help-row">
          <span class="help-icon" style="color:${hex(d.color)}">${SHAPE_GLYPH[d.shape]}</span>
          <div class="help-text"><b>${d.name}</b><span>${SPECIES_ONELINE[d.id] ?? ''}</span></div>
        </div>`,
      )
      .join('');

    const envRows = ENV_ROWS.map(
      (r) => `
        <div class="help-row">
          <span class="help-icon" style="color:${r.color}">${r.icon}</span>
          <div class="help-text"><b>${r.name}</b><span>${r.desc}</span></div>
        </div>`,
    ).join('');

    const controlRows = CONTROL_ROWS.map(
      (r) => `
        <div class="help-row">
          <span class="help-icon">${r.icon}</span>
          <div class="help-text"><b>${r.name}</b><span>${r.desc}</span></div>
        </div>`,
    ).join('');

    this.el.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <span class="modal-glyph">🧫</span>
          <div class="modal-title">게임 방법</div>
          <button class="btn modal-close">✕</button>
        </div>

        <p class="modal-role">작은 접시 속 생태계. 세포가 먹고 분해하며 산소·CO₂를 순환시켜요. 분열이 쌓이면 <b>돌연변이</b>를 골라 개입할 수 있습니다.</p>

        <div class="modal-section">세포 4종</div>
        <div class="help-list">${speciesRows}</div>

        <div class="modal-section">환경</div>
        <div class="help-list">${envRows}</div>

        <div class="modal-section">조작</div>
        <div class="help-list">${controlRows}</div>
      </div>`;
    this.el.querySelector<HTMLButtonElement>('.modal-close')!.onclick = () => this.hide();
  }

  show(): void {
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
