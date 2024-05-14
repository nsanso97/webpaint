import { vec2v } from "../utils/typedefs";
import { RingBuffer } from "../utils/ringbuffer";

export type BrushSettings = {
    max_flow_seconds_to_full_opacity: number;
    stroke_buffer_size: number;
};

const default_brush_settings: BrushSettings = {
    max_flow_seconds_to_full_opacity: 2,
    stroke_buffer_size: 32,
};

export type StrokePoint = {
    x: number;
    y: number;
    pressure: number;

    // r: number;
    // g: number;
    // b: number;
    // a: number;
    //
    // flow: number;
    // size: number;
    // softness: number;
};

export type BrushBindings = {
    viewport?: HTMLElement;
    color_input?: HTMLInputElement;
    alpha_input?: HTMLInputElement;
    flow_input?: HTMLInputElement;
    size_input?: HTMLInputElement;
    softness_input?: HTMLInputElement;
};

export class Brush {
    _r: number;
    _g: number;
    _b: number;
    _a: number;

    _flow: number;
    _size: number;
    _softness: number;

    _stroke_buffer: RingBuffer<StrokePoint>;
    _stroke_start: StrokePoint | null;

    _pointer_over: boolean;
    _pointer_down: boolean;
    _enabled: boolean;

    _bindings: BrushBindings;

    readonly settings: BrushSettings;

    constructor(settings: BrushSettings = default_brush_settings) {
        this.settings = settings;

        this._r = 0;
        this._g = 0;
        this._b = 0;
        this._a = 1;

        this._flow = 1;
        this._size = 12;
        this._softness = 0.9;

        this._stroke_buffer = new RingBuffer(this.settings.stroke_buffer_size);
        this._stroke_start = null;

        this._pointer_over = false;
        this._pointer_down = false;

        this._enabled = true;

        this._bindings = {};
    }

    get r(): number {
        return this._r;
    }
    get g(): number {
        return this._g;
    }
    get b(): number {
        return this._b;
    }
    get a(): number {
        return this._a;
    }
    get flow(): number {
        return this._flow;
    }
    get size(): number {
        return this._size;
    }
    get softness(): number {
        return this._softness;
    }
    get stroke_start(): StrokePoint | null {
        return this._stroke_start;
    }
    get pointer_over(): boolean {
        return this._pointer_over;
    }
    get pointer_down(): boolean {
        return this._pointer_down;
    }
    get is_enabled(): boolean {
        return this._enabled;
    }

    color_to_css(): string {
        return (
            "#" +
            Math.floor(this._r * 0xff)
                .toString(16)
                .padStart(2, "0") +
            Math.floor(this._g * 0xff)
                .toString(16)
                .padStart(2, "0") +
            Math.floor(this._b * 0xff)
                .toString(16)
                .padStart(2, "0")
        );
    }

    set r(r: number) {
        this._r = r;
        if (this._bindings.color_input) {
            this._bindings.color_input.value = this.color_to_css();
        }
    }
    set g(g: number) {
        this._g = g;
        if (this._bindings.color_input) {
            this._bindings.color_input.value = this.color_to_css();
        }
    }
    set b(b: number) {
        this._b = b;
        if (this._bindings.color_input) {
            this._bindings.color_input.value = this.color_to_css();
        }
    }
    set a(a: number) {
        this._a = a;
        if (this._bindings.alpha_input) {
            this._bindings.alpha_input.value = this._a.toString();
        }
    }
    set flow(flow: number) {
        this._flow = flow;
        if (this._bindings.flow_input) {
            this._bindings.flow_input.value = this._flow.toString();
        }
    }
    set size(size: number) {
        this._size = size;
        if (this._bindings.size_input) {
            this._bindings.size_input.value = this._size.toString();
        }
    }
    set softness(softness: number) {
        this._softness = softness;
        if (this._bindings.softness_input) {
            this._bindings.softness_input.value = this._softness.toString();
        }
    }

