import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
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
  private textures: Record<string, Texture> = {};
  private pool: Sprite[] = [];

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
    this.buildTextures();
    this.fit();
    window.addEventListener('resize', () => this.fit());
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
    const sw = this.app.renderer.width / this.app.renderer.resolution;
    const sh = this.app.renderer.height / this.app.renderer.resolution;
    const scale = Math.min(sw / width, sh / height);
    this.root.scale.set(scale);
    this.root.x = (sw - width * scale) / 2;
    this.root.y = (sh - height * scale) / 2;
  }

  /** 매 프레임 호출: 세포 상태를 스프라이트에 동기화 */
  render(): void {
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
