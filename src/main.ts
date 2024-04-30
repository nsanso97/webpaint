import "../style.css";
import { vec2, vec4, mat4 } from "gl-matrix";
import {
  createFramebuffer,
  createTexture,
  loadShader,
} from "./renderpass/shared";
import * as rp_paint from "./renderpass/paint";
import * as rp_present from "./renderpass/present";

type Locations = {
  attrib: {
    pos: number;
    uv: number;
  };
  uniform: {
    transform: WebGLUniformLocation;
  };
  textures: {
    sampler: WebGLUniformLocation;
  };
};

type Buffers = {
  index: WebGLBuffer;
  pos: WebGLBuffer;
  uv: WebGLBuffer;
};

type Uniforms = {
  transform: mat4;
  sampler: WebGLTexture;
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

  const texExt = { w: 64, h: 64 };
  const tex = createTexture(gl, texExt.w, texExt.h);
  const fb = createFramebuffer(gl, tex);
  const pt = rp_paint.createPaint(gl);
  const pr = rp_present.createPresent(gl, tex);

  window.addEventListener("resize", () => {
    canvas.width = canvasBox.clientWidth;
    canvas.height = canvasBox.clientHeight;
  });

  let last_frame_ms = 0;
  function render(current_frame_ms: number) {
    // const delta_ms = current_frame_ms - last_frame_ms;
    last_frame_ms = current_frame_ms;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, texExt.w, texExt.h);
    gl.clearColor(0.5, 0.5, 0.5, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    rp_paint.draw(gl, pt.program, pt.locations, pt.buffers, pt.uniforms);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    rp_present.draw(gl, pr.program, pr.locations, pr.buffers, pr.uniforms);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
