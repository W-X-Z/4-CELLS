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
    role: '광합성의 원료. 호흡하는 세포가 배출하고 대기에서도 유입되며, 광합성 세포가 소비한다. 공급 한도가 광합성 개체군의 상한을 정한다(무한 증식 방지).',
    rows: [
      { k: '공급', v: '호흡 세포 배출 + 대기 유입' },
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
    role: '치우지 않은 시체가 계속 뿜어내는 오염. 시체가 많을수록 독성이 쌓인다. 분해 세포가 시체를 먹어 치우면(원천 제거) 독성 방출도 멎는다. 세포의 독성 내성을 넘으면 초당 피해 — 시체 관리에 실패하면 생태계가 중독된다.',
    rows: [
      { k: '발생', v: '남아 있는 시체(치울수록 감소)' },
      { k: '정화', v: '분해 세포의 시체 섭식 + 자연 감쇠' },
    ],
    value: (w) => w.env.resources.toxicity.toFixed(0),
  },
  corpse: {
    label: '사체',
    color: '#b08a5a',
    glyph: '⬤',
    role: '죽은 세포가 남기는 유기물 덩어리. 자연히 사라지지 않고 치울 때까지 영구히 남으며, 남아 있는 동안 계속 독성을 뿜는다. 분해 세포만 먹어서 치울 수 있다(소비·포식 세포는 못 먹음).',
    rows: [
      { k: '발생', v: '세포의 사망' },
      { k: '처리', v: '분해 세포 섭식(안 치우면 영구 잔존→독성)' },
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
