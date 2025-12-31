// PinchThrow.ts
// Simple pinch-and-pull throwing mechanic for Spectacles
// Pinch to grab, pull back like a slingshot, release to throw
//
// Setup:
// 1. Add Physics Body Component to your throwable object
// 2. Make sure the Physics Body has "dynamic" enabled
// 3. Attach this script to any SceneObject
// 4. Assign your throwable object to "physicsObject"
// 5. (Optional) Create an arrow mesh for the direction indicator

@component
export class PinchThrow extends BaseScriptComponent {
    
    // === REQUIRED ===
    @input
    @hint("The object with Physics Body Component to throw - REQUIRED")
    physicsObject: SceneObject;
    
    // === OPTIONAL VISUAL ===
    @input
    @hint("Arrow or object that shows throw direction (hidden when not aiming)")
    directionIndicator: SceneObject;
    
    // === THROW SETTINGS ===
    @input
    @hint("How hard to throw (higher = further)")
    forceMultiplier: number = 50.0;
    
    @input
    @hint("Maximum pull distance - pulling further won't increase power")
    maxPullDistance: number = 1.0;
    
    @input
    @hint("Minimum pull distance to register a throw")
    minPullDistance: number = 0.05;
    
    // === INDICATOR SETTINGS ===
    @input
    @hint("Base length of direction indicator")
    baseIndicatorLength: number = 10.0;
    
    @input
    @hint("How much indicator grows as you pull")
    indicatorScaleMultiplier: number = 20.0;
    
    @input
    @hint("Maximum indicator length")
    maxIndicatorLength: number = 50.0;
    
    // === AXIS LOCKING (for 2D games) ===
    @input
    @hint("Lock throw to specific axes")
    lockToAxes: boolean = false;
    
    @input
    @showIf("lockToAxes")
    @hint("Allow left/right throwing")
    allowX: boolean = true;
    
    @input
    @showIf("lockToAxes")
    @hint("Allow up/down throwing")  
    allowY: boolean = true;
    
    @input
    @showIf("lockToAxes")
    @hint("Allow forward/back throwing")
    allowZ: boolean = true;
    
    // === DEBUG ===
    @input
    @hint("Print extra debug info to console")
    debugMode: boolean = true;
    
    // Private variables
    private physicsBody: any;
    private indicatorTransform: Transform;
    private startPinchPos: vec3 | null = null;
    private lastPinchPos: vec3 | null = null;
    private isGrabbing: boolean = false;
    private startPosition: vec3;
    
    onAwake() {
        this.log("=== PinchThrow Initializing ===");
        
        // Check for Hand Tracking
        const tracker = (global as any).HandTracking;
        if (!tracker) {
            this.logError("HandTracking not found! Make sure Hand Tracking is enabled in your project.");
            return;
        }
        this.log("HandTracking found");
        
        // Check physics object
        if (!this.physicsObject) {
            this.logError("Physics Object not assigned! Drag your throwable object to the 'physicsObject' input.");
            return;
        }
        this.log("Physics Object: " + this.physicsObject.name);
        
        // Save starting position for reset
        this.startPosition = this.physicsObject.getTransform().getWorldPosition();
        this.log("Start Position: " + this.startPosition.x.toFixed(1) + ", " + this.startPosition.y.toFixed(1) + ", " + this.startPosition.z.toFixed(1));
        
        // Get physics body component
        this.physicsBody = this.physicsObject.getComponent("Physics.BodyComponent");
        if (!this.physicsBody) {
            this.logError("Physics Body Component not found on '" + this.physicsObject.name + "'! Add a Physics Body Component to it.");
            return;
        }
        this.log("Physics Body found");
        
        // Log physics body settings
        this.log("Physics Body dynamic: " + this.physicsBody.dynamic);
        try {
            this.log("Physics Body mass: " + this.physicsBody.mass);
        } catch (e) {
            this.log("Could not read mass");
        }
        
        // Setup direction indicator
        if (this.directionIndicator) {
            this.indicatorTransform = this.directionIndicator.getTransform();
            this.directionIndicator.enabled = false;
            this.log("Direction Indicator: " + this.directionIndicator.name);
        } else {
            this.log("No direction indicator assigned (optional)");
        }
        
        // Log settings
        this.log("Force Multiplier: " + this.forceMultiplier);
        this.log("Max Pull Distance: " + this.maxPullDistance);
        this.log("Min Pull Distance: " + this.minPullDistance);
        
        // Setup hand tracking callbacks
        const self = this;
        
        tracker.onPinchStart.add(function(position: any) {
            if (position) {
                self.onPinchStart(position);
            }
        });
        
        tracker.onPinchHold.add(function(position: any) {
            if (position) {
                self.onPinchHold(position);
            }
        });
        
        tracker.onPinchEnd.add(function(position: any) {
            if (position) {
                self.onPinchEnd(position);
            }
        });
        
        // Update loop for indicator
        this.createEvent("UpdateEvent").bind(() => {
            this.updateIndicator();
        });
        
        this.log("=== PinchThrow Ready! ===");
        this.log("Pinch to grab, pull back, release to throw");
    }
    
