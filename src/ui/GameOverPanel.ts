import type { WorldSnapshot } from '../simulation/types';

/** 게임 오버 결과 화면. */
export class GameOverPanel {
  private el: HTMLElement;

  constructor(
    private root: HTMLElement,
    private onRestart: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'gameover-overlay hidden';
    this.root.appendChild(this.el);
  }

  show(snap: WorldSnapshot, seed: number): void {
    this.el.innerHTML = `
      <div class="gameover-card">
        <div class="gameover-title">생태계 붕괴</div>
        <div class="gameover-sub">모든 세포가 사라졌습니다.</div>
        <div class="gameover-stats">
          <div><span>생존 시간</span><b>${snap.time.toFixed(1)}초</b></div>
          <div><span>최종 점수</span><b>${snap.score}</b></div>
          <div><span>최고 다양성</span><b>${snap.biodiversity.toFixed(2)}</b></div>
          <div><span>시드</span><b>${seed}</b></div>
        </div>
        <button class="btn btn-restart">다시 시작</button>
      </div>`;
    this.el.querySelector<HTMLButtonElement>('.btn-restart')!.onclick = () => {
      this.hide();
      this.onRestart();
    };
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
