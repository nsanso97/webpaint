import "../style.css";
import { createFramebuffer, createTexture } from "./renderpass/shared";
import * as rp_paint from "./renderpass/paint";
import * as rp_present from "./renderpass/present";

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
  const pt = rp_paint.createPaint(gl);
  const pr = rp_present.createPresent(gl);

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
    rp_paint.draw(gl, pt.program, pt.locations, pt.buffers, pt.uniforms, {
      sampler: tex[fbIdx ^ 1],
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    rp_present.draw(gl, pr.program, pr.locations, pr.buffers, pr.uniforms, {
      sampler: tex[fbIdx],
    });

    fbIdx ^= 1;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
