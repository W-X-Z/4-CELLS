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
    role: '광합성 세포가 만들어내고, 호흡하는 세포(소비·포식·분해)가 소비하는 자원. 부족하면 호흡 세포가 질식해 에너지를 급격히 잃는다. 광합성 세포 자신은 호흡하지 않아 산소를 쓰지 않는다.',
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
    role: '광합성의 원료. 호흡하는 세포(소비·포식·분해)와 분해 활동이 배출하고, 광합성 세포가 소비한다. 대기 공급이 없어 다른 세포가 무너지면 CO₂도 말라 광합성도 함께 붕괴한다 — 종간 상호의존의 핵심.',
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
    role: '대사 활동(광합성·분해·시체 섭식)의 부산물. 미지근하면 세포의 이동이 빨라지고, 과열되면 급격히 둔해지며 기초대사 부담이 커진다. 시간이 지나면 주변 온도로 식는다.',
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
    role: '치우지 않은 시체가 계속 뿜어내는 오염. 독성이 높아지면 세포가 감기처럼 병에 걸릴 확률이 오른다(내성 낮은 종부터). 병든 세포는 보라색으로 변하고 에너지를 더 빨리 잃다가 회복하거나 죽는다. 분해 세포가 시체를 치우면 독성이 내려가 전염병이 잦아든다.',
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
