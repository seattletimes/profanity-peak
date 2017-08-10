var $ = require("./lib/qsa");
var director = require("./director");
var tween = require("./tween");
var { mat4, vec3, vec4 } = require("gl-matrix");

// GL helper modules
var configProgram = require("./gl-program");
var loadTexture = require("./gl-texture");
var ElementMesh = require("./element");
var Camera = require("./camera");
var HeightMap = require("./heightmap");

// rendering state
const WIREFRAME = 0;
var downscaling = 1;

// some control constants
const HEIGHTMAP_SCALE = 1.0;
const HEIGHTMAP_DENSITY = 255;
const HEIGHTMAP_SIZE = 24;

// map coordinates
const MAP_BOUNDS = [[48.52163, -118.6259], [48.8532, -118.1260]];
const MAP_EXTENT = [
  Math.abs(MAP_BOUNDS[0][0] - MAP_BOUNDS[1][0]), 
  Math.abs(MAP_BOUNDS[0][1] - MAP_BOUNDS[1][1])
];
const MAP_CENTER = [
  MAP_BOUNDS[0][0] + MAP_EXTENT[0] * .5,
  MAP_BOUNDS[0][1] + MAP_EXTENT[1] * .5
];

var latlngToMap = function(lat, lng) {
  var y = (lat - MAP_BOUNDS[0][0]) / MAP_EXTENT[0];
  y = (y - .5) * -2;
  var x = (lng - MAP_BOUNDS[0][1]) / MAP_EXTENT[1];
  x = (x - .5) * 2;
  return [x, y];
};

var latlngToWorld = function(lat, lng) {
  var [x, y] = latlngToMap(lat, lng);
  x *= HEIGHTMAP_SIZE / 2;
  y *= HEIGHTMAP_SIZE / 2;
  return [x, y];
};

var locations = {
  unloading: [48.6826, -118.2377],
  den: [48.7191, -118.3341],
  salt: [48.7176, -118.3403]
};

// canvas setup
var canvas = $.one("canvas");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
var gl = canvas.getContext("webgl", { alpha: false }) || canvas.getContext("experimental-webgl");
window.gl = gl;

// GL setup
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(1, 1, 1, 1);
gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

// load shader programs
var polyProgram = configProgram(gl, {
  vertex: require("./vertex.glsl"),
  fragment: require("./fragment.glsl"),
  attributes: [
    "a_color",
    "a_normal",
    "a_position"
  ],
  uniforms: [
    "u_perspective",
    "u_camera",
    "u_position",
    "u_light_direction",
    "u_light_color",
    "u_light_intensity",
    "u_time",
    "u_false_color",
    "u_wireframe",
    "u_fog_distance",
    "u_fog_depth"
  ]
});

gl.useProgram(polyProgram);
polyProgram.setUniforms({
  u_light_direction: [.3, .3, .7],
  u_light_color: [0.5, 0.5, 0.5],
  u_light_intensity: .7
});

var pointProgram = configProgram(gl, {
  vertex: require("./vertex.glsl"),
  fragment: require("./pointFrag.glsl"),
  attributes: ["a_position"],
  uniforms: [
    "u_perspective",
    "u_camera",
    "u_position",
    "u_time",
    "u_resolution",
    "u_fog_distance",
    "u_fog_depth",
    "u_alpha"
  ]
});

var camera = new Camera(canvas);

window.addEventListener("resize", function() {
  canvas.width = canvas.clientWidth * downscaling;
  canvas.height = canvas.clientHeight * downscaling;
  camera.configureFOV();
  render();
});

// load the landscape model and data
var landscape = new ElementMesh(gl);

var kills = [];
var meshes = [landscape];
var textures = {
  yellow: loadTexture(gl, "./assets/placeholders/yellow.png"),
  purple: loadTexture(gl, "./assets/placeholders/purple.png"),
  salt: loadTexture(gl, "./assets/icons/salt.png"),
  skull: loadTexture(gl, "./assets/icons/skull.png"),
  skullPaw: loadTexture(gl, "./assets/icons/skull-paw.png"),
  blueSkull: loadTexture(gl, "./assets/icons/blue-skull.png"),
  injured: loadTexture(gl, "./assets/icons/injured.png")
};

camera.target = [landscape.position.x, landscape.position.y + 10, landscape.position.z];
camera.position = [landscape.position.x + 3, 10, landscape.position.z + 3];

// store info for various locations
var sceneState = {
  locations,
  camera,
  latlngToWorld,
  latlngToMap,
  scale: HEIGHTMAP_SIZE / 2,
  den: 0,
  turnout: 0,
  kills: 0,
  salt: 0,
  heatmap: 0
};

var container = $.one("section.mountain");

$.one("input#low-detail").addEventListener("change", function() {
  downscaling = this.checked ? .5 : 1;
  render();
});

var pending = false;

