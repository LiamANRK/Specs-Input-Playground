// Hand Tracking System
// Provides unified pinch/tap events for Spectacles, mobile, and editor testing

// Simple Callback implementation
function Callback() {
    this.callbacks = [];
    
    this.add = function(fn) {
        this.callbacks.push(fn);
    };
    
    this.remove = function(fn) {
        const index = this.callbacks.indexOf(fn);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    };
    
    this.callback = function() {
        const args = Array.prototype.slice.call(arguments);
        for (let i = 0; i < this.callbacks.length; i++) {
            this.callbacks[i].apply(null, args);
        }
    };
}

// global
global.HandTracking = script;

// callbacks
script.onPinchStart = new Callback(); // pos, isTap
script.onPinchHold = new Callback(); // pos, isTap
script.onPinchEnd = new Callback(); // pos, isTap
script.onTrackStart = new Callback(); // isTap
script.onTrackEnd = new Callback(); // isTap
script.onActiveHandChange = new Callback(); // prvHand, curHand

script.onHoverStart = new Callback(); // pos
script.onHovering = new Callback(); // pos
script.onHoverEnd = new Callback(); // pos

// functions
script.getActiveHand = () => activeHand;
script.getDominantHand = () => dominantHand;
script.getPinching = () => isPinching;
script.getPinchPosition = () => cursorPos;
script.getPinchForward = () => cursorFwd;
script.getPinchUp = () => cursorUp;
script.getHoverScreenPosition = () => hoverScreenPosition;
script.getHoverWorldPosition = () => hoverWorldPosition;

// SIK only
script.Hands = {
    Left : null,
    Right : null,
}

// UI
//@ui {"widget":"label"}
//@ui {"widget":"separator"}
//@ui {"widget":"label", "label":"<big><b>Hand Tracking 👐</b>"}
//@ui {"widget":"label", "label":"Unified pinch/tap events for Spectacles, mobile, and editor"}
//@ui {"widget":"separator"}

//@ui {"widget":"label"}
//@ui {"widget":"group_start", "label":"<b>Usage"}
    //@ui {"widget":"label", "label":"<small>callbacks - bind using <font color='#56b1fc'><i>.add(</font><i>f<font color='#56b1fc'>)</i></font> and <font color='#56b1fc'><i>.remove(</font><i>f<font color='#56b1fc'>)</i></font>"}
    //@ui {"widget":"label", "label":"• <font color='#56b1fc'>.onPinchStart</font> <small>→ (<font color='#f5e3d5'>pos</font>, <font color='#f5e3d5'>isTap</font>)"}
    //@ui {"widget":"label", "label":"• <font color='#56b1fc'>.onPinchHold</font> <small>→ (<font color='#f5e3d5'>pos</font>, <font color='#f5e3d5'>isTap</font>)"}
    //@ui {"widget":"label", "label":"• <font color='#56b1fc'>.onPinchEnd</font> <small>→ (<font color='#f5e3d5'>pos</font>, <font color='#f5e3d5'>isTap</font>)"}
    //@ui {"widget":"label", "label":"• <font color='#56b1fc'>.onTrackStart</font> <small>→ (<font color='#f5e3d5'>isTap</font>)"}
    //@ui {"widget":"label", "label":"• <font color='#56b1fc'>.onTrackEnd</font> <small>→ (<font color='#f5e3d5'>isTap</font>)"}
    //@ui {"widget":"label", "label":"• <font color='#56b1fc'>.onActiveHandChange</font> <small>→ (<font color='#f5e3d5'>prvHand</font>, <font color='#f5e3d5'>curHand</font>)"}
//@ui {"widget":"group_end"}

//@ui {"widget":"label"}
//@ui {"widget":"separator"}
//@ui {"widget":"label"}
//@input bool allowTap {"label":"<b>Tap (Editor Testing)"}
//@ui {"widget":"group_start", "label":"", "showIf":"allowTap"}
    //@input bool allowTapDelivery {"label":"In Delivery"}
    //@input Component.Camera cam
    //@input float distFromCamera = 50
    //@input bool hover
