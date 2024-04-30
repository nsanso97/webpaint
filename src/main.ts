import "../style.css";
import { createFramebuffer, createTexture, v2, v4 } from "./renderpass/shared";
import * as rp_paint from "./renderpass/paint";
import * as rp_present from "./renderpass/present";
import { mat3, mat4, vec2 } from "gl-matrix";

const settings = {
  paintExtent: [256, 256] as v2,

  viewportScale: 1.0 / 256 / 2,
  viewportRotation: 0.3,
  viewportTranslation: [0.2, -0.4] as v2,

  brushColor: [0.0, 0.0, 0.0, 1.0] as v4,
  brushSize: 200.0,
  brushSoftness: 0.1,

  pointerPos: [0, 0] as v2,
  pointerDown: false,
  pointerOver: false,

  _pointerMatClipToViewport: mat3.create(),
  _pointerMatClientToClip: mat3.create(),
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
};

function main(): void {
  const gl = setupCanvas();
  const ctx = setupContext(gl);
  _initializePointerMats(
    (gl.canvas as HTMLCanvasElement).getBoundingClientRect(),
    ctx.present.uniforms.transform,
  );
  setupUserInputs(gl, ctx);

  let last_frame_ms = 0;
  function render(current_frame_ms: number) {
    const delta_ms = current_frame_ms - last_frame_ms;
    last_frame_ms = current_frame_ms;

    draw(gl, ctx);

    ctx.frameIndex ^= 1;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function setupCanvas(): WebGLRenderingContext {
  const canvas = document.querySelector("#canvas") as HTMLCanvasElement;

  const canvasBox = document.querySelector("#canvas-box")!;
  canvas.width = canvasBox.clientWidth;
  canvas.height = canvasBox.clientHeight;

  const gl = canvas.getContext("webgl")!;
  if (!gl) {
    alert(
      "Unable to initialize WebGL context. Your browser or machine may not support it",
    );
    throw new Error("unable to initialize webgl context");
  }

  window.addEventListener("resize", () => {
    canvas.width = canvasBox.clientWidth;
    canvas.height = canvasBox.clientHeight;

    _updatePointerMatClientToClip(canvas.getBoundingClientRect());
  });

  return gl;
}

function setupContext(gl: WebGLRenderingContext): Context {
  const ctx: Context = { paint: {}, present: {} } as Context;

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
    pos: [
      [-1.0, -1.0, 0.0],
      [-1.0, 1.0, 0.0],
      [1.0, 1.0, 0.0],
      [1.0, -1.0, 0.0],
    ],
    uv: [
      [0.0, 0.0],
      [0.0, 1.0],
      [1.0, 1.0],
      [1.0, 0.0],
    ],
  };
  paint.buffers = rp_paint.updateBuffers(gl, paint.attributes, null);
  paint.uniforms = {
    transform: mat4.create(),
    mouse_pos: [...settings.pointerPos],
    mouse_offset_to_brush_uv: createMatMouseToBrush(mat3.create()),
    brush_color: [...settings.brushColor],
    brush_softness: settings.brushSoftness,
  };
  rp_paint.updateUniforms(gl, paint.program, paint.locations, paint.uniforms);

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
  present.uniforms = {
    transform: createPresentTransform(mat4.create()),
  };
  rp_present.updateUniforms(
    gl,
    present.program,
    present.locations,
    present.uniforms,
  );
  return ctx;
}

function createPresentTransform(out: mat4): mat4 {
  const w = settings.paintExtent[0];
  const h = settings.paintExtent[1];
  const scale = settings.viewportScale * 2; // 2x as webgl's clip space is 2 units wide and tall
  const rotation = settings.viewportRotation;
  const traslation = settings.viewportTranslation;

  // NOTE: For some crazy reason these apply in reverse order, meaning that the one
  // furthest down is the first one to get applied. In other words, read from bottom to top

  out = mat4.translate(out, out, [traslation[0], traslation[1], 0]); // 4: translate
  out = mat4.rotate(out, out, rotation, [0, 0, 1]); // 3: rotate
  out = mat4.scale(out, out, [scale, scale, 1]); // 2: scale
  out = mat4.translate(out, out, [-w / 2, -h / 2, 0]); // 1: center
  return out;
}

function createMatMouseToBrush(out: mat3): mat3 {
  out = mat3.fromTranslation(out, [-0.5, -0.5]);
  out = mat3.scale(out, out, [settings.brushSize, settings.brushSize]);
  return out;
}

function _updatePointerMatClientToClip(canvasRect: DOMRect) {
  const clientToClip = settings._pointerMatClientToClip;
  mat3.identity(clientToClip);
  mat3.translate(clientToClip, clientToClip, [-1, 1]);
  mat3.scale(clientToClip, clientToClip, [
    2 / canvasRect.width,
    -2 / canvasRect.height,
  ]);
}

function _updatePointerMatClipToViewport(presentTransform: mat4) {
  const ctv = settings._pointerMatClipToViewport;
  // copy X Y W components from mat4 (skip Z)
  ctv[0] = presentTransform[0];
  ctv[1] = presentTransform[1];
  ctv[2] = presentTransform[3];

  ctv[3] = presentTransform[4];
  ctv[4] = presentTransform[5];
  ctv[5] = presentTransform[7];

  ctv[6] = presentTransform[12];
  ctv[7] = presentTransform[13];
  ctv[8] = presentTransform[15];

  // invert the present transformation
  mat3.invert(ctv, ctv);

  // scale by extent to get UV equivalent
  const [w, h] = settings.paintExtent;
  mat3.multiply(ctv, mat3.fromScaling(mat3.create(), [1 / w, 1 / h]), ctv); // I SWEAR TO GOD I'M GOING TO REWRITE THIS FUCKING LIBRARY
}

function _initializePointerMats(canvasRect: DOMRect, presentTransform: mat4) {
  _updatePointerMatClientToClip(canvasRect);
  _updatePointerMatClipToViewport(presentTransform);
}

function setupUserInputs(gl: WebGLRenderingContext, ctx: Context) {
  const canvas = gl.canvas as HTMLCanvasElement;
  const inputBrushColor = document.querySelector(
    "#brush-color",
  ) as HTMLInputElement;
  const inputBrushOpacity = document.querySelector(
    "#brush-opacity",
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
  inputBrushOpacity.value = settings.brushColor[3].toString();
  inputBrushSize.value = settings.brushSize.toString();
  inputBrushSoftness.value = settings.brushSoftness.toString();

  canvas.addEventListener("pointerover", (_event) => {
    settings.pointerOver = true;
  });
  canvas.addEventListener("pointerout", (_event) => {
    settings.pointerOver = false;
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

    ctx.paint.uniforms.mouse_pos[0] = settings.pointerPos[0];
    ctx.paint.uniforms.mouse_pos[1] = settings.pointerPos[1];

    const v: vec2 = [...ctx.paint.uniforms.mouse_pos];
    console.log("------------------");
    console.log(v);
    console.log(vec2.transformMat3(v, v, settings._pointerMatClientToClip));
    console.log(vec2.transformMat3(v, v, settings._pointerMatClipToViewport));
    console.log("------------------");

    vec2.transformMat3(
      ctx.paint.uniforms.mouse_pos,
      ctx.paint.uniforms.mouse_pos,
      settings._pointerMatClientToClip,
    );
    vec2.transformMat3(
      ctx.paint.uniforms.mouse_pos,
      ctx.paint.uniforms.mouse_pos,
      settings._pointerMatClipToViewport,
    );
    rp_paint.updateUniforms(gl, ctx.paint.program, ctx.paint.locations, {
      mouse_pos: ctx.paint.uniforms.mouse_pos,
    });
  });

  inputBrushColor.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;

    settings.brushColor[0] = parseInt(t.value.slice(1, 3), 16) / 0xff;
    settings.brushColor[1] = parseInt(t.value.slice(3, 5), 16) / 0xff;
    settings.brushColor[2] = parseInt(t.value.slice(5, 7), 16) / 0xff;

    ctx.paint.uniforms.brush_color[0] = settings.brushColor[0];
    ctx.paint.uniforms.brush_color[1] = settings.brushColor[1];
    ctx.paint.uniforms.brush_color[2] = settings.brushColor[2];

    rp_paint.updateUniforms(gl, ctx.paint.program, ctx.paint.locations, {
      brush_color: ctx.paint.uniforms.brush_color,
    });
  });

  inputBrushOpacity.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;
    settings.brushColor[3] = +t.value;

    ctx.paint.uniforms.brush_color[3] = settings.brushColor[3];

    rp_paint.updateUniforms(gl, ctx.paint.program, ctx.paint.locations, {
      brush_color: ctx.paint.uniforms.brush_color,
    });
  });

  inputBrushSize.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;
    settings.brushSize = +t.value;

    ctx.paint.uniforms.mouse_offset_to_brush_uv = createMatMouseToBrush(
      mat3.create(),
    );

    rp_paint.updateUniforms(gl, ctx.paint.program, ctx.paint.locations, {
      mouse_offset_to_brush_uv: ctx.paint.uniforms.mouse_offset_to_brush_uv,
    });
  });

  inputBrushSoftness.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;
    settings.brushSoftness = +t.value;

    ctx.paint.uniforms.brush_softness = settings.brushSoftness;

    rp_paint.updateUniforms(gl, ctx.paint.program, ctx.paint.locations, {
      brush_softness: ctx.paint.uniforms.brush_softness,
    });
  });
}

function draw(gl: WebGLRenderingContext, ctx: Context) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.framebuffers[ctx.frameIndex]);
  const w = settings.paintExtent[0];
  const h = settings.paintExtent[1];
  gl.viewport(0, 0, w, h);
  rp_paint.draw(
    gl,
    ctx.paint.program,
    ctx.paint.locations,
    ctx.paint.buffers,
    {
      sampler: ctx.textures[ctx.frameIndex ^ 1],
    },
    ctx.paint.attributes.index.length,
  );

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  rp_present.draw(
    gl,
    ctx.present.program,
    ctx.present.locations,
    ctx.present.buffers,
    {
      sampler: ctx.textures[ctx.frameIndex],
    },
    ctx.present.attributes.index.length,
  );
}
main();
