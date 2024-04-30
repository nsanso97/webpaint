import { mat4 } from "gl-matrix";
import { TBuffers, TLocations, loadShader, v2, v3 } from "./shared";

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

export type Attributes = {
  index: v3[];
  pos: v3[];
  uv: v2[];
};

export type Uniforms = {
  transform: mat4;
};

export type Textures = {
  sampler: WebGLTexture;
};

export type Locations = TLocations<Attributes, Uniforms, Textures>;
export type Buffers = TBuffers<Attributes>;
export type Program = WebGLProgram;

export function createProgram(gl: WebGLRenderingContext) {
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

  return program;
}

export function getLocations(
  gl: WebGLRenderingContext,
  program: Program,
): Locations {
  const locations: Locations = {
    attributes: {
      index: -1,
      pos: gl.getAttribLocation(program, "a_pos")!,
      uv: gl.getAttribLocation(program, "a_uv")!,
    },
    uniforms: {
      transform: gl.getUniformLocation(program, "u_transform")!,
    },
    textures: {
      sampler: gl.getUniformLocation(program, "u_sampler")!,
    },
  };
  gl.useProgram(program);
  gl.uniform1i(locations.textures.sampler, 0);
  return locations;
}

export function updateBuffers(
  gl: WebGLRenderingContext,
  attributes: Partial<Attributes>,
  out_buffers: Buffers | null,
): Buffers {
  if (!out_buffers) {
    out_buffers = {
      index: gl.createBuffer()!,
      pos: gl.createBuffer()!,
      uv: gl.createBuffer()!,
    };
  }

  if (attributes.pos) {
    gl.bindBuffer(gl.ARRAY_BUFFER, out_buffers.pos);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(attributes.pos.flat()),
      gl.STATIC_DRAW,
    );
  }

  if (attributes.uv) {
    gl.bindBuffer(gl.ARRAY_BUFFER, out_buffers.uv);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(attributes.uv.flat()),
      gl.STATIC_DRAW,
    );
  }

  if (attributes.index) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, out_buffers.index);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(attributes.index.flat()),
      gl.STATIC_DRAW,
    );
  }

  return out_buffers;
}

export function updateUniforms(
  gl: WebGLRenderingContext,
  program: Program,
  locations: Locations,
  uniforms: Partial<Uniforms>,
) {
  gl.useProgram(program);
  if (uniforms.transform) {
    gl.uniformMatrix4fv(
      locations.uniforms.transform,
      false,
      uniforms.transform,
    );
  }
}

export function draw(
  gl: WebGLRenderingContext,
  prg: WebGLProgram,
  loc: Locations,
  buf: Buffers,
  tex: Textures,
  triangleCount: number,
) {
  gl.clearColor(0.0, 0.0, 0.0, 0.1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(prg);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex.sampler);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
  gl.vertexAttribPointer(loc.attributes.pos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.attributes.pos);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv);
  gl.vertexAttribPointer(loc.attributes.uv, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.attributes.uv);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.index);

  gl.drawElements(gl.TRIANGLES, triangleCount * 3, gl.UNSIGNED_SHORT, 0);
}
