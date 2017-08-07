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

var salt = "showSalt";
var heat = "showHeatmap";
var turnout = "showTurnout";
var kills = "showKills";
var den = "showDen";

var show = function(scene, ...props) {
  props.forEach(p => tween.create(scene, p, 1));
};

var hide = function(scene, ...props) {
  props.forEach(p => tween.create(scene, p, 0));
};

var stages = {
  intro: function(scene) {
    scene.camera.reposition(3000, [0, ALT * 2, scene.scale * 1.5], [0, 0, 0]);
    hide(scene, salt, heat, turnout, den, kills);
  },
  heatmap: function(scene) {
    scene.camera.reposition(3000, [scene.scale * .2, ALT, scene.scale * .75], [0, 0, 0]);
    show(scene, heat);
  },
  turnout: function(scene) {
    hide(scene, kills, heat);
    show(scene, salt, den, turnout);
    var midpoint = mixVector(scene.locations.den, scene.locations.unloading);
    scene.camera.reposition(2000, [midpoint[0] + scene.scale * .5, ALT, midpoint[2] + scene.scale * .5], midpoint);
  },
  kills: function(scene) {
    show(scene, kills, heat, den);
    hide(scene, salt, turnout);
    scene.camera.reposition(3000, [scene.scale * 1.5, ALT * 2, 0], [0, 0, 0]);
  },
  salt: function(scene) {
    show(scene, salt, den);
    hide(scene, heat, kills, turnout);
    var midpoint = mixVector(scene.locations.den, scene.locations.salt);
    scene.camera.reposition(3000, [midpoint[0] + scene.scale * .25, ALT * .5, midpoint[2] + scene.scale * .25], midpoint);
  },
  outro: function(scene) {
    show(scene, salt, den, turnout, kills, heat);
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