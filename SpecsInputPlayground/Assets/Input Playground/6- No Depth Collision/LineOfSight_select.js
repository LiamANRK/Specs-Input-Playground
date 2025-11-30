// LineOfSightScaleSelf_WithSound.js
// Put this on an object you want to scale when LOS is blocked.
// Optionally plays a sound when LOS first becomes blocked.

// @input SceneObject headObject
// @input float rayRadius = 10.0
// @input float selectedScale = 1.2

// Sound
// @input Component.AudioComponent blockSound
// @input bool debugLogs = false

var probe = Physics.createGlobalProbe();

var target = script.getSceneObject();
var head = script.headObject;

if (!head) {
    print("[LineOfSightScaleSelf] ERROR: headObject not assigned.");
    return;
}

// Cache original scale
var originalScale = target.getTransform().getLocalScale();
var isScaled = false;

// Math helpers
function dot(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function sub(a, b) { return new vec3(a.x-b.x, a.y-b.y, a.z-b.z); }
function len(v) { return Math.sqrt(dot(v, v)); }

script.createEvent("UpdateEvent").bind(function () {

    var headPos = head.getTransform().getWorldPosition();
    var targetPos = target.getTransform().getWorldPosition();

    if (len(sub(headPos, targetPos)) < 0.001) return;

    probe.sphereCast(script.rayRadius, headPos, targetPos, function(hit) {

        var blocked = false;

        if (hit) {
            var so = hit.collider.getSceneObject();
            if (so !== head && so !== target) {
                blocked = true;
                if (script.debugLogs && !isScaled) {
                    print("[LineOfSightScaleSelf] First block by: " + so.name);
                }
            }
        }

        if (blocked) {
            // First time blocked → play sound + scale up
            if (!isScaled) {

                // Scale THIS object
                var newScale = originalScale.uniformScale(script.selectedScale);
                target.getTransform().setLocalScale(newScale);
                isScaled = true;

                // Play sound if assigned
                if (script.blockSound) {
                    script.blockSound.play(1.0);
                }
            }
        } else {
            // Unblocked → restore scale
            if (isScaled) {
                target.getTransform().setLocalScale(originalScale);
                isScaled = false;

                if (script.debugLogs) {
                    print("[LineOfSightScaleSelf] LOS clear → reset scale");
                }
            }
        }
    });
});
