import type { SpeciesId, ResourceKey } from '../simulation/types';
import { RESOURCE_LABELS } from '../simulation/types';
import type { World } from '../simulation/World';
import { GENE_LABELS, mulLabel } from './FeedbackLayer';

/** 종별 역할 설명 (생태계 순환에서의 위치) */
const ROLE_TEXT: Record<SpeciesId, string> = {
  photosynth:
    'CO₂를 흡수해 산소를 만드는 생태계의 엔진. 스스로는 호흡하지 않고 광합성으로만 에너지를 쌓는다. 호흡하는 다른 세포들이 산소를 쓰므로, 광합성이 무너지면 산소가 고갈되어 전 세포가 질식한다.',
    consumer:
    '광합성 세포를 뜯어먹는 초식자. 오직 광합성 포식으로만 살아가며, 한 번 먹으면 소화 시간이 필요하다. 너무 많아지면 광합성을 과도하게 먹어 산소 생산이 무너지고 스스로도 질식한다.',
  predator:
    '소비 세포를 사냥하는 육식자. 소비 세포의 과잉 번식을 억제하지만, 포식자가 너무 많으면 먹이가 전멸해 함께 굶는다.',
  decomposer:
    '시체를 먹어치우고 독성을 정화하는 청소부. 시체가 방치되어 부패하면 독성이 폭증하므로, 생태계를 지키는 마지막 방어선.',
};

const SHAPE_GLYPH: Record<string, string> = {
  circle: '●',
  diamond: '◆',
  triangle: '▲',
  ring: '○',
};

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** intake/output 맵을 "이산화탄소 2.2/s" 형태로 */
function metabLine(map: Partial<Record<ResourceKey, number>>): string {
  const parts: string[] = [];
  for (const [key, amt] of Object.entries(map)) {
    if (!amt) continue;
    parts.push(`${RESOURCE_LABELS[key as ResourceKey]} ${Math.round(amt * 10) / 10}/s`);
  }
  return parts.length ? parts.join(' · ') : '없음';
}

/**
 * 세포 도움말 모달. 하단 세포 바를 탭하면 열린다(게임은 일시정지).
 * 역할 설명 + 종 기본 대사 + 이 종의 유전자풀(돌연변이별 개체군 발현율)을 보여준다.
 */
export class InfoModal {
  private el: HTMLElement;
  visible = false;

  constructor(
    private root: HTMLElement,
    private onClose: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'modal-overlay hidden';
    // 카드 바깥(어두운 배경) 탭으로 닫기
    this.el.addEventListener('click', (ev) => {
      if (ev.target === this.el) this.hide();
    });
    this.root.appendChild(this.el);
  }

  show(id: SpeciesId, world: World): void {
    const def = world.species[id]; // 종 기본 명세(야생형)
    const glyph = SHAPE_GLYPH[def.shape];
    const color = hex(def.color);

    // 현재 상태 집계
    const speciesCells = world.cells.filter((c) => c.species === id);
    const count = speciesCells.length;
    let energySum = 0;
    for (const c of speciesCells) energySum += c.energy;
    const avgEnergy = count > 0 ? Math.round(energySum / count) : 0;

    // 포식 관계
    const preyNames = def.preyOn.map((p) => world.species[p].name).join(', ');

    // 유전자풀: 각 돌연변이의 개체군 발현율(carrier %)
    const pool = world.genePool[id];
    const geneHtml =
      pool.length === 0
        ? `<div class="modal-empty">아직 발생한 돌연변이가 없습니다.</div>`
        : pool
            .map((m) => {
              const carriers = speciesCells.reduce((n, c) => n + (c.carried?.includes(m.id) ? 1 : 0), 0);
              const pct = count > 0 ? Math.round((carriers / count) * 100) : 0;
              return `
              <div class="evo-item">
                <div class="evo-title">${GENE_LABELS[m.field]} ${mulLabel(m.value)}</div>
                <div class="evo-line">개체군 발현 ${pct}% · 등장률 ${Math.round(m.rate * 100)}%</div>
              </div>`;
            })
            .join('');

    const corpseLine =
      def.corpseAppetite > 0
        ? `<div class="modal-row"><span>시체 섭식</span><b>${Math.round(def.corpseAppetite * 10) / 10}/s (에너지 ${def.energyFromCorpse}/질량)</b></div>`
        : '';

    this.el.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <span class="modal-glyph" style="color:${color}">${glyph}</span>
          <div class="modal-title">${def.name}</div>
          <button class="btn modal-close">✕</button>
        </div>
        <p class="modal-role">${ROLE_TEXT[id]}</p>

        <div class="modal-section">기본 대사</div>
        <div class="modal-rows">
          ${preyNames ? `<div class="modal-row"><span>포식 대상</span><b>${preyNames}</b></div>` : ''}
          ${metabLine(def.intake) !== '없음' ? `<div class="modal-row"><span>소비</span><b>${metabLine(def.intake)}</b></div>` : ''}
          ${metabLine(def.output) !== '없음' ? `<div class="modal-row"><span>생산</span><b>${metabLine(def.output)}</b></div>` : ''}
          ${metabLine(def.scavenge) !== '없음' ? `<div class="modal-row"><span>정화</span><b>${metabLine(def.scavenge)}</b></div>` : ''}
          ${corpseLine}
          ${
            def.respires
              ? `<div class="modal-row"><span>호흡(산소 소비)</span><b>${Math.round(def.upkeep * world.cfg.respirationRate * 10) / 10}/s</b></div>`
              : `<div class="modal-row"><span>호흡</span><b>안 함 (광합성 전용)</b></div>`
          }
          <div class="modal-row"><span>기초 에너지 소모</span><b>${Math.round(def.upkeep * 10) / 10}/s</b></div>
        </div>

        <div class="modal-section">현재 상태</div>
        <div class="modal-rows">
          <div class="modal-row"><span>개체수</span><b>${count}</b></div>
          <div class="modal-row"><span>평균 에너지</span><b>${avgEnergy} / ${Math.round(def.maxEnergy)}</b></div>
        </div>

        <div class="modal-section">유전자풀 (돌연변이)</div>
        ${geneHtml}
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
