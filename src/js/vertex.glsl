// each vertex has a position, a color, and a normal vector for lighting
attribute vec3 a_position;
attribute float a_color;
attribute vec3 a_normal;

// the vertex shader uses these uniforms to convert world coords into screen coords
uniform mat4 u_perspective;
uniform mat4 u_camera;
uniform mat4 u_position;
uniform vec3 u_resolution;

// pass-through varyings used to send values to the fragment shader
varying vec4 v_screenspace;
varying vec3 v_position;
varying float v_color;
varying vec3 v_normal;

void main() {
  v_position = a_position;
  v_color = a_color;
  v_normal = normalize(a_normal);
  v_screenspace = u_perspective * u_camera * u_position * vec4(a_position, 1.0);
  gl_Position = v_screenspace;
  gl_PointSize = min((u_resolution.x / 100.0) / (v_screenspace.z / 100.0), u_resolution.x / 6.0);
}
