import { Camera } from "../controls/camera";
import { createProgram, createShader } from "../renderpass/shared";
import { assert } from "../utils/assert";

import shadersrc_view_vert from "../shaders/view.vert?raw";
import shadersrc_view_frag from "../shaders/view.frag?raw";

export class View {
    gl: WebGL2RenderingContext;
    camera: Camera;
    image: WebGLTexture;
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
        image: WebGLTexture,
        framebuffer: WebGLFramebuffer,
    ) {
        assert(!!gl);
        assert(!!camera);
        assert(!!image);

        this.gl = gl;
        this.camera = camera;
        this.image = image;
        this.framebuffer = framebuffer;

        // prettier-ignore
        const shader_view_vert = createShader(gl, "view.vert", gl.VERTEX_SHADER, shadersrc_view_vert);
        // prettier-ignore
        const shader_view_frag = createShader(gl, "view.frag", gl.FRAGMENT_SHADER, shadersrc_view_frag);

        this.program = createProgram(gl, shader_view_vert, shader_view_frag);

        gl.deleteShader(shader_view_vert);
        gl.deleteShader(shader_view_frag);

        // prettier-ignore
        this.locations = {
            a_uv: gl.getAttribLocation(this.program, "a_uv"),

            u_wh: gl.getUniformLocation(this.program, "u_wh")!,
            u_image_bounds: gl.getUniformLocation(this.program, "u_image_bounds")!,
            u_image: gl.getUniformLocation(this.program, "u_image")!,
            u_border_size: gl.getUniformLocation(this.program, "u_border_size")!,
            u_checkerboard_span: gl.getUniformLocation(this.program, "u_checkerboard_span")!,
        };

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
