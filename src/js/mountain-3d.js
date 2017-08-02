// some control constants
const HEIGHTMAP_SCALE = 1.0;
const HEIGHTMAP_DENSITY = 255;
const HEIGHTMAP_SIZE = 24;

const MAP_BOUNDS = [[48.52163, -118.6259], [48.8532, -118.1260]];
const MAP_EXTENT = [
  Math.abs(MAP_BOUNDS[0][0] - MAP_BOUNDS[1][0]), 
  Math.abs(MAP_BOUNDS[0][1] - MAP_BOUNDS[1][1])
];
const MAP_CENTER = [
  MAP_BOUNDS[0][0] + MAP_EXTENT[0] * .5,
  MAP_BOUNDS[0][1] + MAP_EXTENT[1] * .5
];
const LATLNG_SCALE = 1000;

var { mat4, vec3, vec4 } = require("gl-matrix");
var $ = require("./lib/qsa");

var canvas = document.querySelector("canvas");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
var gl = canvas.getContext("webgl");
window.gl = gl;

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

var configProgram = require("./gl-program");

var polyProgram = configProgram(gl, {
  vertex: require("./vertex.glsl"),
  fragment: require("./fragment.glsl"),
  attributes: "a_color a_normal a_position".split(" "),
  uniforms: "u_perspective u_camera u_position u_light_direction u_light_color u_light_intensity u_time".split(" ")
});

var pointProgram = configProgram(gl, {
  vertex: require("./vertex.glsl"),
  fragment: require("./pointFrag.glsl"),
  attributes: "a_position".split(" "),
  uniforms: "u_perspective u_camera u_position u_time".split(" ")
});

var camera = {
  position: [10, 10, 10],
  target: [0, 0, 0],
  up: [0, 1, 0],
  perspective: mat4.create(),
  tracking: null,
  reposition: function(duration, position, target) {
    this.tracking = {
      start: Date.now(),
      duration,
      from: {
        position: this.position.slice(),
        target: this.target.slice()
      },
      to: {
        position: position || this.position.slice(),
        target: target || this.target.slice()
      }
    };
  },
  configure: function() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    mat4.perspective(camera.perspective, 45 * Math.PI / 180, canvas.width / canvas.height, .1, 300);
  }
};

mat4.identity(camera.perspective);
mat4.perspective(camera.perspective, 45 * Math.PI / 180, canvas.width / canvas.height, .1, 300);

window.addEventListener("resize", () => camera.configure());

var ElementMesh = require("./element");
var landscape = new ElementMesh(gl);
landscape.position.x = MAP_CENTER[1];
landscape.position.z = MAP_CENTER[0];

var bitmap = new Image();
bitmap.src = "./assets/cropped.jpg";
var HeightMap = require("./heightmap");
var map = null;
var points = [];

bitmap.onload = function(e) {
  map = new HeightMap(e.target, HEIGHTMAP_DENSITY, HEIGHTMAP_SIZE, HEIGHTMAP_SCALE);
  
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

  window.depredationData.forEach(function(p) {
    var dx = (MAP_CENTER[1] - p.lng) / MAP_EXTENT[1];
    var dz = (MAP_CENTER[0] - p.lat) / MAP_EXTENT[0];
    var px = MAP_CENTER[1] + dx * HEIGHTMAP_SIZE;
    var py = map.getPixel((dx + 1) / 2, (dz + 1) / 2)[0] / 255;
    py += .3;
    var pz = MAP_CENTER[0] + dz * HEIGHTMAP_SIZE;
    points.push(px, py, pz);
  });
  
  requestAnimationFrame(render);
}

var meshes = [landscape];
camera.target = [landscape.position.x, landscape.position.y + 20, landscape.position.z];
camera.position = [landscape.position.x + 10, 10, landscape.position.z + 10];