    // === HAND TRACKING CALLBACKS ===
    
    private onPinchStart(position: any) {
        const pos = this.toVec3(position);
        if (!pos) {
            this.logError("Invalid pinch position received");
            return;
        }
        
        this.startPinchPos = pos;
        this.lastPinchPos = pos;
        this.isGrabbing = true;
        
        // Show indicator
        if (this.directionIndicator) {
            this.directionIndicator.enabled = true;
        }
        
        // Stop any current movement
        if (this.physicsBody.dynamic) {
            try {
                this.physicsBody.setVelocity(new vec3(0, 0, 0));
                this.physicsBody.setAngularVelocity(new vec3(0, 0, 0));
            } catch (e) {
                // Ignore if can't set velocity
            }
        }
        
        this.log("GRAB at: (" + pos.x.toFixed(3) + ", " + pos.y.toFixed(3) + ", " + pos.z.toFixed(3) + ")");
    }
    
    private onPinchHold(position: any) {
        if (!this.isGrabbing) return;
        
        const pos = this.toVec3(position);
        if (!pos) return;
        
        this.lastPinchPos = pos;
    }
    
    private onPinchEnd(position: any) {
        if (!this.isGrabbing) {
            this.log("Release ignored - wasn't grabbing");
            return;
        }
        
        const pos = this.toVec3(position);
        if (!pos || !this.startPinchPos) {
            this.log("Release failed - no position data");
            this.resetGrab();
            return;
        }
        
        this.log("RELEASE at: (" + pos.x.toFixed(3) + ", " + pos.y.toFixed(3) + ", " + pos.z.toFixed(3) + ")");
        
        // Calculate pull direction (throw goes opposite of pull, like a slingshot)
        const pullX = this.startPinchPos.x - pos.x;
        const pullY = this.startPinchPos.y - pos.y;
        const pullZ = this.startPinchPos.z - pos.z;
        
        this.log("Raw pull: (" + pullX.toFixed(3) + ", " + pullY.toFixed(3) + ", " + pullZ.toFixed(3) + ")");
        
        // Apply axis constraints
        const direction = this.constrainDirection(new vec3(pullX, pullY, pullZ));
        
        // Calculate pull distance
        const pullDistance = Math.sqrt(
            direction.x * direction.x + 
            direction.y * direction.y + 
            direction.z * direction.z
        );
        
        this.log("Pull distance: " + pullDistance.toFixed(4));
        
        // Check minimum pull
        if (pullDistance < this.minPullDistance) {
            this.log("Pull too short! (" + pullDistance.toFixed(4) + " < " + this.minPullDistance + ") - NO THROW");
            this.resetGrab();
            return;
        }
        
        // Normalize direction
        const normX = direction.x / pullDistance;
        const normY = direction.y / pullDistance;
        const normZ = direction.z / pullDistance;
        
        // Cap pull distance
        const cappedDistance = Math.min(pullDistance, this.maxPullDistance);
        const powerPercent = (cappedDistance / this.maxPullDistance) * 100;
        
        // Calculate force
        const forceX = normX * cappedDistance * this.forceMultiplier;
        const forceY = normY * cappedDistance * this.forceMultiplier;
        const forceZ = normZ * cappedDistance * this.forceMultiplier;
        
        const forceMagnitude = Math.sqrt(forceX * forceX + forceY * forceY + forceZ * forceZ);
        
        this.log("========== THROW ==========");
        this.log("Direction (normalized): (" + normX.toFixed(2) + ", " + normY.toFixed(2) + ", " + normZ.toFixed(2) + ")");
        this.log("Pull: " + cappedDistance.toFixed(3) + " / " + this.maxPullDistance + " (" + powerPercent.toFixed(0) + "% power)");
        this.log("Force vector: (" + forceX.toFixed(1) + ", " + forceY.toFixed(1) + ", " + forceZ.toFixed(1) + ")");
        this.log("Force magnitude: " + forceMagnitude.toFixed(1));
        
        // Check object position before throw
        const posBefore = this.physicsObject.getTransform().getWorldPosition();
        this.log("Object position before: (" + posBefore.x.toFixed(1) + ", " + posBefore.y.toFixed(1) + ", " + posBefore.z.toFixed(1) + ")");
        
        // Make sure physics body is dynamic
        const wasDynamic = this.physicsBody.dynamic;
        this.physicsBody.dynamic = true;
        this.log("Physics dynamic: " + wasDynamic + " -> true");
        
        // Apply the force
        const impulse = new vec3(forceX, forceY, forceZ);
        
        // Method 1: Try setting velocity directly (most reliable)
        try {
            this.physicsBody.velocity = impulse;
            this.log("Set velocity directly: (" + forceX.toFixed(1) + ", " + forceY.toFixed(1) + ", " + forceZ.toFixed(1) + ")");
        } catch (e) {
            this.log("Could not set velocity property: " + e);
        }
        
        // Method 2: Try addForce with Impulse mode (mode 1)
        try {
            this.physicsBody.addForce(impulse, 1); // 1 = Impulse mode
            this.log("addForce() called with mode 1 (Impulse)");
        } catch (e) {
            this.log("addForce mode 1 failed: " + e);
            
            // Method 3: Try addForce with mode 0
            try {
                this.physicsBody.addForce(impulse, 0);
                this.log("addForce() called with mode 0 (Force)");
            } catch (e2) {
                this.logError("All addForce methods failed");
            }
        }
        
        this.log("===========================");
        
        // Check if object moved after a short delay
        const self = this;
        const startX = posBefore.x;
        const startY = posBefore.y;
        const startZ = posBefore.z;
        
        var checkCount = 0;
        const checkEvent = this.createEvent("UpdateEvent");
        checkEvent.bind(function() {
            checkCount++;
            if (checkCount >= 6) { // ~0.1 seconds at 60fps
                const posAfter = self.physicsObject.getTransform().getWorldPosition();
                const movedX = Math.abs(posAfter.x - startX);
                const movedY = Math.abs(posAfter.y - startY);
                const movedZ = Math.abs(posAfter.z - startZ);
                const totalMoved = movedX + movedY + movedZ;
                
                if (totalMoved > 0.5) {
                    self.log("SUCCESS! Object moved to: (" + posAfter.x.toFixed(1) + ", " + posAfter.y.toFixed(1) + ", " + posAfter.z.toFixed(1) + ")");
                } else {
                    self.log("WARNING: Object barely moved. Check: Physics Body 'Dynamic' enabled? Collider not stuck?");
                }
                checkEvent.enabled = false;
            }
        });
        
        this.resetGrab();
    }
    
