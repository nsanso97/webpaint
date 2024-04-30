import "../style.css";
import { createFramebuffer, createTexture } from "./renderpass/shared";
import * as rp_paint from "./renderpass/paint";
import * as rp_present from "./renderpass/present";
import { mat4 } from "gl-matrix";

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

  const texExt = { w: 256, h: 256 };
  const tex = [
    createTexture(gl, texExt.w, texExt.h),
    createTexture(gl, texExt.w, texExt.h),
  ];
  const fb = [createFramebuffer(gl, tex[0]), createFramebuffer(gl, tex[1])];
  const pt = {} as any;
  pt.program = rp_paint.createProgram(gl);
  pt.locations = rp_paint.getLocations(gl, pt.program);
  pt.attr = {
    index: [
      [0, 1, 2],
      [2, 3, 0],
    ],
    pos: [
      [0.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [1.0, 1.0, 0.0],
      [1.0, 0.0, 0.0],
    ],
    uv: [
      [0.0, 0.0],
      [0.0, 1.0],
      [1.0, 1.0],
      [1.0, 0.0],
    ],
  };
  pt.buffers = rp_paint.updateBuffers(gl, pt.attr, pt.bufs);
  pt.uniforms = {
    transform: mat4.create(),
  };
  rp_paint.updateUniforms(gl, pt.program, pt.locations, pt.uniforms);

  const pr = {} as any;
  pr.program = rp_present.createProgram(gl);
  pr.locations = rp_present.getLocations(gl, pr.program);
  pr.attr = {
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
  pr.bufs = rp_present.updateBuffers(gl, pr.attr, null);
  pr.uniforms = {
    transform: mat4.create(),
  };
  rp_present.updateUniforms(gl, pr.program, pr.locations, pr.uniforms);

  window.addEventListener("resize", () => {
    canvas.width = canvasBox.clientWidth;
    canvas.height = canvasBox.clientHeight;
  });

  let fbIdx = 0;
  let last_frame_ms = 0;
  function render(current_frame_ms: number) {
    const delta_ms = current_frame_ms - last_frame_ms;
    last_frame_ms = current_frame_ms;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb[fbIdx]);
    gl.viewport(0, 0, texExt.w, texExt.h);
    rp_paint.draw(gl, pt.program, pt.locations, pt.buffers, {
      sampler: tex[fbIdx ^ 1],
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    rp_present.draw(
      gl,
      pr.program,
      pr.locations,
      pr.bufs,
      {
        sampler: tex[fbIdx],
      },
      pr.attr.index.length,
    );

    fbIdx ^= 1;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
