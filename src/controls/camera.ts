import { mat4, vec2 } from "gl-matrix";

export type CameraBounds = {
    left: number;
    right: number;

    top: number;
    bottom: number;
};

export type CameraSettings = {
    translation_move_factor: number;
    rotation_move_factor: number;
    scale_move_factor: number;

    translation_wheel_factor: number;
    rotation_wheel_factor: number;
    scale_wheel_factor: number;
};

const default_settings = {
    translation_move_factor: 1,
    rotation_move_factor: 1,
    scale_move_factor: 1,

    translation_wheel_factor: 1,
    rotation_wheel_factor: 1,
    scale_wheel_factor: 1,
};

export type CameraBindings = {
    viewport?: HTMLElement;

    scale_input?: HTMLInputElement;
    rotation_input?: HTMLInputElement;
    translation_x_input?: HTMLInputElement;
    translation_y_input?: HTMLInputElement;
};

export class CameraOrtho2D {
    private _proj: mat4;
    private _proj_dirty: boolean;

    private _view: mat4;
    private _view_dirty: boolean;

    private _view_inverse: mat4;
    private _view_inverse_dirty: boolean;

    private _bounds: CameraBounds;
    private _scale: number;
    private _rotation: number;
    private _translation: vec2;

    private _locked: boolean;

    private _translating: boolean;
    private _rotating: boolean;
    private _scaling: boolean;

    private _bindings: CameraBindings;

    readonly settings: CameraSettings;

    constructor(settings: CameraSettings = default_settings) {
        this._proj = mat4.create();
        this._proj_dirty = true;

        this._view = mat4.create();
        this._view_dirty = true;

        this._bounds = { left: 0, right: 0, top: 0, bottom: 0 };
        this._scale = 1;
        this._translation = [0, 0];
        this._rotation = 1;

        this._view_inverse = mat4.create();
        this._view_inverse_dirty = true;

        this._locked = false;

        this._translating = false;
        this._rotating = false;
        this._scaling = false;

        this._bindings = {};

        this.settings = settings;
    }

    get proj(): mat4 {
        if (this._proj_dirty) {
            this._proj = mat4.ortho(
                this._proj,
                this._bounds.left,
                this._bounds.right,
                this._bounds.bottom,
                this._bounds.top,
                0,
                1,
            );
            this._proj_dirty = false;
        }
        return this._proj;
    }

    get view(): mat4 {
        if (this._view_dirty) {
            mat4.identity(this._view);

            this._view[13] = this._translation[0];
            this._view[14] = this._translation[1];

            mat4.rotateZ(this._view, this._view, this._rotation);

            mat4.scale(this._view, this._view, [
                this._scale,
                this._scale,
                this._scale,
            ]);

            this._view_dirty = false;
            this._view_inverse_dirty = true;
        }
        return this._view;
    }

    get view_inverse() {
        // call to getter necessary to update dirty flag for this mat
        const view = this.view;

        if (this._view_inverse_dirty) {
            this._view_inverse = mat4.invert(this._view_inverse, view);
            this._view_inverse_dirty = false;
        }

        return this._view_inverse;
    }

    get bounds(): CameraBounds {
        return this._bounds;
    }

    set bounds(bounds: CameraBounds) {
        this._bounds = bounds;
        this._proj_dirty = true;
    }

    get translation(): vec2 {
        return this._translation;
    }

    set translation(translation: vec2) {
        this._translation[0] = translation[0];
        this._translation[1] = translation[1];

        if (this._bindings.translation_x_input) {
            this._bindings.translation_x_input.value =
                this._translation[0].toString();
        }
        if (this._bindings.translation_y_input) {
            this._bindings.translation_y_input.value =
                this._translation[1].toString();
        }

        this._view_dirty = true;
    }

    translate(translation: vec2) {
        this._translation[0] += translation[0];
        this._translation[1] += translation[1];

        // call setter for side-effects
        this.translation = this._translation;
    }

    get rotation(): number {
        return this._rotation;
    }

    set rotation(rotation: number) {
        this._rotation = rotation;

        if (this._bindings.rotation_input) {
            this._bindings.rotation_input.value = this._rotation.toString();
        }

        this._view_dirty = true;
    }