    // === INDICATOR UPDATE ===
    
    private updateIndicator() {
        if (!this.isGrabbing || !this.startPinchPos || !this.lastPinchPos || !this.directionIndicator) {
            return;
        }
        
        // Calculate pull direction
        const pullX = this.startPinchPos.x - this.lastPinchPos.x;
        const pullY = this.startPinchPos.y - this.lastPinchPos.y;
        const pullZ = this.startPinchPos.z - this.lastPinchPos.z;
        
        const direction = this.constrainDirection(new vec3(pullX, pullY, pullZ));
        
        const length = Math.sqrt(
            direction.x * direction.x + 
            direction.y * direction.y + 
            direction.z * direction.z
        );
        
        // Get object position for indicator placement
        const objectPos = this.physicsObject.getTransform().getWorldPosition();
        
        if (length < 0.001) {
            // No pull yet - show indicator at object
            this.indicatorTransform.setWorldPosition(objectPos);
            this.indicatorTransform.setLocalScale(new vec3(1, this.baseIndicatorLength, 1));
            return;
        }
        
        // Normalize
        const normX = direction.x / length;
        const normY = direction.y / length;
        const normZ = direction.z / length;
        
        // Calculate indicator length based on pull
        const pullStrength = Math.min(length, this.maxPullDistance);
        const indicatorLength = Math.min(
            this.baseIndicatorLength + (pullStrength * this.indicatorScaleMultiplier),
            this.maxIndicatorLength
        );
        
        // Position indicator ahead of object (where throw will go)
        const halfLength = indicatorLength / 2;
        this.indicatorTransform.setWorldPosition(new vec3(
            objectPos.x + normX * halfLength,
            objectPos.y + normY * halfLength,
            objectPos.z + normZ * halfLength
        ));
        
        // Rotate to point in throw direction
        const throwDir = new vec3(normX, normY, normZ);
        const upAxis = new vec3(0, 1, 0);
        const rotation = quat.rotationFromTo(upAxis, throwDir);
        this.indicatorTransform.setWorldRotation(rotation);
        
        // Scale indicator
        this.indicatorTransform.setLocalScale(new vec3(1, indicatorLength, 1));
    }
    
