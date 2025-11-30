// Boink_PaddleAutoMove2D_Anchored_Robust.js
// Move the paddle along ANCHOR local X in [minX, maxX], driven by camera position and/or look (yaw).
// Works even if the paddle or anchor are several parents apart (no matrix inverse needed).

// @input SceneObject anchorParent
// @input SceneObject cameraObject
// @input bool enabled = true
// @input float minX = -30.0
// @input float maxX =  30.0
// @input float smoothTime = 0.08

// Camera position tracking
// @input bool usePositionTracking = true
// @input bool posUseRelativeZero = true
// @input float posSensitivity = 1.0
// @input float posDeadzone = 0.02
// @input float posWeight = 1.0
// @input bool invertPosition = false

// Look (yaw) tracking
// @input bool useLookTracking = false
// @input float yawLimitDeg = 45.0
// @input float lookWeight = 1.0
// @input bool invertLook = true

(function(){
    if (!script.anchorParent || !script.cameraObject) {
        print("[Boink] AutoMove (robust): assign anchorParent and cameraObject");
        return;
    }

    var paddleSO = script.getSceneObject();

    // --- math helpers (no engine matrix ops) ---
    function dot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
    function add(a,b){ return new vec3(a.x+b.x, a.y+b.y, a.z+b.z); }
    function sub(a,b){ return new vec3(a.x-b.x, a.y-b.y, a.z-b.z); }
    function mul(v,s){ return new vec3(v.x*s, v.y*s, v.z*s); }
    function len(v){ return Math.sqrt(dot(v,v)); }
    function unit(v){ var L=len(v); return L<1e-6 ? new vec3(0,0,0) : v.uniformScale(1/L); }
    function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
    function sign(v){ return v<0 ? -1 : 1; }

    // Anchor basis (re-built every frame)
    function basis() {
        var axf = script.anchorParent.getTransform();
        // Ensure unit axes (defensive)
        var r = unit(axf.right);
        var u = unit(axf.up);
        var f = unit(axf.forward);
        var o = axf.getWorldPosition(); // origin
        return { o:o, r:r, u:u, f:f };
    }

    // World point -> anchor local coords (manual)
    function worldToAnchorLocal(p) {
        var B = basis();
        var d = sub(p, B.o);
        return new vec3(dot(d, B.r), dot(d, B.u), dot(d, B.f));
    }
    // Anchor local coords -> world point (manual)
    function anchorLocalToWorld(lp) {
        var B = basis();
        // p = o + x*r + y*u + z*f
        return add(B.o, add(mul(B.r, lp.x), add(mul(B.u, lp.y), mul(B.f, lp.z))));
    }

    // SmoothDamp-like easing
    function smoothDamp(current, target, velRef, smoothTime, dt){
        smoothTime = Math.max(0.0001, smoothTime);
        var omega = 2.0 / smoothTime;
        var x = omega * dt;
        var exp = 1.0/(1.0 + x + 0.48*x*x + 0.235*x*x*x);
        var change = current - target;
        var temp = (velRef.v + omega * change) * dt;
        var newVel = (velRef.v - omega * temp) * exp;
        var newPos = target + (change + temp) * exp;
        velRef.v = newVel;
        return newPos;
    }

    // Capture initial anchor-local paddle X and camera zero (in anchor frame)
    var pStartLocal = worldToAnchorLocal(paddleSO.getTransform().getWorldPosition());
    var camStartLocal = worldToAnchorLocal(script.cameraObject.getTransform().getWorldPosition());

    var currX = pStartLocal.x;
    var velX = 0.0;

    function posContribution(){
        if (!script.usePositionTracking) return 0;
        var camLocal = worldToAnchorLocal(script.cameraObject.getTransform().getWorldPosition());
        var xOff = camLocal.x - (script.posUseRelativeZero ? camStartLocal.x : 0);
        if (Math.abs(xOff) < script.posDeadzone) xOff = 0;
        else xOff = (Math.abs(xOff) - script.posDeadzone) * sign(xOff);
        var contrib = xOff * script.posSensitivity;
        if (script.invertPosition) contrib = -contrib;
        return contrib * script.posWeight;
    }

    function lookContribution(){
        if (!script.useLookTracking) return 0;
        var B = basis();
        var camFwdW = script.cameraObject.getTransform().forward;
        // Components of camera forward in anchor basis (XZ only)
        var fx = dot(camFwdW, B.r);
        var fz = dot(camFwdW, B.f);
        var yawRad = Math.atan2(fx, fz); // left/right relative to anchor forward
        var yawDeg = yawRad * 180.0 / Math.PI;
        var n = clamp(yawDeg / Math.max(1e-3, script.yawLimitDeg), -1.0, 1.0);
        if (script.invertLook) n = -n;
        var halfRange = 0.5 * (script.maxX - script.minX);
        return n * halfRange * script.lookWeight;
    }

    script.createEvent("UpdateEvent").bind(function(ev){
        if (!script.enabled) return;
        var dt = ev.getDeltaTime ? ev.getDeltaTime() : 1/60;

        var center = 0.5*(script.minX + script.maxX);
        var targetX = center + posContribution() + lookContribution();
        targetX = clamp(targetX, script.minX, script.maxX);

        var velRef = { v: velX };
        currX = smoothDamp(currX, targetX, velRef, script.smoothTime, dt);
        velX = velRef.v;

        // Keep paddle’s anchor-local Y/Z the same; set X = currX; then write world pos
        var currWorld = paddleSO.getTransform().getWorldPosition();
        var currLocal = worldToAnchorLocal(currWorld);
        var newLocal = new vec3(currX, currLocal.y, currLocal.z);
        var newWorld = anchorLocalToWorld(newLocal);
        paddleSO.getTransform().setWorldPosition(newWorld);
    });

    print("[Boink] AutoMove (robust) anchored to '" + script.anchorParent.name + "' in ["+script.minX+","+script.maxX+"].");
})();
