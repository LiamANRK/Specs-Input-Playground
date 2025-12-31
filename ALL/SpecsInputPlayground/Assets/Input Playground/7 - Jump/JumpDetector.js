// JumpDetectorStandalone.js
// ---------------------------------------------------------
// Simple jump / squat detector with a PUBLIC BUTTON CALLBACK
// for starting tracking.
//
// Hook this up like:
//  - Assign `head` to your camera/head object
//  - Assign `statusText` to a world or screen text
//  - Link a button's OnTapped/OnPressed event to
//      script.onStartTrackingButton
//
// @input SceneObject head                  // The head/camera tracking object
// @input float threshold = 0.30            // 30cm up = jump, 30cm down = squat
// @input bool showDebugInfo = true
// @input Component.Text statusText         // Shows "WAITING", "JUMPING", "SQUATTING", "IDLE"

var baselineHeight = 0;
var isJumping = false;
var isSquatting = false;
var isTracking = false;

// ----------------- HELPERS -----------------

function updateStatusText() {
    if (!script.statusText) {
        return;
    }
    
    if (!isTracking) {
        script.statusText.text = "Click button to start Tracking";
    } else if (isJumping) {
        script.statusText.text = "JUMPING";
    } else if (isSquatting) {
        script.statusText.text = "SQUATTING";
    } else {
        script.statusText.text = "IDLE";
    }
}

// ----------------- UPDATE LOOP -----------------

function onUpdate(eventData) {
    if (!script.head || !isTracking) {
        return;
    }
    
    var currentHeight = script.head.getTransform().getWorldPosition().y;
    var difference = currentHeight - baselineHeight;
    
    // Over threshold = JUMPING
    if (difference > script.threshold) {
        if (!isJumping) {
            isJumping = true;
            isSquatting = false;
            
            if (script.showDebugInfo) {
                print("JUMPING (+" + difference.toFixed(2) + "m)");
            }
            updateStatusText();
        }
    }
    // Under -threshold = SQUATTING
    else if (difference < -script.threshold) {
        if (!isSquatting) {
            isSquatting = true;
            isJumping = false;
            
            if (script.showDebugInfo) {
                print("SQUATTING (" + difference.toFixed(2) + "m)");
            }
            updateStatusText();
        }
    }
    // In between = IDLE
    else {
        if (isJumping || isSquatting) {
            isJumping = false;
            isSquatting = false;
            
            if (script.showDebugInfo) {
                print("IDLE (" + difference.toFixed(2) + "m)");
            }
            updateStatusText();
        }
    }
}

// ----------------- PUBLIC API -----------------

// Called from other scripts
script.api.isJumping = function() {
    return isJumping;
};

script.api.isSquatting = function() {
    return isSquatting;
};

script.api.isIdle = function() {
    return isTracking && !isJumping && !isSquatting;
};

script.api.getStatus = function() {
    if (!isTracking) return "Click button to start Tracking.";
    if (isJumping) return "JUMPING";
    if (isSquatting) return "SQUATTING";
    return "IDLE";
};

// Start tracking (for other scripts)
script.api.startTracking = function() {
    if (!script.head) {
        print("JumpDetector: Head not assigned!");
        return;
    }
    
    baselineHeight = script.head.getTransform().getWorldPosition().y;
    isTracking = true;
    isJumping = false;
    isSquatting = false;
    
    if (script.showDebugInfo) {
        print("JumpDetector baseline set: " + baselineHeight.toFixed(2) + "m");
    }
    
    updateStatusText();
};

// Stop tracking (optional)
script.api.stopTracking = function() {
    isTracking = false;
    isJumping = false;
    isSquatting = false;
    updateStatusText();
};

// ----------------- BUTTON CALLBACKS -----------------
// This is the one you hook your UI button to
script.onStartTrackingButton = function() {
    if (script.showDebugInfo) {
        print("JumpDetector: Start button pressed");
    }
    script.api.startTracking();
};

// Optional: button to stop tracking if you want one
script.onStopTrackingButton = function() {
    if (script.showDebugInfo) {
        print("JumpDetector: Stop button pressed");
    }
    script.api.stopTracking();
};

// ----------------- INIT -----------------

script.createEvent("UpdateEvent").bind(onUpdate);

// On start, show WAITING... so the user knows to press the button
var onStartEvent = script.createEvent("OnStartEvent");
onStartEvent.bind(function() {
    updateStatusText();
});
