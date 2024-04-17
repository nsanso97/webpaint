import "../style.css";
import { vec2, vec4, mat4 } from "gl-matrix";

type vec4_t = [number, number, number, number];
const settings = {
  clearColor: [0.5, 0.5, 0.5, 1.0] as vec4_t,
  brushColor: [0.0, 0.0, 0.0, 1.0] as vec4_t,
  brushSize: 24.0,
  brushHardness: 1.0,
};

const vert_src = `
    attribute vec4 aVertexPos;
    attribute vec2 aTextureCoord;

    uniform mat4 uProjectionMat;

    varying mediump vec2 vTextureCoord;

    void main(void) {
        gl_Position = uProjectionMat * aVertexPos;
        vTextureCoord = aTextureCoord;
    }
`;

const frag_src = `
    varying mediump vec2  vTextureCoord;

    uniform mediump vec2  uExtent;
    uniform mediump vec4  uBrushColor;
    uniform mediump float uBrushSize;
    uniform mediump float uBrushHardness;
    uniform mediump vec2  uPointerPos;
    uniform mediump float uPointerOver;
    uniform mediump float uPointerDown;

    void main(void) {
        mediump vec2 texelCoord = vTextureCoord * uExtent;
        mediump float distance = length(uPointerPos - texelCoord);
        mediump float feather = 1.0 / (1.000001 - uBrushHardness);
        mediump float stroke = 1.0 - (distance / uBrushSize);
        stroke = stroke * feather;
        stroke = clamp(stroke, 0.0, 1.0);
        stroke = stroke * stroke;
        stroke = stroke * uPointerOver;
        stroke = stroke * uPointerDown + (stroke * 0.5) * (1.0 - uPointerDown);

        gl_FragColor = uBrushColor * stroke + vec4(vTextureCoord.xy, 0.0, 1.0) * (1.0 - stroke);
    }
`;

type Locations = {
  program: WebGLProgram;
  attrib: {
    vertexPos: number;
    textureCoord: number;
  };
  uniform: {
    projectionMat: WebGLUniformLocation;
    extent: WebGLUniformLocation;
    brushColor: WebGLUniformLocation;
    brushSize: WebGLUniformLocation;
    brushHardness: WebGLUniformLocation;
    pointerPos: WebGLUniformLocation;
    pointerOver: WebGLUniformLocation;
    pointerDown: WebGLUniformLocation;
  };
};

type Buffers = {
  position: WebGLBuffer;
  textureCoord: WebGLBuffer;
  index: WebGLBuffer;
};

type Uniforms = {
  projectionMat: mat4;
  extent: vec2;
  brushColor: vec4;
  brushSize: number;
  brushHardness: number;
  pointerPos: vec2;
  pointerOver: boolean;
  pointerDown: boolean;
};

