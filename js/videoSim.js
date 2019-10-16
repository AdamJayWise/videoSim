console.log('videoSim.js')


var objPos = [0,0];

// overall idea...
// I want one or more camera objects, each one has an image object which it displays
// the camera has a height and width, and controls
// let me start by creating a way to display the image, and show an animated image of a
// HxW screen with poisson sampling


// Knuth low-lambda Poisson random sample generator
function poissonSample( lambda = 1, numSamples = 1 ){
    var output = []

    // if lambda = 0, return array of zeros
    if (lambda <= 0 || isNaN(lambda)){
        output.length = numSamples;
        output.fill(0)
        return output
    }

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
        output.push( Math.max(k-1,0));
    }
    return output;
}

function showArrayCanvas(arr){
    
    
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
function randnSample(nSamples = 1, mu = 0, sigma = 10) {
    var output = [];
    output.length = nSamples;
    for (i = 0; i < nSamples; i++){
        output[i] = (randBM() * sigma) + mu;
    }
    return output;
}


function Camera(paramObj){
    var self = this;
    if (!paramObj){
        console.log('setting parameters');
        self.name = 'Generic Camera'
        self.displayScale = 4; // scale factor for displaying image on screen
        self.xPixels = 40; // number of pixels in x dimension
        self.yPixels = 40; // number of pixels in y dimension
        self.xPixelSize = 13; // x pixel size in microns
        self.yPixelSize = 13; // y pixel size in microns
        self.readNoise = 2; // rms read noise in electrons
        self.CIC = 0; // CIC in events / pixel / frame
        self.offset = 2; // offset in counts for the fake ADC
        self.featureBrightness = 5; // brightness of image feature
    }
    
    self.div = d3.select('body').append('div')
    // add a canvas to the document to display this data
    self.canvas  = self.div
                    .append('canvas')
                    .attr('width', self.displayScale * self.xPixels + ' px')
                    .attr('height', self.displayScale * self.yPixels + ' px')
                    .style('border','3px solid black')

    
    self.div.append('p').style('margin','0 0 10px 0').text('Read Noise: ' + self.readNoise)


    self.simImage = new Arr2d(n = self.xPixels, m = self.yPixels, val = 0)

    this.updateData = function(){

        // start with a simple background of read noise, offset by 2 counts
        self.simImage.data = randnSample(numSamples = self.xPixels * self.yPixels, mu = self.offset, sigma = self.readNoise);

        // I'd like to add a feature which efficienty adds CIC noise.  I'd rather not roll each pixel
        // separately, but rather generate a random number of points based on the self.CIC property
        var nCicPoints = Math.round( poissonSample(self.xPixels * self.yPixels * self.CIC) );

        for (var i = 0; i < nCicPoints; i++){
            var xCoord = Math.floor( Math.random() * self.xPixels );
            var yCoord = Math.floor( Math.random() * self.yPixels );
            self.simImage.set(xCoord, yCoord, self.offset + 6*self.readNoise);
        }

        // right now, this adds a square feature to the random readout noise data
        if (0){
            var offsetX = Math.floor(self.xPixelSize * self.displayScale / 2);
            var offsetY = Math.floor(self.xPixelSize * self.displayScale / 2);
            var featureSize = 15;
            var featureBrightness = 3;
            var q;
            for (var i = 0 + offsetX; i < (featureSize + offsetX); i++){
                for (var j = 0 + offsetY; j < (featureSize + offsetY); j++){
                    q = poissonSample(featureBrightness ,1)[0];
                    self.simImage.set(i,j, q + self.simImage.get(i,j) );
                }
            }
        }
        // -------- end add square

        // right now, this adds a gauss feature to the random readout noise data
        if (1){
            var offsetX = Math.floor(self.xPixels/2);
            var offsetY = Math.floor(self.yPixels/2)
            var featureSize = 15;
            var featureBrightness = self.featureBrightness  ;
            var fSigma = 9; //feature sigma
            var q = 0;
            for (var i = 0; i < self.xPixels; i++){
                for (var j = 0 ; j < self.yPixels; j++){
                    var r = Math.sqrt( (j - offsetY + objPos[0])**2 + (i - offsetX + objPos[1])**2 )
                    var amplitude = Math.exp( -1 * (r**2) / fSigma );
                    
                    var cutoff = 0;
                    if(amplitude >= cutoff){
                        q = poissonSample(featureBrightness * amplitude, 1)[0];
                        if (q<0){
                            console.log(amplitude, q);
                            throw new Error("Something went badly wrong!")
                        }
                    }
                    //console.log(q)
                    if(amplitude < cutoff){
                          q = featureBrightness*amplitude;
                    }
                        
                    self.simImage.set(i,j, q + self.simImage.get(i,j) );
                }
            }
        }
        // -------- end add gauss

    }

    this.draw = function(){
        var arr = self.simImage;
        var scale = 1;
        var arrMax = self.offset + 2*self.readNoise + self.featureBrightness;//Math.max(...arr.data);
        var arrMin = self.offset - 2*self.readNoise;//Math.min(...arr.data);
        var arrRange = arrMax - arrMin;

        var canvas = this.canvas._groups[0][0];
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


}

//2d array object to hold data

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
        return self.data[i*n + j];
    }

    self.set = function(i,j, v){
        self.data[i*n + j] = v;
    }

    self.mapData = function(f){
        self.data = self.data.map(f);
        return self
    }

    self.randomizeData = function(){
        self.data = randnSample(numSamples = self.n*self.m, mu = 2, sigma = 2)
    }
}



// timing variables
var start = null;
var delta = 0

// add some sample cameras to the screen
var cameras = [];

for (var i=0; i<6; i++){
    cameras.push(new Camera());
    cameras[i].readNoise = i*1;
}

function startAnimation(timestamp) {
  if (!start) start = timestamp;
  start = timestamp;
  window.requestAnimationFrame(animate);
}

function animate(){
    delta++;
    if (delta > 5){
        delta = 0;
        objPos[0] = (objPos[0] + Math.random() - 0.5) % 64;
        objPos[1] = (objPos[1] + Math.random() - 0.5) % 64;

        cameras.forEach(x=>x.updateData());
        cameras.forEach(x=>x.draw());
    }
    window.requestAnimationFrame(animate);
}

startAnimation()