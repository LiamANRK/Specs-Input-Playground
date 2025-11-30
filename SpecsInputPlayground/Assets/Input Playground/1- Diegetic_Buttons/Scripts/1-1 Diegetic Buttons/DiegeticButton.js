// DiegeticButton.js

// @input SceneObject objectWithTweens
// @input float checkPressTime = 0.5   // Cooldown in seconds

// Internal state
var lastPressTime = -9999;

script.onButtonPressed = function () {
    var now = getTime();

    // ---- Cooldown check ----
    if (now - lastPressTime < script.checkPressTime) {
        // Optional debug print
        // print("Press ignored (cooldown)");
        return;
    }
    lastPressTime = now;
    // -------------------------

    print("Button Pressed");

    // Safety check
    if (!script.objectWithTweens) {
        print("ERROR: No objectWithTweens assigned");
        return;
    }

    // Tween 1
    global.tweenManager.startTween(script.objectWithTweens, "Pressed");

    // Tween 2
    global.tweenManager.startTween(script.objectWithTweens, "Reset");
};
