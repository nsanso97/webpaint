import "../style.css";
import { Camera } from "./controls/camera";
import { Brush } from "./controls/brush";
import { View } from "./rendering/view";
import { createTexture, fillTexture } from "./renderpass/shared";

function main(): void {
    const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
    canvas.width = canvas.parentElement!.clientWidth;
    canvas.height = canvas.parentElement!.clientHeight;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
        throw new Error(
            "Unable to initialize WebGL context. Your browser or machine may not support it",
        );
    }

    const camera = new Camera();
    // prettier-ignore
    camera.bind({
		viewport: gl.canvas as HTMLCanvasElement,
		translation_x_input: document.querySelector("#translation-x") as HTMLInputElement,
		translation_y_input: document.querySelector("#translation-y") as HTMLInputElement,
		rotation_input: document.querySelector("#rotation") as HTMLInputElement,
		scale_input: document.querySelector("#scale") as HTMLInputElement,
	});

    const view = new View(gl, camera, image, gl.canvas);

    window.addEventListener("resize", () => resize_canvas(gl, canvas));
}

function resize_canvas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    canvas.width = canvas.parentElement!.clientWidth;
    canvas.height = canvas.parentElement!.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

main();
