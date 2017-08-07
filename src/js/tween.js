var swing = p => 0.5 - Math.cos(p * Math.PI) / 2;
var linear = p => p;

var tracking = [];

var update = function() {
  var now = Date.now();
  tracking = tracking.filter(function(tween) {
    var { start, from, to, easing, target, property, duration } = tween;
    var elapsed = now - start;
    var delta = elapsed / duration;
    if (delta > 1) delta = 1;
    var value = from + easing(delta) * (to - from);
    target[property] = value;
    return delta < 1;
  });
};

var create = function(target, property, to, duration = 700) {
  var tween = {
    start: Date.now(),
    duration,
    from: target[property],
    to,
    target,
    property,
    easing: swing
  };
  tracking.push(tween);
};

module.exports = { update, create };