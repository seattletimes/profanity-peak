require("./lib/social");
require("./lib/ads");
// var track = require("./lib/tracking");
require("./lib/comments");

require("./mountain-3d");

var $ = require("./lib/qsa");
var animate = require("./lib/animateScroll");

$(".teaser a").forEach(el => el.addEventListener("click", function(e) {
  e.preventDefault();
  animate("#landscape", 1000);
}));