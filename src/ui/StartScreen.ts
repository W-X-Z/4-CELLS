/**
 * 시작 화면. 게임은 바로 시작하지 않고 이 화면에서 대기한다.
 * [게임 시작] → onStart, [도움말] → onHelp.
 */
export class StartScreen {
  private el: HTMLElement;
  visible = false;

  constructor(
    root: HTMLElement,
    handlers: { onStart: () => void; onHelp: () => void },
  ) {
    this.el = document.createElement('div');
    this.el.className = 'start-screen hidden';
    this.el.innerHTML = `
      <div class="start-card">
        <div class="start-logo">🧫</div>
        <h1 class="start-title">4 CELLS</h1>
        <p class="start-tag">한 방울 속, 살아 숨쉬는 생태계</p>
        <p class="start-sub">먹고 · 사냥하고 · 분해하며 스스로 진화합니다.<br>돌연변이를 골라 개입하고, 붕괴를 늦춰보세요.</p>
        <div class="start-actions">
          <button class="btn start-primary" data-act="start">▶ 게임 시작</button>
          <button class="btn start-secondary" data-act="help">❓ 도움말</button>
        </div>
      </div>`;
    this.el.querySelector<HTMLButtonElement>('[data-act="start"]')!.onclick = () => {
      this.hide();
      handlers.onStart();
    };
    this.el.querySelector<HTMLButtonElement>('[data-act="help"]')!.onclick = () => handlers.onHelp();
    root.appendChild(this.el);
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.visible = true;
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.visible = false;
  }
}
