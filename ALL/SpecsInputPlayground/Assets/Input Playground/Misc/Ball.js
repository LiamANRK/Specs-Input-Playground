// Boink_BallLocal2D_Bounce_NoSlide_AntiTrap_Drift_Anchored.js
// Ball: Physics.BodyComponent (Dynamic).
// Constrain motion to ANCHOR's local XZ plane (local Y=0) with clean reflection, anti-trap, and drift along anchor +Z.

// @input SceneObject anchorParent
/** @input float bounce = 1.0 {"label":"Bounce Multiplier","min":0,"max":2} */
/** @input float tangentDamping = 0.25 {"label":"Tangent Damping (0=keep, 1=kill)","min":0,"max":1} */
/** @input float minReboundSpeed = 180.0 {"label":"Min Normal Rebound Speed"} */
/** @input float minIncidenceDot = 0.10 {"label":"Min Incidence vs Normal","min":0,"max":0.5} */
/** @input float minSpeed = 120.0 {"label":"Min Speed Clamp"} */
/** @input float maxSpeed = 1400.0 {"label":"Max Speed Clamp"} */
/** @input bool  preserveSpeed = true {"label":"Preserve Speed On Bounce"} */
/** @input bool  zeroLocalYAlways = true {"label":"Lock Anchor-Local Y (2D)"} */
/** @input string paddleName = "Paddle" {"label":"Ignore Paddle (name)"} */
/** @input float antiTrapWindow = 0.12 {"label":"Anti-Trap Window (s)"} */
/** @input float antiTrapAngleDeg = 6.0 {"label":"Anti-Trap Angle (deg)","min":0,"max":20} */
/** @input float antiTrapOffset = 0.01 {"label":"Anti-Trap Pos Offset (m)"} */
/** @input float antiTrapOppositeDot = -0.98 {"label":"Opposite Normal Dot Threshold","min":-1,"max":-0.5} */
/** @input float driftAccel = 30.0 {"label":"Drift Accel along anchor +Z (m/s^2)"} */
/** @input bool  invertDrift = false {"label":"Invert Drift Direction"} */
/** @input float driftMaxAdd = 300.0 {"label":"Max Drift Contribution (|along +Z| cap)"} */

var so = script.getSceneObject();
var body = so.getComponent("Physics.BodyComponent");
if (!body || !body.dynamic) { print("[Boink] Ball needs Dynamic BodyComponent"); return; }

// ---- math helpers (no engine .dot()) ----
function dot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
function add(a,b){ return new vec3(a.x+b.x, a.y+b.y, a.z+b.z); }
function sub(a,b){ return new vec3(a.x-b.x, a.y-b.y, a.z-b.z); }
function mul(v,s){ return new vec3(v.x*s, v.y*s, v.z*s); }
function len(v){ return Math.sqrt(dot(v,v)); }
function unit(v){ var L=len(v); return L<1e-6 ? new vec3(0,0,0) : v.uniformScale(1/L); }

// ---- anchor basis (recomputed live, works across any hierarchy) ----
function anchorXf(){ return (script.anchorParent || so.getParent() || so).getTransform(); }
function basis(){
  var a = anchorXf();
  return { o: a.getWorldPosition(), r: unit(a.right), u: unit(a.up), f: unit(a.forward) };
}
function flattenToAnchorPlane(v){
  var B = basis(); var up = B.u; return sub(v, mul(up, dot(v, up)));
}
function decomposeInAnchorPlane(vWorld, normalWorld){
  var vxz = flattenToAnchorPlane(vWorld);
  var nxz = unit(flattenToAnchorPlane(normalWorld));
  var vnMag = dot(vxz, nxz);
  var vn    = mul(nxz, vnMag);
  var vt    = sub(vxz, vn);
  return { vnMag: vnMag, vn: vn, vt: vt, nxz: nxz, vxz: vxz };
}
function clampSpeedInAnchorPlane(vWorld, minS, maxS){
  var f = flattenToAnchorPlane(vWorld);
  var s = len(f);
  if (s < 1e-6) return f;
  var c = Math.max(minS, Math.min(maxS, s));
  return mul(f, c/s);
}
function rotateAroundAnchorUp(vWorld, deg){
  if (Math.abs(deg) < 1e-4) return flattenToAnchorPlane(vWorld);
  var q = quat.angleAxis(deg * Math.PI / 180.0, basis().u);
  return q.multiplyVec3 ? q.multiplyVec3(vWorld) : vWorld;
}
// world <-> anchor-local (for position lock)
function worldToAnchorLocal(p){
  var B = basis(); var d = sub(p, B.o);
  return new vec3(dot(d,B.r), dot(d,B.u), dot(d,B.f));
}
function anchorLocalToWorld(lp){
  var B = basis(); return add(B.o, add(mul(B.r,lp.x), add(mul(B.u,lp.y), mul(B.f,lp.z))));
}