//@ui {"widget":"group_end", "showIf":"allowTap"}

//@ui {"widget":"label"}
//@input bool allowHandTracking {"label":"<b>Hand Tracking (Mobile)"}
//@ui {"widget":"group_start", "label":"", "showIf":"allowHandTracking"}
    //@input Component.ObjectTracking3D handLeft
    //@input Component.ObjectTracking3D handRight
    //@input int stabilityFrames = 3 {"min":0}
//@ui {"widget":"group_end", "showIf":"allowHandTracking"}

//@ui {"widget":"label"}
//@input bool allowSIK {"label":"<b>SIK (Spectacles)"}
//@ui {"widget":"label", "label":"<small>Spectacles Interaction Kit 🕶️"}
//@ui {"widget":"group_start", "label":"", "showIf":"allowSIK"}
    //@input bool syncCombined
//@ui {"widget":"group_end", "showIf":"allowSIK"}
//@ui {"widget":"label"}

// Editor detection
const isEditor = global.deviceInfoSystem.isEditor();
if(!isEditor){
    script.hover = false;
}

// params
var dominantHand = 'right';
const pinchThresholdMobile = 2.5;
const SIKPinchDetectManually = false;
const pinchThresholdSIK = 1.8;

// placeholders
var activeHand = null;
var isPinching = false;
var activeHandObject;
var stabilityDelayPinch = 0;
var stabilityDelayTrackLeft = 0;
var stabilityDelayTrackRight = 0;

var cursorPos;
var cursorFwd;
var cursorUp;
var thumbPos;
var indexPos;

var hoverScreenPosition;
var hoverWorldPosition;

function init(){
    if(script.allowTap) startTap();
    if(script.allowHandTracking) startHandTracking();
    if(script.allowSIK) startSIK();
}
init();

// tap
function startTap(){
    global.touchSystem.touchBlocking = true;

    var screenPos;
    function newPositionFromEvent(eventArgs){
        if(eventArgs) screenPos = eventArgs.getTouchPosition();
        cursorPos = script.cam.screenSpaceToWorldSpace(screenPos, script.distFromCamera);
        cursorFwd = script.cam.getTransform().forward.uniformScale(-1);
        cursorUp = script.cam.getTransform().up;
        thumbPos = cursorPos;
        indexPos = cursorPos;
    }

    const PinchTypes = {None:0, Started:1, Holding:2, Ended:3};
    var pinchType = PinchTypes.None;

    function touchStart(eventArgs){
        newPositionFromEvent(eventArgs);
        pinchType = PinchTypes.Started;
    }
    function touchMove(eventArgs){
        newPositionFromEvent(eventArgs);
    }
    function touchEnd(eventArgs){
        newPositionFromEvent(eventArgs);
        pinchType = PinchTypes.Ended;
    }
    function pinchUpdate(){
        if(script.hover){
            if(!curHoverFrame) curHoverFrame = 0;
            if(!prvHoverFrame) prvHoverFrame = 0;
            if(isHovering && (curHoverFrame > prvHoverFrame)){
                script.onHoverEnd.callback(hoverWorldPosition);
                hoverScreenPosition = null;
                hoverWorldPosition = null;
                hoverUpdateEvent.enabled = false;
                isHovering = false;
            }
            curHoverFrame++;
        }

        switch(pinchType){
            case PinchTypes.Started:
                activeHand = dominantHand;
                script.onTrackStart.callback(true);
                isPinching = true;
                script.onPinchStart.callback(cursorPos, true);
                pinchType = PinchTypes.Holding;
                return;

            case PinchTypes.Holding:
                newPositionFromEvent();
                script.onPinchHold.callback(cursorPos, true);
                return;

            case PinchTypes.Ended:
                isPinching = false;
                thumbPos = null;
                indexPos = null;
                script.onPinchEnd.callback(cursorPos, true);
                cursorPos = null;
                activeHand = null;
                script.onTrackEnd.callback(true);
                pinchType = PinchTypes.None;
                return;
            
            case PinchTypes.None:
                return;
        }
    }

    var curHoverFrame;
    var prvHoverFrame;
    var isHovering;
    function hover(eventArgs){
        var newPos = eventArgs.getHoverPosition();
        hoverScreenPosition = newPos;
        hoverWorldPosition = script.cam.screenSpaceToWorldSpace(hoverScreenPosition, script.distFromCamera);

        if(!isHovering){
            hoverUpdateEvent.enabled = true;
            script.onHoverStart.callback(hoverWorldPosition);
            isHovering = true;
        }
        prvHoverFrame = curHoverFrame || 0;
    }
    function hoverUpdate(){
        script.onHovering.callback(hoverWorldPosition);
    }

    var touchStartEvent = script.createEvent("TouchStartEvent");
    var touchMoveEvent = script.createEvent("TouchMoveEvent");
    var touchEndEvent = script.createEvent("TouchEndEvent");
    var pinchUpdateEvent = script.createEvent("UpdateEvent");
    if(script.hover){
        var hoverEvent = script.createEvent('HoverEvent');
        var hoverUpdateEvent = script.createEvent('UpdateEvent');
    }

    touchStartEvent.bind(touchStart);
    touchMoveEvent.bind(touchMove);
    touchEndEvent.bind(touchEnd);
    pinchUpdateEvent.bind(pinchUpdate);
    if(script.hover){
        hoverEvent.bind(hover);
        hoverUpdateEvent.bind(hoverUpdate);
        hoverUpdateEvent.enabled = false;
    }
}

