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
        const msg =
            "Unable to initialize WebGL context. Your browser or machine may not support it";
        alert(msg);
        throw new Error(msg);
    }

    const image = createTexture(gl, 256, 256);
    if (!image) {
        throw new Error("Failed to create texture");
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

    const brush = new Brush();
    // prettier-ignore
    brush.bind({
        viewport: gl.canvas as HTMLCanvasElement,
        color_input: document.querySelector("#brush-color") as HTMLInputElement,
        opacity_input: document.querySelector("#brush-opacity") as HTMLInputElement,
        flow_input: document.querySelector("#brush-flow") as HTMLInputElement,
        size_input: document.querySelector("#brush-size") as HTMLInputElement,
        softness_input: document.querySelector("#brush-softness") as HTMLInputElement,
    });

    const file_input = document.querySelector("#file") as HTMLInputElement;
    const image_element = new Image();

    file_input.addEventListener("change", () => {
        const file = file_input.files?.item(0);
        if (!file) {
            console.error("Unable to load file");
            return;
        }
        URL.revokeObjectURL(image_element.src);
        image_element.src = URL.createObjectURL(file);
    });

    image_element.addEventListener("error", () => {
        const file_name = file_input.files?.item(0)?.name || "<unknown>";

        URL.revokeObjectURL(image_element.src);
        file_input.value = "";

        console.error(`Unable to load ${file_name} as an Image`);
        return;
    });

    image_element.addEventListener("load", () => {
        fillTexture(gl, image, image_element);
        camera.set_bounds({
            left: 0,
            top: 0,
            right: image_element.width,
            bottom: image_element.height,
        });
    });

    window.addEventListener("resize", () => resize_canvas(gl, canvas));
}

function resize_canvas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    //settings.idle = false;
    canvas.width = canvas.parentElement!.clientWidth;
    canvas.height = canvas.parentElement!.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

main();