canvas.addEventListener("click", function() {
  camera.reposition(
    1000,
    [landscape.position.x + Math.random() * 16, 3 + Math.random(), landscape.position.z + Math.random() * 16]
  );
});

var render = function(time) {
  gl.useProgram(polyProgram);

  gl.uniform1f(polyProgram.uniforms.u_time, time * 0.001);
  
  // clear the canvas, but also the depth buffer
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
  
  if (camera.tracking) {
    var elapsed = Date.now() - camera.tracking.start;
    var delta = elapsed / camera.tracking.duration;
    if (delta >= 1) {
      camera.tracking = null;
    } else {
      var from = camera.tracking.from;
      var to = camera.tracking.to;
      var eased = Math.sin(delta * Math.PI * .5);
      vec3.lerp(camera.position, from.position, to.position, eased);
      vec3.lerp(camera.target, from.target, to.target, eased);
    }
  }
  
  // Global diffuse lighting (the "sun" for this scene)
  var light = [.5, .5, 0];
  var lightColor = [0.5, 0.5, 0.5];
  var intensity = .7;
  
  gl.uniform3fv(polyProgram.uniforms.u_light_direction, light);
  gl.uniform3fv(polyProgram.uniforms.u_light_color, lightColor);
  gl.uniform1f(polyProgram.uniforms.u_light_intensity, intensity);
  
  // aim the camera at its target and generate a matrix to "move" the scene in front of the camera
  var gaze = mat4.create();
  mat4.lookAt(gaze, camera.position, camera.target, camera.up);
  
  // pass all camera matrices in for the vertex shader
  // `perspective` scales content in 3D
  // `gaze` moves the world in front of the camera
  gl.uniformMatrix4fv(polyProgram.uniforms.u_perspective, false, camera.perspective);
  gl.uniformMatrix4fv(polyProgram.uniforms.u_camera, false, gaze);
  
  // now render the landscape
  meshes.forEach(mesh => drawElements(mesh));

  // and render point layers
  gl.useProgram(pointProgram);
  
  gl.uniform1f(pointProgram.uniforms.u_time, time * 0.001);
  gl.uniformMatrix4fv(pointProgram.uniforms.u_perspective, false, camera.perspective);
  gl.uniformMatrix4fv(pointProgram.uniforms.u_camera, false, gaze);
  gl.uniformMatrix4fv(pointProgram.uniforms.u_position, false, mat4.create());
  
  drawPoints(points);
  
  requestAnimationFrame(render);
};

var drawElements = function(mesh) {

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
  gl.uniformMatrix4fv(polyProgram.uniforms.u_position, false, toWorld);
  
  // send the index buffer to the GPU to render it
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index.buffer);
  gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_SHORT, 0);
};

var drawPoints = function(points) {
  var pointBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
  gl.vertexAttribPointer(pointProgram.attributes.a_position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(pointProgram.attributes.a_position);
  gl.drawArrays(gl.POINTS, 0, points.length / 3);
}

var stage = 0;
var repo = {
  1: {
    position: [landscape.position.x - 16, 7, landscape.position.z],
    target: [landscape.position.x, landscape.position.y, landscape.position.z]
  },
  2: {
    position: [landscape.position.x - 4, 3, landscape.position.z - 16],
    target: [landscape.position.x + 6, landscape.position.y, landscape.position.z]
  },
  3: {
    target: [landscape.position.x - 4, landscape.position.y, landscape.position.z - 3]
  }
};

var stageElements = $(".stage");
window.addEventListener("scroll", function() {
  for (var i = 0; i < stageElements.length; i++) {
    var bounds = stageElements[i].getBoundingClientRect();
    if (bounds.top > 0 && bounds.bottom > 0) {
      var choice = stageElements[i].getAttribute("data-stage");
      if (stage == choice) return;
      var placement = repo[choice];
      if (!placement) return;
      camera.reposition(3000, placement.position, placement.target);
      stage = choice;
      return;
    }
  }
})