// 3D (mobile) hand tracking
function startHandTracking(){
    var onHandChange = new Callback();
    var forceStopPinch;

    const leftHandObject = {
        thumbTip : script.handLeft.getAttachedObjects("thumb-3")[0].getTransform(),
        indexTip : script.handLeft.getAttachedObjects("index-3")[0].getTransform()
    }
    const rightHandObject = {
        thumbTip : script.handRight.getAttachedObjects("thumb-3")[0].getTransform(),
        indexTip : script.handRight.getAttachedObjects("index-3")[0].getTransform()
    }

    function getHandByString(str){
        return str=='left'?leftHandObject:rightHandObject;
    }

    function start(){
        var trackStateEvent = script.createEvent("UpdateEvent");
        trackStateEvent.bind(updateTrackingState);

        var pinchEvent = script.createEvent('UpdateEvent');
        pinchEvent.bind(pinchingUpdate);

        onHandChange.add(function(newHand){
            if(activeHand == newHand) return;

            script.onActiveHandChange.callback(activeHand, newHand);

            if(!activeHand && newHand){
                activeHand = newHand;
                script.onTrackStart.callback(false);
            }
            if(activeHand && !newHand){
                if(isPinching) script.onPinchEnd.callback(cursorPos, false);
                activeHand = newHand;
                isPinching = false;
                script.onTrackEnd.callback(false);
            }

            activeHand = newHand;
            activeHandObject = newHand ? getHandByString(activeHand) : null;
        
            pinchEvent.enabled = !!newHand;
            if(!pinchEvent.enabled) isPinching = false;
        });
    }
    script.createEvent("OnStartEvent").bind(start);

    var leftTracking;
    var rightTracking;
    function updateTracking(){
        if(isPinching) forceStopPinch = true;
        if(rightTracking && leftTracking){
            onHandChange.callback(dominantHand);
        }else if(rightTracking){
            onHandChange.callback('right');
        }else if(leftTracking){
            onHandChange.callback('left');
        }else{
            onHandChange.callback(null);
        }
    }

    function awaitTrackStabilityDelay(handName){
        if(handName == 'left'){
            if(stabilityDelayTrackLeft > 0){
                stabilityDelayTrackLeft--;
            }else{
                stabilityDelayTrackLeft = script.stabilityFrames;
            }
            if(stabilityDelayTrackLeft == 0) return false;
            return true;

        }else if(handName == 'right'){
            if(stabilityDelayTrackRight > 0){
                stabilityDelayTrackRight--;
            }else{
                stabilityDelayTrackRight = script.stabilityFrames;
            }
            if(stabilityDelayTrackRight == 0) return false;
            return true;
        }
    }

    function updateTrackingState(){
        if(script.stabilityFrames){
            if(script.handLeft.isTracking()) stabilityDelayTrackLeft = 0;
            if(script.handRight.isTracking()) stabilityDelayTrackRight = 0;
        }
        
        if(script.handLeft.isTracking() && !leftTracking){
            leftTracking = true;
            updateTracking();
        }
        if(!script.handLeft.isTracking() && leftTracking){
            if(script.stabilityFrames && awaitTrackStabilityDelay('left')){
            }else{
                leftTracking = false;
                updateTracking();
            }
        }
        if(script.handRight.isTracking() && !rightTracking){
            rightTracking = true;
            updateTracking();
        }
        if(!script.handRight.isTracking() && rightTracking){
            if(script.stabilityFrames && awaitTrackStabilityDelay('right')){
            }else{
                rightTracking = false;
                updateTracking();
            }
        }

        if(activeHandObject){
            if(script.stabilityFrames && stabilityDelayTrackLeft==0 || !script.stabilityFrames) thumbPos = activeHandObject.thumbTip.getWorldPosition();
            if(script.stabilityFrames && stabilityDelayTrackRight==0 || !script.stabilityFrames) indexPos = activeHandObject.indexTip.getWorldPosition();
            cursorPos = vec3.lerp(thumbPos, indexPos, .5);
            cursorFwd = activeHandObject.indexTip.forward;
            cursorUp = activeHandObject.indexTip.up;
        }
    }

    var wasPinching;
    function pinchingUpdate(){
        if(forceStopPinch){
            forceStopPinch = false;
            HandTracking.onPinchEnd.callback(cursorPos, false);
            isPinching = false;
            wasPinching = false;
            stabilityDelayPinch = 0;
            return;
        }

        if(script.stabilityFrames && stabilityDelayPinch > 0) HandTracking.onPinchHold.callback(cursorPos, false);
        
        if(!thumbPos || !indexPos) return;
        if(!leftTracking && !rightTracking) return;

        isPinching = thumbPos.distance(indexPos) < pinchThresholdMobile;
        if(isPinching && script.stabilityFrames) stabilityDelayPinch = script.stabilityFrames;

        if(!wasPinching && isPinching){
            HandTracking.onPinchStart.callback(cursorPos, false);
        }else if(wasPinching && isPinching){
            HandTracking.onPinchHold.callback(cursorPos, false);
        }else if(wasPinching && !isPinching){
            if(script.stabilityFrames && stabilityDelayPinch > 0){
                stabilityDelayPinch--;
                return;
            }else{
                stabilityDelayPinch = 0;
                HandTracking.onPinchEnd.callback(cursorPos, false);
            }
        }

        wasPinching = isPinching;
    }
}