// actual rendering code
var render = function(time) {
  var forceUpdate = false;

  if (pending) cancelAnimationFrame(pending);

  // was this run manually?
  if (!time) {
    time = performance.now();
    forceUpdate = true;
  }

  // only run if we're visible
  var bounds = container.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > window.innerHeight) {
    return pending = requestAnimationFrame(render);
  }

  // EXPERIMENTAL: only run if we're in a camera movement
  if (!forceUpdate && !camera.tracking && !tween.tracking.length) {
    return pending = requestAnimationFrame(render);
  }

  gl.useProgram(polyProgram);
  
  // clear the canvas, but also the depth buffer
  canvas.width = canvas.clientWidth * downscaling;
  canvas.height = canvas.clientHeight * downscaling;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
  
  camera.update();
  tween.update();
  
  // aim the camera at its target and generate a matrix to "move" the scene in front of the camera
  mat4.lookAt(camera.gaze, camera.position, camera.target, camera.up);

  polyProgram.setUniforms({
    u_time: time * 0.001,
    u_resolution: [canvas.width, canvas.height, 300],
    u_perspective: camera.perspective,
    u_camera: camera.gaze,
    u_false_color: sceneState.heatmap,
    u_fog_distance: 18,
    u_fog_depth: 30
  });
  
  // now render the landscape
  meshes.forEach(mesh => drawModel(mesh));

  // and render point layers
  gl.useProgram(pointProgram);
  pointProgram.setUniforms({
    u_resolution: [canvas.width, canvas.height, 300],
    u_time: time * 0.001,
    u_perspective: camera.perspective,
    u_camera: camera.gaze,
    u_position: camera.identity,
    u_fog_distance: 20,
    u_fog_depth: 20,
    u_alpha: 1
  });

  //various map POI
  if (sceneState.turnout) {
    gl.uniform1f(pointProgram.uniforms.u_alpha, sceneState.turnout);
    textures.purple.activate(pointProgram);
    drawPoints(locations.unloading);
  }

  if (sceneState.den) {
    gl.uniform1f(pointProgram.uniforms.u_alpha, sceneState.den);
    textures.yellow.activate(pointProgram);
    drawPoints(locations.den);
  }

  if (sceneState.salt) {
    gl.uniform1f(pointProgram.uniforms.u_alpha, sceneState.salt);
    textures.salt.activate(pointProgram);
    drawPoints(locations.salt);
  }
  
  if (sceneState.kills) {
    gl.uniform1f(pointProgram.uniforms.u_alpha, sceneState.kills);
    // killed, definitely wolf
    textures.skull.activate(pointProgram);
    drawPoints(locations.wolfKills);
    // killed, unconfirmed animal
    textures.blueSkull.activate(pointProgram);
    drawPoints(locations.unconfirmedKills);
    // attacked, definitely wolf
    textures.injured.activate(pointProgram);
    drawPoints(locations.wolfAttacks);
    // attacked, unconfirmed animal
    // NOTE: doesn't exist?
    // textures.red.activate(pointProgram);
    // drawPoints(locations.unconfirmedAttacks);
  }
  
  //schedule next update
  pending = requestAnimationFrame(render);

};

var drawModel = function(mesh) {

  for (var k in mesh.attributes) {
    var b = mesh.attributes[k];
    var a = polyProgram.attributes[k];
    gl.enableVertexAttribArray(a);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
    gl.vertexAttribPointer(a, b.size, gl.FLOAT, false, 0, 0);
  }
  
  // generate a matrix to will move model vertexes around world space
  // this lets us generate model vertex values once, but easily reposition them
  var translation = vec4.fromValues(mesh.position.x, mesh.position.y, mesh.position.z, 1);
  var toWorld = mat4.create();
  mat4.fromTranslation(toWorld, translation);
  mat4.rotateY(toWorld, toWorld, mesh.position.r, [0, 0, 0]);
  
  // send the index buffer to the GPU to render it
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index.buffer);

  polyProgram.setUniforms({
    u_position: toWorld,
    u_wireframe: 0
  });

  gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_SHORT, 0);

  // overdraw
  if (WIREFRAME) {
    gl.uniform1f(polyProgram.uniforms.u_wireframe, 1);
    gl.drawElements(gl.LINES, mesh.index.length, gl.UNSIGNED_SHORT, 0);
  }

};

var drawPoints = function(points) {
  var pointBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
  gl.vertexAttribPointer(pointProgram.attributes.a_position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(pointProgram.attributes.a_position);
  gl.drawArrays(gl.POINTS, 0, points.length / 3);
};

// kick it off
var bitmap = new Image();
bitmap.src = "./assets/cropped.jpg";
bitmap.onload = function(e) {
  var map = sceneState.map = new HeightMap(e.target, HEIGHTMAP_DENSITY, HEIGHTMAP_SIZE, HEIGHTMAP_SCALE);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, landscape.attributes.a_position.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(map.verts), gl.STATIC_DRAW);
  landscape.attributes.a_position.length = map.verts.length;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, landscape.attributes.a_color.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(map.color), gl.STATIC_DRAW);
  landscape.attributes.a_color.length = map.color.length;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, landscape.attributes.a_normal.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(map.normals), gl.STATIC_DRAW);
  landscape.attributes.a_normal.length = map.normals.length;
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, landscape.index.buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(map.index), gl.STATIC_DRAW);
  landscape.index.length = map.index.length;

  for (var k in locations) {
    var [lat, lng] = locations[k];
    var [x, z] = latlngToMap(lat, lng);
    var y = map.getPixel((x + 1) / 2, (z + 1) / 2)[0] / 255 + .3;
    x *= HEIGHTMAP_SIZE / 2;
    z *= HEIGHTMAP_SIZE / 2;
    locations[k] = [x, y, z];
  }

  window.depredationData.forEach(function(p) {
    var cat = (p.wolf == "Y" ? "wolf" : "unconfirmed") + (p.kill == "Y" ? "Kills" : "Attacks");
    var [dx, dz] = latlngToMap(p.lat, p.lng);
    var dy = map.getPixel((dx + 1) / 2, (dz + 1) / 2)[0] / 255;
    dy += .3;
    if (!locations[cat]) locations[cat] = [];
    locations[cat].push(dx * HEIGHTMAP_SIZE / 2, dy, dz * HEIGHTMAP_SIZE / 2);
  });
  
  requestAnimationFrame(render);
  director.action(sceneState);
};