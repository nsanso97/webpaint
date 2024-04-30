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

    uniform sampler2D u_sampler;

    void main(void) {
        mediump vec4 sample_clr = texture2D(u_sampler, v_uv);
        mediump vec3 emission = sample_clr.xyz * sample_clr.w + vec3(v_uv.y,0.0, v_uv.x) * (1.0 - sample_clr.w);
        gl_FragColor = vec4(emission, 1.0);
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
  textures: {
    sampler: WebGLUniformLocation;
  };
};

export type Buffers = {
  index: WebGLBuffer;
  pos: WebGLBuffer;
  uv: WebGLBuffer;
};

export type Uniforms = {
  transform: mat4;
  sampler: WebGLTexture;
};

export function createPresent(gl: WebGLRenderingContext, tex: WebGLTexture) {
  const vert = loadShader(gl, "vert2", gl.VERTEX_SHADER, vert_src);
  const frag = loadShader(gl, "frag2", gl.FRAGMENT_SHADER, frag_src);

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
    textures: {
      sampler: gl.getUniformLocation(program, "u_sampler")!,
    },
  };

  const buffers: Buffers = {
    index: gl.createBuffer()!,
    pos: gl.createBuffer()!,
    uv: gl.createBuffer()!,
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos);
  // prettier-ignore
  const positions = [
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
  const texture_coords = [
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
  const indices = [
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
    sampler: tex,
  };

  return { program, locations, buffers, uniforms };
}

export function draw(
  gl: WebGLRenderingContext,
  prg: WebGLProgram,
  loc: Locations,
  buf: Buffers,
  uni: Uniforms,
) {
  gl.clearColor(0.0, 0.0, 0.0, 0.1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(prg);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, uni.sampler);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
  gl.vertexAttribPointer(loc.attrib.pos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.attrib.pos);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv);
  gl.vertexAttribPointer(loc.attrib.uv, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.attrib.uv);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.index);

  gl.uniformMatrix4fv(loc.uniform.transform, false, uni.transform);

  gl.uniform1i(loc.textures.sampler, 0);

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}
