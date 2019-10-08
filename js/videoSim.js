console.log('videoSim.js')


// overall idea...
// I want one or more camera objects, each one has an image object which it displays
// the camera has a height and width, and controls
// let me start by creating a way to display the image, and show an animated image of a
// HxW screen with poisson sampling

console.log('main.js in progress');

// Knuth low-lambda Poisson random sample generator
function poissonSample( lambda = 1, numSamples = 1 ){
    var output = []
    var l = Math.exp(-lambda);
    var k = 0;
    var p = 1;
    for (var i = 0; i < numSamples; i++){
        k = 0;
        p = 1;
        while(p>l){
            k++;
            p = p*Math.random();
        }
        output.push(k-1);
    }
    return output;
}

function showArrayCanvas(arr){
    
    var scale = 1;
    var arrMax = 10//Math.max(...arr.data);
    var arrMin = 0//Math.min(...arr.data);
    var arrRange = arrMax - arrMin;

    var canvas = document.querySelector("canvas");
    var context = canvas.getContext("2d");

    context.lineWidth = 0;
    context.strokeStyle = 'none'

    var m = arr.m;
    var n = arr.n;
    
    // scale the data array to the canvas
    if( canvas.height == canvas.width ){
        scale = canvas.width / arr.m
    }
    else
        var scale = 2;

    for (var i=0; i<m; i++){
        for (var j=0; j<n; j++){ 
            var v = Math.round( 255*(arr.get(i,j)-arrMin)/arrRange );
            context.fillStyle = `rgb(${v},${v},${v})`;
            context.fillRect(i*scale, j*scale, scale, scale);
        }
    }
}


function generateRandomArray(m,n){
    var m = new Arr2d(m,n,0).mapData(d=>poissonSample(4));
    return m
}

// Standard Normal variate using Box-Muller transform.
function randBM() {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

// helper function to make arrays of normally distributed random values
function randnSample(nSamples = 1, mu = 0, sigma = 1) {
    var output = [];
    output.length = nSamples;
    for (i = 0; i < nSamples; i++){
        output[i] = randBM() * sigma + mu;
    }
    return output;
}


//function to make ones

function Arr2d(n,m,val){
    
    var self = this;
    self.n = n;
    self.m = m;
    self.val = val;
    self.data = [];
    self.data.length = n*m;
    self.data.fill(val);
    self.length = self.data.length;
    
    self.get = function(i,j){
        return self.data[i*n + j]
    }

    self.mapData = function(f){
        self.data = self.data.map(f);
        return self
    }

    self.randomizeData = function(){
        self.data = randnSample(numSamples = self.n*self.m, mu = 2, sigma = 2)
    }
}

// function to add a blob to an array

d3.select('body').append('canvas').attr('width','128 px').attr('height','128 px').style('border','3px solid red')

var start = null;
var delta = 0
var h = 128;
var r = generateRandomArray(h,h);

function startAnimation(timestamp) {
  if (!start) start = timestamp;
  start = timestamp;
  window.requestAnimationFrame(animate);
}

function animate(){
    delta++;
    if (delta > 0){
        delta = 0;
        r.randomizeData()
        console.log(delta)
        showArrayCanvas(r);
    }
    window.requestAnimationFrame(animate);
}

startAnimation()