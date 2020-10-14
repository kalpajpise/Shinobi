const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
// ffmpeg.setFfmpegPath(ffmpegPath)
var stat , startTime, endTime, size;

module.exports = function(s,config,lang){
    console.log("Heelo World")


    //Function to Ttom Video of 10 sec
    s.trimVideo = function(e,k,callback) {
        
        trim = "trim-"
        videoDir = k.dir
        videoFile = k.file
        console.log(k.dir,k.file,fs.existsSync(k.dir + k.file));

        if(fs.existsSync(k.dir + k.file)){


            ffmpeg(videoDir + videoFile)
            .setStartTime('00:00:00')
            .setDuration('10')
            .output(videoDir + trim + videoFile)
            .on('end', function(err) {
                if(!err) { console.log('conversion Done') }
            })
            .on('error', function(err){
                console.log('error: ', err)
            }).run()

            setTimeout( () => {
                console.log("stat file ---->" , videoDir + trim + videoFile);
                stat = fs.statSync(videoDir + trim + videoFile)
                startTime = stat.atime
                endTime = stat.mtime
                size = stat.size

                console.log(startTime,endTime,size);

                s.knexQuery({
                    action: "insert",
                    table: "Videos",
                    insert: {
                        ke: e.ke,
                        mid: e.mid,
                        time: startTime,
                        ext: e.ext,
                        status: 1,
                        details: s.s(k.details),
                        size: size,
                        end: endTime,
                    }
                },(err) => {
                    if(callback)callback(err)
                    fs.chmod(trim+videoDir+videoFile,0o777,function(err){
                    })
                })

                s.insertCompletedVideoExtensions.forEach(function(extender){
                    extender(e,{
                        dir : videoDir,
                        filename : trim + videoFile,
                        startTime : startTime,
                        endTime : endTime,
                        filesize : size,
                        filesizeMB : parseFloat((size/1048576).toFixed(2))

                    })
                })

            },1500)



        }      
        // console.log("startTime");
        // console.log(startTime,endTime,size);

    }
}



// if (fs.existsSync( videoDir  + videoFile )){

//     ffmpeg(videoDir + videoFile)
//     .setStartTime('00:00:00')
//     .setDuration('10')
//     .output(videoDir + trim + videoFile)
//     .on('end', function(err) {
//         if(!err) { console.log('conversion Done') }
//     })
//     .on('error', function(err){
//         console.log('error: ', err)
//     }).run()

//     setTimeout( () => {
//         stat = fs.statSync(videoDir + videoFile)
//         startTime = stat.atime
//         endTime = stat.mtime
//         size = stat.size
//     },500)
// }
// else if( fs.existsSync( k.dir +  k.file ) ){
//     console.log("should go");

//     ffmpeg(videoDir + videoFile)
//     .setStartTime('00:00:00')
//     .setDuration('10')
//     .output(videoDir + trim + videoFile)
//     .on('end', function(err) {
//         if(!err) { console.log('conversion Done') }
//     })
//     .on('error', function(err){
//         console.log('error: ', err)
//     }).run()

//     setTimeout( () => {
//         stat = fs.statSync(videoDir + trim +videoFile)
//         startTime = stat.atime
//         endTime = stat.mtime
//         size = stat.size

//         console.log(k.startTime , k.endTime,);
//         console.log(startTime,endTime,size);
//     },300)

//     // startTime = new Date(s.nameToTime(videoFile))
//     // endTime = new Date(stat.mtime)

// }