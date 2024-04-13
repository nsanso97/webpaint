import "../style.css";
import { vec2, vec4, mat4 } from "gl-matrix";

const settings = {
  clearColor: [0.5, 0.5, 0.5, 1.0],
  brushColor: [0.0, 0.0, 1.0, 1.0],
  brushSize: 12.0,
};

const vert_src = `
    attribute vec4 aVertexPos;
    attribute vec2 aTextureCoord;

    uniform mat4 uProjectionMat;

    varying highp vec2 vTextureCoord;

    void main(void) {
        gl_Position = uProjectionMat * aVertexPos;
        // gl_Position = aVertexPos;
        vTextureCoord = aTextureCoord;
    }
`;

const frag_src = `
    varying highp vec2 vTextureCoord;

    uniform highp vec2 uExtent;
    uniform highp vec2 uMousePos;
    uniform highp vec4 uBrushColor;
    uniform highp float uBrushSize;
    uniform lowp int uMouseOver;

    void main(void) {
        highp vec2 texturePixelCoord = vTextureCoord * uExtent;
        highp float mouseDistance = length(texturePixelCoord - uMousePos);

        if (bool(uMouseOver) && mouseDistance < uBrushSize) {
            gl_FragColor = uBrushColor;
        } else {
            gl_FragColor = vec4(vTextureCoord.xy, 0.0, 1.0);
        }
    }
`;

/**
 * @typedef {Object} Locations
 * @property {WebGLProgram} program
 * @property {Object} attrib
 * @property {number} attrib.vertexPos
 * @property {number} attrib.textureCoord
 * @property {Object} uniform
 * @property {WebGLUniformLocation} uniform.projectionMat
 * @property {WebGLUniformLocation} uniform.extent
 * @property {WebGLUniformLocation} uniform.mousePos
 * @property {WebGLUniformLocation} uniform.brushColor
 * @property {WebGLUniformLocation} uniform.brushSize
 * @property {WebGLUniformLocation} uniform.mouseOver
 */

/**
 * @typedef {Object} Buffers
 * @property {WebGLBuffer} position
 * @property {WebGLBuffer} textureCoord
 * @property {WebGLBuffer} index
 */

/**
 * @typedef {Object} Uniforms
 * @property {mat4} projectionMat
 * @property {vec2} extent
 * @property {vec2} mousePos
 * @property {vec4} brushColor
 * @property {number} brushSize
 * @property {bool} uniform.mouseOver
 */

function main() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  if (!canvas) throw new Error("#canvas not found");

  const canvasBox = document.querySelector("#canvas-box");
  if (!canvas) throw new Error("#canvas-box not found");
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

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`,
    );
  }

  /** @type {Locations} */
  const programInfo = {
    program,
    attrib: {
      vertexPos: gl.getAttribLocation(program, "aVertexPos"),
      textureCoord: gl.getAttribLocation(program, "aTextureCoord"),
    },
    uniform: {
      projectionMat: gl.getUniformLocation(program, "uProjectionMat"),
      extent: gl.getUniformLocation(program, "uExtent"),
      mousePos: gl.getUniformLocation(program, "uMousePos"),
      brushColor: gl.getUniformLocation(program, "uBrushColor"),
      brushSize: gl.getUniformLocation(program, "uBrushSize"),
      mouseOver: gl.getUniformLocation(program, "uMouseOver"),
    },
  };

  /** @type {Buffers} */
  const buffers = {
    position: gl.createBuffer(),
    textureCoord: gl.createBuffer(),
    index: gl.createBuffer(),
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

  /** @type {Uniforms} */
  const uniforms = {
    // prettier-ignore
    projectionMat: [ 
         1.0,  0.0,  0.0,  0.0,
         0.0, -1.0,  0.0,  0.0,
         0.0,  0.0,  1.0,  0.0,
         0.0,  0.0,  0.0,  1.0,
      ],
    extent: [gl.canvas.width, gl.canvas.height],
    mousePos: [-1000.0, -1000.0],
    brushColor: settings.brushColor,
    brushSize: settings.brushSize,
  };

  window.addEventListener("resize", () => {
    canvas.width = canvasBox.clientWidth;
    canvas.height = canvasBox.clientHeight;

    uniforms.extent[0] = gl.canvas.width;
    uniforms.extent[1] = gl.canvas.height;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  });

  gl.canvas.addEventListener("pointerover", (event) => {
    uniforms.mouseOver = true;
  });
  gl.canvas.addEventListener("pointerout", (event) => {
    uniforms.mouseOver = false;
  });
  gl.canvas.addEventListener("pointermove", (event) => {
    /** @type {PointerEvent} e */
    const e = event;

    const rect = canvas.getBoundingClientRect();
    uniforms.mousePos[0] = e.clientX - rect.x;
    uniforms.mousePos[1] = e.clientY - rect.y;
  });

  let last_frame_ms = 0;
  function render(current_frame_ms) {
    const delta_ms = current_frame_ms - last_frame_ms;
    last_frame_ms = current_frame_ms;

    draw(gl, programInfo, buffers, uniforms);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {string} name
 * @param {number} type
 * @param {string} source
 */
function loadShader(gl, name, type, source) {
  const shader = gl.createShader(type);
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

/**
 * @param {WebGLRenderingContext} gl
 * @param {Locations} locations
 * @param {Buffers} buffers
 * @param {Uniforms} uniforms
 */
function draw(gl, locations, buffers, uniforms) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  setAttributes(gl, locations, buffers);

  gl.useProgram(locations.program);

  gl.uniformMatrix4fv(
    locations.uniform.projectionMat,
    false,
    uniforms.projectionMat,
  );
  gl.uniform2fv(locations.uniform.extent, uniforms.extent);
  gl.uniform2fv(locations.uniform.mousePos, uniforms.mousePos);
  gl.uniform4fv(locations.uniform.brushColor, uniforms.brushColor);
  gl.uniform1f(locations.uniform.brushSize, uniforms.brushSize);
  gl.uniform1i(locations.uniform.mouseOver, uniforms.mouseOver);

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {Locations} locations
 * @param {Buffers} buffers
 */
function setAttributes(gl, locations, buffers) {
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
