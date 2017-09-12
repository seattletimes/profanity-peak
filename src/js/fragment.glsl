precision highp float;

uniform vec3 u_light_direction;
uniform vec3 u_light_color;
uniform float u_light_intensity;
uniform float u_time;
uniform float u_false_color;
uniform float u_wireframe;
uniform float u_fog_distance;
uniform float u_fog_depth;

varying vec4 v_screenspace;
varying vec3 v_position;
varying float v_color;
varying vec3 v_normal;

float noise(vec2 seed) {
  float result = fract(sin(dot(seed.xy, vec2(12.9898, 78.233))) * 43758.5453);
  return result;
}

void main() {
  if (u_wireframe == 1.0) {
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
    return;
  }

  // colors
  vec3 peak = vec3(208.0, 199.0, 168.0) / 255.0;
  vec3 valley = vec3(70.0, 101.0, 65.0) / 255.0;
  vec3 heat = vec3(0.99, 0.4, 0.1);

  // lighting calc
  float shade = 1.0 - v_position.y * .2;
  vec3 normal = normalize(v_normal);
  vec3 lightDirection = normalize(u_light_direction);
  float facing = max(dot(normal, lightDirection), 0.0);
  //half lambert!
  float diffuse = facing * .5 + .5;
  float grain = noise(v_screenspace.xy) * 0.1 + 0.9;

  // coloring
  vec3 pixel = mix(valley, peak, smoothstep(.34, .75, v_position.y));
  // pixel = pixel * shade;
  // heatmap mix
  pixel = mix(pixel, heat, v_color * u_false_color);
  pixel = pixel * grain;
  // apply lighting
  pixel = pixel * diffuse * u_light_color;
  // add fog
  pixel = mix(pixel, vec3(1.0), smoothstep(u_fog_distance, u_fog_distance + u_fog_depth, v_screenspace.z));
  gl_FragColor = vec4(pixel, 1.0);
}
