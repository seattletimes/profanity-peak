var compileShader = function(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  var log = gl.getShaderInfoLog(shader);
  if (log) throw log;

  return shader;
}

module.exports = function(gl, config) {

  var vertex = compileShader(gl, gl.VERTEX_SHADER, config.vertex);

  var fragment = compileShader(gl, gl.FRAGMENT_SHADER, config.fragment);

  // create the program and link it with the two shaders
  var program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  program.attributes = {};
  program.uniforms = {};

  if (config.attributes) {
    config.attributes.forEach(a => program.attributes[a] = gl.getAttribLocation(program, a));
  }

  if (config.uniforms) {
    config.uniforms.forEach(u => program.uniforms[u] = gl.getUniformLocation(program, u));
  }

  return program;
}