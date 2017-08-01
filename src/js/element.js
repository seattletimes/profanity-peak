var ElementMesh = function(gl) {
  this.position = {
    x: 0,
    y: 0,
    z: 0,
    r: 0
  };
  this.attributes = {
    a_position: { buffer: gl.createBuffer(), size: 3, length: 0 },
    a_normal: { buffer: gl.createBuffer(), size: 3, length: 0 },
    a_color: { buffer: gl.createBuffer(), size: 3, length: 0 }
  };
  this.index = { buffer: gl.createBuffer(), length: 0 }
};

module.exports = ElementMesh;