    rotate(rotation: number) {
        this.rotation += rotation;
    }

    get scale(): number {
        return this._scale;
    }

    set scale(scale: number) {
        this._scale = scale;

        if (this._bindings.scale_input) {
            this._bindings.scale_input.value = this._scale.toString();
        }

        this._view_dirty = true;
    }

    rescale(scale: number) {
        this.scale *= scale;
    }

    /**
     * @param movement - translation vector from view space
     */
    move(x: number, y: number) {
        let m = [x, y] as vec2;
        m = vec2.transformMat4(m, m, this.view_inverse);
        this.translate(m);
    }

    get is_idle(): boolean {
        return (
            !this._translating &&
            !this._rotating &&
            !this._scaling &&
            !this._proj_dirty &&
            !this._view_dirty
        );
    }

    lock(): void {
        this._locked = true;
    }

    unlock(): void {
        this._locked = false;
    }

    get is_locked(): boolean {
        return this._locked;
    }

    bind(bindings: CameraBindings) {
        const {
            viewport,
            scale_input,
            rotation_input,
            translation_x_input,
            translation_y_input,
        } = bindings;

        if (viewport) {
            viewport.addEventListener("mouseup", (event) => {
                if (this._locked) return;
                event.preventDefault();
            });

            viewport.addEventListener("mousedown", (event) => {
                if (this._locked) return;
                event.preventDefault();
            });

            // viewport.addEventListener("pointerout", (_event) => {
            //     if (this._locked) return;
            //
            //     this._translating = false;
            //     this._rotating = false;
            //     this._scaling = false;
            // });

            viewport.addEventListener("pointerdown", (event) => {
                if (this._locked) return;

                this._translating =
                    event.button == 1 ||
                    (event.button == 0 && event.ctrlKey && !event.altKey);

                this._scaling =
                    event.button == 0 && event.altKey && !event.ctrlKey;

                this._rotating =
                    event.button == 0 && event.altKey && !event.ctrlKey;
            });

            window.addEventListener("pointerup", (_event) => {
                if (this._locked) return;

                this._translating = false;
                this._rotating = false;
                this._scaling = false;
            });

            window.addEventListener("pointermove", (event) => {
                if (this._locked) return;

                if (this._translating) {
                    const x =
                        event.movementX * this.settings.translation_move_factor;
                    const y =
                        event.movementY * this.settings.translation_move_factor;
                    this.move(x, y);
                }

                if (this._scaling) {
                    let scale =
                        event.movementY * this.settings.scale_move_factor;
                    this.rescale(scale);
                }

                if (this._rotating) {
                    let rotation =
                        event.movementX * this.settings.rotation_move_factor;
                    this.rotate(rotation);
                }
            });

            viewport.addEventListener("wheel", (event) => {
                event.preventDefault();

                // scale
                if (!event.ctrlKey && !event.altKey) {
                    let scale = event.deltaY * this.settings.scale_wheel_factor;
                    this.rescale(scale);
                }

                // rotation
                if (event.ctrlKey && !event.altKey) {
                    let rotation =
                        event.deltaY * this.settings.rotation_wheel_factor;
                    this.rotate(rotation);
                }
            });
        }

        if (scale_input) {
            scale_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.scale = +t.value;
                // this.scale = Math.pow(
                //     settings.viewScaleExpBase,
                //     +t.value - 1,
                // );
            });
        }

        if (rotation_input) {
            rotation_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.rotation = +t.value * Math.PI;
            });
        }

        if (translation_x_input) {
            translation_x_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.translation[0] = +t.value;
                // trigger side-effects
                this.translation = this.translation;
            });
        }

        if (translation_y_input) {
            translation_y_input.addEventListener("input", (event) => {
                const e = event as InputEvent;
                const t = e.target as HTMLInputElement;
                this.translation[1] = +t.value;
                // trigger side-effects
                this.translation = this.translation;
            });
        }

        // trigger side-effects to sync input elements values
        this.scale = this.scale;
        this.rotation = this.rotation;
        this.translation = this.translation;
    }
}
