import {
  CanvasRenderer,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Ticker,
  UPDATE_PRIORITY,
  WebGLRenderer,
} from 'pixi.js';
import type { World } from '../simulation/World';
import { speciesDefs } from '../data/species';
import { corpseRadius } from '../simulation/systems/Scavenging';
import { clamp } from '../core/math';
import type { QualityProfile } from '../core/device';
import type { Cell, SpeciesDef } from '../simulation/types';

const TEX_RADIUS = 16; // 텍스처 기준 반경(스프라이트에서 축소)
const VIEW_PAD = 8; // 캔버스 가장자리 여백(px) — 경계 세포 잘림 방지에 충분한 최소값(여백 최소화)
const CORPSE_TINT = 0x6b5a45; // 시체(유기물) 색
const HALO_TINT = 0xffffff; // 돌연변이 개체 강조 링

/**
 * PixiJS 렌더러. 시뮬레이션 상태를 읽어 스프라이트로 그리기만 한다(단방향).
 * 세포는 종별 모양(색약 대응) + tint 색상. 스프라이트 풀링으로 GC 최소화.
 */
export class PixiRenderer {
  readonly app = { ticker: new Ticker() };
  private renderer!: WebGLRenderer | CanvasRenderer;
  private stage = new Container();
  private resizeTarget!: HTMLElement;
  private readonly resizeHandler = (): void => {
    const width = this.resizeTarget.clientWidth || window.innerWidth;
    const height = this.resizeTarget.clientHeight || window.innerHeight;
    this.renderer.resize(width, height);
  };
  private world!: World;
  private quality!: QualityProfile;
  private resizeObserver?: ResizeObserver;

  private root = new Container();
  private corpseLayer = new Container(); // 시체 (세포 아래)
  private haloLayer = new Container(); // 돌연변이 강조 링 (세포 아래, 시체 위)
  private cellLayer = new Container();
  private fxLayer = new Container(); // 플로팅 텍스트 이펙트 (세포 위)
  private textures: Record<string, Texture> = {};
  private corpseTex!: Texture;
  private haloTex!: Texture;
  private pool: Sprite[] = [];
  private corpsePool: Sprite[] = [];
  private haloPool: Sprite[] = [];

  // ── 플로팅 텍스트 (포식/광합성 등 순간 이벤트 시각화) ──
  private fxPool: Text[] = [];
  private fxActive: { t: Text; age: number; ttl: number }[] = [];
  private fxCap = 40;
  private worldScale = 1; // 월드→화면 배율. 텍스트를 역배율해 화면상 크기를 일정하게 유지.
  private photoAccum = 0; // 광합성 표시 샘플링 타이머
  private frame = 0;

  // ── 카메라(팬/줌) ──
  private camZoom = 1; // 1 = 월드 전체가 화면에 맞는 기본 배율. 최대 6배까지 확대.
  private camPanX = 0; // 화면 px 단위 팬 오프셋
  private camPanY = 0;

  // ── 개체 선택(탭) ──
  /** 캔버스를 탭(짧게 클릭)하면 호출 — 드래그/핀치와 구분됨. main이 일시정지 상태에서 세포 선택에 사용. */
  onTap: ((clientX: number, clientY: number) => void) | null = null;
  private selected: Cell | null = null;
  private selectSprite?: Sprite;

  async init(canvas: HTMLCanvasElement, world: World, quality: QualityProfile): Promise<void> {
    this.world = world;
    this.quality = quality;
    this.resizeTarget = canvas.parentElement ?? document.body;
    this.renderer = await this.createRenderer(canvas, quality);

    this.resizeHandler();
    window.addEventListener('resize', this.resizeHandler);
    // 컨테이너 크기 변화를 항상 추적(레이아웃이 나중에 확정돼도 캔버스가 정확히 맞도록)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resizeHandler());
      this.resizeObserver.observe(this.resizeTarget);
    }
    this.setupCamera(this.resizeTarget);

    this.stage.addChild(this.root);
    this.root.addChild(this.corpseLayer);
    this.root.addChild(this.haloLayer);
    this.root.addChild(this.cellLayer);
    this.root.addChild(this.fxLayer);
    this.fxCap = quality.isMobile ? 16 : 40;
    this.buildTextures();
    // 선택 강조 링(세포 위, 텍스트 아래). 평소엔 숨김.
    this.selectSprite = new Sprite(this.haloTex);
    this.selectSprite.anchor.set(0.5);
    this.selectSprite.visible = false;
    this.fxLayer.addChild(this.selectSprite);
    this.fit();

