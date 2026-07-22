import type { ChoiceDef } from '../rules/types';
import { speciesById } from '../data/species';

const SHAPE_GLYPH: Record<string, string> = {
  circle: '●',
  diamond: '◆',
  triangle: '▲',
  ring: '○',
};

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** 이 선택지의 대표 등장률(첫 돌연변이 효과 기준) */
function emergenceRate(c: ChoiceDef): number {
  const m = c.effects.find((e) => e.kind === 'mutation');
  return m ? m.rate : 0;
}

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
    this.el.innerHTML = `<div class="choice-title">진화의 갈림길 — 돌연변이를 하나 선택하세요</div>`;
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    for (const c of choices) {
      const sp = speciesById[c.category];
      const color = sp ? hex(sp.color) : '#9ca3af';
      const glyph = sp ? SHAPE_GLYPH[sp.shape] : '●';
      const rate = Math.round(emergenceRate(c) * 100);
      const card = document.createElement('button');
      card.className = `choice-card cat-${c.category}`;
      card.style.setProperty('--sp-color', color);
      card.innerHTML = `
        <div class="choice-cat"><span class="choice-glyph" style="color:${color}">${glyph}</span>${sp?.name ?? ''}</div>
        <div class="choice-name">${c.title}</div>
        <div class="choice-desc">${c.description}</div>
        <div class="choice-rate">돌연변이 등장률 <b>${rate}%</b></div>`;
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
