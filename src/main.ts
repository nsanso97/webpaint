import "../style.css";
import { createFramebuffer, createTexture } from "./renderpass/shared";
import * as rp_paint from "./renderpass/paint";
import * as rp_present from "./renderpass/present";
import { mat4 } from "gl-matrix";

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

  const ctx: Context = { paint: {}, present: {} } as Context;

  ctx.frameIndex = 0;

  const texExt = { w: 256, h: 256 };
  ctx.textures = [
    createTexture(gl, texExt.w, texExt.h),
    createTexture(gl, texExt.w, texExt.h),
  ];
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
      [0.0, texExt.h, 0.0],
      [texExt.w, texExt.h, 0.0],
      [texExt.w, 0.0, 0.0],
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
    transform: mat4.fromScaling(mat4.create(), [1 / 100, 1 / 100, 1]),
  };
  rp_present.updateUniforms(
    gl,
    present.program,
    present.locations,
    present.uniforms,
  );

  window.addEventListener("resize", () => {
    canvas.width = canvasBox.clientWidth;
    canvas.height = canvasBox.clientHeight;
  });

  let fbIdx = 0;
  let last_frame_ms = 0;
  function render(current_frame_ms: number) {
    const delta_ms = current_frame_ms - last_frame_ms;
    last_frame_ms = current_frame_ms;

    gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.framebuffers[ctx.frameIndex]);
    gl.viewport(0, 0, texExt.w, texExt.h);
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

    ctx.frameIndex ^= 1;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
