import { assert } from "../utils/assert";

export type TLocations<Attributes, Uniforms, Textures> = {
    attributes: {
        [key in keyof Attributes]: number;
    };
    uniforms: {
        [key in keyof Uniforms]: WebGLUniformLocation;
    };
    textures: {
        [key in keyof Textures]: WebGLUniformLocation;
    };
};

export type TBuffers<Attributes> = {
    [key in keyof Attributes]: WebGLBuffer;
};

export function createShader(
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

export function createProgram(
    gl: WebGLRenderingContext,
    ...shaders: WebGLShader[]
) {
    const program = gl.createProgram()!;
    for (const shader of shaders) {
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
            `Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`,
        );
    }
    return program;
}

export function createTexture(gl: WebGLRenderingContext, w: number, h: number) {
    const pixels = null;
    // const pixels = new Uint8Array(w * h * 4);
    // for (let i = 0; i < w * h; i++) {
    //   pixels[i * 4 + 0] = 0x00; // R
    //   pixels[i * 4 + 1] = 0x00; // G
    //   pixels[i * 4 + 2] = 0x00; // B
    //   pixels[i * 4 + 3] = 0x00; // A
    // }
    const tex = gl.createTexture()!;

    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);

    fillTexture(gl, tex, w, h, pixels);

    return tex;
}

export function fillTexture(
    gl: WebGLRenderingContext,
    texture: WebGLTexture,
    source: TexImageSource,
): void;
export function fillTexture(
    gl: WebGLRenderingContext,
    texture: WebGLTexture,
    width: number,
    height: number,
    pixels: ArrayBufferView | null,
): void;
export function fillTexture(
    gl: WebGLRenderingContext,
    texture: WebGLTexture,
    source_or_width: TexImageSource | number,
    height?: number,
    pixels?: ArrayBufferView | null,
) {
    gl.bindTexture(gl.TEXTURE_2D, texture);

    if (typeof source_or_width == "number") {
        assert(typeof height == "number");
        assert(typeof pixels !== "undefined");

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            source_or_width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels,
        );
    } else {
        assert(typeof height == "undefined");
        assert(typeof pixels == "undefined");

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            source_or_width,
        );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
}

export function createFramebuffer(
    gl: WebGLRenderingContext,
    tex: WebGLTexture,
) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
}
