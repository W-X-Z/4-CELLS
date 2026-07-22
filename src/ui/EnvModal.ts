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
    role: '모든 세포가 호흡으로 소비하는 필수 자원. 광합성 세포가 만들어낸다. 고갈되면 모든 세포가 질식해 에너지를 급격히 잃는다 — 광합성이 무너지면 전체가 연쇄 질식한다.',
    rows: [
      { k: '생산', v: '광합성 세포' },
      { k: '소비', v: '모든 세포의 호흡' },
    ],
    value: (w) => w.env.resources.oxygen.toFixed(0),
  },
  co2: {
    label: '이산화탄소',
    color: '#94a3b8',
    glyph: '◐',
    role: '광합성의 유일한 원료. 세포가 호흡할 때 배출되고 광합성 세포가 소비한다. 고갈되면 광합성이 멈춰 산소 생산도 함께 무너진다 — 광합성 세포가 무한 증식하지 못하게 막는 제한 자원.',
    rows: [
      { k: '배출', v: '모든 세포의 호흡' },
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
    role: '방치된 시체가 부패하며 발생하는 오염. 분해 세포가 흡수해 정화한다. 세포의 독성 내성을 넘으면 초당 피해를 입는다 — 시체를 제때 치우지 못하면 생태계가 중독되어 붕괴한다.',
    rows: [
      { k: '발생', v: '방치된 시체의 부패' },
      { k: '정화', v: '분해 세포' },
    ],
    value: (w) => w.env.resources.toxicity.toFixed(0),
  },
  corpse: {
    label: '사체',
    color: '#b08a5a',
    glyph: '⬤',
    role: '죽은 세포가 남기는 유기물 덩어리. 분해 세포가 먹어 순환시키고, 방치하면 부패하며 독성을 방출한다. 소비·포식 세포는 시체를 먹지 않는다(분해 세포 전담).',
    rows: [
      { k: '발생', v: '세포의 사망' },
      { k: '처리', v: '분해 세포 섭식 / 방치 시 부패→독성' },
    ],
    value: (w) => String(w.corpses.length),
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
