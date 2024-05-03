import { mat3 } from "gl-matrix";
import { TBuffers, TLocations, loadShader, v2, v3, v4 } from "./shared";

const vert_src = `
    attribute vec2 a_uv;

    uniform mat3 u_view;
    uniform mat3 u_proj;

    #ifdef GL_FRAGMENT_PRECISION_HIGH
        varying highp vec2 v_uv;
        varying highp vec2 v_texel_coord;
    #else
        varying mediump vec2 v_uv;
        varying mediump vec2 v_texel_coord;
    #endif

    void main() {
        v_uv = a_uv;

        vec3 pos2D = u_proj * u_view * vec3(a_uv, 1.0);
        gl_Position = vec4(pos2D.xy, 0.0, pos2D.z);

        v_texel_coord = (u_view * vec3(a_uv, 1.0)).xy;
    }
`;

const frag_src = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
    #else
        precision mediump float;
    #endif
 
    #define MOUSE_SAMPLE_BUFFER_SIZE 64

    #define PI 3.1415926535897932384626433832795
    #define EPSILON 0.000001
    #define TWO_THIRDS 0.66666666
    #define MS_TO_S 0.001

    varying vec2 v_uv;
    varying vec2 v_texel_coord;

    uniform sampler2D u_sampler;

    // TODO: uniform sampler2D u_brush_sdf;
    uniform vec3 u_brush_color;
    uniform float u_brush_flow;
    uniform float u_brush_softness;

    uniform lowp int u_n_mouse_samples;
    uniform vec2 u_mouse_samples[MOUSE_SAMPLE_BUFFER_SIZE];
    uniform mat3 u_mouse_offset_to_brush_uv;

    uniform float u_delta_ms;

    void main() {
        vec4 out_clr = texture2D(u_sampler, v_uv);

        float step = 1.0 / float(u_n_mouse_samples);
        float delta_ms = u_delta_ms / float(u_n_mouse_samples);

        // This formula comes from using a logistic function to approximate the geometric
        // series formed by alpha blending the same color repeatedly.
        // The objective is to model brush flow in a framerate independent way, by 
        // specifying it as desired time of application to reach full opacity, instead 
        // of as the alpha of a single stamp.
        //
        // The exact logistic used is:
        // $ (2 / (1 + e^(-kx))) - 1 $
        //
        // with $ k = u_brush_flow * 2 * PI $
        // with $ u_brush_flow == 1 / seconds_to_full_opacity $
        //
        // It was confronted with the series: 
        // $ alpha * sum[n = 0 : x * fps - 1]((1 - alpha)^n) $
        //
        // when $ alpha == 2/3 * k/fps == 2/3 * k * delta_s $ 
        // the two functions where evaluated as close enough
        float alpha = u_brush_flow * delta_ms * MS_TO_S * 2.0 * PI * TWO_THIRDS;
        alpha = clamp(alpha, 0.0, 1.0);

        vec4 brush_clr = vec4(u_brush_color * alpha, alpha);
        
        for (int i = 0; i <= MOUSE_SAMPLE_BUFFER_SIZE; i++) {
            if (i >= u_n_mouse_samples) break;

            vec3 mouse_offset = vec3(u_mouse_samples[i] - v_texel_coord, 1.0);
            vec2 sample_uv = (u_mouse_offset_to_brush_uv * mouse_offset).xy;

            // TODO after implementing SDF generation
            // vec4 brush_sdf_clr = texture2D(u_brush_nd, sample_uv); 

            float dist_to_circle = length(vec2(0.5, 0.5) - sample_uv);
            float brush_sdf = -(dist_to_circle * 2.0 - 1.0);

            float brush_alpha = clamp(
                1.0 / (u_brush_softness + EPSILON) * brush_sdf,
                0.0, 1.0);
            brush_alpha = brush_alpha * brush_alpha; // squaring for even softer edges

            vec4 sample_clr = brush_clr * brush_alpha;
            out_clr = sample_clr + (1.0 - sample_clr.w) * out_clr;
        }
        gl_FragColor = out_clr;
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
    /** Mouse positions for this frame in texure space(0:W,0:H) */
    mouse_samples: v2[];
    /** Number of stored mouse positions (MAX 64 defined in shader) */
    n_mouse_samples: number;
    /** Transform from the 2D vector offset from the mouse
     * position in texture space to the position in brush uv
     * space used to sample to brush Signed Distance Field (SDF) */
    mouse_offset_to_brush_uv: mat3;
    /** RGBA premuliplied */
    brush_color: v3;
    /** inverse of the time in seconds needed to reach full opacity */
    brush_flow: number;
    /** Range 0:1, with 0 being hardest and 1 being softest */
    brush_softness: number;
    /** Delta time from last frame */
    delta_ms: number;
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
            mouse_samples: gl.getUniformLocation(program, "u_mouse_samples")!,
            n_mouse_samples: gl.getUniformLocation(
                program,
                "u_n_mouse_samples",
            )!,
            mouse_offset_to_brush_uv: gl.getUniformLocation(
                program,
                "u_mouse_offset_to_brush_uv",
            )!,
            brush_color: gl.getUniformLocation(program, "u_brush_color")!,
            brush_flow: gl.getUniformLocation(program, "u_brush_flow")!,
            brush_softness: gl.getUniformLocation(program, "u_brush_softness")!,
            delta_ms: gl.getUniformLocation(program, "u_delta_ms")!,
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
    if (uniforms.mouse_samples) {
        gl.uniform2fv(
            locations.uniforms.mouse_samples,
            uniforms.mouse_samples.flat(),
        );
    }
    if (uniforms.n_mouse_samples) {
        gl.uniform1i(
            locations.uniforms.n_mouse_samples,
            uniforms.n_mouse_samples,
        );
    }
    if (uniforms.mouse_offset_to_brush_uv) {
        gl.uniformMatrix3fv(
            locations.uniforms.mouse_offset_to_brush_uv,
            false,
            uniforms.mouse_offset_to_brush_uv,
        );
    }
    if (uniforms.brush_color) {
        gl.uniform3fv(locations.uniforms.brush_color, uniforms.brush_color);
    }
    if (uniforms.brush_flow != undefined) {
        gl.uniform1f(locations.uniforms.brush_flow, uniforms.brush_flow);
    }
    if (uniforms.brush_softness != undefined) {
        gl.uniform1f(
            locations.uniforms.brush_softness,
            uniforms.brush_softness,
        );
    }
    if (uniforms.delta_ms != undefined) {
        gl.uniform1f(locations.uniforms.delta_ms, uniforms.delta_ms);
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
