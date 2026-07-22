import type { Effect } from '../rules/types';
import type { GeneField } from '../simulation/types';
import { speciesById } from '../data/species';

/**
 * 상호작용 피드백 레이어: 선택 결과를 텍스트/숫자로 화면에 떠오르게 표시.
 * "내 결정이 무엇을 바꿨는지"를 즉시 읽히게 하는 장치.
 */
export class FeedbackLayer {
  private el: HTMLElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'feedback-layer';
    root.appendChild(this.el);
  }

  /** 선택지 적용 시 각 Effect를 사람이 읽을 수 있는 토스트로 표출 */
  showEffects(title: string, effects: Effect[]): void {
    const lines = effects.map(describeEffect).filter(Boolean);
    this.toast(`🧬 ${title}`, lines);
  }

  private toast(header: string, lines: string[]): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<div class="toast-h">${header}</div>` + lines.map((l) => `<div class="toast-l">${l}</div>`).join('');
    this.el.appendChild(t);
    // 애니메이션 후 제거
    setTimeout(() => t.classList.add('toast-out'), 2600);
    setTimeout(() => t.remove(), 3200);
  }
}

/** 유전 형질(GeneField) 한글 라벨 */
export const GENE_LABELS: Record<GeneField, string> = {
  moveSpeed: '이동속도',
  vision: '시야',
  energyFromIntake: '광합성 효율',
  upkeep: '기초대사',
  attackEnergy: '포식 에너지',
  divideEnergy: '분열 에너지',
  maxEnergy: '최대 에너지',
  toxicityTolerance: '독성 내성',
  energyFromCorpse: '시체 섭취 효율',
  eatCooldown: '소화 시간',
  divideCost: '분열 비용',
  corpseAppetite: '시체 섭식 속도',
};

/** 배율(1.0 기준)을 "+35% / -25%" 로 */
export function mulLabel(value: number): string {
  const pct = Math.round((value - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/** Effect를 사람이 읽을 수 있는 한 줄 텍스트로 변환 (토스트 공용) */
export function describeEffect(e: Effect): string {
  switch (e.kind) {
    case 'mutation':
      return `${speciesById[e.species]?.name} ${GENE_LABELS[e.field]} ${mulLabel(e.value)} · 등장률 ${Math.round(e.rate * 100)}%`;
    default:
      return '';
  }
}
