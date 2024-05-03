import "../style.css";
import {
    createFramebuffer,
    createTexture,
    v2,
    v3,
    v4,
} from "./renderpass/shared";
import * as rp_paint from "./renderpass/paint";
import * as rp_present from "./renderpass/present";
import { mat3, mat4, vec2 } from "gl-matrix";

const settings = {
    paintExtent: [1024, 1024] as v2,

    viewScale: 1.0,
    viewRotation: 0.0,
    viewTranslation: [0, 0] as v2,

    brushColor: [1.0, 0.0, 0.0] as v3,
    brushFlow: 1.0,
    brushSize: 24.0,
    brushSoftness: 0.8,

    pointerSamples: [] as v2[],
    pointerDown: false,
    pointerOver: false,

    maxSecondsToOpaque: 2,
    viewScaleExpBase: 16,

    idle: false,
};

type Context = {
    textures: [WebGLTexture, WebGLTexture];
    framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
    frameIndex: number;

    paint: {
        program: rp_paint.Program;
        locations: rp_paint.Locations;
        buffers: rp_paint.Buffers;
        attributes: rp_paint.Attributes;
        uniforms: rp_paint.Uniforms;
    };

    present: {
        program: rp_present.Program;
        locations: rp_present.Locations;
        buffers: rp_present.Buffers;
        attributes: rp_present.Attributes;
        uniforms: rp_present.Uniforms;
    };

    mouse: {
        viewToTexel: mat3;
    };
};

