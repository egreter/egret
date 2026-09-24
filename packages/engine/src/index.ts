export interface EgreterPointerEvent {
  type: "pointerdown" | "pointerup" | "pointermove";
  stageX: number;
  stageY: number;
  target: DisplayObject;
  originalEvent: PointerEvent;
}

type EventMap = {
  pointerdown: EgreterPointerEvent;
  pointerup: EgreterPointerEvent;
  pointermove: EgreterPointerEvent;
};

type EventName = keyof EventMap;
type EventListener<K extends EventName> = (event: EventMap[K]) => void;

export class EventDispatcher {
  readonly #listeners = new Map<EventName, Set<(event: never) => void>>();

  on<K extends EventName>(type: K, listener: EventListener<K>): this {
    let listeners = this.#listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(type, listeners);
    }
    listeners.add(listener as (event: never) => void);
    return this;
  }

  off<K extends EventName>(type: K, listener: EventListener<K>): this {
    this.#listeners.get(type)?.delete(listener as (event: never) => void);
    return this;
  }

  protected emit<K extends EventName>(type: K, event: EventMap[K]): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      (listener as (event: EventMap[K]) => void)(event);
    }
  }
}

export abstract class DisplayObject extends EventDispatcher {
  x = 0;
  y = 0;
  scaleX = 1;
  scaleY = 1;
  alpha = 1;
  visible = true;
  width = 0;
  height = 0;
  parent: Container | null = null;

  render(context: CanvasRenderingContext2D, parentAlpha = 1): void {
    if (!this.visible || this.alpha <= 0 || this.scaleX === 0 || this.scaleY === 0) {
      return;
    }

    context.save();
    context.translate(this.x, this.y);
    context.scale(this.scaleX, this.scaleY);
    context.globalAlpha = parentAlpha * this.alpha;
    this.draw(context, context.globalAlpha);
    context.restore();
  }

  protected abstract draw(context: CanvasRenderingContext2D, alpha: number): void;

  protected containsLocalPoint(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x <= this.width && y <= this.height;
  }

  hitTestLocal(x: number, y: number): DisplayObject | null {
    return this.visible && this.containsLocalPoint(x, y) ? this : null;
  }

  dispatchPointerEvent(event: EgreterPointerEvent): void {
    this.emit(event.type, event);
  }
}

export class Container extends DisplayObject {
  readonly children: DisplayObject[] = [];

  addChild<T extends DisplayObject>(child: T): T {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: DisplayObject): boolean {
    const index = this.children.indexOf(child);
    if (index < 0) {
      return false;
    }
    this.children.splice(index, 1);
    child.parent = null;
    return true;
  }

  removeAllChildren(): void {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children.length = 0;
  }

  protected override draw(context: CanvasRenderingContext2D, alpha: number): void {
    for (const child of this.children) {
      child.render(context, alpha);
    }
  }

  override hitTestLocal(x: number, y: number): DisplayObject | null {
    if (!this.visible) {
      return null;
    }

    for (let index = this.children.length - 1; index >= 0; index -= 1) {
      const child = this.children[index];
      if (!child || !child.visible || child.scaleX === 0 || child.scaleY === 0) {
        continue;
      }

      const localX = (x - child.x) / child.scaleX;
      const localY = (y - child.y) / child.scaleY;
      const hit = child.hitTestLocal(localX, localY);
      if (hit) {
        return hit;
      }
    }

    return this.containsLocalPoint(x, y) ? this : null;
  }
}

export class Rect extends DisplayObject {
  color: string;

  constructor(width: number, height: number, color = "#ffffff") {
    super();
    this.width = width;
    this.height = height;
    this.color = color;
  }

  protected override draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = this.color;
    context.fillRect(0, 0, this.width, this.height);
  }
}

export class TextField extends DisplayObject {
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;

  constructor(
    text = "",
    options: {
      color?: string;
      fontSize?: number;
      fontFamily?: string;
      fontWeight?: string;
    } = {}
  ) {
    super();
    this.text = text;
    this.color = options.color ?? "#ffffff";
    this.fontSize = options.fontSize ?? 32;
    this.fontFamily = options.fontFamily ?? "system-ui, sans-serif";
    this.fontWeight = options.fontWeight ?? "400";
    this.updateBounds();
  }

  setText(value: string): void {
    this.text = value;
    this.updateBounds();
  }

