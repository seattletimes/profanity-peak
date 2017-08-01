// some control constants
const HEIGHTMAP_SCALE = 1.0;

var { mat4, vec3, vec4 } = require("gl-matrix");

var canvas = document.querySelector("canvas");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
var gl = canvas.getContext("webgl");

// depth-testing means we don't have to worry about rendering order, GL will track it for us.
gl.enable(gl.DEPTH_TEST);
// this removes (does not render) back-facing triangles
gl.enable(gl.CULL_FACE);
// gl.clearColor(1.0, .5, 0, 1);
gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

var vertex = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertex, require("./vertex.glsl"));
gl.compileShader(vertex);

var vError = gl.getShaderInfoLog(vertex);
if (vError) console.error(vError);

var fragment = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragment, require("./fragment.glsl"));
gl.compileShader(fragment);

// create the program and link it with the two shaders
var program = gl.createProgram();
gl.attachShader(program, vertex);
gl.attachShader(program, fragment);
gl.linkProgram(program);

gl.useProgram(program);

// Container variable to hold state related to the 3D scene
// GL largely works via global state, which is a pain
var scene = {
  terrain: {
    position: {
      x: 0,
      y: 0,
      z: 0,
      r: 0
    },
    verts: [],
    normals: [],
    index: [],
    color: [],
    buffers: {
      position: gl.createBuffer(),
      index: gl.createBuffer(),
      color: gl.createBuffer(),
      normals: gl.createBuffer()
    }
  },
}

program.attribs = {
  a_position: gl.getAttribLocation(program, "a_position"),
  a_color: gl.getAttribLocation(program, "a_color"),
  a_normal: gl.getAttribLocation(program, "a_normal")
}

program.uniforms = {
  u_perspective: gl.getUniformLocation(program, "u_perspective"),
  u_camera: gl.getUniformLocation(program, "u_camera"),
  u_position: gl.getUniformLocation(program, "u_position"),
  u_light: gl.getUniformLocation(program, "u_light"),
  u_light_color: gl.getUniformLocation(program, "u_light_color"),
  u_light_intensity: gl.getUniformLocation(program, "u_light_intensity"),
  u_time: gl.getUniformLocation(program, "u_time")
};

/*

Our camera for this project is untraditional: normally, we would give it a
position and use a mathematical construct called a quaternion to give it a
direction. But I'm bad at math and don't understand quaternions, so instead
our camera just has a position and a target. We use our vector library to
point the camera at the target instead of controlling it directly. This is
great for our purposes (guided tours of a scene) but obviously would be really
cumbersome for a more typical player-controlled camera.

*/

var camera = {
  position: [10, 10, 10],
  target: [0, 0, 0],
  up: [0, 1, 0],
  perspective: mat4.create()
};

mat4.identity(camera.perspective);
mat4.perspective(camera.perspective, 45 * Math.PI / 180, canvas.width / canvas.height, .1, 300);

/*

When the heightmap image is loaded, we need to turn it into the triangle
positions for the terrain. The white pixels are used to create peaks, and the
black pixels create valleys, with everything in between.

Technically, we use an "element array" structure here, instead of a
traditional list of triangles, because we want to share vertex positions for
each grid point between all the triangles that touch that point (up to six, I
think, depending on how we triangulate). So we construct the arrays without
worrying about triangles, just points, and then the index array tells GL which
points make up any given triangle.

We'll also generate normals as a part of this process. The normal for a vertex
is the direction of "away" from the surface at that location. We'll use it in
the shader for lighting: if the surface faces lighting, it gets an added
highlight. If it faces away, light doesn't hit it.

At the end of the function, data is sent to the GPU by calling bindBuffer()
(which sets the destination for the data stream) and then bufferData() (which
actually performs the upload). The fact that this is not one, object-oriented
function call is yet another way that the GL API is written to be as
inconvenient as possible, a fact that we will return to throughout the rest of
this script.

*/