function main(): void {
    const gl = getWebGl();
    setupCanvas(gl);
    setupUserInputs(gl.canvas as HTMLCanvasElement);
    const ctx = setupContext(gl);

    let last_frame_ms = 0;
    function render(current_frame_ms: number) {
        const delta_ms = current_frame_ms - last_frame_ms;
        last_frame_ms = current_frame_ms;

        if (!settings.idle) {
            updateUniforms(gl, ctx, delta_ms);
            draw(gl, ctx);

            if (settings.pointerOver && settings.pointerDown) {
                ctx.frameIndex ^= 1;
            }

            settings.idle = true;
        }

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function getWebGl(): WebGLRenderingContext {
    const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
    canvas.width = canvas.parentElement!.clientWidth;
    canvas.height = canvas.parentElement!.clientHeight;

    const gl = canvas.getContext("webgl")!;
    if (!gl) {
        alert(
            "Unable to initialize WebGL context. Your browser or machine may not support it",
        );
        throw new Error("unable to initialize webgl context");
    }
    return gl;
}

function setupCanvas(gl: WebGLRenderingContext) {
    const canvas = gl.canvas as HTMLCanvasElement;

    window.addEventListener("resize", () => {
        settings.idle = false;

        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = canvas.parentElement!.clientHeight;
    });

    return gl;
}

function setupContext(gl: WebGLRenderingContext): Context {
    const ctx: Context = {
        paint: {},
        present: {},
        mouse: {},
    } as Context;

    ctx.frameIndex = 0;

    const w = settings.paintExtent[0];
    const h = settings.paintExtent[1];
    ctx.textures = [createTexture(gl, w, h), createTexture(gl, w, h)];
    ctx.framebuffers = [
        createFramebuffer(gl, ctx.textures[0])!,
        createFramebuffer(gl, ctx.textures[1])!,
    ];

    const paint = ctx.paint;
    paint.program = rp_paint.createProgram(gl);
    paint.locations = rp_paint.getLocations(gl, paint.program);
    paint.attributes = {
        index: [
            [0, 1, 2],
            [2, 3, 0],
        ],
        uv: [
            [0.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
            [1.0, 0.0],
        ],
    };
    paint.buffers = rp_paint.updateBuffers(gl, paint.attributes, null);

    const present = ctx.present;
    present.program = rp_present.createProgram(gl);
    present.locations = rp_present.getLocations(gl, present.program);
    present.attributes = {
        index: [
            [0, 1, 2],
            [2, 3, 0],
        ],
        pos: [
            [0.0, 0.0, 0.0],
            [0.0, h, 0.0],
            [w, h, 0.0],
            [w, 0.0, 0.0],
        ],
        uv: [
            [0.0, 0.0],
            [0.0, 1.0],
            [1.0, 1.0],
            [1.0, 0.0],
        ],
    };
    present.buffers = rp_present.updateBuffers(gl, present.attributes, null);

    updateUniforms(gl, ctx, 0, true);
    return ctx;
}

function updateUniforms(
    gl: WebGLRenderingContext,
    ctx: Context,
    delta_ms: number,
    init = false,
) {
    const { paint, present, mouse } = ctx;

    if (init) {
        present.uniforms = {
            view: mat4.create(),
            proj: mat4.create(),
        };
    }
    const canvasExtent = [gl.canvas.width, gl.canvas.height] as v2;
    rp_present.makeViewMat(
        present.uniforms.view,
        settings.viewScale,
        settings.viewRotation,
        settings.viewTranslation,
        settings.paintExtent,
        canvasExtent,
    );
    rp_present.makeProjMat(present.uniforms.proj, canvasExtent);

    if (init) mouse.viewToTexel = mat3.create();
    mouse.viewToTexel = makeViewToTexel(
        mouse.viewToTexel,
        present.uniforms.view,
    );

    if (init) {
        paint.uniforms = {
            view: mat3.create(),
            proj: mat3.create(),
            mouse_samples: [],
            n_mouse_samples: 0,
            mouse_offset_to_brush_uv: mat3.create(),
            brush_color: [0, 0, 0],
            brush_flow: 0,
            brush_softness: 0,
            delta_ms: 0,
        };
        for (let i = 0; i < 64; i++) {
            paint.uniforms.mouse_samples[i] = [0, 0];
        }
    }
    rp_paint.makeViewMat(paint.uniforms.view, settings.paintExtent);
    rp_paint.makeProjMat(paint.uniforms.proj, settings.paintExtent);

    paint.uniforms.n_mouse_samples = settings.pointerSamples.length;
    for (let i = 0; i < paint.uniforms.n_mouse_samples; i++) {
        vec2.transformMat3(
            paint.uniforms.mouse_samples[i],
            settings.pointerSamples[i],
            mouse.viewToTexel,
        );
    }
    settings.pointerSamples = [];

    rp_paint.updateUniforms(gl, ctx.paint.program, ctx.paint.locations, {
        n_mouse_samples: ctx.paint.uniforms.n_mouse_samples,
        mouse_samples: ctx.paint.uniforms.mouse_samples,
    });

    rp_paint.makeMouseToBrush(
        paint.uniforms.mouse_offset_to_brush_uv,
        settings.brushSize,
    );

    paint.uniforms.brush_color[0] = settings.brushColor[0];
    paint.uniforms.brush_color[1] = settings.brushColor[1];
    paint.uniforms.brush_color[2] = settings.brushColor[2];
    paint.uniforms.brush_flow =
        1 / settings.maxSecondsToOpaque / (1 - settings.brushFlow + 0.000001);
    paint.uniforms.brush_softness = settings.brushSoftness;
    paint.uniforms.delta_ms = delta_ms;

    rp_present.updateUniforms(
        gl,
        present.program,
        present.locations,
        present.uniforms,
    );
    rp_paint.updateUniforms(gl, paint.program, paint.locations, paint.uniforms);
}

function makeViewToTexel(out: mat3, texelToView: mat4): mat3 {
    if (!out) out = mat3.create();

    //copy by dropping Z coordinates
    out[0] = texelToView[0];
    out[1] = texelToView[1];
    out[2] = texelToView[3];

    out[3] = texelToView[4];
    out[4] = texelToView[5];
    out[5] = texelToView[7];

    out[6] = texelToView[12];
    out[7] = texelToView[13];
    out[8] = texelToView[15];

    mat3.invert(out, out);
    return out;
}

function setupUserInputs(canvas: HTMLCanvasElement) {
    canvas.addEventListener("mouseup", (event) => event.preventDefault());
    canvas.addEventListener("mousedown", (event) => event.preventDefault());
    canvas.addEventListener("pointerover", (_event) => {
        settings.idle = false;
        settings.pointerOver = true;
    });
    canvas.addEventListener("pointerout", (_event) => {
        settings.idle = false;
        settings.pointerOver = false;
        settings.pointerDown = false;
    });
    canvas.addEventListener("pointerdown", (_event) => {
        settings.idle = false;
        settings.pointerDown = true;
    });
    canvas.addEventListener("pointerup", (_event) => {
        settings.idle = false;
        settings.pointerDown = false;
    });
    canvas.addEventListener("pointermove", (event) => {
        settings.idle = false;
        const e = event as PointerEvent;

        const rect = canvas.getBoundingClientRect();
        settings.pointerSamples.push([e.clientX - rect.x, e.clientY - rect.y]);
    });

    const inputX = document.querySelector("#translation-x") as HTMLInputElement;
    const inputY = document.querySelector("#translation-y") as HTMLInputElement;
    const inputScale = document.querySelector("#scale") as HTMLInputElement;
    const inputRotation = document.querySelector(
        "#rotation",
    ) as HTMLInputElement;

    inputX.min = (-settings.paintExtent[0] / 2).toString();
    inputX.max = (settings.paintExtent[0] / 2).toString();
    inputX.value = settings.viewTranslation[0].toString();

    inputY.min = (-settings.paintExtent[1] / 2).toString();
    inputY.max = (settings.paintExtent[1] / 2).toString();
    inputX.value = settings.viewTranslation[1].toString();

    inputScale.value = (
        Math.log(settings.viewScale) / Math.log(settings.viewScaleExpBase) +
        1
    ).toString();
    inputRotation.value = (settings.viewRotation / Math.PI).toString();

    inputX.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.viewTranslation[0] = +t.value;
    });
    inputY.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.viewTranslation[1] = +t.value;
    });
    inputScale.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.viewScale = Math.pow(settings.viewScaleExpBase, +t.value - 1);
    });
    inputRotation.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.viewRotation = +t.value * Math.PI;
    });

    const inputBrushColor = document.querySelector(
        "#brush-color",
    ) as HTMLInputElement;
    const inputBrushFlow = document.querySelector(
        "#brush-flow",
    ) as HTMLInputElement;
    const inputBrushSize = document.querySelector(
        "#brush-size",
    ) as HTMLInputElement;
    const inputBrushSoftness = document.querySelector(
        "#brush-softness",
    ) as HTMLInputElement;

    inputBrushColor.value = (settings.brushColor as number[])
        .map((c) => Math.floor(c * 0xff))
        .slice(0, 3)
        .reduce((r, c) => r + c.toString(16).padStart(2, "0"), "#");
    inputBrushSize.value = settings.brushSize.toString();
    inputBrushFlow.value = settings.brushFlow.toString();
    inputBrushSoftness.value = settings.brushSoftness.toString();

    inputBrushColor.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;

        settings.brushColor[0] = parseInt(t.value.slice(1, 3), 16) / 0xff;
        settings.brushColor[1] = parseInt(t.value.slice(3, 5), 16) / 0xff;
        settings.brushColor[2] = parseInt(t.value.slice(5, 7), 16) / 0xff;
    });

    inputBrushFlow.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.brushFlow = +t.value;
    });

    inputBrushSize.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.brushSize = +t.value;
    });

    inputBrushSoftness.addEventListener("input", (event) => {
        settings.idle = false;
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.brushSoftness = +t.value;
    });
}

function draw(gl: WebGLRenderingContext, ctx: Context) {
    const renderIdx = ctx.frameIndex;
    const sampleIdx = ctx.frameIndex ^ 1;
    const presentIdx = settings.pointerOver ? renderIdx : sampleIdx;

    if (settings.pointerOver) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.framebuffers[renderIdx]);
        const w = settings.paintExtent[0];
        const h = settings.paintExtent[1];
        gl.viewport(0, 0, w, h);
        rp_paint.draw(
            gl,
            ctx.paint.program,
            ctx.paint.locations,
            ctx.paint.buffers,
            {
                sampler: ctx.textures[sampleIdx],
            },
            ctx.paint.attributes.index.length,
        );
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    rp_present.draw(
        gl,
        ctx.present.program,
        ctx.present.locations,
        ctx.present.buffers,
        {
            sampler: ctx.textures[presentIdx],
        },
        ctx.present.attributes.index.length,
    );
}
main();
