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
};

var stages = {
  intro: function(scene) {
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
    scene.showHeatmap = false;
    scene.showSalt = false;
    scene.showTurnout = false;
    scene.showDen = false;
    scene.showKills = false;
  },
  heatmap: function(scene) {
    scene.showHeatmap = true;
  },
  turnout: function(scene) {
    scene.showDen = true;
    scene.showTurnout = true;
    scene.showHeatmap = false;
    var den = scene.locations.den;
    var unloading = scene.locations.unloading;
    var midpoint = mixVector(den, unloading);
    scene.camera.reposition(2000, [midpoint[0] + scene.scale * .5, ALT, midpoint[2] + scene.scale * .5], midpoint);
  },
  kills: function(scene) {
    scene.showKills = true;
    scene.camera.reposition(3000, [scene.scale * 1.5, ALT * 2, 0], [0, 0, 0]);
  },
  salt: function(scene) {
    scene.showSalt = true;
    scene.showTurnout = true;
    scene.showDen = true;
    scene.showHeatmap = false;
    var midpoint = mixVector(scene.locations.den, scene.locations.salt);
    scene.camera.reposition(3000, [midpoint[0] + scene.scale * .25, ALT * .5, midpoint[2] + scene.scale * .25], midpoint);
  },
  outro: function(scene) {
    scene.showHeatmap = true;
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
  },
};

var stageElements = $(".stage");
var current = null;

var action = function(scene) {

  var onScroll = function() {
    for (var i = stageElements.length - 1; i >= 0; i--) {
      var element = stageElements[i];
      var bounds = element.getBoundingClientRect();
      if (bounds.bottom < window.innerHeight) {
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