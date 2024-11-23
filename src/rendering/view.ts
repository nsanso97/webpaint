import { Camera } from "../controls/camera";
import { assert } from "../utils/assert";

import view_vert_src from "../shaders/view.vert?raw";
import view_frag_src from "../shaders/view.frag?raw";
import { Program, Shader } from "../shaders/shader";

export class View {
    gl: WebGL2RenderingContext;
    camera: Camera;
    framebuffer: WebGLFramebuffer;

    program: WebGLProgram;
    locations: {
        a_uv: number;

        u_wh: WebGLUniformLocation;
        u_image_bounds: WebGLUniformLocation;
        u_image: WebGLUniformLocation;
        u_border_size: WebGLUniformLocation;
        u_checkerboard_span: WebGLUniformLocation;
    };

    buf_index: WebGLBuffer;
    buf_a_uv: WebGLBuffer;

    constructor(
        gl: WebGL2RenderingContext,
        camera: Camera,
        framebuffer: WebGLFramebuffer,
    ) {
        assert(!!gl);
        assert(!!camera);

        this.gl = gl;
        this.camera = camera;
        this.framebuffer = framebuffer;

        const view_vert = new Shader(
            gl,
            "view.vert",
            gl.VERTEX_SHADER,
            view_vert_src,
            { attributes: ["a_uv"], uniforms: ["u_wh", "u_image_bounds"] },
        );
        const view_frag = new Shader(
            gl,
            "view.frag",
            gl.FRAGMENT_SHADER,
            view_frag_src,
            {
                attributes: [],
                uniforms: [
                    "u_wh",
                    "u_image_bounds",
                    "u_image",
                    "u_border_size",
                    "u_checkerboard_span",
                ],
            },
        );

        this.program = new Program(gl, [view_vert, view_frag]);

        view_vert.delete();
        view_frag.delete();

        this.buf_index = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buf_index);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array([0, 1, 2, 2, 3, 0]),
            gl.STATIC_DRAW,
        );
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        this.buf_a_uv = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf_a_uv);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            gl.STATIC_DRAW,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    draw(viewport: { x: number; y: number; width: number; height: number }) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.image);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    teardown() {
        const gl = this.gl;
        gl.deleteProgram(this.program);
        gl.deleteBuffer(this.buf_index);
        gl.deleteBuffer(this.buf_a_uv);
    }
}
