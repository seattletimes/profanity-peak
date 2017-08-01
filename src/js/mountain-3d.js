// some control constants
const HEIGHTMAP_SCALE = 1.0;

var { mat4, vec3, vec4 } = require("gl-matrix");

var canvas = document.querySelector("canvas");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
var gl = canvas.getContext("webgl");
window.gl = gl;

// depth-testing means we don't have to worry about rendering order, GL will track it for us.
gl.enable(gl.DEPTH_TEST);
// this removes (does not render) back-facing triangles
gl.enable(gl.CULL_FACE);
// gl.clearColor(1.0, .5, 0, 1);
gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

var configProgram = require("./gl-program");

var program = configProgram(gl, {
  vertex: require("./vertex.glsl"),
  fragment: require("./fragment.glsl"),
  attributes: "a_color a_normal a_position".split(" "),
  uniforms: "u_perspective u_camera u_position u_light_direction u_light_color u_light_intensity u_time".split(" ")
});

gl.useProgram(program);

var camera = {
  position: [10, 10, 10],
  target: [0, 0, 0],
  up: [0, 1, 0],
  perspective: mat4.create()
};

mat4.identity(camera.perspective);
mat4.perspective(camera.perspective, 45 * Math.PI / 180, canvas.width / canvas.height, .1, 300);

var ElementMesh = require("./element");
var landscape = new ElementMesh(gl);

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
  var verts = new Array(interval ** 2 * 3);
  var color = new Array(interval ** 2 * 3);
  var normals = new Array(interval ** 2 * 3);
  // polys along each axis
  var edges = interval - 1;
  // element index buffer
  var index = new Array((edges ** 2) * 6);
  
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
  
  gl.bindBuffer(gl.ARRAY_BUFFER, landscape.attributes.a_position.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  landscape.attributes.a_position.length = verts.length;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, landscape.attributes.a_color.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(color), gl.STATIC_DRAW);
  landscape.attributes.a_color.length = color.length;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, landscape.attributes.a_normal.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  landscape.attributes.a_normal.length = normals.length;
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, landscape.index.buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
  landscape.index.length = index.length;
  
  requestAnimationFrame(render);
}


var render = function(time) {

  // pass in a tick that can be used for time-based effects
  time *= 0.001;
  gl.uniform1f(program.uniforms.u_time, time);
  
  // clear the canvas, but also the depth buffer
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // the camera pans in a circle around the scene origin
  camera.position = [
    Math.sin(time * .2) * 16,
    3,
    Math.cos(time * .2) * 16
  ];
  
  // Global diffuse lighting (the "sun" for this scene)
  var light = [.5, .5, 0];
  var lightColor = [0.5, 0.5, 0.5];
  var intensity = .7;
  
  gl.uniform3fv(program.uniforms.u_light_direction, light);
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
  drawElements(landscape);
  
  requestAnimationFrame(render);
};

var drawElements = function(mesh) {

  for (var k in mesh.attributes) {
    var b = mesh.attributes[k];
    var a = program.attributes[k];
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
  gl.uniformMatrix4fv(program.uniforms.u_position, false, toWorld);
  
  // send the index buffer to the GPU to render it
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index.buffer);
  gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_SHORT, 0);
};

