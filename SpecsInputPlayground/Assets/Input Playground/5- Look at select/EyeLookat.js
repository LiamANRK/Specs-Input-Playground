// EyeLookAt.js
// Shoots a fat "look ray" from head forward, scales looked-at objects,
// and restores them to their original scale.

// @input SceneObject headObject
// @input float rayDistance = 150.0
// @input float rayRadius = 10.0
// @input float lookScale = 1.2
// @input bool debugNoHit = false

var probe = Physics.createGlobalProbe();

var lastLookedAt = null;
var originalScale = null;   // vec3 storing the last object's true scale

var head = script.headObject ? script.headObject : script.getSceneObject();
if (!head) {
    print("[EyeLookAt] ERROR: No headObject assigned.");
    return;
}

script.createEvent("UpdateEvent").bind(function () {
    var t = head.getTransform();
    var start = t.getWorldPosition();
    var dir = t.forward;   // Swap to t.back if needed
    var end = start.add(dir.uniformScale(script.rayDistance));

    // correct signature: sphereCast(radius, start, end, callback)
    probe.sphereCast(script.rayRadius, start, end, function (hit) {
        if (hit) {
            var so = hit.collider.getSceneObject();

            if (so !== lastLookedAt) {

                // --- Restore old object ----
                if (lastLookedAt && originalScale) {
                    lastLookedAt.getTransform().setLocalScale(originalScale);
                }

                // --- Store this new object's natural scale ----
                originalScale = so.getTransform().getLocalScale();

                // --- Scale up ----
                var newScale = originalScale.uniformScale(script.lookScale);
                so.getTransform().setLocalScale(newScale);

                print("[EyeLookAt] Looking at: " + so.name);

                lastLookedAt = so;
            }
        } else {
            // Hit nothing
            if (lastLookedAt) {
                // restore
                if (originalScale) {
                    lastLookedAt.getTransform().setLocalScale(originalScale);
                }

                if (script.debugNoHit) {
                    print("[EyeLookAt] Looking at: nothing");
                }

                lastLookedAt = null;
                originalScale = null;
            }
        }
    });
});
