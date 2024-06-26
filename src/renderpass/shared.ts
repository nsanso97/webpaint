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

export function loadShader(
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

export function createTexture(gl: WebGLRenderingContext, w: number, h: number) {
    const initialData = null;
    // const initialData = new Uint8Array(w * h * 4);
    // for (let i = 0; i < w * h; i++) {
    //   initialData[i * 4 + 0] = 0x00; // R
    //   initialData[i * 4 + 1] = 0x00; // G
    //   initialData[i * 4 + 2] = 0x00; // B
    //   initialData[i * 4 + 3] = 0x00; // A
    // }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        initialData,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
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
    return fb;
}