function main(): void {
  const canvas = document.querySelector("#canvas") as HTMLCanvasElement;

  const canvasBox = document.querySelector("#canvas-box")!;
  canvas.width = canvasBox.clientWidth;
  canvas.height = canvasBox.clientHeight;

  const gl = canvas.getContext("webgl");
  if (!gl) {
    alert(
      "Unable to initialize WebGL context. Your browser or machine may not support it",
    );
    throw new Error("unable to initialize webgl context");
  }

  gl.clearColor(...settings.clearColor);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const vert = loadShader(gl, "vert", gl.VERTEX_SHADER, vert_src);
  const frag = loadShader(gl, "frag", gl.FRAGMENT_SHADER, frag_src);

  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`,
    );
  }

  const programInfo: Locations = {
    program,
    attrib: {
      vertexPos: gl.getAttribLocation(program, "aVertexPos")!,
      textureCoord: gl.getAttribLocation(program, "aTextureCoord")!,
    },
    uniform: {
      projectionMat: gl.getUniformLocation(program, "uProjectionMat")!,
      extent: gl.getUniformLocation(program, "uExtent")!,
      brushColor: gl.getUniformLocation(program, "uBrushColor")!,
      brushSize: gl.getUniformLocation(program, "uBrushSize")!,
      brushHardness: gl.getUniformLocation(program, "uBrushHardness")!,
      pointerPos: gl.getUniformLocation(program, "uPointerPos")!,
      pointerOver: gl.getUniformLocation(program, "uPointerOver")!,
      pointerDown: gl.getUniformLocation(program, "uPointerDown")!,
    },
  };

  const buffers: Buffers = {
    position: gl.createBuffer()!,
    textureCoord: gl.createBuffer()!,
    index: gl.createBuffer()!,
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  // prettier-ignore
  const positions = [
    -1.0, -1.0, 0.0,
    -1.0,  1.0, 0.0,
     1.0,  1.0, 0.0,
     1.0, -1.0, 0.0,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
  // prettier-ignore
  const texture_coords = [
    0.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
  ];
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(texture_coords),
    gl.STATIC_DRAW,
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
  // prettier-ignore
  const indices = [
    0, 1, 2,
    2, 3, 0,
  ];
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW,
  );

  const uniforms: Uniforms = {
    // prettier-ignore
    projectionMat: [ 
         1.0,  0.0,  0.0,  0.0,
         0.0, -1.0,  0.0,  0.0,
         0.0,  0.0,  1.0,  0.0,
         0.0,  0.0,  0.0,  1.0,
      ],
    extent: [gl.canvas.width, gl.canvas.height],
    brushColor: settings.brushColor,
    brushSize: settings.brushSize,
    brushHardness: settings.brushHardness,
    pointerPos: [0.0, 0.0],
    pointerOver: false,
    pointerDown: false,
  };

  window.addEventListener("resize", () => {
    canvas.width = canvasBox.clientWidth;
    canvas.height = canvasBox.clientHeight;

    uniforms.extent[0] = gl.canvas.width;
    uniforms.extent[1] = gl.canvas.height;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  });

  gl.canvas.addEventListener("pointerover", (_event) => {
    uniforms.pointerOver = true;
  });
  gl.canvas.addEventListener("pointerout", (_event) => {
    uniforms.pointerOver = false;
  });
  gl.canvas.addEventListener("pointerdown", (_event) => {
    uniforms.pointerDown = true;
  });
  gl.canvas.addEventListener("pointerup", (_event) => {
    uniforms.pointerDown = false;
  });
  gl.canvas.addEventListener("pointermove", (event) => {
    const e = event as PointerEvent;

    const rect = canvas.getBoundingClientRect();
    uniforms.pointerPos[0] = e.clientX - rect.x;
    uniforms.pointerPos[1] = e.clientY - rect.y;
  });

  const inputBrushColor = document.querySelector(
    "#brush-color",
  ) as HTMLInputElement;
  const inputBrushOpacity = document.querySelector(
    "#brush-opacity",
  ) as HTMLInputElement;
  const inputBrushSize = document.querySelector(
    "#brush-size",
  ) as HTMLInputElement;
  const inputBrushHardness = document.querySelector(
    "#brush-hardness",
  ) as HTMLInputElement;

  inputBrushColor.value = settings.brushColor
    .map((c) => Math.floor(c * 0xff))
    .slice(0, 3)
    .reduce((r, c) => r + c.toString(16).padStart(2, "0"), "#");
  inputBrushOpacity.value = settings.brushColor[3].toString();
  inputBrushSize.value = settings.brushSize.toString();
  inputBrushHardness.value = settings.brushHardness.toString();

  inputBrushColor.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;

    uniforms.brushColor[0] = parseInt(t.value.slice(1, 3), 16) / 0xff;
    uniforms.brushColor[1] = parseInt(t.value.slice(3, 5), 16) / 0xff;
    uniforms.brushColor[2] = parseInt(t.value.slice(5, 7), 16) / 0xff;
  });

  inputBrushOpacity.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;
    uniforms.brushColor[3] = +t.value;
  });

  inputBrushSize.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;
    uniforms.brushSize = +t.value;
  });

  inputBrushHardness.addEventListener("change", (event) => {
    const e = event as InputEvent;
    const t = e.target as HTMLInputElement;
    uniforms.brushHardness = +t.value;
  });

  let last_frame_ms = 0;
  function render(current_frame_ms: number) {
    // const delta_ms = current_frame_ms - last_frame_ms;
    last_frame_ms = current_frame_ms;

    draw(gl!, programInfo, buffers, uniforms);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function loadShader(
  gl: WebGLRenderingContext,
  name: string,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(
      `An error occurred compiling the shader '${name}': ${info}`,
    );
  }
  return shader;
}

function draw(
  gl: WebGLRenderingContext,
  locations: Locations,
  buffers: Buffers,
  uniforms: Uniforms,
) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  setAttributes(gl, locations, buffers);

  gl.useProgram(locations.program);

  gl.uniformMatrix4fv(
    locations.uniform.projectionMat,
    false,
    uniforms.projectionMat,
  );
  gl.uniform2fv(locations.uniform.extent, uniforms.extent);
  gl.uniform4fv(locations.uniform.brushColor, uniforms.brushColor);
  gl.uniform2fv(locations.uniform.pointerPos, uniforms.pointerPos);
  gl.uniform1f(locations.uniform.brushSize, uniforms.brushSize);
  gl.uniform1f(locations.uniform.brushHardness, uniforms.brushHardness);
  gl.uniform1f(locations.uniform.pointerOver, +uniforms.pointerOver);
  gl.uniform1f(locations.uniform.pointerDown, +uniforms.pointerDown);

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function setAttributes(
  gl: WebGLRenderingContext,
  locations: Locations,
  buffers: Buffers,
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(locations.attrib.vertexPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(locations.attrib.vertexPos);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
  gl.vertexAttribPointer(
    locations.attrib.textureCoord,
    2,
    gl.FLOAT,
    false,
    0,
    0,
  );
  gl.enableVertexAttribArray(locations.attrib.textureCoord);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
}

main();
