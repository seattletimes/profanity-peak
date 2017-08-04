// Director watches the page state and updates the sceneState
// The renderer will then use that to control rendering
// each stage gets access to the scene in turn

var $ = require("./lib/qsa");

const ALT = 5;

var stages = {
  intro: function(scene) {
    scene.camera.reposition(3000, [-scene.scale, ALT, scene.scale], [0, 0, 0]);
  },
  release: function(scene) {
    var [lat, lng] = scene.locations.unloading;
    var [x, y] = scene.latlngToWorld(lat, lng);
    var dist = scene.scale * .4;
    scene.camera.reposition(2000, [x - dist, ALT, y + dist], [x, 0, y]);
  },
  den: function(scene) {
    var [lat, lng] = scene.locations.den;
    var [x, y] = scene.latlngToWorld(lat, lng);
    var distance = scene.scale * .4;
    scene.camera.reposition(2000, null, [x, 0, y]);
  },
  salt: function(scene) {
    var [lat, lng] = scene.locations.salt;
    var [x, y] = scene.latlngToWorld(lat, lng);
    var distance = scene.scale * .4;
    scene.camera.reposition(2000, null, [x, 0, y]);
  },
  depredation: function(scene) {

  },
  kills: function(scene) {

  },
  saltRemoval: function(scene) {

  },
  killsConcluded: function(scene) {

  }
};

var stageElements = $(".stage");
var current = null;
var noop = function() {};

var action = function(scene) {

  var onScroll = function() {
    for (var i = 0; i < stageElements.length; i++) {
      var element = stageElements[i];
      var bounds = element.getBoundingClientRect();
      if (bounds.top > 0 && bounds.top < window.innerHeight) {
        var stageID  = element.getAttribute("data-stage");
        if (stageID == current) return;
        var stage = stages[stageID] || noop;
        stage(scene);
        current = stageID;
        console.log(current);
        return;
      }
    }
  };

  onScroll();
  window.addEventListener("scroll", onScroll);

};

module.exports = { action };