import "../style.css";
import { createFramebuffer, createTexture, v2, v4 } from "./renderpass/shared";
import * as rp_paint from "./renderpass/paint";
import * as rp_present from "./renderpass/present";
import { mat3, mat4, vec2 } from "gl-matrix";

const settings = {
    paintExtent: [256, 256] as v2,

    viewScale: 3.0,
    viewRotation: 0.0,
    viewTranslation: [32, 32] as v2,

    brushColor: [1.0, 0.0, 0.0, 0.5] as v4,
    brushSize: 24.0,
    brushSoftness: 0.8,

    pointerPos: [0, 0] as v2,
    pointerDown: false,
    pointerOver: false,

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
        }

        settings.idle = !settings.pointerOver;

        if (settings.pointerOver && settings.pointerDown) {
            ctx.frameIndex ^= 1;
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
        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = canvas.parentElement!.clientHeight;

        settings.idle = false;
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
    rp_present.makeViewMat(
        present.uniforms.view,
        settings.viewScale,
        settings.viewRotation,
        settings.viewTranslation,
    );
    rp_present.makeProjMat(present.uniforms.proj, [
        gl.canvas.width,
        gl.canvas.height,
    ]);

    if (init) mouse.viewToTexel = mat3.create();
    mouse.viewToTexel = makeViewToTexel(
        mouse.viewToTexel,
        present.uniforms.view,
    );

    if (init) {
        paint.uniforms = {
            view: mat3.create(),
            proj: mat3.create(),
            mouse_pos: [
                [-1, -1],
                [-1, -1],
            ],
            mouse_offset_to_brush_uv: mat3.create(),
            brush_color: [0, 0, 0, 0],
            brush_softness: 0,
        };
    }
    rp_paint.makeViewMat(paint.uniforms.view, settings.paintExtent);
    rp_paint.makeProjMat(paint.uniforms.proj, settings.paintExtent);

    ctx.paint.uniforms.mouse_pos[0][0] = ctx.paint.uniforms.mouse_pos[1][0];
    ctx.paint.uniforms.mouse_pos[0][1] = ctx.paint.uniforms.mouse_pos[1][1];

    vec2.transformMat3(
        ctx.paint.uniforms.mouse_pos[1],
        settings.pointerPos,
        ctx.mouse.viewToTexel,
    );

    if (ctx.paint.uniforms.mouse_pos[0][0] < 0) {
        ctx.paint.uniforms.mouse_pos[0][0] = ctx.paint.uniforms.mouse_pos[1][0];
        ctx.paint.uniforms.mouse_pos[0][1] = ctx.paint.uniforms.mouse_pos[1][1];
    }

    rp_paint.updateUniforms(gl, ctx.paint.program, ctx.paint.locations, {
        mouse_pos: ctx.paint.uniforms.mouse_pos,
    });

    rp_paint.makeMouseToBrush(
        paint.uniforms.mouse_offset_to_brush_uv,
        settings.brushSize,
    );

    paint.uniforms.brush_color[0] =
        settings.brushColor[0] * settings.brushColor[3];
    paint.uniforms.brush_color[1] =
        settings.brushColor[1] * settings.brushColor[3];
    paint.uniforms.brush_color[2] =
        settings.brushColor[2] * settings.brushColor[3];
    paint.uniforms.brush_color[3] = settings.brushColor[3];
    paint.uniforms.brush_softness = settings.brushSoftness;

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
    inputBrushFlow.value = settings.brushColor[3].toString();
    inputBrushSize.value = settings.brushSize.toString();
    inputBrushSoftness.value = settings.brushSoftness.toString();

    canvas.addEventListener("mouseup", (event) => event.preventDefault());
    canvas.addEventListener("mousedown", (event) => event.preventDefault());
    canvas.addEventListener("pointerover", (_event) => {
        settings.pointerOver = true;
    });
    canvas.addEventListener("pointerout", (_event) => {
        settings.pointerOver = false;
        settings.pointerDown = false;
        settings.pointerPos.fill(-1);
    });
    canvas.addEventListener("pointerdown", (_event) => {
        settings.pointerDown = true;
    });
    canvas.addEventListener("pointerup", (_event) => {
        settings.pointerDown = false;
    });
    canvas.addEventListener("pointermove", (event) => {
        const e = event as PointerEvent;

        const rect = canvas.getBoundingClientRect();
        settings.pointerPos[0] = e.clientX - rect.x;
        settings.pointerPos[1] = e.clientY - rect.y;
    });

    inputBrushColor.addEventListener("change", (event) => {
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;

        settings.brushColor[0] = parseInt(t.value.slice(1, 3), 16) / 0xff;
        settings.brushColor[1] = parseInt(t.value.slice(3, 5), 16) / 0xff;
        settings.brushColor[2] = parseInt(t.value.slice(5, 7), 16) / 0xff;
    });

    inputBrushFlow.addEventListener("change", (event) => {
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.brushColor[3] = +t.value;
    });

    inputBrushSize.addEventListener("change", (event) => {
        const e = event as InputEvent;
        const t = e.target as HTMLInputElement;
        settings.brushSize = +t.value;
    });

    inputBrushSoftness.addEventListener("change", (event) => {
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
