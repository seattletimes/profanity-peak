precision lowp float;

uniform float u_time;

varying vec4 v_screenspace;
varying vec3 v_position;

float noise(vec2 seed) {
  float result = fract(sin(dot(seed.xy ,vec2(12.9898,78.233))) * 43758.5453);
  return result;
}

void main() {
  float fogDistance = 16.0;
  vec3 pixel = vec3(1.0, 0.0, 0.0);
  vec3 fogged = mix(pixel, vec3(1.0), smoothstep(fogDistance, fogDistance * 1.5, v_screenspace.z));
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
