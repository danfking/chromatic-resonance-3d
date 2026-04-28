// vehicle-physics-4x4.js - Per-wheel suspension vehicle physics
// Replaces bicycle model with independent spring-damper suspension per wheel,
// weight distribution from center of mass, rollover prevention, terrain-dependent drag

// Dimensions from jeep-vehicle.js (length=4.0, width=1.8)
const WHEELBASE = 2.96;
const TRACK_WIDTH = 1.95;
const HALF_WB = WHEELBASE * 0.5;
const HALF_TW = TRACK_WIDTH * 0.5;

const DEFAULT_MASS = 1500;         // kg base vehicle
const MAX_ENGINE_FORCE = 6000;     // N
const MAX_BRAKE_FORCE = 8000;      // N
const MAX_STEER_ANGLE = 0.55;      // rad (~31°)
const STEER_SPEED = 2.5;           // rad/s
const STEER_SPEED_REDUCTION = 0.15; // Critical: reduces steer range at speed
const DRAG_COEFFICIENT = 0.4257;
const ROLLING_RESISTANCE = 12.8;
const ENGINE_BRAKING = 3.0;          // m/s² deceleration when throttle released (drivetrain friction)
const MAX_CLIMB_ANGLE = Math.PI / 4;
const GROUND_CLEARANCE = 0.45;
const MAX_DT = 1 / 20;
const SUB_STEP_THRESHOLD = 0.3;
const WHEEL_RADIUS = 0.40;
const MAX_SPEED = 20;              // ~72 km/h arcade cap
const GRAVITY = 9.81;

// Suspension parameters
const SPRING_K = 25000;            // N/m spring stiffness
const DAMPING_C = 3000;            // N*s/m damping coefficient
const REST_LENGTH = 0.45;          // m natural spring length
const MAX_COMPRESSION = 0.35;      // m max travel before bottoming out
const MIN_COMPRESSION = -0.1;      // m max extension (rebound)

// Rollover prevention
const CG_HEIGHT = 0.7;            // m center of gravity height
const ANTI_ROLL_TORQUE = 15000;    // N*m max anti-roll assistance

// Terrain drag/traction lookup
const TERRAIN_TYPES = {
    grass:    { drag: 0.5,  traction: 0.8 },
    dirt:     { drag: 0.6,  traction: 0.7 },
    mud:      { drag: 1.2,  traction: 0.4 },
    rock:     { drag: 0.35, traction: 0.9 },
    water:    { drag: 2.5,  traction: 0.2 },
    road:     { drag: 0.25, traction: 1.0 },
    default:  { drag: 0.45, traction: 0.85 },
};

// Height thresholds for terrain classification
// Below waterLevel → water, steep slope → rock, etc.
const WATER_LEVEL = 2.0;
const ROCK_SLOPE_THRESHOLD = 0.7; // cos of slope angle

/**
 * Classify terrain type from height and slope
 * @param {number} height - terrain height at point
 * @param {number} slopeY - Y component of terrain normal (1 = flat, 0 = vertical)
 * @returns {object} { drag, traction }
 */
function classifyTerrain(height, slopeY) {
    if (height < WATER_LEVEL) return TERRAIN_TYPES.water;
    if (slopeY < ROCK_SLOPE_THRESHOLD) return TERRAIN_TYPES.rock;
    if (height < 4.0) return TERRAIN_TYPES.mud;
    if (height > 15.0) return TERRAIN_TYPES.rock;
    return TERRAIN_TYPES.grass;
}

/**
 * Per-wheel state
 */
class WheelState {
    constructor(localX, localZ, name) {
        this.localX = localX;      // position relative to vehicle center
        this.localZ = localZ;
        this.name = name;           // 'FL', 'FR', 'RL', 'RR'

        this.worldX = 0;
        this.worldZ = 0;
        this.terrainHeight = 0;
        this.compression = 0;       // current spring compression
        this.compressionVel = 0;    // compression velocity
        this.springForce = 0;       // computed spring force
        this.normalLoad = 0;        // vertical force on this wheel
        this.terrainType = TERRAIN_TYPES.default;
        this.isGrounded = true;
        this.spinAngle = 0;         // visual wheel rotation
    }
}

