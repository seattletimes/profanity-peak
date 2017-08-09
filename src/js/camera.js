var { vec3, mat4 } = require("gl-matrix");

var ease = p => 0.5 - Math.cos(p * Math.PI) / 2;

var Camera = function(canvas) {
  this.position = [0, 0, 0];
  this.target = [0, 0, 0];
  this.up = [0, 1, 0];
  this.perspective = mat4.create();
  this.identity = mat4.create();
  this.gaze = mat4.create();

  mat4.identity(this.perspective);

  this.canvas = canvas;
  this.configureFOV();
};

Camera.prototype = {
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
  update: function() {
    if (this.tracking) {
      var tracking = this.tracking;
      var elapsed = Date.now() - tracking.start;
      var delta = elapsed / tracking.duration;
      if (delta >= 1) {
        delta = 1;
        this.tracking = null;
      }
      var from = tracking.from;
      var to = tracking.to;
      var eased = ease(delta);
      vec3.lerp(this.position, from.position, to.position, eased);
      vec3.lerp(this.target, from.target, to.target, eased);
    }
  },
  configureFOV: function() {
    var canvas = this.canvas;
    var fov = 60 + (1 - canvas.width / canvas.height) * 40;
    if (fov < 45) fov = 45;
    mat4.perspective(this.perspective, fov * Math.PI / 180, canvas.width / canvas.height, .1, 300);
  }
};

module.exports = Camera;