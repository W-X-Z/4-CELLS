import type { Effect } from '../rules/types';
import { RESOURCE_LABELS, type ResourceKey } from '../simulation/types';
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
    this.toast(`✔ ${title}`, lines);
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

function sign(v: number): string {
  return v >= 0 ? `+${v}` : `${v}`;
}

/** 종 능력치 필드의 한글 라벨 */
const FIELD_LABELS: Record<string, string> = {
  moveSpeed: '이동속도',
  radius: '크기',
  energyFromIntake: '에너지 효율',
  upkeep: '기초대사',
  attackEnergy: '포식 에너지',
  divideEnergy: '분열 에너지',
  divideCooldown: '분열 쿨다운',
  maxEnergy: '최대 에너지',
  lifespan: '수명',
  toxicityTolerance: '독성 내성',
};

/** Effect를 사람이 읽을 수 있는 한 줄 텍스트로 변환 (토스트/도움말 모달 공용) */
export function describeEffect(e: Effect): string {
  switch (e.kind) {
    case 'resource':
      return `${RESOURCE_LABELS[e.key as ResourceKey]} ${e.op === 'mul' ? `×${e.value}` : sign(e.value)}`;
    case 'resourceRegen':
      return `${RESOURCE_LABELS[e.key as ResourceKey]} 회복량 ${e.op === 'mul' ? `×${e.value}` : sign(e.value)}/s`;
    case 'species':
      return `${speciesById[e.species]?.name} ${FIELD_LABELS[e.field] ?? e.field} ${e.op === 'mul' ? `×${e.value}` : sign(e.value)}`;
    case 'metabolism':
      return `${speciesById[e.species]?.name} ${e.io === 'intake' ? '소비' : '생산'} ${RESOURCE_LABELS[e.key as ResourceKey]} ${e.op === 'mul' ? `×${e.value}` : sign(e.value)}`;
    case 'moveMode':
      return `${speciesById[e.species]?.name} 이동방식 → ${e.value}`;
    case 'predation':
      return `${speciesById[e.species]?.name} ${e.op === 'add' ? '포식 대상 추가' : '포식 중단'}: ${speciesById[e.target]?.name}`;
    case 'spawn':
      return `${speciesById[e.species]?.name} +${e.count} 투입`;
    default:
      return '';
  }
}
