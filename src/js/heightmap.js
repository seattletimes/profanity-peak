var { vec3 } = require("gl-matrix");

const HEIGHT = 0;
const HEAT = 2;

var HeightMap = function(image, interval, size) {
  this.image = image;

  //extract image data
  var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d");
  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0, image.width, image.height);
  var imageData = this.imageData = context.getImageData(0, 0, image.width, image.height);
  
  // create the plane
  var verts = this.verts = new Array(interval ** 2 * 3);
  var color = this.color = new Array(interval ** 2);
  var normals = this.normals = new Array(interval ** 2 * 3);
  // polys along each axis
  var edges = interval - 1;
  // element index buffer
  var index = this.index = new Array((edges ** 2) * 6);
  
  //generate vertex data
  for (var x = 0; x < interval; x++) {
    for (var z = 0; z < interval; z++) {
      var i = ((x * interval + z) * 3);
      var u = x / (interval - 1);
      var v = z / (interval - 1);
      var pixel = this.getPixel(u, v);
      
      //set the height at x/y
      //red pixels are used to set height
      var height = pixel[HEIGHT] / 255;
      verts[i] = x / (interval - 1) * size - (size / 2);
      verts[i+1] = height;
      verts[i+2] = z / (interval - 1) * size - (size / 2);
      
      //  approximate normal from neighboring pixels
      var offset = 1 / (interval - 1);
      var nL = this.getPixel(u - offset, v)[HEIGHT] / 255;
      var nR = this.getPixel(u + offset, v)[HEIGHT] / 255;
      var nU = this.getPixel(u, v - offset)[HEIGHT] / 255;
      var nD = this.getPixel(u, v + offset)[HEIGHT] / 255;
      var n = vec3.fromValues(nL - nR, .5, nD - nU);
      normals[i] = n[0];
      normals[i+1] = n[1];
      normals[i+2] = n[2];
      
      // generate false coloring (heatmap)
      // blue pixels are used for this
      color[i / 3] = 1 - pixel[HEAT] / 255;
    }
  }

  console.log(color.slice(0, 1000));
  
  //generate index list
  for (var i = 0; i < edges; i++) {
    for (var j = 0; j < edges; j++) {
      var k = (i * edges + j) * 6;
      var corner = i * interval + j;
      index[k] = corner;
      index[k+1] = corner + 1;
      index[k+2] = corner + interval;
      index[k+3] = corner + 1;
      index[k+4] = corner + interval + 1;
      index[k+5] = corner + interval;
    }
  }
};

HeightMap.prototype = {
  // image pixels are addressed in UV coordinates, ranging from 0,0 to 1,1  
  getPixel: function(x, y) {
    if (x > 1 || x < 0 || y > 1 || y < 0) return [255, 255, 255, 0];
    x = Math.floor(x * (this.image.width - 1));
    y = Math.floor(y * (this.image.height - 1));
    var index = (y * this.image.height + x) * 4;
    return this.imageData.data.slice(index, index + 4);
  }
}

module.exports = HeightMap;