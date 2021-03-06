var os = require('os');
var exec = require('child_process').exec;
var request = require('request')
module.exports = function(s,config,lang){
    const moveLock = {}
    const ptzTimeoutsUntilResetToHome = {}
    const startMove = async function(options,callback){
        const device = s.group[options.ke].activeMonitors[options.id].onvifConnection
        if(!device){
            const response = await s.createOnvifDevice({
                ke: options.ke,
                id: options.id,
            })
            const device = s.group[options.ke].activeMonitors[options.id].onvifConnection
        }
        options.controlOptions.ProfileToken = device.current_profile.token
        s.runOnvifMethod({
            auth: {
                ke: options.ke,
                id: options.id,
                action: 'continuousMove',
                service: 'ptz',
            },
            options: options.controlOptions,
        },callback)
    }
    const stopMove = function(options,callback){
        const device = s.group[options.ke].activeMonitors[options.id].onvifConnection
        s.runOnvifMethod({
            auth: {
                ke: options.ke,
                id: options.id,
                action: 'stop',
                service: 'ptz',
            },
            options: {
                'PanTilt': true,
                'Zoom': true,
                ProfileToken: device.current_profile.token
            },
        },callback)
    }
    const moveOnvifCamera = function(options,callback){
        const monitorConfig = s.group[options.ke].rawMonitorConfigurations[options.id]
        const invertedVerticalAxis = monitorConfig.details.control_invert_y === '1'
        const controlUrlStopTimeout = parseInt(monitorConfig.details.control_url_stop_timeout) || 1000
        switch(options.direction){
            case'center':
                callback({type:'Center button inactive'})
            break;
            case'stopMove':
                callback({type:'Control Trigger Ended'})
                stopMove({
                    ke: options.ke,
                    id: options.id,
                },(response) => {

                })
            break;
            default:
            try{
                var controlOptions = {
                    Velocity : {}
                }
                if(options.axis){
                    options.axis.forEach((axis) => {
                        controlOptions.Velocity[axis.direction] = axis.amount
                    })
                }else{
                    var onvifDirections = {
                        "left": [-1.0,'x'],
                        "right": [1.0,'x'],
                        "down": [invertedVerticalAxis ? 1.0 : -1.0,'y'],
                        "up": [invertedVerticalAxis ? -1.0 : 1.0,'y'],
                        "zoom_in": [1.0,'z'],
                        "zoom_out": [-1.0,'z']
                    }
                    var direction = onvifDirections[options.direction]
                    controlOptions.Velocity[direction[1]] = direction[0]
                }
                (['x','y','z']).forEach(function(axis){
                    if(!controlOptions.Velocity[axis])
                        controlOptions.Velocity[axis] = 0
                })
                if(monitorConfig.details.control_stop === '1'){
                    startMove({
                        ke: options.ke,
                        id: options.id,
                        controlOptions: controlOptions
                    },(response) => {
                        if(response.ok){
                            if(controlUrlStopTimeout != '0'){
                                setTimeout(function(){
                                    stopMove({
                                        ke: options.ke,
                                        id: options.id,
                                    },(response) => {
                                        if(!response.ok){
                                            console.log(error)
                                        }
                                    })
                                    callback({type: 'Control Triggered'})
                                },controlUrlStopTimeout)
                            }
                        }else{
                            s.debugLog(response)
                        }
                    })
                }else{
                    controlOptions.Speed = {'x': 1, 'y': 1, 'z': 1}
                    controlOptions.Translation = Object.assign(controlOptions.Velocity,{})
                    delete(controlOptions.Velocity)
                    s.runOnvifMethod({
                        auth: {
                            ke: options.ke,
                            id: options.id,
                            action: 'relativeMove',
                            service: 'ptz',
                        },
                        options: controlOptions,
                    },(response) => {
                        if(response.ok){
                            callback({type: 'Control Triggered'})
                        }else{
                            callback({type: 'Control Triggered', error: response.error})
                        }
                    })
                }
            }catch(err){
                console.log(err)
                console.log(new Error())
            }
            break;
        }
    }
    const ptzControl = async function(options,callback){
        if(!s.group[options.ke] || !s.group[options.ke].activeMonitors[options.id]){return}
        const monitorConfig = s.group[options.ke].rawMonitorConfigurations[options.id]
        const controlUrlMethod = monitorConfig.details.control_url_method || 'GET'
        const controlBaseUrl = monitorConfig.details.control_base_url || s.buildMonitorUrl(monitorConfig, true)
        if(monitorConfig.details.control !== "1"){
            s.userLog(e,{type:lang['Control Error'],msg:lang.ControlErrorText1});
            return
        }
        if(monitorConfig.details.control_url_stop_timeout === '0' && monitorConfig.details.control_stop === '1' && s.group[options.ke].activeMonitors[options.id].ptzMoving === true){
            options.direction = 'stopMove'
            s.group[options.ke].activeMonitors[options.id].ptzMoving = false
        }else{
            s.group[options.ke].activeMonitors[options.id].ptzMoving = true
        }
        if(controlUrlMethod === 'ONVIF'){
            try{
                //create onvif connection
                if(
                    !s.group[options.ke].activeMonitors[options.id].onvifConnection ||
                    !s.group[options.ke].activeMonitors[options.id].onvifConnection.current_profile ||
                    !s.group[options.ke].activeMonitors[options.id].onvifConnection.current_profile.token
                ){
                    const response = await s.createOnvifDevice({
                        ke: options.ke,
                        id: options.id,
                    })
                    if(response.ok){
                        moveOnvifCamera({
                            ke: options.ke,
                            id: options.id,
                            direction: options.direction,
                            axis: options.axis,
                        },(msg) => {
                            msg.msg = options.direction
                            callback(msg)
                        })
                    }else{
                        s.userLog(e,{type:lang['Control Error'],msg:response.error})
                    }
                }else{
                    moveOnvifCamera({
                        ke: options.ke,
                        id: options.id,
                        direction: options.direction,
                        axis: options.axis,
                    },(msg) => {
                        if(!msg.msg)msg.msg = {direction: options.direction}
                        callback(msg)
                    })
                }
            }catch(err){
                s.debugLog(err)
                callback({
                    type: lang['Control Error'],
                    msg: {
                        msg: lang.ControlErrorText2,
                        error: err,
                        direction: options.direction
                    }
                })
            }
        }else{
            const controlUrlStopTimeout = parseInt(monitorConfig.details.control_url_stop_timeout) || 1000
            var stopCamera = function(){
                let stopURL = controlBaseUrl + monitorConfig.details[`control_url_${options.direction}_stop`]
                let controlOptions = s.cameraControlOptionsFromUrl(stopURL,monitorConfig)
                let requestOptions = {
                    url : stopURL,
                    method : controlOptions.method,
                    auth : {
                        user : controlOptions.username,
                        pass : controlOptions.password
                    }
                }
                if(monitorConfig.details.control_digest_auth === '1'){
                    requestOptions.sendImmediately = true
                }
                request(requestOptions,function(err,data){
                    const msg =  {
                        ok: true,
                        type:'Control Trigger Ended'
                    }
                    if(err){
                        msg.ok = false
                        msg.type = 'Control Error'
                        msg.msg = err
                    }
                    callback(msg)
                    s.userLog(e,msg);
                })
            }
            if(options.direction === 'stopMove'){
                stopCamera()
            }else{
                let controlURL = controlBaseUrl + monitorConfig.details[`control_url_${options.direction}`]
                let controlOptions = s.cameraControlOptionsFromUrl(controlURL,monitorConfig)
                let requestOptions = {
                    url: controlURL,
                    method: controlOptions.method,
                    auth: {
                        user: controlOptions.username,
                        pass: controlOptions.password
                    }
                }
                if(monitorConfig.details.control_digest_auth === '1'){
                    requestOptions.sendImmediately = true
                }
                request(requestOptions,function(err,data){
                    if(err){
                        callback({ok:false,type:'Control Error',msg:err})
                        return
                    }
                    if(monitorConfig.details.control_stop == '1' && options.direction !== 'center' ){
                        s.userLog(e,{type:'Control Triggered Started'});
                        if(controlUrlStopTimeout > 0){
                            setTimeout(function(){
                                stopCamera()
                            },controlUrlStopTimeout)
                        }
                    }else{
                        callback({ok:true,type:'Control Triggered'})
                    }
                })
            }
        }
    }
    const getPresetPositions = (options,callback) => {
        const profileToken = options.ProfileToken || "__CURRENT_TOKEN"
        return s.runOnvifMethod({
            auth: {
                ke: options.ke,
                id: options.id,
                service: 'ptz',
                action: 'getPresets',
            },
            options: {
                ProfileToken: profileToken
            },
        },callback)
    }
    const setPresetForCurrentPosition = (options,callback) => {
        const nonStandardOnvif = s.group[options.ke].rawMonitorConfigurations[options.id].details.onvif_non_standard === '1'
        const profileToken = options.ProfileToken || "__CURRENT_TOKEN"
        s.runOnvifMethod({
            auth: {
                ke: options.ke,
                id: options.id,
                service: 'ptz',
                action: 'setPreset',
            },
            options: {
                ProfileToken: profileToken,
                PresetToken: nonStandardOnvif ? null : options.PresetToken || profileToken,
                PresetName: options.PresetName || nonStandardOnvif ? '1' : profileToken
            },
        },(endData) => {
            callback(endData)
        })
    }
    const moveToPresetPosition = (options,callback) => {
        const nonStandardOnvif = s.group[options.ke].rawMonitorConfigurations[options.id].details.onvif_non_standard === '1'
        const profileToken = options.ProfileToken || "__CURRENT_TOKEN"
        return s.runOnvifMethod({
            auth: {
                ke: options.ke,
                id: options.id,
                service: 'ptz',
                action: 'gotoPreset',
            },
            options: {
                ProfileToken: profileToken,
                PresetToken: options.PresetToken || nonStandardOnvif ? '1' : profileToken,
                Speed: {
                   "x": 1,
                   "y": 1,
                   "z": 1
                },
            },
        },callback)
    }
    const getLargestMatrix = (matrices) => {
        var largestMatrix = {width: 0, height: 0}
        matrices.forEach((matrix) => {
            if(matrix.width > largestMatrix.width && matrix.height > largestMatrix.height)largestMatrix = matrix
        })
        return largestMatrix.x ? largestMatrix : null
    }
    const moveCameraPtzToMatrix = function(event,trackingTarget){
        if(moveLock[event.ke + event.id])return;
        clearTimeout(moveLock[event.ke + event.id])
        moveLock[event.ke + event.id] = setTimeout(() => {
            delete(moveLock[event.ke + event.id])
        },1000)
        const imgHeight = event.details.imgHeight
        const imgWidth = event.details.imgWidth
        const thresholdX = imgWidth * 0.125
        const thresholdY = imgHeight * 0.125
        const imageCenterX = imgWidth / 2
        const imageCenterY = imgHeight / 2
        const matrices = event.details.matrices
        const largestMatrix = getLargestMatrix(matrices.filter(matrix => matrix.tag === (trackingTarget || 'person')))
        // console.log(matrices.find(matrix => matrix.tag === 'person'))
        if(!largestMatrix)return;
        const matrixCenterX = largestMatrix.x + (largestMatrix.width / 2)
        const matrixCenterY = largestMatrix.y + (largestMatrix.height / 2)
        const rawDistanceX = (matrixCenterX - imageCenterX)
        const rawDistanceY = (matrixCenterY - imageCenterY)
        const distanceX = imgWidth / rawDistanceX
        const distanceY = imgHeight / rawDistanceY
        const axisX = rawDistanceX > thresholdX || rawDistanceX < -thresholdX ? distanceX : 0
        const axisY = largestMatrix.y < 30 && largestMatrix.height > imgHeight * 0.8 ? 0.5 : rawDistanceY > thresholdY || rawDistanceY < -thresholdY ? -distanceY : 0
        if(axisX !== 0 || axisY !== 0){
            ptzControl({
                axis: [
                    {direction: 'x', amount: axisX === 0 ? 0 : axisX > 0 ? 0.01 : -0.01},
                    {direction: 'y', amount: axisY === 0 ? 0 : axisY > 0 ? 0.01 : -0.01},
                    {direction: 'z', amount: 0},
                ],
                // axis: [{direction: 'x', amount: 1.0}],
                id: event.id,
                ke: event.ke
            },(msg) => {
                s.userLog(event,msg)
                // console.log(msg)
                clearTimeout(ptzTimeoutsUntilResetToHome[event.ke + event.id])
                ptzTimeoutsUntilResetToHome[event.ke + event.id] = setTimeout(() => {
                    moveToPresetPosition({
                        ke: event.ke,
                        id: event.id,
                    },(endData) => {
                        console.log(endData)
                    })
                },7000)
            })
        }
    }
    return {
        ptzControl: ptzControl,
        startMove: startMove,
        stopMove: stopMove,
        getPresetPositions: getPresetPositions,
        setPresetForCurrentPosition: setPresetForCurrentPosition,
        moveToPresetPosition: moveToPresetPosition,
        moveCameraPtzToMatrix: moveCameraPtzToMatrix
    }
}
