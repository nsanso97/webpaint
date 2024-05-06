import { mat4, vec2, quat, vec3 } from "gl-matrix";

export type CameraBounds = {
    left: number;
    right: number;

    top: number;
    bottom: number;
};

export class CameraOrtho2D {
    proj: mat4;
    view: mat4;

    bounds: CameraBounds;
    scaling: vec3;
    rotation: quat;
    translation: vec3;

    view_inverse_dirty: boolean;
    view_inverse: mat4;

    constructor(
        bounds: CameraBounds,
        translation: vec2,
        rotation: number,
        scale: number,
    ) {
        this.proj = mat4.create();
        this.view = mat4.create();

        this.set_bounds(bounds);

        this.scaling = [scale, scale, scale];
        this.translation = [translation[0], translation[1], 0];
        this.rotation = quat.fromEuler(quat.create(), 0, 0, rotation);

        this.view_inverse_dirty = true;
        this.view_inverse = mat4.create();

        this.view = mat4.fromRotationTranslationScale(
            this.view,
            this.rotation,
            this.translation,
            this.scaling,
        );
    }

    set_bounds(bounds: CameraBounds) {
        this.bounds = bounds;

        this.proj = mat4.ortho(
            this.proj,
            bounds.left,
            bounds.right,
            bounds.bottom,
            bounds.top,
            0,
            1,
        );
    }

    set_translation(translation: vec2) {
        this.translation = [translation[0], translation[1], 0];

        this.view = mat4.fromRotationTranslationScale(
            this.view,
            this.rotation,
            this.translation,
            this.scaling,
        );
        this.view_inverse_dirty = true;
    }

    set_rotation(rotation: number) {
        this.rotation = quat.fromEuler(quat.create(), 0, 0, rotation);

        this.view = mat4.fromRotationTranslationScale(
            this.view,
            this.rotation,
            this.translation,
            this.scaling,
        );
        this.view_inverse_dirty = true;
    }

    set_scale(scale: number) {
        this.scaling = [scale, scale, scale];

        this.view = mat4.fromRotationTranslationScale(
            this.view,
            this.rotation,
            this.translation,
            this.scaling,
        );
        this.view_inverse_dirty = true;
    }

    translate(translation: vec2) {
        this.translation[0] += translation[0];
        this.translation[1] += translation[1];

        this.view = mat4.fromRotationTranslationScale(
            this.view,
            this.rotation,
            this.translation,
            this.scaling,
        );
        this.view_inverse_dirty = true;
    }

    rotate(rotation: number) {
        this.rotation = quat.rotateZ(this.rotation, this.rotation, rotation);

        this.view = mat4.fromRotationTranslationScale(
            this.view,
            this.rotation,
            this.translation,
            this.scaling,
        );
        this.view_inverse_dirty = true;
    }

    scale(scale: number) {
        this.scaling = vec3.scale(this.scaling, this.scaling, scale);

        this.view = mat4.fromRotationTranslationScale(
            this.view,
            this.rotation,
            this.translation,
            this.scaling,
        );
        this.view_inverse_dirty = true;
    }

    /**
     * @param movement translation vector from view space
     */
    move(movement: vec2) {
        let m = [0, 0] as vec2;
        m = vec2.transformMat4(m, movement, this.get_view_inverse());
        this.translate(m);
    }

    get_view_inverse() {
        if (!this.view_inverse_dirty) return this.view_inverse;

        this.view_inverse = mat4.invert(this.view_inverse, this.view);
        return this.view_inverse;
    }
}
