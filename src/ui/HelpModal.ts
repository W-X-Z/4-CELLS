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

function rows(items: { icon: string; color?: string; name: string; desc: string }[]): string {
  return items
    .map(
      (r) => `
      <div class="help-row">
        <span class="help-icon"${r.color ? ` style="color:${r.color}"` : ''}>${r.icon}</span>
        <div class="help-text"><b>${r.name}</b><span>${r.desc}</span></div>
      </div>`,
    )
    .join('');
}

/**
 * 게임 도움말 모달 (페이지네이션 카드).
 * 개요/세포/환경/조작 4페이지를 좌우 화살표·점·스와이프로 넘긴다.
 */
export class HelpModal {
  private el: HTMLElement;
  visible = false;

  private index = 0;
  private pageCount = 0;
  private track!: HTMLElement;
  private dots!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;

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
    // 좌우 방향키로도 넘긴다(도움말이 열려 있을 때만).
    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.go(1); }
    });
  }

  private build(): void {
    const pages: { title: string; body: string }[] = [
      {
        title: '개요',
        body: `<p class="help-lead">작은 접시 속 생태계. 세포가 <b>먹고 · 사냥하고 · 분해하며</b> 산소·CO₂를 순환시켜요. 분열이 쌓이면 <b>돌연변이</b>를 골라 개입할 수 있습니다.</p>
          <p class="help-lead">목표는 간단해요 — 개입해서 <b>균형을 최대한 오래</b> 유지하기.</p>`,
      },
      {
        title: '세포 4종',
        body: `<div class="help-list">${rows(
          speciesDefs.map((d) => ({ icon: SHAPE_GLYPH[d.shape], color: hex(d.color), name: d.name, desc: SPECIES_ONELINE[d.id] ?? '' })),
        )}</div>`,
      },
      { title: '환경', body: `<div class="help-list">${rows(ENV_ROWS)}</div>` },
      { title: '조작', body: `<div class="help-list">${rows(CONTROL_ROWS)}</div>` },
    ];
    this.pageCount = pages.length;

    const pagesHtml = pages
      .map((p) => `<div class="help-page"><div class="help-page-title">${p.title}</div>${p.body}</div>`)
      .join('');
    const dotsHtml = pages.map((_, i) => `<span class="help-dot${i === 0 ? ' active' : ''}"></span>`).join('');

    this.el.innerHTML = `
      <div class="modal-card help-card">
        <div class="modal-head">
          <span class="modal-glyph">🧫</span>
          <div class="modal-title">게임 방법</div>
          <button class="btn modal-close">✕</button>
        </div>
        <div class="help-viewport">
          <div class="help-track">${pagesHtml}</div>
        </div>
        <div class="help-nav">
          <button class="help-arrow" data-dir="-1" aria-label="이전">‹</button>
          <div class="help-dots">${dotsHtml}</div>
          <button class="help-arrow" data-dir="1" aria-label="다음">›</button>
        </div>
      </div>`;

    this.el.querySelector<HTMLButtonElement>('.modal-close')!.onclick = () => this.hide();
    this.track = this.el.querySelector('.help-track')!;
    this.dots = this.el.querySelector('.help-dots')!;
    this.prevBtn = this.el.querySelector('[data-dir="-1"]')!;
    this.nextBtn = this.el.querySelector('[data-dir="1"]')!;
    this.prevBtn.onclick = () => this.go(-1);
    this.nextBtn.onclick = () => this.go(1);
    this.el.querySelectorAll<HTMLElement>('.help-dot').forEach((dot, i) => (dot.onclick = () => this.goTo(i)));
    this.setupSwipe();
    this.goTo(0);
  }

  /** 스와이프(수평 드래그)로 페이지 넘기기 */
  private setupSwipe(): void {
    const vp = this.el.querySelector<HTMLElement>('.help-viewport')!;
    let startX = 0;
    let active = false;
    vp.addEventListener('pointerdown', (e) => {
      active = true;
      startX = e.clientX;
    });
    const end = (e: PointerEvent): void => {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      if (dx < -40) this.go(1);
      else if (dx > 40) this.go(-1);
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', () => (active = false));
  }

  private go(dir: number): void {
    this.goTo(this.index + dir);
  }

  private goTo(i: number): void {
    this.index = Math.max(0, Math.min(this.pageCount - 1, i));
    this.track.style.transform = `translateX(${-this.index * 100}%)`;
    this.dots.querySelectorAll('.help-dot').forEach((d, k) => d.classList.toggle('active', k === this.index));
    this.prevBtn.disabled = this.index === 0;
    this.nextBtn.disabled = this.index === this.pageCount - 1;
  }

  show(): void {
    this.goTo(0); // 열 때 항상 첫 페이지부터
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
