console.log('videoSim.js - Adam Wise 2019')

// global variables, I love them
var objPos = [0,0]; // x,y position of the feature in pixels

var speedMultiplier = 0.5; // fudge factor for random walk speed of the feature

var app = {
 'mode' : 'Fast', // fast or slow imaging mode
 'exposureTime' : 30, // exposure time in seconds
 'wavelength' : 500, // wavelength of light incident on camera, in nm
 'featureBrightness' : 10, // peak brightness of the feature in photons / counts / whatever
 'activeDataSet' : 0 // which data set is currently active
}
// overall idea...
// I want one or more camera objects, each one has an image object which it displays
// the camera has a height and width, and controls
// let me start by creating a way to display the image, and show an animated image of a
// HxW screen with poisson sampling

// ok now for the next feature - a switch that will change between "fast imaging", and "long exposures"
// the "fast imaging" mode will give a qualitative idea for real-time imaging
// the "slow imaging / long exposure" mode will give 
// maybe a spectra mode as well, which uses a set height and calculates the spectrum

// ok - now, how to add a changeable 'resolution'

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
    self.xPixels = 64; // number of pixels in x dimension
    self.yPixels = 64; // number of pixels in y dimension
    self.xPixelSize = 13; // x pixel size in microns
    self.yPixelSize = 13; // y pixel size in microns
    
    self.readNoise = 2; // rms read noise in electrons
    self.readNoiseSlow = 1; // rms read noise for slow readout
    self.readNoiseFast = 3; // rms read noise for slowest readout
    
    self.CIC = 0; // CIC in events / pixel / frame
    self.offset = 2; // offset in counts for the fake ADC
    self.featureSigma = 10; // FWHM of image feature
    self.QE = 1; // camera quantum efficiency (QE), range from 0 to 1
    
    self.frameRateHz = 10; // camera framerate in relative units
    self.frameRateHzFast = 20; // camera framerate for fast mode
    self.frameRateHzSlow = 5; // camera framerate for slow mode

    self.darkCurrent = 0.001; // camera dark current in e/pix/sec
    self.emGain = 0; // em gain flag
    self.model = models['BV']; // what chip variant


    self.pixelDecimation = 8; // factor to reduce resolution to ease display on a monitor
    self.hasRealImage = true; // should this camera have another real image available?

    if (paramObj){
        self.div = d3.select('#' + paramObj.containerDivID).append('div').attr('class','cameraDiv');
    }
    else {
        self.div = d3.select('body').append('div').attr('class','cameraDiv');
    }


    if (paramObj){
        Object.keys(paramObj).forEach(function(k){self[k]=paramObj[k]})
    }
    
    self.xPixels = Math.round(self.xPixels / self.pixelDecimation);
    self.yPixels = Math.round(self.yPixels / self.pixelDecimation)
    
    // add a canvas to the document to display this data
    var displayScaleFactor = self.xPixelSize/6.5;

    self.canvas  = self.div
                    .append('div')
                    .attr('class','canvasHolder')
                    .style('border','3 px solid black')
                    .style('padding-top',  0.5 * self.yPixels * (displayScaleFactor - 1) + 'px')
                    .style('padding-bottom',  0.5 * self.yPixels * (displayScaleFactor - 1) + 'px')
                    .style('width', self.yPixels * displayScaleFactor + 'px')
                    .append('canvas')
                    .attr('width', self.xPixels + ' px')
                    .attr('height', self.yPixels + ' px')
                    .style('transform','scale(' + displayScaleFactor + ')')
                    .style('transform-origin','center left')


                    
                    // so original height is yPixels, new width is yPixels * displayScaleFactor
                    // so top/bottom margin of 1/2 of the difference (ypixels*displayScaleFactor - ypixels)
                    // or 0.5 * yPixels * (displayScaleFactor - 1)

                    
    function startDrag(){
        var thisDiv = d3.select(this)
        thisDiv.style('position','fixed')       
    }

    function dragging(){
        var currentTop = Number(d3.select(this).style('top').slice(0,-2))
        var currentLeft = Number(d3.select(this).style('left').slice(0,-2))
        d3.select(this).style('left', currentLeft + d3.event.dx + 'px')
        d3.select(this).style('top',currentTop + d3.event.dy + 'px')
        console.log(currentTop)
    }

    self.div.call(d3.drag().on("start", startDrag).on('drag',dragging));


    var labelContainer = self.div.append('div').attr('class','labelContainer')
    
    labelContainer.append('p')
        .style('margin','0')
        .html(self.displayName)
        .attr('class','windowLabel')
        .attr('class','nameLabel')
    
    var readNoiseLabel = labelContainer.append('p')
        .style('margin','0')
        .html(self.readNoise + ' e<sup>-</sup> Read Noise')
        .attr('class','windowLabel')
    
    var QElabel = labelContainer.append('p')
        .style('margin','0')
        .html(Math.round(self.QE*100) + '% QE')
        .attr('class','windowLabel')

    var FPSlabel = labelContainer.append('p')
        .style('margin','0')
        .html(self.frameRateHz + ' FPS')
        .attr('class','windowLabel')
    
    self.updateQELabel = function(n){
        QElabel.html(Math.round(self.QE*100) + '% QE')
    }

    self.updateReadNoiseLabel = function(n){
        if (self.readNoise < 1){
            readNoiseLabel.html('<1 e<sup>-</sup> Read Noise')
            return
        }
        readNoiseLabel.html(self.readNoise + ' e<sup>-</sup> Read Noise')
    }

    self.updateFPSLabel = function(n){
        FPSlabel.html(self.frameRateHz + ' FPS')
    }

    // create image data
    self.simImage = new Arr2d(self.xPixels, self.yPixels, 0)

    if (self.hasRealImage & !self.imageSource){
        var v = 0;
        var w = 0;
        self.realImage = new Arr2d(self.xPixels, self.yPixels, 0);
        for (var i = 0; i < self.xPixels; i++){
            for (var j = 0; j < self.yPixels; j++){
               v = ((Math.sin(0 + ( (i) * self.xPixelSize) / 42.5))+1) / 2;  
               w = ((Math.sin(0 + ( (j) * self.yPixelSize) / 42.5))+1) / 2;
               self.realImage.set(i,j, v*w);
            }
        }
        
    }

    if (self.shortName){
        self.realImage = new Arr2d(self.xPixels, self.yPixels, 0);
        self.realImage.data = jsonImage[self.shortName + app.activeDataSet];
    }

    this.updateData = function(){

        self.QE = self.model.getQE(app.wavelength);
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



        // generate data from 'real' image

        if(self.hasRealImage){
            var q;
            var areaFrac = (self.xPixelSize * self.yPixelSize) / (16*16);
            for (var i = 0; i < self.xPixels; i++){
                for (var j = 0; j < self.yPixels; j++){

                    q = poissonSample(app.featureBrightness * self.QE * areaFrac * self.realImage.get(i,j) , 1)[0];
                    self.simImage.set(i,j, q + self.simImage.get(i,j));
                }
            }
            return 0;
        }

        // right now, this adds a gauss feature to the random readout noise data
        if (0){
            var offsetX = Math.floor(self.xPixels/2);
            var offsetY = Math.floor(self.yPixels/2)
            var featureSize = 15;
            var featureBrightness = app.featureBrightness  ;
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
                    
                    if (app.mode == 'Slow'){
                        darkCounts =  poissonSample(self.darkCurrent * app.exposureTime, 1)[0]
                    }

                    self.simImage.set(i,j, q + darkCounts + self.simImage.get(i,j) );
                }
            }
        }
        // -------- end add gauss

    }

    this.draw = function(){
        var arr = self.simImage;

        var areaFrac = 1;
        if (self.hasRealImage){
            areaFrac = (self.xPixelSize * self.yPixelSize) / (16*16);
        } 
        var arrMax = self.offset + 2*self.readNoise + self.QE  * app.featureBrightness * areaFrac + 0.5 * Math.sqrt(self.QE * areaFrac * app.featureBrightness );//Math.max(...arr.data);
        var arrMin = self.offset - 2*self.readNoise;
        var arrRange = arrMax - arrMin;

        // if in slow imaging mode, include the dark current in the color scale calculations
        if (app.mode == 'Slow'){
            var darkCounts = self.darkCurrent * app.exposureTime;
            arrMax = self.offset + 2*self.readNoise + self.QE * areaFrac * app.featureBrightness + 0.5 * Math.sqrt(self.QE * areaFrac * app.featureBrightness ) + darkCounts;//Math.max(...arr.data);
            arrMin = self.offset - 2*self.readNoise - Math.sqrt(darkCounts) + darkCounts;
            arrRange = arrMax - arrMin;
        }

        var canvas = this.canvas._groups[0][0];
        var context = canvas.getContext("2d");
        var scale = self.xPixelSize * self.displayScale;

        if (self.drawStyle){
            context.lineWidth = 0;
            context.strokeStyle = 'none'

            for (var i = 0; i < self.xPixels; i++){
                for (var j = 0; j < self.yPixels; j++){ 
                    var v = Math.round( 255*(arr.get(i,j)-arrMin)/arrRange );
                    context.fillStyle = `rgb(${v},${v},${v})`;
                    context.fillRect(i * scale, j * scale, scale, scale);
                }
            }
        }

        if (1){
            var img = new ImageData(self.xPixels, self.yPixels);
            for (var i = 0; i<img.data.length; i+=4){
                var k = Math.floor(i/4)%self.xPixels;
                var l = Math.floor ( Math.floor(i/4) / self.xPixels);
                var v = Math.round( 255*(arr.data[i/4]-arrMin)/arrRange );
                img.data[i+0] = v;
                img.data[i+1] = v;
                img.data[i+2] = v;
                img.data[i+3] = 255;
            }
            context.putImageData(img,0,0);
        }
    }

    this.remove = function(){
        self.div.remove();
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
        return self.data[j*n + i];
    }

    self.set = function(i,j, v){
        self.data[j*n + i] = v;
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
        .attr('class','sliderLabel')
        .attr('id', configObj.controlName+'sliderDiv')
        .text(configObj.labelText + ' - ')

        var sliderLabel = sliderDiv.append('span')
            .attr('class','sliderLabel')

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
                app[configObj['parameter']] = Number(self.value);
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
    //createSlider(featureWidthConfig);
    createSlider(wavelengthConfig);


    // add a drop down selector for data type
    d3.select('#mainControls').append('hr');
    var chooserDiv = d3.select('#mainControls').append('div').attr('class','sliderLabel');
    chooserDiv.append('span').text('Data Set : ');
    var dataSetChooser = chooserDiv.append('select').attr('name','dataSet');
    dataSetChooser.append('option').property('value','0').text('Cells 0')
    dataSetChooser.append('option').property('value','1').text('Cells 1')
    dataSetChooser.on('change', function(){
        var self = this;
        app.activeDataSet = this.value;
        cameras.forEach(function(cam){
            cam.realImage.data = jsonImage[cam.shortName + self.value];
            cam.updateData();
            cam.draw();
        });
        
    })


    d3.select('#mainControls').append('hr')

    var checkBoxDiv = d3.select('#mainControls')
    .append('div')
    .attr('class','sliderLabel')
    .attr('id', 'checkBoxDiv')
  
checkBoxDiv
    .append('label')
    .text("Fast Mode - Simulate Max Frame Rate")
    .append('input')
    .attr('type','radio')
    .attr('name','mode')
    .attr('value','Fast')
    .attr('id','Fast')
    .attr('checked','true')

checkBoxDiv
    .append('label')
    .text("Slow Mode - Simulate 30 Second Exposure")
    .append('input')
    .attr('type','radio')
    .attr('name','mode')
    .attr('value','Slow')
    .attr('id','Slow')

d3.selectAll('[type = radio]').on('change', function(){
     var self = this;
     app.mode = this.value;

     cameras.forEach( function(cam){
        cam.readNoise = cam['readNoise' + app.mode];
        cam.frameRateHz = cam['frameRateHz' + app.mode];
        console.log(app.mode);
        cam.updateReadNoiseLabel();
        cam.updateFPSLabel();
        cam.updateData();
        cam.draw();
    } );




     // update the explainer box
     if (self.value == 'Fast'){
        d3.select('.explainerBox .content').html(`Above are windows simulating each camera, acquiring 16-bit image
        data as quickly as possible.  Each window shows what you'd see if you swapped out each camera, without changing magnification or optics.
        "Signal peak" is equal to the number of photons hitting a 16um x 16um area at the brightest 99th percentile of the image.
        Frame rates are relative. Resolution of each camera has been reduced to 1/6th of real to ease display on your screen.`)
     }

     if (self.value == 'Slow'){
        d3.select('.explainerBox .content').html(`Above are windows simulating each camera, acquiring 16-bit image
        data with a 30s exposure time.  Each window shows what you'd see if you swapped out each camera, without changing 
        magnification or optics.
        "Signal peak" is equal to the number of photons hitting a 16um x 16um area at the brightest 99th percentile of the image. 
        Resolution of each camera has been reduced to 1/6th of real to ease display on your screen.`)
     }

     
    })

    // add checkboxes to the controls for each camera in camerasdefs
    var availableCameras = Object.keys(cameraDefs);
    for (var i in availableCameras){
        var checkDiv = d3.select("#mainControls").append('div')
        checkDiv.append('input')
            .attr("type","checkbox")
            .property('checked',false)
            .property('value',cameraDefs[availableCameras[i]]['shortName'])
            .property('key', availableCameras[i])
            .on('change', function(){
                var self = d3.select(this);
                console.log(d3.select(this).property('checked'));
                console.log(d3.select(this).property('value'));

                if (self.property('checked')){
                    cameras.push(new Camera(cameraDefs[self.property('key')]))
                    console.log(self.property('key'))

                    cameras.forEach( function(cam){
                        cam.readNoise = cam['readNoise' + app.mode];
                        cam.frameRateHz = cam['frameRateHz' + app.mode];
                        console.log(app.mode);
                        cam.updateReadNoiseLabel();
                        cam.updateFPSLabel();
                        cam.updateData();
                        cam.draw();
                    } );

                }

                if (!self.property('checked')){
                for (var q = 0; q < cameras.length; q++){
                    if (cameras[q].shortName == self.property('value')){
                        console.log('ting')
                        cameras[q].remove();
                        cameras.splice(q,q)
                        }
                    }
                }
            })
        checkDiv.append('span').text(cameraDefs[availableCameras[i]]['displayName'])
        }
    
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

    
    //cameras.push(new Camera( cameraDefs['idus420']));
    //cameras.push(new Camera( cameraDefs['newton971']));
    //cameras.push(new Camera( cameraDefs['iXon888'] ));
    //cameras.push(new Camera( cameraDefs['zyla55'] ));
    //cameras.push(new Camera( cameraDefs['sona42'] ));
    //cameras.push(new Camera( cameraDefs['iKonM934-BEX2-DD'] ));


    // ikon m 934

    
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

// generate a frame to beforehand to avoid weird moire
cameras.forEach( function(x){
    x.updateFPSLabel();
    x.updateQELabel();
    x.updateReadNoiseLabel();
    x.draw()
} )

startAnimation();