    enable() {
        this._enabled = true;
    }
    disable() {
        this._enabled = false;
    }

    push_stroke(x: number, y: number, pressure: number) {
        this._stroke_buffer.push_back({
            x,
            y,
            pressure,
            // r: this.r,
            // g: this.g,
            // b: this.b,
            // a: this.a,
            // flow: this.flow,
            // size: this.size,
            // softness: this.softness,
        });
    }

    pop_stroke(): StrokePoint {
        const sp = this._stroke_buffer.pop_front();
        this._stroke_start = sp;
        return sp;
    }

    push_strokes(points: vec2v, pressures: number[]) {
        if (points.length * 2 != pressures.length) {
            throw new Error("SoA length mismatch");
        }

        for (let i = 0; i < pressures.length; i++) {
            this._stroke_buffer.push_back({
                x: points[i + 0],
                y: points[i + 1],
                pressure: pressures[i],
                // r: this.r,
                // g: this.g,
                // b: this.b,
                // a: this.a,
                // flow: this.flow,
                // size: this.size,
                // softness: this.softness,
            });
        }
    }

    pop_strokes(
        count: number,
        out: StrokePoint[] | null = null,
    ): StrokePoint[] {
        out = this._stroke_buffer.slice(0, count, out);
        this._stroke_buffer.shrink(count);
        this._stroke_start = out[count - 1];
        return out;
    }

    clear(): void {
        this._stroke_buffer.reset();
        this._stroke_start = null;
    }

    bind(bindings: BrushBindings) {
        const {
            viewport,
            color_input,
            alpha_input,
            flow_input,
            size_input,
            softness_input,
        } = bindings;

        if (viewport) {
            window.addEventListener("mouseup", (event) => {
                if (!this._enabled) return;
                event.preventDefault();
            });

            viewport.addEventListener("mousedown", (event) => {
                if (!this._enabled) return;
                event.preventDefault();
            });

            viewport.addEventListener("pointerover", (_event) => {
                if (!this._enabled) return;

                this._pointer_over = true;
            });

            viewport.addEventListener("pointerout", (_event) => {
                if (!this._enabled) return;

                this._pointer_over = false;
            });

            viewport.addEventListener("pointerdown", (event) => {
                if (!this._enabled) return;

                this._pointer_down =
                    event.button == 0 && !event.ctrlKey && !event.altKey;
            });

            window.addEventListener("pointerup", (_event) => {
                if (!this._enabled) return;

                this._pointer_down = false;
            });

            window.addEventListener("pointermove", (event) => {
                if (!this._enabled) return;
                if (!this._pointer_over && !this._pointer_down) return;

                const e = event as PointerEvent;
                let pressure = e.pressure;

                if (e.pointerType != "pen" && e.pointerType != "touch") {
                    pressure = 1;
                }

                const rect = viewport.getBoundingClientRect();
                this.push_stroke(
                    e.clientX - rect.x,
                    e.clientY - rect.y,
                    pressure,
                );
            });
        }

        if (color_input) {
            color_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;

                this._r = parseInt(t.value.slice(1, 3), 16) / 0xff;
                this._g = parseInt(t.value.slice(3, 5), 16) / 0xff;
                this._b = parseInt(t.value.slice(5, 7), 16) / 0xff;

                // trigger side-effects
                this.r = this.r; // one is enough for colors
            });
        }

        if (alpha_input) {
            alpha_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.a = +t.value;
            });
        }

        if (flow_input) {
            flow_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.flow = +t.value;
            });
        }

        if (size_input) {
            size_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.size = +t.value;
            });
        }

        if (softness_input) {
            softness_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.softness = +t.value;
            });
        }

        // trigger side-effects
        this.r = this.r; // one is enough for colors
        this.flow = this.flow;
        this.size = this.size;
        this.softness = this.softness;
    }
}
