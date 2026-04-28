// jeep-physics.js - Pure physics simulation for drivable jeep (no THREE.js scene graph)
// Bicycle model steering, terrain following, drift, slope blocking, obstacle probes

// Constants derived from jeep-vehicle.js dimensions (length=4.0, width=1.8)
const WHEELBASE = 2.96;          // length * 0.37 * 2
const TRACK_WIDTH = 1.95;        // (width*0.5 + wheelWidth*0.3) * 2
const MASS = 1500;               // kg
const MAX_ENGINE_FORCE = 6000;   // N
const MAX_BRAKE_FORCE = 8000;    // N
const MAX_STEER_ANGLE = 0.55;    // rad (~31°)
const STEER_SPEED = 2.5;         // rad/s
const DRAG_COEFFICIENT = 0.4257;
const ROLLING_RESISTANCE = 12.8;
const ENGINE_BRAKING = 3.0;          // m/s² deceleration when throttle released (drivetrain friction)
const MAX_CLIMB_ANGLE = Math.PI / 4; // 45°
const GROUND_CLEARANCE = 0.45;
const MAX_DT = 1 / 20;           // Cap dt for anti-tunneling
const SUB_STEP_THRESHOLD = 0.3;  // When speed*dt > this, subdivide

const WHEEL_RADIUS = 0.40;

export class JeepPhysics {
    /**
     * @param {function} getHeightAt - (x, z) => height
     * @param {function} getTerrainNormal - (x, z) => {x, y, z}
     */
    constructor(getHeightAt, getTerrainNormal) {
        this._getHeightAt = getHeightAt;
        this._getTerrainNormal = getTerrainNormal;

        // Position & orientation
        this.positionX = 0;
        this.positionY = 0;
        this.positionZ = 0;
        this.yaw = 0;         // heading angle (radians)
        this.pitch = 0;       // body pitch from terrain
        this.roll = 0;        // body roll from terrain

        // Velocity
        this.speed = 0;       // scalar speed along heading
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityZ = 0;
        this.lateralSpeed = 0;

        // Steering
        this.steerAngle = 0;
        this.wheelSpinAngle = 0;

        // Suspension offsets per wheel [FL, FR, RL, RR]
        this.suspension = [0, 0, 0, 0];

        // State flags
        this.isGrounded = true;
        this.isDrifting = false;
        this.slipAngle = 0;

        // Bounds
        this.boundsMinX = 0;
        this.boundsMaxX = 200;
        this.boundsMinZ = 0;
        this.boundsMaxZ = 200;
    }

    /**
     * Teleport vehicle to position
     */
    reset(x, y, z, yaw = 0) {
        this.positionX = x;
        this.positionY = y;
        this.positionZ = z;
        this.yaw = yaw;
        this.pitch = 0;
        this.roll = 0;
        this.speed = 0;
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityZ = 0;
        this.lateralSpeed = 0;
        this.steerAngle = 0;
        this.wheelSpinAngle = 0;
        this.isDrifting = false;
        this.slipAngle = 0;
    }

    /**
     * Step the physics simulation
     * @param {number} dt - Delta time in seconds
     * @param {object} input - {throttle: -1..1, brake: 0..1, steer: -1..1, handbrake: bool}
     */
    update(dt, input) {
        // Cap dt
        dt = Math.min(dt, MAX_DT);

        // Anti-tunneling: subdivide if moving too fast
        const distPerStep = Math.abs(this.speed) * dt;
        if (distPerStep > SUB_STEP_THRESHOLD) {
            const subSteps = Math.ceil(distPerStep / SUB_STEP_THRESHOLD);
            const subDt = dt / subSteps;
            for (let i = 0; i < subSteps; i++) {
                this._step(subDt, input);
            }
        } else {
            this._step(dt, input);
        }
    }

