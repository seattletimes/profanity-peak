// Director watches the page state and updates the sceneState
// The renderer will then use that to control rendering
// each stage gets access to the scene in turn

var $ = require("./lib/qsa");
var debounce = require("./lib/debounce");

const ALT = 5;
var noop = function() {};
var mixVector = function(a, b) {
  var out = [];
  for (var i = 0; i < a.length; i++) {
    out[i] = (a[i] + b[i]) / 2;
  }
  return out;
}

var stages = {
  intro: function(scene) {
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
  },
  heatmap: noop,
  turnout: function(scene) {
    scene.showDen = true;
    scene.showTurnout = true;
    var den = scene.locations.den;
    var unloading = scene.locations.unloading;
    var midpoint = mixVector(den, unloading);
    scene.camera.reposition(2000, [midpoint[0] + scene.scale * .5, ALT, midpoint[2] + scene.scale * .5], midpoint);
  },
  kills: function(scene) {
    scene.showKills = true;
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
  },
  salt: function(scene) {
    scene.showSalt = true;
    scene.showTurnout = true;
    scene.showDen = true;
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
  },
  outro: function(scene) {
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
  },
};

var stageElements = $(".stage");
var current = null;

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
        return;
      }
    }
  };

  onScroll();
  window.addEventListener("scroll", onScroll);

};

module.exports = { action };