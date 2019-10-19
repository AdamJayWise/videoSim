console.log('videoSim.js')

// global variables!
var objPos = [0,0]; // x,y position of the feature in pixels
var featureBrightness = 10; // peak brightness of the feature in photons / counts / whatever
var speedMultiplier = 0.5; // fudge factor for random walk speed of the feature

// overall idea...
// I want one or more camera objects, each one has an image object which it displays
// the camera has a height and width, and controls
// let me start by creating a way to display the image, and show an animated image of a
// HxW screen with poisson sampling

// ok now for the next feature - a switch that will change between "fast imaging", and "long exposures"
// the "fast imaging" mode will give a qualitative idea for real-time imaging
// the "slow imaging / long exposure" mode will give 
// maybe a spectra mode as well, which uses a set height and calculates the spectrum

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
    
    //default parameters
    console.log('setting parameters');
    self.name = 'Generic Camera'
    self.displayScale = 3; // scale factor for displaying image on screen
    self.xPixels = 64; // number of pixels in x dimension
    self.yPixels = 64; // number of pixels in y dimension
    self.xPixelSize = 13; // x pixel size in microns
    self.yPixelSize = 13; // y pixel size in microns
    
    self.readNoise = 2; // rms read noise in electrons
    self.readNoiseSlow = 1; // rms read noise for slow readout
    self.readNoiseFast = 3; // rms read noise for slowest readout
    
    self.CIC = 0; // CIC in events / pixel / frame
    self.offset = 2; // offset in counts for the fake ADC
    self.featureBrightness = 5; // brightness of image feature
    self.featureSigma = 10; // FWHM of image feature
    self.QE = 1; // camera quantum efficiency (QE), range from 0 to 1
    
    self.frameRateHz = 10; // camera framerate in relative units
    self.frameRateHzFast = 20; // camera framerate for fast mode
    self.frameRateHzSlow = 5; // camera framerate for slow mode

    self.darkCurrent = 0.001; // camera dark current in e/pix/sec

    self.emGain = 0; // em gain flag
    self.model = models['BV']; // what chip variant
    self.wavelength = 500; // wavelength of light incident on camera, in nm
    self.mode = 'fast'; // fast or slow imaging mode
    self.exposureTime = 30; // exposure time in seconds

    if (paramObj.containerDivID){
        self.div = d3.select('#' + paramObj.containerDivID).append('div').attr('class','cameraDiv');
    }
    else {
        self.div = d3.select('body').append('div').attr('class','cameraDiv');
    }

    if (paramObj){
        Object.keys(paramObj).forEach(function(k){self[k]=paramObj[k]})
    }
    
    
    
    // add a canvas to the document to display this data
    self.canvas  = self.div
                    .append('canvas')
                    .attr('width', self.displayScale * self.xPixels + ' px')
                    .attr('height', self.displayScale * self.yPixels + ' px')
                    .style('border','3px solid black')

    
    self.div.append('p')
        .style('margin','0')
        .html(self.displayName)
        .attr('class','windowLabel')
        .attr('class','nameLabel')
    
    var readNoiseLabel = self.div.append('p')
        .style('margin','0')
        .html(self.readNoise + ' e<sup>-</sup> Read Noise')
        .attr('class','windowLabel')
    
    var QElabel = self.div.append('p')
        .style('margin','0')
        .html(Math.round(self.QE*100) + '% QE')
        .attr('class','windowLabel')
    
    self.updateQELabel = function(n){
        QElabel.html(Math.round(self.QE*100) + '% QE')
    }

    self.updateReadNoiseLabel = function(n){
        readNoiseLabel.html(self.readNoise + ' e<sup>-</sup> Read Noise')
    }


    self.simImage = new Arr2d(n = self.xPixels, m = self.yPixels, val = 0)

    this.updateData = function(){

        self.QE = self.model.getQE(self.wavelength);
        if(!self.QE){
            self.QE = 0;
        }
        self.updateQELabel(self.QE);
        

        // start with a simple background of read noise, offset by 2 counts
        self.simImage.data = randnSample(numSamples = self.xPixels * self.yPixels, mu = self.offset, sigma = self.readNoise);

        // I'd like to add a feature which efficienty adds CIC noise.  I'd rather not roll each pixel
        // separately, but rather generate a random number of points based on the self.CIC property
        var nCicPoints = Math.round( poissonSample(self.xPixels * self.yPixels * self.CIC) );

        for (var i = 0; i < nCicPoints; i++){
            var xCoord = Math.floor( Math.random() * self.xPixels );
            var yCoord = Math.floor( Math.random() * self.yPixels );
            self.simImage.set(xCoord, yCoord, self.offset + (1+5*Math.random()));
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
            var fSigma = self.featureSigma; //feature sigma
            var q = 0;
            for (var i = 0; i < self.xPixels; i++){
                for (var j = 0 ; j < self.yPixels; j++){
                    var r = Math.sqrt( (j - offsetY + objPos[0])**2 + (i - offsetX + objPos[1])**2 )
                    var amplitude = Math.exp( -1 * (r**2) / fSigma );
                    
                    var cutoff = 0.01;
                    if(amplitude*featureBrightness >= cutoff){
                        if (self.emGain == 0){
                            q = poissonSample( self.QE * featureBrightness * amplitude, 1)[0];
                        }

                        if (self.emGain == 1){
                            q = poissonSample( self.QE * featureBrightness * amplitude, 1)[0];
                            q = poissonSample( q , 1)[0];
                        }

                        // add dark current if in slow mode


                        if (q<0){
                            console.log(amplitude, q);
                            throw new Error("Something went badly wrong!")
                        }
                    }

                    // 
                    if(amplitude < cutoff){
                          q = self.QE * featureBrightness * amplitude;
                    }
                        
                    var darkCounts = 0;
                    
                    if (self.mode == 'Slow'){
                        darkCounts =  poissonSample(self.darkCurrent * self.exposureTime, 1)[0]
                    }

                    self.simImage.set(i,j, q + darkCounts + self.simImage.get(i,j) );
                }
            }
        }
        // -------- end add gauss

    }

    this.draw = function(){
        var arr = self.simImage;
        var scale = 1;


        var arrMax = self.offset + 2*self.readNoise + self.QE * self.featureBrightness + 0.5 * Math.sqrt(self.QE * self.featureBrightness );//Math.max(...arr.data);
        var arrMin = self.offset - 2*self.readNoise;
        var arrRange = arrMax - arrMin;

        // if in slow imaging mode, include the dark current in the color scale calculations
        if (self.mode == 'Slow'){
            var darkCounts = self.darkCurrent * self.exposureTime;
            arrMax = self.offset + 2*self.readNoise + self.QE * self.featureBrightness + 0.5 * Math.sqrt(self.QE * self.featureBrightness ) + darkCounts;//Math.max(...arr.data);
            arrMin = self.offset - 2*self.readNoise - Math.sqrt(darkCounts) + darkCounts;
            arrRange = arrMax - arrMin;
        }


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

// initialize an instrument panel
function initializeControls(){

    featureBrightnessConfig = {
        controlName : 'featureBrightness',
        labelText : 'Signal Peak, Photons',
        parameter : 'featureBrightness',
        min : 1,
        max : 100,
        defaultValue: 3
    }

    featureWidthConfig = {
        controlName : 'featureWidth',
        labelText : 'Feature FWHM, Px',
        parameter : 'featureSigma',
        min : 1,
        max : 30,
        defaultValue : 5
    }

    wavelengthConfig = {
        controlName : 'wavelength',
        labelText : 'Wavelength, nm',
        parameter : 'wavelength',
        min : 300,
        max : 1000,
        defaultValue : 500
    }

    var createSlider = function(configObj){
        var sliderDiv = d3.select('#mainControls')
        .append('div')
        .attr('class','container')
        .style('margin','5px 0 5px 0')
        .attr('id', configObj.controlName+'sliderDiv')
        .text(configObj.labelText + ' - ')

        var sliderLabel = sliderDiv.append('span').style('font-weight','bold').style('margin','0 5px 0 5px')
        sliderLabel.text(configObj.defaultValue)

        var slider = sliderDiv
            .append('input')
            .attr('type','range')
            .attr('min', configObj.min)
            .attr('max', configObj.max)
            .attr('value', configObj.defaultValue)
            .attr('step', 1)
            .style('width','300px')
            .attr('class','slider')
        

        
        var sliderCallBackFactory = function(configObj){
            var f = function(){
                self = this;
                cameras.forEach(x => x[configObj['parameter']] = Number(self.value));
                sliderLabel.text(self.value);
                cameras.forEach(x=>x.updateData());
                cameras.forEach(x=>x.draw());
            }
            return f;
        }
        slider.on('input', sliderCallBackFactory(configObj));
        return slider;
    }

    createSlider(featureBrightnessConfig);
    createSlider(featureWidthConfig);
    createSlider(wavelengthConfig);

    var checkBoxDiv = d3.select('#mainControls')
    .append('div')
    .attr('class','container')
    .style('margin','5px 0 5px 0')
    .attr('id', 'checkBoxDiv')
  
checkBoxDiv
    .append('label')
    .text("Fast Mode - Max Frame Rate")
    .append('input')
    .attr('type','radio')
    .attr('name','mode')
    .attr('value','Fast')
    .attr('id','Fast')
    .attr('checked','true')

checkBoxDiv
    .append('label')
    .text("Slow Mode - 30 Second Exposure")
    .append('input')
    .attr('type','radio')
    .attr('name','mode')
    .attr('value','Slow')
    .attr('id','Slow')

d3.selectAll('[type = radio]').on('change', function(){
     var self = this;
     cameras.forEach(x=>x.mode = this.value);

     cameras.forEach( function(cam){
         cam.readNoise = cam['readNoise'+self.value];
         cam.frameRateHz = cam['frameRateHz'+self.value];
         console.log(self.value);
         cam.updateReadNoiseLabel();
         cam.updateData();
         cam.draw();
     } );

     // update the explainer box
     if (self.value == 'Fast'){
        d3.select('.explainerBox .content').html(`Above are windows simulating a sub-area of each camera, acquiring 16-bit image
        data as quickly as possible.  Each window shows what a small Gaussian spot focused on the camera would look like, with the size
        of the spot scaled to match the cameras pixel size.  Signal peak is the number of photons per pixel at the brightest part
        of the spot.  Frame rates are relative.`)
     }

     if (self.value == 'Slow'){
        d3.select('.explainerBox .content').html(`Above are windows simulating a sub-area of each camera, acquiring 16-bit image
        data with a 30-second exposure.  Each window shows what a small Gaussian spot focused on the camera would look like, with the size
        of the spot scaled to match the cameras pixel size.  Signal peak is the number of photons per pixel at the brightest part
        of the spot.  Frame rates are relative.`)
     }

     
    })
    
}

// timing variables
var start = null;
var delta = 0;

// add some sample cameras to the screen
var cameras = [];

// show different cameras
if (1){

    d3.select('#mainContainer')
        .append('div')
        .attr('id','subContainer')
        .style('display','flex')

    var idus420 = {
        readNoise : 10,
        readNoiseFast: 10,
        readNoiseSlow: 4,
        QE : 0.95,
        frameRateHz : 0.34,
        frameRateHzFast: 0.34,
        frameRateHzSlow: 1,    
        darkCurrent : 0.008,    
        containerDivID : 'subContainer',
        displayName : 'Idus 420 BEX2-DD'}
    cameras.push(new Camera(idus420))

    var newton971 = {
        readNoise : 0.04,
        readNoiseFast : 0.04,
        readNoiseSlow : 0.0028,
        QE : 0.95,
        frameRateHz : 10,
        frameRateHzFast : 10,
        frameRateHzSlow : 1,
        darkCurrent : 0.00020,
        containerDivID : 'subContainer',
        emGain : 1, 
        displayName: 'Newton 971 BV'}
    cameras.push(new Camera(newton971))

    var iXon888 = {
        readNoise : 0.13,
        readNoiseFast: 0.13,
        readNoiseSlow: 0.012,
        QE : 0.95,
        CIC : 0.005,
        darkCurrent : 0.00011,
        frameRateHz : 26,
        frameRateHzFast: 26,
        frameRateHzSlow: 1,
        emGain : 1,
       containerDivID : 'subContainer',
       model : models['BV'],
       displayName: 'iXon Ultra 888 BV'}
    cameras.push(new Camera(iXon888))

    var newcam = {
        readNoise : 1.6,
        readNoiseFast : 1.6,
        readNoiseSlow : 1.2,
        QE : 0.6,
        CIC : 0,
        frameRateHz : 75,
        frameRateHzFast : 75,
        frameRateHzSlow : 1,
        darkCurrent : 0.019,
       containerDivID : 'subContainer',
       model : models['Zyla 5.5'],
       displayName: 'Zyla 5.5 10-Tap'}
    cameras.push(new Camera(newcam))

    var newcam = {
        readNoise : 1.3,
        readNoiseFast : 1.3,
        readNoiseSlow : 1.1 ,
        QE : 0.83,
        CIC : 0,
        frameRateHz : 101,
        frameRateHzFast : 101,
        frameRateHzSlow : 1,
        darkCurrent : 0.019,
       containerDivID : 'subContainer',
       model : models['Zyla 4.2 PLUS'],
       displayName: 'Zyla 4.2+ 10-Tap'}
    cameras.push(new Camera(newcam))

    var newCam = {
        readNoise : 1.6,
        readNoiseFast : 1.6,
        readNoiseSlow : 1.6,
        QE : 0.95,
        CIC : 0,
        frameRateHz : 24,
        frameRateHzFast : 24,
        frameRateHzSlow : 1,
        darkCurrent : 0.2,
       containerDivID : 'subContainer',
       model : models['Sona'],
       displayName: 'Sona 4.2'}
    cameras.push(new Camera(newCam))

    // ikon m 934
    var newCam = {
        readNoise : 11.6,
        readNoiseFast : 11.6,
        readNoiseSlow : 2.9,
        darkCurrent : 0.00012,
        QE : 0.95,
        CIC : 0,
        frameRateHz : 2.6,
        frameRateHzFast : 2.6,
        frameRateHzSlow : 1 ,
       containerDivID : 'subContainer',
       model : models['BEX2-DD'],
       displayName: 'iKon-M 934 BEX2-DD'}
    cameras.push(new Camera(newCam))
}

// set up a matrix of parameters
if (0){
    var numRows = 3;
    var numCols = 4;

    for (var i = 0; i < numRows; i++){
        d3.select('#mainContainer')
            .append('div')
            .attr('id','subContainer'+i)
            .style('display','flex')
            .attr('class','subContainer')
    }

    for (var i=0; i<numRows; i++){
        for (var j = 0; j < numCols; j++){
            cameras.push(new Camera( {'readNoise':i*1, 'QE': 1 - j * 0.2, 'containerDivID' : 'subContainer'+i} ));
        }
    }
}
 
function startAnimation(timestamp) {
  if (!start) start = timestamp;
  start = timestamp;
  window.requestAnimationFrame(animate);
}

function modRange(a, lowerLim, upperLim){
    if (a > upperLim){
        return lowerLim;
    }
    if (a < lowerLim ){
        return upperLim;
    }
    return a;
}


// animate cameras
function animate(){
    var frameRateMultiplier = Math.min(...cameras.map(x=>(1/x.frameRateHz)));
    delta++;
    if (1){
        //delta = 0;
        objPos[0] = modRange( objPos[0] + speedMultiplier * (Math.random() - 0.5), -32, 32);
        objPos[1] = modRange( objPos[1] + speedMultiplier * (Math.random() - 0.5), -32, 32);

        function testFrameRate(cam){
            if ( (delta % Math.round(1/cam.frameRateHz / frameRateMultiplier) == 0) || delta == 1 ){
                cam.updateData();
                cam.draw();
            }
        }

        //cameras.forEach(x=>x.updateData());
        //cameras.forEach(x=>x.draw());
        cameras.forEach(testFrameRate)
    }
    window.requestAnimationFrame(animate);
}

// set up controls and start the animation process
initializeControls();
startAnimation();