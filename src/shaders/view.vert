#version 300 es

attribute vec2 a_uv;

uniform vec2 u_wh;
uniform vec4 u_image_bounds;

varying highp vec2 v_xy;
varying highp vec2 v_image_uv;

void main(void) {
    gl_Position = a_uv
    v_xy = a_uv * u_wh;

    vec2 image_wh = u_image_bounds.zw - u_image_bounds.xy;
    vec2 image_xy = v_xy - u_image_bounds.xy;
    v_image_uv = image_xy / image_wh;
}