  private updateBounds(): void {
    this.width = Math.max(1, this.text.length * this.fontSize * 0.62);
    this.height = this.fontSize * 1.25;
  }

  protected override draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = this.color;
    context.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    context.textBaseline = "top";
    context.fillText(this.text, 0, 0);
  }
}

export class Bitmap extends DisplayObject {
  readonly image: HTMLImageElement;

  constructor(image: HTMLImageElement) {
    super();
    this.image = image;
    this.width = image.naturalWidth || image.width;
    this.height = image.naturalHeight || image.height;
  }

  static async fromUrl(url: string): Promise<Bitmap> {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener(
        "error",
        () => reject(new Error(`Unable to load image asset: ${url}`)),
        { once: true }
      );
      image.src = url;
    });

    return new Bitmap(image);
  }

  protected override draw(context: CanvasRenderingContext2D): void {
    context.drawImage(this.image, 0, 0, this.width, this.height);
  }
}

export interface StageOptions {
  width: number;
  height: number;
  background?: string;
  frameRate?: number;
}

export class Stage extends Container {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  background: string;
  frameRate: number;
  #running = false;
  #frameHandle = 0;
  #lastFrameAt = 0;

  constructor(canvas: HTMLCanvasElement, options: StageOptions) {
    super();
    this.canvas = canvas;
    this.width = options.width;
    this.height = options.height;
    this.background = options.background ?? "#111827";
    this.frameRate = options.frameRate ?? 60;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Egreter requires a browser with Canvas 2D support.");
    }
    this.context = context;
    this.configureCanvas();
    this.installPointerEvents();
  }

  private configureCanvas(): void {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * pixelRatio);
    this.canvas.height = Math.round(this.height * pixelRatio);
    this.canvas.style.aspectRatio = `${this.width} / ${this.height}`;
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  private installPointerEvents(): void {
    for (const type of ["pointerdown", "pointerup", "pointermove"] as const) {
      this.canvas.addEventListener(type, (originalEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        const stageX = ((originalEvent.clientX - rect.left) / rect.width) * this.width;
        const stageY = ((originalEvent.clientY - rect.top) / rect.height) * this.height;
        const target = this.hitTestLocal(stageX, stageY) ?? this;

        target.dispatchPointerEvent({
          type,
          stageX,
          stageY,
          target,
          originalEvent
        });
      });
    }
  }

  start(): void {
    if (this.#running) {
      return;
    }
    this.#running = true;
    this.#lastFrameAt = performance.now();

    const tick = (time: number) => {
      if (!this.#running) {
        return;
      }

      const interval = 1000 / Math.max(1, this.frameRate);
      if (time - this.#lastFrameAt >= interval - 0.5) {
        this.renderFrame();
        this.#lastFrameAt = time;
      }

      this.#frameHandle = requestAnimationFrame(tick);
    };

    this.#frameHandle = requestAnimationFrame(tick);
  }

  stop(): void {
    this.#running = false;
    if (this.#frameHandle) {
      cancelAnimationFrame(this.#frameHandle);
      this.#frameHandle = 0;
    }
  }

  renderFrame(): void {
    this.context.save();
    this.context.setTransform(
      this.canvas.width / this.width,
      0,
      0,
      this.canvas.height / this.height,
      0,
      0
    );
    this.context.globalAlpha = 1;
    this.context.fillStyle = this.background;
    this.context.fillRect(0, 0, this.width, this.height);
    for (const child of this.children) {
      child.render(this.context, 1);
    }
    this.context.restore();
  }
}

export interface ApplicationOptions extends StageOptions {
  canvas: string | HTMLCanvasElement;
  autoStart?: boolean;
}

export class Application {
  readonly stage: Stage;

  constructor(options: ApplicationOptions) {
    const canvas =
      typeof options.canvas === "string"
        ? document.querySelector<HTMLCanvasElement>(options.canvas)
        : options.canvas;

    if (!canvas) {
      throw new Error(`Egreter canvas was not found: ${String(options.canvas)}`);
    }

    this.stage = new Stage(canvas, options);

    if (options.autoStart !== false) {
      this.start();
    }
  }

  start(): void {
    this.stage.start();
  }

  stop(): void {
    this.stage.stop();
  }
}

export function createApplication(options: ApplicationOptions): Application {
  return new Application(options);
}

export const version = "0.1.0-dev.0";
