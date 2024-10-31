import { assert } from "../utils/assert";

export type ShaderType = WebGLRenderingContextBase[
    | "VERTEX_SHADER"
    | "FRAGMENT_SHADER"];

export class Shader<
    Attributes extends readonly string[],
    Uniforms extends readonly string[],
> {
    gl: WebGL2RenderingContext;
    name: string;
    type: ShaderType;
    attributes: Attributes;
    uniforms: Uniforms;
    shader: WebGLShader | null;

    constructor(
        gl: WebGL2RenderingContext,
        name: string,
        type: ShaderType,
        source: string,
        locations: { attributes: Attributes; uniforms: Uniforms },
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
        this.attributes = locations.attributes;
        this.uniforms = locations.uniforms;

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

export class ShaderProgram<
    Attributes extends readonly string[],
    Uniforms extends readonly string[],
> {
	constructor(
        gl: WebGL2RenderingContext,
		...shaders: Shader<>[]
}
