import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { World } from '../simulation/World';
import { speciesDefs } from '../data/species';
import type { QualityProfile } from '../core/device';
import type { SpeciesDef } from '../simulation/types';

const TEX_RADIUS = 16; // 텍스처 기준 반경(스프라이트에서 축소)

/**
 * PixiJS 렌더러. 시뮬레이션 상태를 읽어 스프라이트로 그리기만 한다(단방향).
 * 세포는 종별 모양(색약 대응) + tint 색상. 스프라이트 풀링으로 GC 최소화.
 */
export class PixiRenderer {
  app = new Application();
  private world!: World;
  private quality!: QualityProfile;

  private root = new Container();
  private cellLayer = new Container();
  private fxLayer = new Container(); // 플로팅 텍스트 이펙트 (세포 위)
  private textures: Record<string, Texture> = {};
  private pool: Sprite[] = [];

  // ── 플로팅 텍스트 (포식/광합성 등 순간 이벤트 시각화) ──
  private fxPool: Text[] = [];
  private fxActive: { t: Text; age: number; ttl: number }[] = [];
  private fxCap = 40;
  private worldScale = 1; // 월드→화면 배율. 텍스트를 역배율해 화면상 크기를 일정하게 유지.
  private photoAccum = 0; // 광합성 표시 샘플링 타이머
  private frame = 0;

  async init(canvas: HTMLCanvasElement, world: World, quality: QualityProfile): Promise<void> {
    this.world = world;
    this.quality = quality;

    await this.app.init({
      canvas,
      preference: 'webgl', // WebGPU 프로빙으로 인한 지연/실패 회피(폭넓은 호환)
      resizeTo: canvas.parentElement ?? window,
      background: 0x0a0f1a,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, quality.resolutionCap),
      autoDensity: true,
    });

