// FollowProximityTarget.js
// The paddle follows proximityTarget's X position in ANCHOR local space.

// @input SceneObject anchorParent
// @input SceneObject proximityTarget

// @input bool enabled = true
// @input float minX = -30.0
// @input float maxX =  30.0
// @input float smoothTime = 0.08

(function () {

    if (!script.anchorParent || !script.proximityTarget) {
        print("[FollowProximityTarget] ERROR: Missing anchorParent or proximityTarget.");
        return;
    }

    var paddleSO = script.getSceneObject();

    // --- math helpers ---
    function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    function add(a, b) { return new vec3(a.x + b.x, a.y + b.y, a.z + b.z); }
    function sub(a, b) { return new vec3(a.x - b.x, a.y - b.y, a.z - b.z); }
    function mul(v, s) { return new vec3(v.x * s, v.y * s, v.z * s); }
    function len(v) { return Math.sqrt(dot(v, v)); }
    function unit(v) { var L = len(v); return (L < 1e-6) ? new vec3(0,0,0) : v.uniformScale(1/L); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function basis() {
        var t = script.anchorParent.getTransform();
        return {
            o: t.getWorldPosition(),
            r: unit(t.right),
            u: unit(t.up),
            f: unit(t.forward)
        };
    }

    function worldToAnchorLocal(p) {
        var B = basis();
        var d = sub(p, B.o);
        return new vec3(dot(d, B.r), dot(d, B.u), dot(d, B.f));
    }

    function anchorLocalToWorld(lp) {
        var B = basis();
        return add(
            B.o,
            add(mul(B.r, lp.x),
            add(mul(B.u, lp.y), mul(B.f, lp.z)))
        );
    }

    function smoothDamp(current, target, velRef, smoothTime, dt) {
        smoothTime = Math.max(0.0001, smoothTime);
        var omega = 2.0 / smoothTime;
        var x = omega * dt;
        var exp = 1.0 / (1.0 + x + 0.48*x*x + 0.235*x*x*x);
        var change = current - target;
        var temp = (velRef.v + omega * change) * dt;
        var newVel = (velRef.v - omega * temp) * exp;
        var newPos = target + (change + temp) * exp;
        velRef.v = newVel;
        return newPos;
    }

    // Initial position
    var startLocal = worldToAnchorLocal(paddleSO.getTransform().getWorldPosition());
    var currX = startLocal.x;
    var velX = 0.0;

    script.createEvent("UpdateEvent").bind(function(ev) {
        if (!script.enabled) return;

        var dt = ev.getDeltaTime ? ev.getDeltaTime() : 1/60;

        // The target X = proximityTarget in anchor-local space
        var proxLocal = worldToAnchorLocal(script.proximityTarget.getTransform().getWorldPosition());
        var targetX = clamp(proxLocal.x, script.minX, script.maxX);

        // Smooth follow
        var velRef = { v: velX };
        currX = smoothDamp(currX, targetX, velRef, script.smoothTime, dt);
        velX = velRef.v;

        // Apply back in world space
        var paddleWorld = paddleSO.getTransform().getWorldPosition();
        var currLocal = worldToAnchorLocal(paddleWorld);
        var newLocal = new vec3(currX, currLocal.y, currLocal.z);
        var newWorld = anchorLocalToWorld(newLocal);
        paddleSO.getTransform().setWorldPosition(newWorld);
    });

    print("[FollowProximityTarget] Following target X in anchor space.");
})();