export class VehiclePhysics4x4 {
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
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;

        // Velocity
        this.speed = 0;
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityZ = 0;
        this.lateralSpeed = 0;

        // Steering
        this.steerAngle = 0;
        this.wheelSpinAngle = 0;

        // Per-wheel state [FL, FR, RL, RR]
        this.wheels = [
            new WheelState(-HALF_TW,  HALF_WB, 'FL'),
            new WheelState( HALF_TW,  HALF_WB, 'FR'),
            new WheelState(-HALF_TW, -HALF_WB, 'RL'),
            new WheelState( HALF_TW, -HALF_WB, 'RR'),
        ];

        // Suspension offsets for visual sync (backward compat with jeep-physics)
        this.suspension = [0, 0, 0, 0];

        // Mass and center of gravity
        this.mass = DEFAULT_MASS;
        this.cgOffsetX = 0;        // CG offset from geometric center
        this.cgOffsetZ = 0;        // positive = forward

        // Component mass additions
        this._componentMass = 0;
        this._componentCGX = 0;
        this._componentCGZ = 0;

        // State flags
        this.isGrounded = true;
        this.isDrifting = false;
        this.slipAngle = 0;
        this.rolloverRisk = 0;     // 0-1, triggers anti-roll above 0.8

        // Damage modifiers (1.0 = full, set by damage system)
        this.engineMultiplier = 1.0;
        this.steeringMultiplier = 1.0;

        // Augment system reference (set externally)
        this.augmentSystem = null;

