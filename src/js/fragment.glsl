precision lowp float;

uniform vec3 u_light_direction;
uniform vec3 u_light_color;
uniform float u_light_intensity;
uniform float u_time;

varying vec4 v_screenspace;
varying vec3 v_position;
varying vec3 v_color;
varying vec3 v_normal;

float noise(vec2 seed) {
  float result = fract(sin(dot(seed.xy ,vec2(12.9898,78.233))) * 43758.5453);
  return result;
}

void main() {
  vec3 peak = vec3(81.0, 77.0, 72.0) / 255.0;
  vec3 valley = vec3(29.0, 48.0, 22.0) / 255.0;
  // peak = vec3(1.0, 0.0, 0.0);
  // valley = vec3(0.0, 0.0, 1.0);

  float fogDistance = 16.0;
  float shade = v_position.y;
  vec3 normal = normalize(v_normal);
  vec3 lightDirection = normalize(u_light_direction);
  float facing = max(dot(normal, lightDirection), 0.0);
  vec3 diffuse = u_light_color * facing;
  vec3 mountain = mix(valley, peak, smoothstep(.55, .8, v_position.y));
  vec3 color = mountain * shade * (noise(v_screenspace.xy) * 0.1 + 0.9);
  vec3 pixel = clamp(color + diffuse * u_light_intensity, 0.0, 1.0);
  vec3 fogged = mix(pixel, vec3(1.0), smoothstep(fogDistance, fogDistance * 2.0, v_screenspace.z));
  gl_FragColor = vec4(fogged, 1.0);
}