    // 게임 갱신(NORMAL) 뒤에 실제 화면을 그린다.
    this.app.ticker.add(() => this.renderer.render({ container: this.stage }), undefined, UPDATE_PRIORITY.LOW);
    this.app.ticker.start();
    // 참고: fit()은 render()에서 매 프레임 호출 — Pixi의 지연 리사이즈와 월드 크기 변경을 모두 즉시 반영
  }

  private async createRenderer(
    canvas: HTMLCanvasElement,
    quality: QualityProfile,
  ): Promise<WebGLRenderer | CanvasRenderer> {
    const resolution = Math.min(window.devicePixelRatio || 1, quality.resolutionCap);

    // PixiJS autoDetectRenderer는 WebGL 컨텍스트와 함께 stencil 지원까지 선검사한다.
    // 일부 모바일은 WebGL이 가능해도 stencil이 없어 자동 감지에서 탈락하므로 직접 초기화한다.
    try {
      const webgl = new WebGLRenderer();
      await webgl.init({
        canvas,
        preferWebGLVersion: 1,
        background: 0x0a0f1a,
        antialias: !quality.isMobile,
        resolution,
        autoDensity: true,
      });
      return webgl;
    } catch (webglError) {
      console.warn('WebGL renderer unavailable; falling back to Canvas renderer.', webglError);

      // 이미 그래픽 컨텍스트 생성을 시도한 canvas는 다른 컨텍스트를 반환하지 않을 수 있어 교체한다.
      const fallbackCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fallbackCanvas);
      const canvasRenderer = new CanvasRenderer();
      await canvasRenderer.init({
        canvas: fallbackCanvas,
        background: 0x0a0f1a,
        resolution,
        autoDensity: true,
      });
      return canvasRenderer;
    }
  }

  private buildTextures(): void {
    for (const def of speciesDefs) {
      const g = new Graphics();
      drawShape(g, def.shape, TEX_RADIUS);
      this.textures[def.id] = this.renderer.generateTexture({ target: g, resolution: 2 });
      g.destroy();
    }
    // 시체: 부드러운 원형
    const cg = new Graphics();
    cg.circle(0, 0, TEX_RADIUS).fill(0xffffff);
    this.corpseTex = this.renderer.generateTexture({ target: cg, resolution: 2 });
    cg.destroy();
    // 돌연변이 강조: 얇은 링
    const hg = new Graphics();
    hg.circle(0, 0, TEX_RADIUS * 0.82).stroke({ width: TEX_RADIUS * 0.22, color: 0xffffff, alignment: 0.5 });
    this.haloTex = this.renderer.generateTexture({ target: hg, resolution: 2 });
    hg.destroy();
  }

  /** 월드 좌표계를 캔버스에 맞추고 카메라(줌/팬)를 반영 */
  private fit(): void {
    const { width, height } = this.world.cfg;
    // screen은 항상 논리(화면) px. renderer.width도 v8에선 논리 px라 resolution으로 나누면 안 됨.
    const sw = this.renderer.screen.width;
    const sh = this.renderer.screen.height;
    // 월드 경계에 있는 세포가 캔버스 가장자리에서 잘리지 않도록 여백을 둔다(세포는 중심 기준 배치).
    const pad = VIEW_PAD;
    const availW = Math.max(1, sw - pad * 2);
    const availH = Math.max(1, sh - pad * 2);
    const baseScale = Math.min(availW / width, availH / height) || 1; // 월드 전체가 보이는 기본 배율
    const scale = baseScale * this.camZoom;
    this.worldScale = scale;
    // 팬 클램프: 줌인 상태에서 월드가 화면 밖으로 완전히 빠져나가지 않도록
    const allowedX = Math.max(0, (width * scale - sw) / 2);
    const allowedY = Math.max(0, (height * scale - sh) / 2);
    this.camPanX = clamp(this.camPanX, -allowedX, allowedX);
    this.camPanY = clamp(this.camPanY, -allowedY, allowedY);
    this.root.scale.set(scale);
    this.root.x = (sw - width * scale) / 2 + this.camPanX;
    this.root.y = (sh - height * scale) / 2 + this.camPanY;
  }

  /** 팬/줌 입력 설정 (휠 줌·드래그 팬·핀치 줌·더블클릭 리셋·탭 선택) */
  private setupCamera(target: HTMLElement): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let lastPinchDist = 0;
    // 탭(선택) 판별: 단일 포인터로 눌렀다가 거의 움직이지 않고 뗐을 때만 탭으로 본다(드래그/핀치 제외).
    let tapCandidate = false;
    let tapMoved = 0;

    target.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );

    target.addEventListener('pointerdown', (e) => {
      target.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // 첫 포인터면 탭 후보 시작, 멀티터치가 되면 탭 취소.
      if (pointers.size === 1) {
        tapCandidate = true;
        tapMoved = 0;
      } else {
        tapCandidate = false;
      }
    });
    target.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        if (tapCandidate) tapMoved += Math.hypot(dx, dy); // 이동 누적 → 임계 넘으면 탭 아님(드래그)
        // 드래그 팬
        this.camPanX += dx;
        this.camPanY += dy;
      } else if (pointers.size === 2) {
        // 핀치 줌 (두 손가락 거리 변화)
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        if (lastPinchDist > 0 && dist > 0) this.zoomAt(midX, midY, dist / lastPinchDist);
        lastPinchDist = dist;
      }
    });
    const release = (e: PointerEvent): void => {
      // 마지막 포인터를 떼는 순간, 거의 안 움직였다면 탭(선택)으로 처리.
      const wasLast = pointers.size === 1 && pointers.has(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastPinchDist = 0;
      if (wasLast && tapCandidate && tapMoved < 6) this.onTap?.(e.clientX, e.clientY);
      if (pointers.size === 0) tapCandidate = false;
    };
    target.addEventListener('pointerup', release);
    target.addEventListener('pointercancel', release);
    // 더블클릭/더블탭 → 뷰 리셋
    target.addEventListener('dblclick', () => {
      this.camZoom = 1;
      this.camPanX = 0;
      this.camPanY = 0;
    });
  }

  /** (clientX, clientY) 아래의 월드 좌표를 고정한 채 factor배 확대/축소 */
  private zoomAt(clientX: number, clientY: number, factor: number): void {
    const rect = this.resizeTarget.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const newZoom = clamp(this.camZoom * factor, 1, 6);
    if (newZoom === this.camZoom) return;
    // 현재 변환 기준으로 커서 아래 월드 좌표
    const wx = (cx - this.root.x) / this.worldScale;
    const wy = (cy - this.root.y) / this.worldScale;
    const baseScale = this.worldScale / this.camZoom;
    const newScale = baseScale * newZoom;
    const { width, height } = this.world.cfg;
    const sw = this.renderer.screen.width;
    const sh = this.renderer.screen.height;
    // 커서 위치가 유지되도록 팬 재계산
    this.camPanX = cx - wx * newScale - (sw - width * newScale) / 2;
    this.camPanY = cy - wy * newScale - (sh - height * newScale) / 2;
    this.camZoom = newZoom;
  }

  /** 화면(clientX,clientY) → 월드 좌표. 카메라 팬/줌 변환을 역으로 적용. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.resizeTarget.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    return { x: (cx - this.root.x) / this.worldScale, y: (cy - this.root.y) / this.worldScale };
  }

  /** 선택된 세포(강조 링 표시). null이면 해제. */
  setSelected(cell: Cell | null): void {
    this.selected = cell;
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
        this.spawnFloatText('eat!', e.x, e.y, 0xf87171, 13);
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

    // ── 시체 ──
    const corpses = this.world.corpses;
    const cn = Math.min(corpses.length, this.quality.maxCells);
    for (let i = 0; i < cn; i++) {
      const co = corpses[i];
      let sp = this.corpsePool[i];
      if (!sp) {
        sp = new Sprite(this.corpseTex);
        sp.anchor.set(0.5);
        this.corpseLayer.addChild(sp);
        this.corpsePool[i] = sp;
      }
      sp.visible = true;
      sp.tint = CORPSE_TINT;
      sp.x = co.x;
      sp.y = co.y;
      sp.scale.set((corpseRadius(co.mass) / TEX_RADIUS) * (1 + co.flash * 0.4));
      sp.alpha = 0.5 + Math.min(0.35, co.mass * 0.03);
    }
    for (let i = cn; i < this.corpsePool.length; i++) this.corpsePool[i].visible = false;

    // ── 세포 + 돌연변이 강조 링 ──
    const cells = this.world.cells;
    const n = Math.min(cells.length, this.quality.maxCells);

    let haloCount = 0;
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

      // 돌연변이 보유 개체는 얇은 링으로 강조
      if (c.carried && c.carried.length > 0) {
        let halo = this.haloPool[haloCount];
        if (!halo) {
          halo = new Sprite(this.haloTex);
          halo.anchor.set(0.5);
          this.haloLayer.addChild(halo);
          this.haloPool[haloCount] = halo;
        }
        halo.visible = true;
        halo.tint = HALO_TINT;
        halo.x = c.x;
        halo.y = c.y;
        halo.scale.set((def.radius * 1.7) / TEX_RADIUS);
        halo.alpha = 0.35;
        haloCount++;
      }
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
    for (let i = haloCount; i < this.haloPool.length; i++) this.haloPool[i].visible = false;

    // ── 선택 강조 링 ──
    const sel = this.selectSprite;
    if (sel) {
      const c = this.selected;
      if (c && c.alive) {
        const def = this.world.species[c.species] as SpeciesDef;
        sel.visible = true;
        sel.tint = 0x38bdf8; // 강조색(시안)
        sel.x = c.x;
        sel.y = c.y;
        // 은은한 맥동 — 결정론에 무관(코스메틱, 프레임 카운터 기반)
        const pulse = 1 + Math.sin(this.frame * 0.15) * 0.08;
        sel.scale.set(((def.radius * 2.6) / TEX_RADIUS) * pulse);
        sel.alpha = 0.9;
      } else {
        sel.visible = false;
      }
    }
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resizeHandler);
    this.app.ticker.destroy();
    this.stage.destroy({ children: true, texture: true });
    this.renderer.destroy(true);
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
