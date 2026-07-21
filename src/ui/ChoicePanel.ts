import type { ChoiceDef, ChoiceCategory } from '../rules/types';

const CATEGORY_LABEL: Record<ChoiceCategory, string> = {
  environment: '환경',
  ability: '능력치',
  behavior: '행동 규칙',
  metabolism: '대사 관계',
  spawn: '세포 투입',
};

/** 선택지 오버레이. 표시되는 동안 시뮬레이션은 일시정지된다. */
export class ChoicePanel {
  private el: HTMLElement;

  constructor(
    private root: HTMLElement,
    private onPick: (choiceId: string) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'choice-overlay hidden';
    this.root.appendChild(this.el);
  }

  show(choices: ChoiceDef[]): void {
    this.el.innerHTML = `<div class="choice-title">진화의 갈림길 — 하나를 선택하세요</div>`;
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    for (const c of choices) {
      const card = document.createElement('button');
      card.className = `choice-card cat-${c.category}`;
      card.innerHTML = `
        <div class="choice-cat">${CATEGORY_LABEL[c.category]}</div>
        <div class="choice-name">${c.title}</div>
        <div class="choice-desc">${c.description}</div>`;
      card.onclick = () => {
        this.hide();
        this.onPick(c.id);
      };
      grid.appendChild(card);
    }
    this.el.appendChild(grid);
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
