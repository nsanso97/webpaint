import { mat4 } from "gl-matrix";
import { TBuffers, TLocations, loadShader, v2, v3 } from "./shared";

const vert_src = `
    attribute vec4 a_pos;
    attribute vec2 a_uv;

    uniform mat4 u_view;
    uniform mat4 u_proj;

    varying highp vec2 v_uv;

    void main(void) {
        gl_Position = u_proj * u_view * a_pos;
        v_uv = a_uv;
    }
`;

const frag_src = `
    varying highp vec2  v_uv;

    uniform sampler2D u_sampler;

    void main(void) {
        gl_FragColor = texture2D(u_sampler, v_uv);
    }
`;

export type Attributes = {
  index: v3[];
  pos: v3[];
  uv: v2[];
};

export type Uniforms = {
  /**
   * Transform from texel(0:Wt,0:Ht) to viewport(0:Wv,0:Hv)
   *
   * The viewport's Wv and Hv are equal to the canvas' Wc and Hc
   * The transformation can scale, rotate and translate the texel
   * space freely, meaning that the bounds of the 2 spaces do not
   * need to match, but it should keep the correct texel aspect ratio
   */
  view: mat4;
  /** Transform from viewport(0:Wv,0:Hv) to clip(-1:1,-1:1) */
  proj: mat4;
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
      view: gl.getUniformLocation(program, "u_view")!,
      proj: gl.getUniformLocation(program, "u_proj")!,
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

  if (uniforms.view) {
    gl.uniformMatrix4fv(locations.uniforms.view, false, uniforms.view);
  }
  if (uniforms.proj) {
    gl.uniformMatrix4fv(locations.uniforms.proj, false, uniforms.proj);
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
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
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

/** NOTE: needs testing with user interaction
 *
 * @param scale scale at which to draw the original texels
 * @param rotation radians
 * @param translation in viewport units
 * @returns out */
export function makeViewMat(
  out: mat4,
  scale: number,
  rotation: number,
  translation: v2,
): mat4 {
  mat4.identity(out);
  mat4.translate(out, out, [translation[0], translation[1], 0]); // 4: translate
  mat4.rotate(out, out, rotation, [0, 0, 1]); // 3: rotate
  mat4.scale(out, out, [scale, scale, 1]); // 2: scale
  // mat4.translate(out, out, [textureExtent[0]/2, textureExtent[1]/2, 1]); // 1: center
  return out;
}

/** @returns out */
export function makeProjMat(out: mat4, canvasExtent: v2): mat4 {
  mat4.identity(out);
  mat4.translate(out, out, [-1, 1, 0]);
  mat4.scale(out, out, [2 / canvasExtent[0], -2 / canvasExtent[1], 1]);
  return out;
}
