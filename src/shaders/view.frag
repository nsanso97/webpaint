#version 300 es

varying highp vec2 v_xy;
varying highp vec2 v_image_uv;

uniform vec2 u_wh;
uniform vec4 u_image_bounds;
uniform sampler2D u_image;
uniform float u_border_size;
uniform float u_checkerboard_span;

void main(void) {

    // float checkerboard_span = exp2(
    //         max(0.0f,
    //             floor(checkerboard_base_scale_log + u_image_scale_log)
    //         ))

    // outside image
    if (min(v_image_uv) < 0.0f || max(v_image_uv) > 1.0f) {
        if (
            max(v_xy - u_image_bounds.xy) < u_border_size
                || max(u_image_bounds.zw - v_xy) < u_border_size
        ) { // border
            gl_FragColor = vec4(0.5f, 0.5f, 0.5f, 1.0f) * 1.0f;
        } else { // void
            gl_FragColor = vec4(0.5f, 0.5f, 0.5f, 1.0f) * 0.1f;
        }
    } else { // inside image
        vec2 image_xy = v_xy - u_image_bounds.xy;
        vec2 checkerboard_xy = image_xy / u_checkerboard_span;
        float checkerboard_parity = floor(mod(dot(checkerboard_xy, checkerboard_xy), 2.0f));

        vec4 checkerboard_color =
            vec4(0.0f, 0.0f, 0.0f, 1.0f) * checkerboard_parity +
                vec4(1.0f, 1.0f, 1.0f, 1.0f) * (1.0f - checkerboard_parity);

        vec4 image_color = texture2D(u_image, v_image_uv);

        gl_FragColor = image_color + (1.0f - image_color.w) * checkerboard_color * 0.1f;
    }
}