// ---- per-frame: drift + plane lock ----
script.createEvent("UpdateEvent").bind(function(ev){
  var dt = ev.getDeltaTime ? ev.getDeltaTime() : 1/60;

  // Drift along anchor forward
  if (script.driftAccel !== 0) {
    var B = basis();
    var v = body.velocity;
    var sign = script.invertDrift ? -1 : 1;
    v = add(v, mul(B.f, sign * script.driftAccel * dt));
    var along = dot(v, B.f);
    if (Math.abs(along) > script.driftMaxAdd) {
      var vAlong = mul(B.f, Math.sign(along) * script.driftMaxAdd);
      var vPerp  = sub(v, mul(B.f, along));
      v = add(vAlong, vPerp);
    }
    body.velocity = v;
  }

  // Lock to anchor-local plane
  if (script.zeroLocalYAlways) {
    var wp = so.getTransform().getWorldPosition();
    var lp = worldToAnchorLocal(wp);
    if (Math.abs(lp.y) > 0.0001) {
      lp.y = 0;
      so.getTransform().setWorldPosition(anchorLocalToWorld(lp));
    }
    var v0 = body.velocity;
    var vFlat = flattenToAnchorPlane(v0);
    if (v0.x!==vFlat.x || v0.y!==vFlat.y || v0.z!==vFlat.z) body.velocity = vFlat;
  }
});

// ---- anti-trap state ----
var lastN = null, lastT = -999, streak = 0;
function isOppositeInPlane(aWorld, bWorld){
  var A = unit(flattenToAnchorPlane(aWorld));
  var B = unit(flattenToAnchorPlane(bWorld));
  return dot(A,B) <= script.antiTrapOppositeDot;
}

// ---- bounce (ENTER only) ----
function onBounce(e){
  var c = e.collision; if (!c) return;
  var otherSO = c.collider && c.collider.getSceneObject ? c.collider.getSceneObject() : null;
  if (otherSO && otherSO.name === script.paddleName) return;

  var contacts = c.contacts; if (!contacts || contacts.length===0) return;
  var n = contacts[0].normal;

  var v = body.velocity;
  var comp = decomposeInAnchorPlane(v, n);

  var incidenceDot = Math.abs(dot(unit(comp.vxz), comp.nxz));
  var needKick = incidenceDot < script.minIncidenceDot;

  var vnRef = mul(comp.nxz, -comp.vnMag);
  var vtDmp = mul(comp.vt, Math.max(0, 1 - script.tangentDamping));
  var reflected = add(vnRef, vtDmp);

  var normalComponent = dot(reflected, comp.nxz);
  if (needKick || Math.abs(normalComponent) < script.minReboundSpeed) {
    reflected = add(mul(comp.nxz, script.minReboundSpeed), vtDmp);
  }

  var now = getTime();
  var thisN = comp.nxz;
  if (lastN && (now - lastT) <= script.antiTrapWindow && isOppositeInPlane(thisN, lastN)) {
    streak++;
    var ang = (streak % 2 === 0) ? script.antiTrapAngleDeg : -script.antiTrapAngleDeg;
    reflected = rotateAroundAnchorUp(reflected, ang);
    var wp = so.getTransform().getWorldPosition();
    var offset = mul(thisN, script.antiTrapOffset);
    so.getTransform().setWorldPosition(add(wp, offset));
  } else {
    streak = 0;
  }
  lastN = thisN; lastT = now;

  var finalV = mul(reflected, script.bounce);
  if (script.preserveSpeed) {
    var s0 = len(comp.vxz), s1 = len(finalV);
    if (s0>0.0001 && s1>0.0001) finalV = mul(finalV, s0/s1);
  }
  finalV = clampSpeedInAnchorPlane(finalV, script.minSpeed, script.maxSpeed);
  finalV = flattenToAnchorPlane(finalV);
  body.velocity = finalV;
}

if (body.onCollisionEnter && body.onCollisionEnter.add) body.onCollisionEnter.add(onBounce);
