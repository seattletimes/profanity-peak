precision mediump float;

uniform float u_time;
uniform sampler2D u_sampler;
uniform float u_fog_distance;
uniform float u_fog_depth;
uniform float u_alpha;

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
  vec4 color = texture2D(u_sampler, gl_PointCoord.xy);
  if (color.a == 0.0) discard;
  float fog = 1.0 - smoothstep(u_fog_distance, u_fog_distance + u_fog_depth, v_screenspace.z);
  vec4 fogged = mix(vec4(1.0), color, fog);
  gl_FragColor = vec4(fogged.rgb, u_alpha * fogged.a);

}
