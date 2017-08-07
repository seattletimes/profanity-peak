// Director watches the page state and updates the sceneState
// The renderer will then use that to control rendering
// each stage gets access to the scene in turn

var $ = require("./lib/qsa");
var debounce = require("./lib/debounce");
var tween = require("./tween");

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
    "showHeatmap showSalt showTurnout showDen showKills".split(" ").forEach(function(p) {
      tween.create(scene, p, 0);
    });
  },
  heatmap: function(scene) {
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
    tween.create(scene, "showHeatmap", 1);
  },
  turnout: function(scene) {
    tween.create(scene, "showDen", 1);
    tween.create(scene, "showTurnout", 1);
    tween.create(scene, "showHeatmap", 0);
    var den = scene.locations.den;
    var unloading = scene.locations.unloading;
    var midpoint = mixVector(den, unloading);
    scene.camera.reposition(2000, [midpoint[0] + scene.scale * .5, ALT, midpoint[2] + scene.scale * .5], midpoint);
  },
  kills: function(scene) {
    tween.create(scene, "showKills", 1);
    scene.camera.reposition(3000, [scene.scale * 1.5, ALT * 2, 0], [0, 0, 0]);
  },
  salt: function(scene) {
    "showSalt showTurnout showDen".split(" ").forEach(p => tween.create(scene, p, 1));
    tween.create(scene, "showHeatmap", 0);
    var midpoint = mixVector(scene.locations.den, scene.locations.salt);
    scene.camera.reposition(3000, [midpoint[0] + scene.scale * .25, ALT * .5, midpoint[2] + scene.scale * .25], midpoint);
  },
  outro: function(scene) {
    tween.create(scene, "showHeatmap", 1);
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
      if (bounds.top < window.innerHeight) {
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