// Spectacles Interaction Kit
function startSIK(){
    var SIK = require("Examples/SpectaclesInteractionKit.lspkg/SIK").SIK;
    
    print("✓ SIK loaded!");

    const leftHand = SIK.HandInputData.getHand("left");
    const rightHand = SIK.HandInputData.getHand("right");
    script.Hands.Left = leftHand;
    script.Hands.Right = rightHand;
    var onHandChange = new Callback();
    var forceStopPinch;

    var pinchEvent;
    var cursorEvent;

    function start(){
        cursorEvent = script.createEvent("UpdateEvent");
        cursorEvent.bind(updateCursorPosition);

        pinchEvent = script.createEvent('UpdateEvent');
        pinchEvent.bind(pinchingUpdate);

        activeHandChecker();
        onHandChange.add(function(newHand){
            if(activeHand == newHand) return;

            script.onActiveHandChange.callback(activeHand, newHand);

            if(!activeHand && newHand){
                activeHand = newHand;
                script.onTrackStart.callback(false);
            }
            if(activeHand && !newHand){
                activeHand = newHand;
                cursorPos = null;
                cursorFwd = null;
                cursorUp = null;
                isPinching = false;
                script.onTrackEnd.callback(false);
            }

            cursorEvent.enabled = newHand != null;
            if(!cursorEvent.enabled){
                cursorPos = null;
                cursorFwd = null;
                cursorUp = null;
            }

            activeHand = newHand;
            activeHandObject = newHand ? SIK.HandInputData.getHand(activeHand) : null;
        
            pinchEvent.enabled = newHand;
            if(!pinchEvent.enabled) isPinching = false;
        });
    }
    script.createEvent("OnStartEvent").bind(start);

    var leftTracking;
    var rightTracking;

    var updateTracking = function(){
        if(isPinching) forceStopPinch = true;

        if(rightTracking && leftTracking){
            onHandChange.callback(dominantHand);
        }else if(rightTracking){
            onHandChange.callback('right');
        }else if(leftTracking){
            onHandChange.callback('left');
        }else{
            onHandChange.callback(null);
        }
    }

    function activeHandChecker(){
        leftHand.onHandFound.add(function(){
            leftTracking = true;
            updateTracking();
        });
        leftHand.onHandLost.add(function(){
            leftTracking = false;
            updateTracking();
        });
        rightHand.onHandFound.add(function(){
            rightTracking = true;
            updateTracking();
        });
        rightHand.onHandLost.add(function(){
            rightTracking = false;
            updateTracking();
        });
    }

    const center = new vec2(.5, .5);
    function setCenteredDominantHand(){
        if(rightTracking && leftTracking){
            var prvDominantHand = dominantHand;
            const leftDist = SIK.HandInputData.getHand('left').thumbTip.screenPosition.distance(center);
            const rightDist = SIK.HandInputData.getHand('right').thumbTip.screenPosition.distance(center);
            if(leftDist < rightDist){
                dominantHand = 'left';
            }else{
                dominantHand = 'right';
            }

            if(prvDominantHand != dominantHand) updateTracking();
        
        }else{
            dominantHand = SIK.HandInputData.getDominantHand() == leftHand ? 'left' : 'right';
        }
    }

    function updateCursorPosition(){
        if(!activeHandObject) return;

        thumbPos = activeHandObject.thumbTip.position;
        indexPos = activeHandObject.indexTip.position;
        cursorPos = vec3.lerp(thumbPos, indexPos, .5);
        cursorFwd = activeHandObject.indexTip.forward;
        cursorUp = activeHandObject.indexTip.up;

        setCenteredDominantHand();
    }

    var wasPinching;
    function pinchingUpdate(){
        if(SIKPinchDetectManually ? (!thumbPos || !indexPos) : !activeHandObject) return;

        if(forceStopPinch){
            forceStopPinch = false;
            HandTracking.onPinchEnd.callback(cursorPos, false);
            isPinching = false;
            wasPinching = false;
            return;
        }

        if(!leftTracking && !rightTracking) return;

        isPinching = SIKPinchDetectManually ? thumbPos.distance(indexPos) < pinchThresholdSIK : activeHandObject.isPinching();

        if(!wasPinching && isPinching){
            HandTracking.onPinchStart.callback(cursorPos, false);
        }else if(wasPinching && isPinching){
            HandTracking.onPinchHold.callback(cursorPos, false);
        }else if(wasPinching && !isPinching){
            HandTracking.onPinchEnd.callback(cursorPos, false);
        }

        wasPinching = isPinching;
    }
}