    _step(dt, input) {
        const { throttle = 0, brake = 0, steer = 0, handbrake = false } = input;

        // 1. Steering — reduce max steer at speed for stability
        const effectiveMaxSteer = MAX_STEER_ANGLE / (1 + Math.abs(this.speed) * 0.15);
        const targetSteer = steer * effectiveMaxSteer;
        const steerDelta = STEER_SPEED * dt;
        if (Math.abs(targetSteer - this.steerAngle) < steerDelta) {
            this.steerAngle = targetSteer;
        } else {
            this.steerAngle += Math.sign(targetSteer - this.steerAngle) * steerDelta;
        }

        // 2. Forces
        const engineForce = throttle * MAX_ENGINE_FORCE / MASS;
        const brakeForce = brake * MAX_BRAKE_FORCE / MASS;
        const dragForce = -DRAG_COEFFICIENT * this.speed * Math.abs(this.speed) / MASS;
        const rollingForce = -ROLLING_RESISTANCE * this.speed / MASS;

        // Engine braking — drivetrain friction when throttle released
        let engineBraking = 0;
        if (throttle === 0 && Math.abs(this.speed) > 0.05) {
            engineBraking = this.speed > 0 ? -ENGINE_BRAKING : ENGINE_BRAKING;
        }

        // Net acceleration
        let acceleration = engineForce + dragForce + rollingForce + engineBraking;

        // Apply braking (always opposes current speed)
        if (brakeForce > 0) {
            if (this.speed > 0.1) {
                acceleration -= brakeForce;
            } else if (this.speed < -0.1) {
                acceleration += brakeForce;
            } else {
                // Allow reverse when braking from standstill with throttle
                this.speed = 0;
            }
        }

        // Handbrake — kill most longitudinal speed, allow lateral sliding
        if (handbrake) {
            this.speed *= (1 - 3 * dt); // Rapid deceleration
            this.isDrifting = true;
        }

        // 3. Slope blocking — check terrain normal
        const normal = this._getTerrainNormal(this.positionX, this.positionZ);
        const slopeAngle = Math.acos(Math.min(1, normal.y));

        if (slopeAngle > MAX_CLIMB_ANGLE) {
            // Too steep — reject forward velocity, apply downhill slide
            if (acceleration > 0) acceleration = 0;
            // Slide downhill along surface
            const slideForce = 9.8 * Math.sin(slopeAngle) * 0.5;
            // Compute downhill direction (negative of normal projected on XZ)
            const projLen = Math.sqrt(normal.x * normal.x + normal.z * normal.z);
            if (projLen > 0.001) {
                this.positionX += (-normal.x / projLen) * slideForce * dt;
                this.positionZ += (-normal.z / projLen) * slideForce * dt;
            }
        } else if (slopeAngle > MAX_CLIMB_ANGLE * 0.7) {
            // Steep but climbable — reduce engine power proportionally
            const steepFactor = 1 - (slopeAngle - MAX_CLIMB_ANGLE * 0.7) / (MAX_CLIMB_ANGLE * 0.3);
            if (acceleration > 0) acceleration *= Math.max(0, steepFactor);
        }

        // Update speed
        this.speed += acceleration * dt;

        // Clamp maximum speed
        const maxSpeed = 20; // ~72 km/h arcade cap
        this.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, this.speed));

        // Dead zone — stop creeping
        if (Math.abs(this.speed) < 0.05 && throttle === 0 && brake === 0) {
            this.speed = 0;
        }

        // 4. Bicycle model integration
        const angularVelocity = this.speed * Math.tan(this.steerAngle) / WHEELBASE;
        this.yaw += angularVelocity * dt;

        // 5. Drift mechanics — decompose velocity into longitudinal/lateral
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);

        // Forward direction
        const fwdX = sinYaw;
        const fwdZ = cosYaw;
        // Right direction
        const rightX = cosYaw;
        const rightZ = -sinYaw;

        // Compute current velocity direction
        let velX = fwdX * this.speed;
        let velZ = fwdZ * this.speed;

        // Add lateral component from turning
        this.lateralSpeed += angularVelocity * this.speed * 0.15 * dt;

        // Compute slip angle
        if (Math.abs(this.speed) > 0.5) {
            this.slipAngle = Math.abs(Math.atan2(this.lateralSpeed, Math.abs(this.speed)));
        } else {
            this.slipAngle = 0;
        }

        // Drift state
        this.isDrifting = this.slipAngle > 0.4 || handbrake;

        // Lateral grip — reduced when drifting
        const gripFactor = this.isDrifting ? 0.85 : 0.95;
        this.lateralSpeed *= Math.pow(gripFactor, dt * 60);

        // Dead-zone lateral
        if (Math.abs(this.lateralSpeed) < 0.01) this.lateralSpeed = 0;

        // Final velocity with lateral component
        velX += rightX * this.lateralSpeed;
        velZ += rightZ * this.lateralSpeed;

        // Update position
        this.positionX += velX * dt;
        this.positionZ += velZ * dt;

        this.velocityX = velX;
        this.velocityZ = velZ;

        // 6. Terrain following — sample height at 4 wheel positions
        const halfWB = WHEELBASE * 0.5;
        const halfTW = TRACK_WIDTH * 0.5;

        // Wheel positions in world space
        const flX = this.positionX + fwdX * halfWB - rightX * halfTW;
        const flZ = this.positionZ + fwdZ * halfWB - rightZ * halfTW;
        const frX = this.positionX + fwdX * halfWB + rightX * halfTW;
        const frZ = this.positionZ + fwdZ * halfWB + rightZ * halfTW;
        const rlX = this.positionX - fwdX * halfWB - rightX * halfTW;
        const rlZ = this.positionZ - fwdZ * halfWB - rightZ * halfTW;
        const rrX = this.positionX - fwdX * halfWB + rightX * halfTW;
        const rrZ = this.positionZ - fwdZ * halfWB + rightZ * halfTW;

        const hFL = this._getHeightAt(flX, flZ);
        const hFR = this._getHeightAt(frX, frZ);
        const hRL = this._getHeightAt(rlX, rlZ);
        const hRR = this._getHeightAt(rrX, rrZ);

        // Store suspension offsets (visual only)
        const avgHeight = (hFL + hFR + hRL + hRR) * 0.25;
        this.suspension[0] = hFL - avgHeight;
        this.suspension[1] = hFR - avgHeight;
        this.suspension[2] = hRL - avgHeight;
        this.suspension[3] = hRR - avgHeight;

        // Target body Y — use max of wheel average and center height
        // to prevent averaging-down on steep slopes
        const centerHeight = this._getHeightAt(this.positionX, this.positionZ);
        const targetY = Math.max(avgHeight, centerHeight) + GROUND_CLEARANCE;

        // Smooth terrain following
        const terrainLerpFactor = 1 - Math.exp(-10 * dt);
        this.positionY += (targetY - this.positionY) * terrainLerpFactor;

        // Hard floor clamp — vehicle must never go below terrain
        this.positionY = Math.max(this.positionY, centerHeight + GROUND_CLEARANCE);

        // Pitch from front-rear height difference
        const frontAvg = (hFL + hFR) * 0.5;
        const rearAvg = (hRL + hRR) * 0.5;
        const targetPitch = Math.atan2(rearAvg - frontAvg, WHEELBASE);

        // Roll from left-right height difference
        const leftAvg = (hFL + hRL) * 0.5;
        const rightAvg = (hFR + hRR) * 0.5;
        const targetRoll = Math.atan2(rightAvg - leftAvg, TRACK_WIDTH);

        this.pitch += (targetPitch - this.pitch) * terrainLerpFactor;
        this.roll += (targetRoll - this.roll) * terrainLerpFactor;

        this.isGrounded = true;

        // 7. Wheel spin animation
        this.wheelSpinAngle += (this.speed / WHEEL_RADIUS) * dt;

        // 8. Bounds clamping
        const margin = 2;
        this.positionX = Math.max(this.boundsMinX + margin, Math.min(this.boundsMaxX - margin, this.positionX));
        this.positionZ = Math.max(this.boundsMinZ + margin, Math.min(this.boundsMaxZ - margin, this.positionZ));

        // Kill speed at bounds
        if (this.positionX <= this.boundsMinX + margin || this.positionX >= this.boundsMaxX - margin) {
            this.speed *= 0.5;
            this.velocityX *= 0.5;
        }
        if (this.positionZ <= this.boundsMinZ + margin || this.positionZ >= this.boundsMaxZ - margin) {
            this.speed *= 0.5;
            this.velocityZ *= 0.5;
        }
    }

    /**
     * Returns 8 world-space perimeter points for collision raycasting
     */
    getCollisionProbePoints() {
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);
        const fwdX = sinYaw;
        const fwdZ = cosYaw;
        const rightX = cosYaw;
        const rightZ = -sinYaw;

        const halfL = 2.0;    // half length
        const halfW = 1.0;    // half width
        const y = this.positionY;

        const points = [];
        // 4 corners
        points.push({ x: this.positionX + fwdX * halfL + rightX * halfW, y, z: this.positionZ + fwdZ * halfL + rightZ * halfW });
        points.push({ x: this.positionX + fwdX * halfL - rightX * halfW, y, z: this.positionZ + fwdZ * halfL - rightZ * halfW });
        points.push({ x: this.positionX - fwdX * halfL + rightX * halfW, y, z: this.positionZ - fwdZ * halfL + rightZ * halfW });
        points.push({ x: this.positionX - fwdX * halfL - rightX * halfW, y, z: this.positionZ - fwdZ * halfL - rightZ * halfW });
        // 4 edge midpoints
        points.push({ x: this.positionX + fwdX * halfL, y, z: this.positionZ + fwdZ * halfL }); // front center
        points.push({ x: this.positionX - fwdX * halfL, y, z: this.positionZ - fwdZ * halfL }); // rear center
        points.push({ x: this.positionX + rightX * halfW, y, z: this.positionZ + rightZ * halfW }); // right center
        points.push({ x: this.positionX - rightX * halfW, y, z: this.positionZ - rightZ * halfW }); // left center

        return points;
    }

    /**
     * Apply collision response — push out and reduce speed
     * @param {object} hitNormal - {x, y, z} of the collision surface
     * @param {number} penetration - depth of penetration
     */
    applyCollisionResponse(hitNormal, penetration) {
        // Push out
        this.positionX += hitNormal.x * penetration;
        this.positionZ += hitNormal.z * penetration;

        // Kill speed
        this.speed *= 0.3;
        this.lateralSpeed *= 0.3;
    }

    /**
     * Get current state for mesh sync
     */
    getState() {
        return {
            positionX: this.positionX,
            positionY: this.positionY,
            positionZ: this.positionZ,
            yaw: this.yaw,
            pitch: this.pitch,
            roll: this.roll,
            speed: this.speed,
            velocityX: this.velocityX,
            velocityY: this.velocityY,
            velocityZ: this.velocityZ,
            steerAngle: this.steerAngle,
            wheelSpinAngle: this.wheelSpinAngle,
            suspension: this.suspension,
            isGrounded: this.isGrounded,
            isDrifting: this.isDrifting,
            slipAngle: this.slipAngle,
        };
    }
}
