import { mat4 } from "gl-matrix";
import { loadShader } from "./shared";

const vert_src = `
    attribute vec4 a_pos;
    attribute vec2 a_uv;

    uniform mat4 u_transform;

    varying highp vec2 v_uv;

    void main(void) {
        gl_Position = u_transform * a_pos;
        v_uv = a_uv;
    }
`;

const frag_src = `
    varying highp vec2  v_uv;

    void main(void) {
        gl_FragColor = vec4(v_uv.xy, 0.0, 1.0);
    }
`;

export type Locations = {
  attrib: {
    pos: number;
    uv: number;
  };
  uniform: {
    transform: WebGLUniformLocation;
  };
};

export type Buffers = {
  index: WebGLBuffer;
  pos: WebGLBuffer;
  uv: WebGLBuffer;
};

export type Uniforms = {
  transform: mat4;
};

export function createPaint(gl: WebGLRenderingContext) {
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

  const locations: Locations = {
    attrib: {
      pos: gl.getAttribLocation(program, "a_pos")!,
      uv: gl.getAttribLocation(program, "a_uv")!,
    },
    uniform: {
      transform: gl.getUniformLocation(program, "u_transform")!,
    },
  };

  const buffers: Buffers = {
    index: gl.createBuffer()!,
    pos: gl.createBuffer()!,
    uv: gl.createBuffer()!,
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos);
  // prettier-ignore
  let positions = [
     [0.0,  0.0, 0.0],
     [0.0,  1.0, 0.0],
     [1.0,  1.0, 0.0],
     [1.0,  0.0, 0.0],
  ];
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(positions.flat()),
    gl.STATIC_DRAW,
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
  // prettier-ignore
  let texture_coords = [
    [0.0, 0.0],
    [0.0, 1.0],
    [1.0, 1.0],
    [1.0, 0.0],
  ];
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(texture_coords.flat()),
    gl.STATIC_DRAW,
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
  // prettier-ignore
  let indices = [
    [0, 1, 2],
    [2, 3, 0]
  ];
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices.flat()),
    gl.STATIC_DRAW,
  );

  const uniforms: Uniforms = {
    // prettier-ignore
    transform: mat4.create(),
  };

  return { program, locations, buffers, uniforms };
}

export function draw(
  gl: WebGLRenderingContext,
  prg: WebGLProgram,
  loc: Locations,
  buf: Buffers,
  uni: Uniforms,
): void {
  gl.clearColor(0.0, 0.5, 0.0, 0.5);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(prg);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
  gl.vertexAttribPointer(loc.attrib.pos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.attrib.pos);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv);
  gl.vertexAttribPointer(loc.attrib.uv, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.attrib.uv);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.index);

  gl.uniformMatrix4fv(loc.uniform.transform, false, uni.transform);

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}
