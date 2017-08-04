precision mediump float;

uniform float u_time;

varying vec4 v_screenspace;
varying vec3 v_position;

float noise(vec2 seed) {
  float result = fract(sin(dot(seed.xy ,vec2(12.9898,78.233))) * 43758.5453);
  return result;
}

void main() {
  float fogDistance = 10.0;
  float fogDepth = 20.0;

  vec2 coord = (gl_PointCoord.xy - 0.5) * 2.0;
  float r = distance(coord, vec2(0.0));
  float circle = smoothstep(0.9, 0.8, r);
  if (circle == 0.0) discard;
  vec3 color = vec3(0.0, 0.5, 0.5);
  float fog = 1.0 - smoothstep(fogDistance, fogDistance + fogDepth, v_screenspace.z);
  vec3 fogged = mix(vec3(1.0), color, fog);
  gl_FragColor = vec4(fogged, 1.0);

}
