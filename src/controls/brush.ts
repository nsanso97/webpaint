import { vec2, vec3 } from "gl-matrix";
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

export type Color = vec3;

export class Brush {
    color: Color;
    opacity: number;
    flow: number;
    size: number;
    softness: number;

    readonly settings: BrushSettings;

    stroke_buffer: RingBuffer<number>;
    stroke_next_start: vec2;

    constructor(settings: BrushSettings = default_brush_settings) {
        this.settings = settings;

        this.color = [0, 0, 0];
        this.opacity = 1;
        this.flow = 1;
        this.size = 12;
        this.softness = 0.9;

        this.stroke_buffer = new RingBuffer(
            this.settings.stroke_buffer_size * 2,
        );
        this.stroke_next_start = [NaN, NaN];
    }

    push_stroke(point: vec2) {
        this.stroke_buffer.push_back(point[0]);
        this.stroke_buffer.push_back(point[1]);
    }

    pop_stroke(out: vec2 | null = null): vec2 {
        if (!out) out = [0, 0];

        out[0] = this.stroke_buffer.pop_front();
        out[1] = this.stroke_buffer.pop_front();

        this.stroke_next_start[0] = out[0];
        this.stroke_next_start[1] = out[1];

        return out;
    }

    push_strokes(points: vec2v) {
        for (const p of points) {
            this.stroke_buffer.push_back(p);
        }
    }

    pop_strokes(count: number, out: vec2v | null = null): vec2v {
        count *= 2; // 2 numbers per vec2 element

        out = this.stroke_buffer.slice(0, count, out as number[]);

        this.stroke_buffer.shrink(count);

        this.stroke_next_start[0] = out[count - 2];
        this.stroke_next_start[1] = out[count - 1];

        return out;
    }

    clear(): void {
        this.stroke_buffer.reset();

        this.stroke_next_start[0] = NaN;
        this.stroke_next_start[1] = NaN;
    }
}