    // === HELPER FUNCTIONS ===
    
    private resetGrab() {
        this.isGrabbing = false;
        this.startPinchPos = null;
        this.lastPinchPos = null;
        
        if (this.directionIndicator) {
            this.directionIndicator.enabled = false;
        }
    }
    
    private constrainDirection(direction: vec3): vec3 {
        if (!this.lockToAxes) {
            return direction;
        }
        
        return new vec3(
            this.allowX ? direction.x : 0,
            this.allowY ? direction.y : 0,
            this.allowZ ? direction.z : 0
        );
    }
    
    private toVec3(v: any): vec3 | null {
        if (!v) return null;
        
        try {
            const x = (typeof v.x === 'number' && !isNaN(v.x)) ? v.x : 0;
            const y = (typeof v.y === 'number' && !isNaN(v.y)) ? v.y : 0;
            const z = (typeof v.z === 'number' && !isNaN(v.z)) ? v.z : 0;
            return new vec3(x, y, z);
        } catch (e) {
            return null;
        }
    }
    
    private log(message: string) {
        if (this.debugMode) {
            print("[PinchThrow] " + message);
        }
    }
    
    private logError(message: string) {
        // Always print errors
        print("[PinchThrow] ERROR: " + message);
    }
    
    // === PUBLIC API ===
    
    // Reset object back to starting position
    public reset() {
        this.physicsBody.dynamic = false;
        try {
            this.physicsBody.setVelocity(new vec3(0, 0, 0));
            this.physicsBody.setAngularVelocity(new vec3(0, 0, 0));
        } catch (e) {}
        this.physicsObject.getTransform().setWorldPosition(this.startPosition);
        this.log("Reset to start position");
    }
    
    // Reset object to a specific position
    public resetTo(position: vec3) {
        this.physicsBody.dynamic = false;
        try {
            this.physicsBody.setVelocity(new vec3(0, 0, 0));
            this.physicsBody.setAngularVelocity(new vec3(0, 0, 0));
        } catch (e) {}
        this.physicsObject.getTransform().setWorldPosition(position);
        this.log("Reset to: (" + position.x.toFixed(1) + ", " + position.y.toFixed(1) + ", " + position.z.toFixed(1) + ")");
    }
}