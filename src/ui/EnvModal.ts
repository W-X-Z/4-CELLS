import type { World } from '../simulation/World';
import type { EnvKey } from './HUD';

interface EnvInfo {
  label: string;
  color: string;
  glyph: string;
  role: string;
  rows: { k: string; v: string }[];
  value: (world: World) => string;
}

/** 환경 대시보드 각 요소의 역할 설명 (세포 도움말과 동일한 패턴) */
const ENV_INFO: Record<EnvKey, EnvInfo> = {
  oxygen: {
    label: '산소',
    color: '#7dd3fc',
    glyph: '○',
    role: '광합성이 만들고, 호흡 세포(소비·포식·분해)가 쓴다. 부족하면 호흡 세포가 질식한다.',
    rows: [
      { k: '생산', v: '광합성 세포' },
      { k: '소비', v: '호흡 세포(소비·포식·분해)' },
    ],
    value: (w) => w.env.resources.oxygen.toFixed(0),
  },
  co2: {
    label: '이산화탄소',
    color: '#94a3b8',
    glyph: '◐',
    role: '광합성의 원료. 호흡·분해가 배출하고 광합성이 쓴다. 다른 종이 무너지면 CO₂도 말라 함께 붕괴한다.',
    rows: [
      { k: '공급', v: '호흡·분해 세포 배출(대기 유입 없음)' },
      { k: '소비', v: '광합성 세포' },
    ],
    value: (w) => w.env.resources.co2.toFixed(0),
  },
  heat: {
    label: '열',
    color: '#fb923c',
    glyph: '△',
    role: '대사의 부산물. 미지근하면 이동↑, 과열되면 이동↓·대사 부담↑. 시간이 지나면 식는다.',
    rows: [
      { k: '발생', v: '대사 활동' },
      { k: '효과', v: '미지근=이동↑ / 과열=이동↓·대사↑' },
    ],
    value: (w) => w.env.resources.heat.toFixed(0),
  },
  toxicity: {
    label: '독성',
    color: '#c084fc',
    glyph: '✦',
    role: '치우지 않은 시체가 뿜는 오염. 높아지면 세포가 병들어(보라색) 에너지를 잃다 회복·사망한다. 분해가 시체를 치우면 가라앉는다.',
    rows: [
      { k: '발생', v: '남아 있는 시체(치울수록 감소)' },
      { k: '효과', v: '높을수록 세포 감염 확률↑(보라색)' },
      { k: '정화', v: '분해 세포의 시체 섭식 + 자연 감쇠' },
    ],
    value: (w) => w.env.resources.toxicity.toFixed(0),
  },
};

/**
 * 환경 도움말 모달. 상단 자원 카드를 탭하면 열린다(게임은 일시정지).
 * 세포 도움말(InfoModal)과 같은 스타일/동작을 공유한다.
 */
export class EnvModal {
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

  show(key: EnvKey, world: World): void {
    const info = ENV_INFO[key];
    this.el.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <span class="modal-glyph" style="color:${info.color}">${info.glyph}</span>
          <div class="modal-title">${info.label}</div>
          <button class="btn modal-close">✕</button>
        </div>
        <p class="modal-role">${info.role}</p>

        <div class="modal-section">역할</div>
        <div class="modal-rows">
          ${info.rows.map((r) => `<div class="modal-row"><span>${r.k}</span><b>${r.v}</b></div>`).join('')}
          <div class="modal-row"><span>현재 값</span><b>${info.value(world)}</b></div>
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
