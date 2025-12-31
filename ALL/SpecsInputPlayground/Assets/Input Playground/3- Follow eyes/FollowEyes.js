// LookMovement.js
// Move the paddle along ANCHOR local X in [minX, maxX], driven by camera LOOK (yaw) only.

// @input SceneObject anchorParent
// @input SceneObject cameraObject
// @input bool enabled = true
// @input float minX = -30.0
// @input float maxX =  30.0
// @input float smoothTime = 0.08

// Look (yaw) tracking
// @input float yawLimitDeg = 45.0
// @input float lookWeight = 1.0
// @input bool invertLook = true

(function () {
    if (!script.anchorParent || !script.cameraObject) {
        print("[LookMovement] Assign anchorParent and cameraObject");
        return;
    }

    var paddleSO = script.getSceneObject();

    // --- math helpers ---
    function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    function add(a, b) { return new vec3(a.x + b.x, a.y + b.y, a.z + b.z); }
    function sub(a, b) { return new vec3(a.x - b.x, a.y - b.y, a.z - b.z); }
    function mul(v, s) { return new vec3(v.x * s, v.y * s, v.z * s); }
    function len(v) { return Math.sqrt(dot(v, v)); }
    function unit(v) { var L = len(v); return L < 1e-6 ? new vec3(0, 0, 0) : v.uniformScale(1 / L); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function basis() {
        var axf = script.anchorParent.getTransform();
        var r = unit(axf.right);
        var u = unit(axf.up);
        var f = unit(axf.forward);
        var o = axf.getWorldPosition();
        return { o: o, r: r, u: u, f: f };
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
            add(
                mul(B.r, lp.x),
                add(mul(B.u, lp.y), mul(B.f, lp.z))
            )
        );
    }

    function smoothDamp(current, target, velRef, smoothTime, dt) {
        smoothTime = Math.max(0.0001, smoothTime);
        var omega = 2.0 / smoothTime;
        var x = omega * dt;
        var exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
        var change = current - target;
        var temp = (velRef.v + omega * change) * dt;
        var newVel = (velRef.v - omega * temp) * exp;
        var newPos = target + (change + temp) * exp;
        velRef.v = newVel;
        return newPos;
    }

    var pStartLocal = worldToAnchorLocal(paddleSO.getTransform().getWorldPosition());
    var currX = pStartLocal.x;
    var velX = 0.0;

    function lookContribution() {
        var B = basis();
        var camFwdW = script.cameraObject.getTransform().forward;

        var fx = dot(camFwdW, B.r);
        var fz = dot(camFwdW, B.f);

        var yawRad = Math.atan2(fx, fz);
        var yawDeg = yawRad * 180.0 / Math.PI;

        var n = clamp(
            yawDeg / Math.max(1e-3, script.yawLimitDeg),
            -1.0,
            1.0
        );

        if (script.invertLook) {
            n = -n;
        }

        var halfRange = 0.5 * (script.maxX - script.minX);
        return n * halfRange * script.lookWeight;
    }

    script.createEvent("UpdateEvent").bind(function (ev) {
        if (!script.enabled) { return; }

        var dt = ev.getDeltaTime ? ev.getDeltaTime() : 1 / 60;

        var center = 0.5 * (script.minX + script.maxX);
        var targetX = center + lookContribution();
        targetX = clamp(targetX, script.minX, script.maxX);

        var velRef = { v: velX };
        currX = smoothDamp(currX, targetX, velRef, script.smoothTime, dt);
        velX = velRef.v;

        var currWorld = paddleSO.getTransform().getWorldPosition();
        var currLocal = worldToAnchorLocal(currWorld);
        var newLocal = new vec3(currX, currLocal.y, currLocal.z);
        var newWorld = anchorLocalToWorld(newLocal);
        paddleSO.getTransform().setWorldPosition(newWorld);
    });

    print("[LookMovement] anchored to '" + script.anchorParent.name + "' in [" + script.minX + "," + script.maxX + "].");
})();