    this.app.stage.addChild(this.root);
    this.root.addChild(this.cellLayer);
    this.root.addChild(this.fxLayer);
    this.fxCap = quality.isMobile ? 16 : 40;
    this.buildTextures();
    this.fit();
    // 참고: fit()은 render()에서 매 프레임 호출 — Pixi의 지연 리사이즈와 월드 크기 변경을 모두 즉시 반영
  }

  private buildTextures(): void {
    for (const def of speciesDefs) {
      const g = new Graphics();
      drawShape(g, def.shape, TEX_RADIUS);
      this.textures[def.id] = this.app.renderer.generateTexture({ target: g, resolution: 2 });
      g.destroy();
    }
  }

  /** 월드 좌표계를 캔버스에 레터박스로 맞춤 */
  private fit(): void {
    const { width, height } = this.world.cfg;
    // app.screen은 항상 논리(화면) px. renderer.width도 v8에선 논리 px라 resolution으로 나누면 안 됨.
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const scale = Math.min(sw / width, sh / height);
    this.worldScale = scale || 1;
    this.root.scale.set(scale);
    this.root.x = (sw - width * scale) / 2;
    this.root.y = (sh - height * scale) / 2;
  }

  /** 월드 좌표 (x,y)에서 위로 떠오르며 사라지는 텍스트를 생성 */
  private spawnFloatText(str: string, x: number, y: number, color: number, fontSize = 13): void {
    if (this.fxActive.length >= this.fxCap) return;
    let t = this.fxPool.pop();
    if (!t) {
      t = new Text({
        text: str,
        style: { fontFamily: 'sans-serif', fontSize: 14, fontWeight: '700', fill: 0xffffff },
      });
      t.anchor.set(0.5, 1);
      this.fxLayer.addChild(t);
    }
    t.text = str;
    t.style.fontSize = fontSize;
    t.style.fill = color;
    t.x = x;
    t.y = y;
    t.alpha = 1;
    t.visible = true;
    // 월드가 축소 렌더될수록(모바일) 텍스트를 역배율해 화면상 크기를 유지
    t.scale.set(1 / this.worldScale);
    this.fxActive.push({ t, age: 0, ttl: 1.1 });
  }

  /** 플로팅 텍스트 갱신: 상승 + 페이드아웃 */
  private updateFloatTexts(dt: number): void {
    const rise = 26 / this.worldScale; // 화면 기준 초당 26px 상승
    for (let i = this.fxActive.length - 1; i >= 0; i--) {
      const fx = this.fxActive[i];
      fx.age += dt;
      fx.t.y -= rise * dt;
      const p = fx.age / fx.ttl;
      fx.t.alpha = p < 0.5 ? 1 : 1 - (p - 0.5) * 2;
      if (fx.age >= fx.ttl) {
        fx.t.visible = false;
        this.fxPool.push(fx.t);
        this.fxActive.splice(i, 1);
      }
    }
  }

  /** 시뮬레이션 이벤트 → 이펙트. 광합성은 연속 대사라 주기적으로 일부만 샘플링해 표시. */
  private emitEffects(dt: number): void {
    // 1) 이산 이벤트 (포식). 초식이 빈번하므로 프레임당 소수만 표시(스팸/상한 독점 방지).
    let predShown = 0;
    const predPerFrame = this.quality.isMobile ? 2 : 4;
    for (const e of this.world.drainEvents()) {
      if (e.type === 'predation' && predShown < predPerFrame) {
        this.spawnFloatText('포식!', e.x, e.y, 0xf87171, 13);
        predShown++;
      }
    }

    // 2) 광합성 샘플링: 0.6초마다 광합성 세포 몇 개 위에 O₂ 표시.
    //    포식 텍스트가 상한을 독점하지 않도록 약간의 여유가 있을 때만.
    this.photoAccum += dt;
    if (this.photoAccum < 0.6) return;
    this.photoAccum = 0;
    if (this.fxActive.length > this.fxCap - 4) return;
    const env = this.world.env.resources;
    if (env.co2 < 5) return; // 원료(CO₂)가 없으면 광합성도 없음

    const cells = this.world.cells;
    let shown = 0;
    // 프레임 카운터 기반 의사 난수 시작점 → 시뮬레이션 결정론에 영향 없음(코스메틱)
    const start = cells.length > 0 ? (this.frame * 7919) % cells.length : 0;
    for (let k = 0; k < cells.length && shown < 2; k++) {
      const c = cells[(start + k) % cells.length];
      if (c.species !== 'photosynth' || !c.alive) continue;
      this.spawnFloatText('O₂', c.x, c.y - 6, 0x7dd3fc, 11);
      shown++;
    }
  }

  private lastTick = -1;

  /** 매 프레임 호출: 세포 상태를 스프라이트에 동기화 */
  render(): void {
    this.fit(); // 캔버스/월드 크기 변화를 즉시 반영 (수 회 곱셈 수준의 비용)
    const dt = Math.min(this.app.ticker.deltaMS / 1000, 0.1);
    this.frame++;

    // 시뮬레이션이 진행 중일 때만 새 이펙트 발생 (일시정지 중엔 기존 것만 페이드)
    if (this.world.tick !== this.lastTick) {
      this.lastTick = this.world.tick;
      this.emitEffects(dt);
    }
    this.updateFloatTexts(dt);

    const cells = this.world.cells;
    const n = Math.min(cells.length, this.quality.maxCells);

    for (let i = 0; i < n; i++) {
      const c = cells[i];
      const def = this.world.species[c.species] as SpeciesDef;
      let sp = this.pool[i];
      if (!sp) {
        sp = new Sprite();
        sp.anchor.set(0.5);
        this.cellLayer.addChild(sp);
        this.pool[i] = sp;
      }
      sp.visible = true;
      sp.texture = this.textures[c.species];
      sp.tint = def.color;
      sp.x = c.x;
      sp.y = c.y;
      const flash = this.quality.flashEffects ? c.flash : 0;
      const base = def.radius / TEX_RADIUS;
      sp.scale.set(base * (1 + flash * 0.6));
      // 에너지가 낮으면 흐리게(굶주림 시각화)
      const vitality = Math.max(0.25, Math.min(1, c.energy / (def.maxEnergy * 0.6)));
      sp.alpha = 0.55 + vitality * 0.45 + flash * 0.4;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}

function drawShape(g: Graphics, shape: string, r: number): void {
  switch (shape) {
    case 'circle':
      g.circle(0, 0, r).fill(0xffffff);
      break;
    case 'diamond':
      g.poly([0, -r, r, 0, 0, r, -r, 0]).fill(0xffffff);
      break;
    case 'triangle':
      g.poly([0, -r, r * 0.87, r * 0.6, -r * 0.87, r * 0.6]).fill(0xffffff);
      break;
    case 'ring':
      g.circle(0, 0, r * 0.78).stroke({ width: r * 0.5, color: 0xffffff, alignment: 0.5 });
      break;
    default:
      g.circle(0, 0, r).fill(0xffffff);
  }
}