var bitmap = new Image();
bitmap.src = "./assets/cropped.jpg";
bitmap.onload = function(e) {
  var image = e.target;
  var heightmap = document.createElement("canvas");
  var context = heightmap.getContext("2d");
  heightmap.width = image.width;
  heightmap.height = image.height;
  context.drawImage(image, 0, 0, image.width, image.height);
  var imageData = context.getImageData(0, 0, image.width, image.height);
  
  // image pixels are addressed in UV coordinates, ranging from 0,0 to 1,1
  var getPixel = function(x, y) {
    if (x > 1 || x < 0 || y > 1 || y < 0) return [255, 255, 255, 0];
    x = Math.floor(x * (image.width - 1));
    y = Math.floor(y * (image.height - 1));
    var index = (y * image.height + x) * 4;
    return imageData.data.slice(index, index + 4);
  };
  
  // create the plane
  // points along each axis
  var interval = 256;
  // size in scene units
  var size = 24;
  scene.terrain.verts = new Array(interval ** 2 * 3);
  scene.terrain.color = new Array(interval ** 2 * 3);
  scene.terrain.normals = new Array(interval ** 2 * 3);
  // polys along each axis
  var edges = interval - 1;
  // element index buffer
  scene.terrain.index = new Array((edges ** 2) * 6);
  var { verts, index, color, normals } = scene.terrain;
  
  //generate vertex data
  for (var x = 0; x < interval; x++) {
    for (var z = 0; z < interval; z++) {
      var i = ((x * interval + z) * 3);
      var u = x / (interval - 1);
      var v = z / (interval - 1);
      var pixel = getPixel(u, v);
      
      //set the height at x/y
      var height = pixel[0] / 255 * HEIGHTMAP_SCALE;
      verts[i] = x / (interval - 1) * size - (size / 2);
      verts[i+1] = height;
      verts[i+2] = z / (interval - 1) * size - (size / 2);
      
      //  approximate normal from neighboring pixels
      var offset = 1 / (interval - 1);
      var nL = getPixel(u - offset, v)[0] / 255;
      var nR = getPixel(u + offset, v)[0] / 255;
      var nU = getPixel(u, v - offset)[0] / 255;
      var nD = getPixel(u, v + offset)[0] / 255;
      var n = vec3.fromValues(nL - nR, .5, nD - nU);
      normals[i] = n[0];
      normals[i+1] = n[1];
      normals[i+2] = n[2];
      
      // generate colors
      color[i] = .2;
      color[i+1] = 1;//z % 2;
      color[i+2] = .5;
    }
  }
  
  //generate index list
  for (var i = 0; i < edges; i++) {
    for (var j = 0; j < edges; j++) {
      var k = (i * edges + j) * 6;
      var corner = i * interval + j;
      index[k] = corner;
      index[k+1] = corner + 1;
      index[k+2] = corner + interval;
      index[k+3] = corner + 1;
      index[k+4] = corner + interval + 1;
      index[k+5] = corner + interval;
    }
  }
  
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.terrain.buffers.position);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.terrain.buffers.color);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(color), gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.terrain.buffers.normals);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, scene.terrain.buffers.index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
  
  requestAnimationFrame(render);
}

var render = function(time) {
  // pass in a tick that can be used for time-based effects
  time *= 0.001;
  gl.uniform1f(program.uniforms.u_time, time);
  
  // clear the canvas, but also the depth buffer
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // the camera pans in a circle around the scene origin
  camera.position = [
    Math.sin(time * .2) * 16,
    3,
    Math.cos(time * .2) * 16
  ];
  
  // we can move the target just to make sure that it works
  // camera.target = [
  //   Math.sin(time * .1) * 5,
  //   4,
  //   Math.sin(time * .1) * 5
  // ]
  
  // Global diffuse lighting (the "sun" for this scene)
  var light = [.5, .5, 0];
  var lightColor = [0.5, 0.5, 0.5];
  var intensity = .7;
  
  gl.uniform3fv(program.uniforms.u_light, light);
  gl.uniform3fv(program.uniforms.u_light_color, lightColor);
  gl.uniform1f(program.uniforms.u_light_intensity, intensity);
  
  // aim the camera at its target and generate a matrix to "move" the scene in front of the camera
  var gaze = mat4.create();
  mat4.lookAt(gaze, camera.position, camera.target, camera.up);
  
  // pass all camera matrices in for the vertex shader
  // `perspective` scales content in 3D
  // `gaze` moves the world in front of the camera
  gl.uniformMatrix4fv(program.uniforms.u_perspective, false, camera.perspective);
  gl.uniformMatrix4fv(program.uniforms.u_camera, false, gaze);
  
  // now render the landscape
  drawElements(scene.terrain.buffers, scene.terrain.position, scene.terrain.index.length);
  
  requestAnimationFrame(render);
};

var drawElements = function(buffers, position, length) {
  // model-space vertex coordinates
  gl.enableVertexAttribArray(program.attribs.a_position);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(program.attribs.a_position, 3, gl.FLOAT, false, 0, 0);
  
  // per-vertex color values
  gl.enableVertexAttribArray(program.attribs.a_color);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
  gl.vertexAttribPointer(program.attribs.a_color, 3, gl.FLOAT, false, 0, 0);
  
  // per-vertex normals
  gl.enableVertexAttribArray(program.attribs.a_normal);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
  gl.vertexAttribPointer(program.attribs.a_normal, 3, gl.FLOAT, false, 0, 0);
  
  // generate a matrix to will move model vertexes around world space
  // this lets us generate model vertex values once, but easily reposition them
  var translation = vec4.fromValues(position.x, position.y, position.z, 1);
  var toWorld = mat4.create();
  mat4.fromTranslation(toWorld, translation);
  mat4.rotateY(toWorld, toWorld, position.r, [0, 0, 0]);
  gl.uniformMatrix4fv(program.uniforms.u_position, false, toWorld);
  
  // send the index buffer to the GPU to render it
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
  gl.drawElements(gl.TRIANGLES, length, gl.UNSIGNED_SHORT, 0);
  // gl.drawArrays(gl.TRIANGLES, 0, verts.length / 3);
};

