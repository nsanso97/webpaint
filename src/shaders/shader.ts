import { assert } from "../utils/assert";

export type ShaderType = WebGLRenderingContextBase[
    | "VERTEX_SHADER"
    | "FRAGMENT_SHADER"];

export type LocationKeys = {
    attributes: readonly string[];
    uniforms: readonly string[];
};

export class Shader {
    gl: WebGL2RenderingContext;
    name: string;
    type: ShaderType;
    locations: LocationKeys;
    shader: WebGLShader | null;

    constructor(
        gl: WebGL2RenderingContext,
        name: string,
        type: ShaderType,
        source: string,
        locations: LocationKeys,
    ) {
        this.gl = gl;
        this.name = name;
        this.type = type;

        assert(
            type === gl.VERTEX_SHADER || type === gl.FRAGMENT_SHADER,
            `Shader: type ${type} is not supported (${this.name})`,
        );
        this.type = type;

        /*
         * NOTE: the asserts that check coherency between supplied attributes and
         * uniforms and those extracted from the shader code are necessarily located
         * after the shader program linking.
         * This is because that is the earliest time in which webgl makes them available.
         */
        this.locations = locations;

        const shader = gl.createShader(this.type);
        if (!shader) {
            throw new Error(
                `Shader: could not create WebGLShader (${this.name})`,
            );
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader: error occurred (${this.name})\n\t${info}`);
        }

        this.shader = shader;
    }

    delete() {
        if (!this.shader) {
            throw new Error(`Shader.delete: can't delete (${this.name})`);
        }

        this.gl.deleteShader(this.shader);
        this.shader = null;
    }
}

export type Locations = {
    attributes: { [key: string]: number };
    uniforms: { [key: string]: WebGLUniformLocation };
};

export class Program {
    gl: WebGL2RenderingContext;
    name: string;
    program: WebGLProgram | null;
    locations: Locations;

    constructor(gl: WebGL2RenderingContext, shaders: Shader[]) {
        this.gl = gl;

        this.name = "";
        for (const s of shaders) {
            this.name += "+" + s.name;
        }

        for (const s of shaders) {
            if (!s.shader)
                throw new Error(
                    `Program: shader "${s.name}" already deleted (${this.name})`,
                );
        }

        const p = gl.createProgram();
        if (!p) {
            throw new Error(`Program: gl.createProgram failed (${this.name})`);
        }

        for (const s of shaders) {
            gl.attachShader(p, s.shader!);
        }
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            throw new Error(
                `Program: unable to link ${this.name}.\n` +
                    `Info: ${gl.getProgramInfoLog(p)}`,
            );
        }
        this.program = p;

        this.locations = { attributes: {}, uniforms: {} };

        for (const s of shaders) {
            for (const k of s.locations.attributes) {
                const a = gl.getAttribLocation(this.program, k);
                if (a === -1) {
                    throw new Error(
                        `Program: attribute ${k} (Shader ${s.name}) not found (${this.name})`,
                    );
                }
                this.locations.attributes[k] = a;
            }

            for (const k of s.locations.uniforms) {
                const u = gl.getUniformLocation(this.program, k);
                if (!u) {
                    throw new Error(
                        `Program: uniform ${k} (Shader ${s.name}) not found (${this.name})`,
                    );
                }
                this.locations.uniforms[k] = u;
            }
        }
    }

    delete() {
        if (!this.program) {
            throw new Error(`Program.delete: can't delete (${this.name})`);
        }

        this.gl.deleteProgram(this.program);
        this.program = null;
    }
}
