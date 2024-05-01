import { mat3 } from "gl-matrix";
import { TBuffers, TLocations, loadShader, v2, v3, v4 } from "./shared";

const vert_src = `
    attribute vec2 a_uv;

    uniform mat3 u_view;
    uniform mat3 u_proj;
    uniform vec2 u_mouse_pos;
    uniform mat3 u_mouse_offset_to_brush_uv;

    varying highp vec2 v_uv;
    varying highp vec2 v_brush_uv;

    void main() {
        v_uv = a_uv;
        vec3 pos2D = u_proj * u_view * vec3(a_uv, 1.0);
        gl_Position = vec4(pos2D.xy, 0.0, pos2D.z);

        vec3 texel_coord = u_view * vec3(a_uv, 1.0);
        vec3 mouse_offset = vec3(u_mouse_pos - texel_coord.xy, 1.0);
        v_brush_uv = (u_mouse_offset_to_brush_uv * mouse_offset).xy;
    }
`;

const frag_src = `
    varying highp vec2 v_uv;
    varying highp vec2 v_brush_uv;

    uniform sampler2D u_sampler;
    // TODO: uniform sampler2D u_brush_sdf;
    uniform mediump vec4 u_brush_color;
    uniform mediump float u_brush_softness;

    void main() {
        mediump vec4 original_clr = texture2D(u_sampler, v_uv);

        // mediump vec4 brush_sdf_clr = texture2D(u_brush_nd, v_brush_uv); // TODO after implementing SDF generation

        mediump float dist_to_circle = length(vec2(0.5, 0.5) - v_brush_uv);
        mediump float circle_sdf = -(dist_to_circle * 2.0 - 1.0);
        mediump vec4 brush_sdf_clr = vec4(circle_sdf, circle_sdf, circle_sdf, circle_sdf);

        mediump vec4 brush_clr_factor = clamp(
            (1.0 / u_brush_softness) * brush_sdf_clr,
            0.0, 1.0);
        mediump vec4 brush_clr = u_brush_color * brush_clr_factor;

        mediump vec4 prem_original_clr = vec4(original_clr.w * original_clr.xyz, original_clr.w);
        mediump vec4 prem_brush_clr = vec4(brush_clr.w * brush_clr.xyz, brush_clr.w);
        mediump vec4 prem_out = vec4(
            prem_brush_clr.xyz + (1.0 - prem_brush_clr.w) * prem_original_clr.xyz,
            prem_brush_clr.w + (1.0 - prem_brush_clr.w) * prem_original_clr.w);

        gl_FragColor = vec4(prem_out.w * prem_out.xyz, prem_out.w);
    }
`;

export type Attributes = {
  index: v3[];
  uv: v2[];
};

export type Uniforms = {
  /** Transform from uv(0:1,0:1) to texture(0:W,0:H) */
  view: mat3;
  /** Transform from texture(0:W,0:H) to clip(-1:1,-1:1) */
  proj: mat3;
  /** Mouse position in texure space(0:W,0:H) */
  mouse_pos: v2;
  /** Transform from the 2D vector offset from the mouse
   * position in texture space to the position in brush uv
   * space used to sample to brush Signed Distance Field (SDF) */
  mouse_offset_to_brush_uv: mat3;
  /** RGBA */
  brush_color: v4;
  /** Range 0:1, with 0 being hardest and 1 being softest */
  brush_softness: number;
};

export type Textures = {
  sampler: WebGLTexture;
};

export type Locations = TLocations<Attributes, Uniforms, Textures>;
export type Buffers = TBuffers<Attributes>;
export type Program = WebGLProgram;

export function createProgram(gl: WebGLRenderingContext) {
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

  return program;
}

export function getLocations(
  gl: WebGLRenderingContext,
  program: Program,
): Locations {
  const locations: Locations = {
    attributes: {
      index: -1,
      uv: gl.getAttribLocation(program, "a_uv")!,
    },
    uniforms: {
      view: gl.getUniformLocation(program, "u_view")!,
      proj: gl.getUniformLocation(program, "u_proj")!,
      mouse_pos: gl.getUniformLocation(program, "u_mouse_pos")!,
      mouse_offset_to_brush_uv: gl.getUniformLocation(
        program,
        "u_mouse_offset_to_brush_uv",
      )!,
      brush_color: gl.getUniformLocation(program, "u_brush_color")!,
      brush_softness: gl.getUniformLocation(program, "u_brush_softness")!,
    },
    textures: {
      sampler: gl.getUniformLocation(program, "u_sampler")!,
      // brush_sdf: gl.getUniformLocation(p, "u_brush_sdf")!,
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
      uv: gl.createBuffer()!,
    };
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
    gl.uniformMatrix3fv(locations.uniforms.view, false, uniforms.view);
  }
  if (uniforms.proj) {
    gl.uniformMatrix3fv(locations.uniforms.proj, false, uniforms.proj);
  }
  if (uniforms.mouse_pos) {
    gl.uniform2fv(locations.uniforms.mouse_pos, uniforms.mouse_pos);
  }
  if (uniforms.mouse_offset_to_brush_uv) {
    gl.uniformMatrix3fv(
      locations.uniforms.mouse_offset_to_brush_uv,
      false,
      uniforms.mouse_offset_to_brush_uv,
    );
  }
  if (uniforms.brush_color) {
    gl.uniform4fv(locations.uniforms.brush_color, uniforms.brush_color);
  }
  if (uniforms.brush_softness != undefined) {
    gl.uniform1f(locations.uniforms.brush_softness, uniforms.brush_softness);
  }
}

export function draw(
  gl: WebGLRenderingContext,
  prg: WebGLProgram,
  loc: Locations,
  buf: Buffers,
  tex: Textures,
  triangleCount: number,
): void {
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(prg);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex.sampler);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv);
  gl.vertexAttribPointer(loc.attributes.uv, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.attributes.uv);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.index);

  gl.drawElements(gl.TRIANGLES, triangleCount * 3, gl.UNSIGNED_SHORT, 0);
}

/** @returns out */
export function makeViewMat(out: mat3, textureExtent: v2): mat3 {
  return mat3.fromScaling(out, textureExtent);
}

/** @returns out */
export function makeProjMat(out: mat3, textureExtent: v2): mat3 {
  mat3.fromTranslation(out, [-1, -1]);
  mat3.scale(out, out, [2 / textureExtent[0], 2 / textureExtent[1]]);
  return out;
}

/** @returns out */
export function makeMouseToBrush(out: mat3, brushSize: number): mat3 {
  const s = 1 / brushSize;
  mat3.identity(out);
  mat3.translate(out, out, [0.5, 0.5]);
  mat3.scale(out, out, [s, s]);
  return out;
}