        // Bounds
        this.boundsMinX = 0;
        this.boundsMaxX = 200;
        this.boundsMinZ = 0;
        this.boundsMaxZ = 200;
    }

    /**
     * Add component mass that shifts center of gravity
     * Called by vehicle-components system when equipping/unequipping
     */
    setComponentMass(totalComponentMass, cgX, cgZ) {
        this._componentMass = totalComponentMass;
        this._componentCGX = cgX;
        this._componentCGZ = cgZ;
        this._recalculateMass();
    }

    _recalculateMass() {
        this.mass = DEFAULT_MASS + this._componentMass;
        // Weighted CG = (baseMass * basePos + componentMass * componentPos) / totalMass
        this.cgOffsetX = (this._componentMass * this._componentCGX) / this.mass;
        this.cgOffsetZ = (this._componentMass * this._componentCGZ) / this.mass;
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
        this.rolloverRisk = 0;

        for (const w of this.wheels) {
            w.compression = 0;
            w.compressionVel = 0;
            w.springForce = 0;
            w.normalLoad = this.mass * GRAVITY * 0.25; // equal distribution at rest
            w.spinAngle = 0;
        }
    }

    /**
     * Step the physics simulation
     * @param {number} dt - Delta time in seconds
     * @param {object} input - {throttle: -1..1, brake: 0..1, steer: -1..1, handbrake: bool}
     */
    update(dt, input) {
        dt = Math.min(dt, MAX_DT);

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

        // Direction vectors
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);
        const fwdX = sinYaw;
        const fwdZ = cosYaw;
        const rightX = cosYaw;
        const rightZ = -sinYaw;

        // ─── 1. STEERING ──────────────────────────────────────────────
        const effectiveMaxSteer = MAX_STEER_ANGLE * this.steeringMultiplier /
            (1 + Math.abs(this.speed) * STEER_SPEED_REDUCTION);
        const targetSteer = steer * effectiveMaxSteer;
        const steerDelta = STEER_SPEED * dt;
        if (Math.abs(targetSteer - this.steerAngle) < steerDelta) {
            this.steerAngle = targetSteer;
        } else {
            this.steerAngle += Math.sign(targetSteer - this.steerAngle) * steerDelta;
        }

        // ─── 2. WHEEL POSITIONS & TERRAIN SAMPLING ───────────────────
        let totalNormalForce = 0;
        let anyGrounded = false;
        let totalDrag = 0;
        let totalTraction = 0;

        for (let i = 0; i < 4; i++) {
            const w = this.wheels[i];

            // World position of wheel
            w.worldX = this.positionX + fwdX * w.localZ + rightX * w.localX;
            w.worldZ = this.positionZ + fwdZ * w.localZ + rightZ * w.localX;

            // Sample terrain
            w.terrainHeight = this._getHeightAt(w.worldX, w.worldZ);
            const normal = this._getTerrainNormal(w.worldX, w.worldZ);
            w.terrainType = classifyTerrain(w.terrainHeight, normal.y);

            // Spring compression = how much the spring is compressed
            // positive = compressed, negative = extended
            const wheelBottomY = this.positionY - GROUND_CLEARANCE + w.compression;
            const targetCompression = w.terrainHeight - (this.positionY - GROUND_CLEARANCE);

            // Compression velocity
            const prevCompression = w.compression;
            w.compression = Math.max(MIN_COMPRESSION,
                Math.min(MAX_COMPRESSION, targetCompression));
            w.compressionVel = (w.compression - prevCompression) / dt;

            // Spring-damper force: F = k * compression + c * compressionVelocity
            w.springForce = SPRING_K * w.compression + DAMPING_C * w.compressionVel;
            w.springForce = Math.max(0, w.springForce); // Springs can only push, not pull

            w.isGrounded = w.compression > MIN_COMPRESSION + 0.01;
            if (w.isGrounded) anyGrounded = true;

            // Weight distribution based on CG offset
            // Lever arm ratio: how far each wheel is from CG
            const leverX = w.localX - this.cgOffsetX;
            const leverZ = w.localZ - this.cgOffsetZ;
            // Static weight distribution factor (inverse distance weighting)
            const distFromCG = Math.sqrt(leverX * leverX + leverZ * leverZ) + 0.1;
            w.normalLoad = w.springForce;
            totalNormalForce += w.normalLoad;

            // Accumulate terrain effects
            if (w.isGrounded) {
                totalDrag += w.terrainType.drag;
                totalTraction += w.terrainType.traction;
            }
        }

        // Average terrain properties from grounded wheels
        const groundedCount = this.wheels.filter(w => w.isGrounded).length || 1;
        const avgDrag = totalDrag / groundedCount;
        const avgTraction = totalTraction / groundedCount;

        this.isGrounded = anyGrounded;

        // ─── 3. FORCES ───────────────────────────────────────────────
        const engineForce = throttle * MAX_ENGINE_FORCE * this.engineMultiplier / this.mass;
        const brakeForce = brake * MAX_BRAKE_FORCE / this.mass;
        const terrainDragForce = -avgDrag * this.speed * 2.0 / this.mass;
        const dragForce = -DRAG_COEFFICIENT * this.speed * Math.abs(this.speed) / this.mass;
        const rollingForce = -ROLLING_RESISTANCE * this.speed / this.mass;

        // Engine braking — drivetrain friction when throttle released
        let engineBrakingForce = 0;
        if (throttle === 0 && Math.abs(this.speed) > 0.05) {
            engineBrakingForce = this.speed > 0 ? -ENGINE_BRAKING : ENGINE_BRAKING;
        }

        let acceleration = engineForce * avgTraction + dragForce + rollingForce + terrainDragForce + engineBrakingForce;

        // Braking
        if (brakeForce > 0) {
            if (this.speed > 0.1) {
                acceleration -= brakeForce;
            } else if (this.speed < -0.1) {
                acceleration += brakeForce;
            } else {
                this.speed = 0;
            }
        }

        // Handbrake
        if (handbrake) {
            this.speed *= (1 - 3 * dt);
            this.isDrifting = true;
        }

        // ─── 4. SLOPE BLOCKING ───────────────────────────────────────
        const normal = this._getTerrainNormal(this.positionX, this.positionZ);
        const slopeAngle = Math.acos(Math.min(1, normal.y));

        if (slopeAngle > MAX_CLIMB_ANGLE) {
            if (acceleration > 0) acceleration = 0;
            const slideForce = GRAVITY * Math.sin(slopeAngle) * 0.5;
            const projLen = Math.sqrt(normal.x * normal.x + normal.z * normal.z);
            if (projLen > 0.001) {
                this.positionX += (-normal.x / projLen) * slideForce * dt;
                this.positionZ += (-normal.z / projLen) * slideForce * dt;
            }
        } else if (slopeAngle > MAX_CLIMB_ANGLE * 0.7) {
            const steepFactor = 1 - (slopeAngle - MAX_CLIMB_ANGLE * 0.7) / (MAX_CLIMB_ANGLE * 0.3);
            if (acceleration > 0) acceleration *= Math.max(0, steepFactor);
        }

        // Update speed
        this.speed += acceleration * dt;

        // Apply engine augment effects (nitro speed boost)
        let effectiveMaxSpeed = MAX_SPEED;
        const engineEffects = this.augmentSystem?.getEngineEffects();
        if (engineEffects) {
            if (engineEffects.nitroSpeedMult) {
                effectiveMaxSpeed *= engineEffects.nitroSpeedMult;
            }
            this.ramDamage = engineEffects.ramDamage || 0;
            this.essenceDrainMult = engineEffects.essenceDrainMult || 1.0;
        }
        this.speed = Math.max(-effectiveMaxSpeed * 0.4, Math.min(effectiveMaxSpeed, this.speed));

        // Dead zone
        if (Math.abs(this.speed) < 0.05 && throttle === 0 && brake === 0) {
            this.speed = 0;
        }

        // ─── 5. TURNING (bicycle model preserved for stability) ──────
        const angularVelocity = this.speed * Math.tan(this.steerAngle) / WHEELBASE;
        this.yaw += angularVelocity * dt;

        // ─── 6. DRIFT MECHANICS ──────────────────────────────────────
        let velX = fwdX * this.speed;
        let velZ = fwdZ * this.speed;

        this.lateralSpeed += angularVelocity * this.speed * 0.15 * dt;

        if (Math.abs(this.speed) > 0.5) {
            this.slipAngle = Math.abs(Math.atan2(this.lateralSpeed, Math.abs(this.speed)));
        } else {
            this.slipAngle = 0;
        }

        this.isDrifting = this.slipAngle > 0.4 || handbrake;

        const gripFactor = this.isDrifting ? 0.85 : 0.95;
        this.lateralSpeed *= Math.pow(gripFactor, dt * 60);
        if (Math.abs(this.lateralSpeed) < 0.01) this.lateralSpeed = 0;

        velX += rightX * this.lateralSpeed;
        velZ += rightZ * this.lateralSpeed;

        this.positionX += velX * dt;
        this.positionZ += velZ * dt;
        this.velocityX = velX;
        this.velocityZ = velZ;

        // ─── 7. SUSPENSION → BODY POSE ──────────────────────────────
        // Compute body height and orientation from 4 spring forces
        const hFL = this.wheels[0].terrainHeight;
        const hFR = this.wheels[1].terrainHeight;
        const hRL = this.wheels[2].terrainHeight;
        const hRR = this.wheels[3].terrainHeight;

        // Weighted average height from spring forces
        const totalForce = totalNormalForce || 1;
        let weightedHeight = 0;
        for (const w of this.wheels) {
            weightedHeight += w.terrainHeight * (w.normalLoad / totalForce);
        }
        const targetY = weightedHeight + GROUND_CLEARANCE;

        // Smooth terrain following (preserving jeep-physics lerp)
        const terrainLerpFactor = 1 - Math.exp(-10 * dt);
        this.positionY += (targetY - this.positionY) * terrainLerpFactor;

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

        // ─── 8. ROLLOVER PREVENTION ─────────────────────────────────
        // Lateral acceleration from turning
        const lateralAccel = Math.abs(this.speed * angularVelocity);
        // Static stability factor
        const stabilityFactor = TRACK_WIDTH / (2 * CG_HEIGHT);
        this.rolloverRisk = lateralAccel / (stabilityFactor * GRAVITY);

        if (this.rolloverRisk > 0.8) {
            // Apply anti-roll: reduce lateral grip and dampen roll
            const rollCorrection = (this.rolloverRisk - 0.8) * 5; // 0-1 correction
            this.lateralSpeed *= (1 - rollCorrection * 0.3 * dt * 60);
            // Dampen roll angle toward 0
            this.roll *= (1 - rollCorrection * 0.2 * dt * 60);
            // Visual teeter: add slight oscillation rather than full correction
            this.roll += Math.sin(Date.now() * 0.01) * rollCorrection * 0.02;
        }

        // ─── 9. SUSPENSION VISUAL OFFSETS ───────────────────────────
        const avgHeight = (hFL + hFR + hRL + hRR) * 0.25;
        this.suspension[0] = hFL - avgHeight;
        this.suspension[1] = hFR - avgHeight;
        this.suspension[2] = hRL - avgHeight;
        this.suspension[3] = hRR - avgHeight;

        // ─── 10. WHEEL SPIN ─────────────────────────────────────────
        this.wheelSpinAngle += (this.speed / WHEEL_RADIUS) * dt;
        for (const w of this.wheels) {
            w.spinAngle = this.wheelSpinAngle;
        }

        // ─── 11. BOUNDS CLAMPING ────────────────────────────────────
        const margin = 2;
        this.positionX = Math.max(this.boundsMinX + margin, Math.min(this.boundsMaxX - margin, this.positionX));
        this.positionZ = Math.max(this.boundsMinZ + margin, Math.min(this.boundsMaxZ - margin, this.positionZ));

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
     * (Same as JeepPhysics for backward compatibility)
     */
    getCollisionProbePoints() {
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);
        const fwdX = sinYaw;
        const fwdZ = cosYaw;
        const rightX = cosYaw;
        const rightZ = -sinYaw;

        const halfL = 2.0;
        const halfW = 1.0;
        const y = this.positionY;

        const points = [];
        points.push({ x: this.positionX + fwdX * halfL + rightX * halfW, y, z: this.positionZ + fwdZ * halfL + rightZ * halfW });
        points.push({ x: this.positionX + fwdX * halfL - rightX * halfW, y, z: this.positionZ + fwdZ * halfL - rightZ * halfW });
        points.push({ x: this.positionX - fwdX * halfL + rightX * halfW, y, z: this.positionZ - fwdZ * halfL + rightZ * halfW });
        points.push({ x: this.positionX - fwdX * halfL - rightX * halfW, y, z: this.positionZ - fwdZ * halfL - rightZ * halfW });
        points.push({ x: this.positionX + fwdX * halfL, y, z: this.positionZ + fwdZ * halfL });
        points.push({ x: this.positionX - fwdX * halfL, y, z: this.positionZ - fwdZ * halfL });
        points.push({ x: this.positionX + rightX * halfW, y, z: this.positionZ + rightZ * halfW });
        points.push({ x: this.positionX - rightX * halfW, y, z: this.positionZ - rightZ * halfW });

        return points;
    }

    /**
     * Apply collision response
     */
    applyCollisionResponse(hitNormal, penetration) {
        this.positionX += hitNormal.x * penetration;
        this.positionZ += hitNormal.z * penetration;
        this.speed *= 0.3;
        this.lateralSpeed *= 0.3;
    }

    /**
     * Get current state for mesh sync (backward compatible with JeepPhysics.getState())
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
            rolloverRisk: this.rolloverRisk,
            engineMultiplier: this.engineMultiplier,
            steeringMultiplier: this.steeringMultiplier,
            wheels: this.wheels.map(w => ({
                name: w.name,
                worldX: w.worldX,
                worldZ: w.worldZ,
                compression: w.compression,
                springForce: w.springForce,
                normalLoad: w.normalLoad,
                isGrounded: w.isGrounded,
                terrainType: w.terrainType,
                spinAngle: w.spinAngle,
            })),
        };
    }

    /**
     * Get per-wheel terrain data for debugging/UI
     */
    getWheelStates() {
        return this.wheels.map(w => ({
            name: w.name,
            compression: w.compression,
            springForce: w.springForce,
            normalLoad: w.normalLoad,
            isGrounded: w.isGrounded,
            terrainDrag: w.terrainType.drag,
            terrainTraction: w.terrainType.traction,
        }));
    }
}
