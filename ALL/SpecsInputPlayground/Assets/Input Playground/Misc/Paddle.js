// Boink_PaddleHit_AnchoredLocal2D.js
// Paddle has a ColliderComponent. Impulse is computed in the ANCHOR's local plane,
// blending away-from-paddle with paddle’s facing (in-plane).

// @input SceneObject anchorParent {"label":"Anchor Parent"}
// @input Physics.ColliderComponent paddleCollider
// @input float impulseStrength = 4000.0
// @input string ballName = "Ball"
// @input float facingBias = 1.0 {"label":"Facing Influence 0..1"}
// @input float hitCooldown = 0.08
// @input bool  zeroBallVelocityFirst = true

if (!script.paddleCollider) { print("[Boink] Assign paddleCollider"); return; }

var so = script.getSceneObject();
var lastHitTime = -999;

// ---- shared basis + helpers (match the Ball script) ----
function dot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
function add(a,b){ return new vec3(a.x+b.x, a.y+b.y, a.z+b.z); }
function sub(a,b){ return new vec3(a.x-b.x, a.y-b.y, a.z-b.z); }
function mul(v,s){ return new vec3(v.x*s, v.y*s, v.z*s); }
function len(v){ return Math.sqrt(dot(v,v)); }
function unit(v){ var L=len(v); return L<1e-6 ? new vec3(0,0,0) : v.uniformScale(1/L); }

function anchorXf(){ return (script.anchorParent || so.getParent() || so).getTransform(); }
function basis(){
  var a = anchorXf();
  return { o: a.getWorldPosition(), r: unit(a.right), u: unit(a.up), f: unit(a.forward) };
}
function flattenToAnchorPlane(v){
  var B = basis(); var up = B.u; return sub(v, mul(up, dot(v, up)));
}

function computeDir(ballSO){
  // away-from-paddle in anchor plane
  var pPos = so.getTransform().getWorldPosition();
  var bPos = ballSO.getTransform().getWorldPosition();
  var away = unit(flattenToAnchorPlane(sub(bPos, pPos)));
  // paddle's forward projected into anchor plane
  var fwd  = unit(flattenToAnchorPlane(so.getTransform().forward));
  // blend
  return unit(add(mul(away, 1.0 - script.facingBias), mul(fwd, script.facingBias)));
}

function boost(ballSO){
  var now = getTime();
  if (now - lastHitTime < script.hitCooldown) return;
  lastHitTime = now;

  var body = ballSO.getComponent("Physics.BodyComponent");
  if (!body || !body.dynamic) return;

  if (script.zeroBallVelocityFirst && body.clearMotion) body.clearMotion();

  var dir = computeDir(ballSO);
  var impulse = mul(dir, script.impulseStrength);
  body.addForce(impulse, Physics.ForceMode.Impulse);
}

script.paddleCollider.onCollisionEnter.add(function(e){
  var other = e && e.collision ? e.collision.collider : null;
  if (!other || !other.getSceneObject) return;
  var otherSO = other.getSceneObject();
  if (otherSO && otherSO.name === script.ballName) boost(otherSO);
});
