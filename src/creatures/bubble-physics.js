// bubble-physics.js - Realistic bubble deformation physics
// Handles impact compression, elastic rebound, wobble, and movement deformation

import * as THREE from 'three';

// Default physics parameters (tuned by user)
export const BUBBLE_PHYSICS_DEFAULTS = {
    // Membrane properties
    surfaceTension: 0.6,      // Stiffness (lower = more wobbly)
    elasticity: 0.7,          // Bounce back strength (0-1)
    damping: 0.2,             // Wobble decay rate (lower = wobbles longer)

    // Impact response
    maxCompression: 0.5,      // Max flatten ratio (0.5 = squash to 50% height)
    recoveryTime: 0.4,        // Seconds to restore shape
    wobbleFrequency: 50,      // Oscillations per second (higher = more visible)
    wobbleDecay: 0.55,        // How fast wobble fades (lower = wobbles longer)

    // Ground sag (low-pressure tire effect)
    groundSag: 0.34,          // How much to flatten when grounded
    groundSagSmoothing: 11,   // How fast sag responds to grounded state

    // Movement deformation
    movementStretch: 0.2,     // How much to elongate when moving
    stretchSmoothing: 11,     // How fast stretch follows velocity

    // Collision
    particleTransfer: 0.1,    // % particles exchanged on collision
    pushForce: 5.0,           // Knockback strength
    stickyThreshold: 0.2      // Below this speed, bubbles can merge
};

/**
 * BubblePhysics - Manages deformation state for a bubble creature
 */
export class BubblePhysics {
    constructor(options = {}) {
        this.config = { ...BUBBLE_PHYSICS_DEFAULTS, ...options };

        // Deformation state
        this.deformation = 0;           // Current compression (0-1)
        this.deformAxis = new THREE.Vector3(0, 1, 0);  // Axis of compression
        this.targetDeformation = 0;     // Target deformation to lerp toward

        // Wobble state
        this.wobblePhase = 0;           // Current wobble animation phase
        this.wobbleAmplitude = 0;       // Current wobble strength
        this.wobbleAxis = new THREE.Vector3(1, 0, 0);  // Secondary wobble axis

        // Velocity tracking for movement deformation
        this.velocity = new THREE.Vector3();
        this.smoothedVelocity = new THREE.Vector3();
        this.stretchAmount = 0;
        this.stretchAxis = new THREE.Vector3(0, 0, 1);

        // Impact tracking
        this.lastImpactTime = 0;
        this.impactIntensity = 0;

        // Ground sag (low-pressure tire bulge)
        this.isGrounded = false;
        this.currentGroundSag = 0;

        // ACCELERATION-BASED PHYSICS (research-backed approach)
        // Key insight: use acceleration (change in velocity), not velocity itself
        this.prevVelocity = new THREE.Vector3();
        this.currentVelocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();  // Computed each frame
        this.smoothedAcceleration = new THREE.Vector3();  // For visual smoothness

        // Turn/centrifugal bulge (now based on lateral acceleration)
        this.turnBulgeAmount = 0;    // Smoothed bulge amount
        this.turnBulgeDir = new THREE.Vector3(1, 0, 0);  // Direction of bulge

        // Momentum for internal particles
        this.particleMomentum = new THREE.Vector3();
    }

    /**
     * Set grounded state for ground sag effect
     * @param {boolean} grounded - Whether creature is on the ground
     */
    setGrounded(grounded) {
        this.isGrounded = grounded;
    }

    /**
     * Set velocity for acceleration-based physics
     * Acceleration is computed internally as (current - previous) / delta
     * @param {THREE.Vector3} velocity - Current velocity vector
     */
    setVelocityForPhysics(velocity) {
        // Store previous before updating
        this.prevVelocity.copy(this.currentVelocity);
        this.currentVelocity.copy(velocity);
    }

    /**
     * DEPRECATED: Use setVelocityForPhysics instead
     * Kept for backwards compatibility
     */
    setTurnInfo(turnCross, momentum) {
        // Convert old API to new acceleration-based system
        this.setVelocityForPhysics(momentum);
    }

    /**
     * Apply an impact to the bubble
     * @param {THREE.Vector3} direction - Direction the impact came from (normalized)
     * @param {number} force - Impact force (0-1 for normal hits, >1 for heavy)
     */
    applyImpact(direction, force) {
        // Set deformation axis (opposite to impact direction)
        this.deformAxis.copy(direction).negate();

        // Calculate deformation amount based on force
        const compression = Math.min(force * 0.5, this.config.maxCompression);
        this.targetDeformation = compression;
        this.deformation = compression * 0.8; // Instant partial compression

        // Start wobble
        this.wobbleAmplitude = compression * 1.5;
        this.wobblePhase = 0;

        // Set wobble axis perpendicular to deform axis
        this.wobbleAxis.set(
            this.deformAxis.y + this.deformAxis.z,
            -this.deformAxis.x,
            -this.deformAxis.x
        ).normalize();

        // Apply momentum to internal particles (opposite to impact)
        this.particleMomentum.copy(direction).multiplyScalar(-force * 2);

        this.lastImpactTime = performance.now();
        this.impactIntensity = force;
    }

    /**
     * Apply movement-based deformation
     * @param {THREE.Vector3} velocity - Current movement velocity
     */
    setVelocity(velocity) {
        this.velocity.copy(velocity);
    }

    /**
     * Update physics state
     * @param {number} delta - Time delta in seconds
     * @returns {Object} Current deformation state for shader
     */
    update(delta) {
        const config = this.config;

        // === IMPACT DEFORMATION RECOVERY ===
        if (this.deformation > 0.001) {
            // Spring back to sphere
            const recovery = config.surfaceTension * delta / config.recoveryTime;
            this.deformation = Math.max(0, this.deformation - recovery);
            this.targetDeformation *= (1 - recovery * 2);
        }

        // === WOBBLE UPDATE ===
        if (this.wobbleAmplitude > 0.001) {
            // Advance wobble phase
            this.wobblePhase += config.wobbleFrequency * delta * Math.PI * 2;

            // Decay wobble amplitude
            this.wobbleAmplitude *= Math.pow(1 - config.wobbleDecay, delta * 10);

            if (this.wobbleAmplitude < 0.001) {
                this.wobbleAmplitude = 0;
            }
        }

        // === MOVEMENT STRETCH ===
        // Smooth velocity for stretch calculation
        this.smoothedVelocity.lerp(this.velocity, config.stretchSmoothing * delta);

        const speed = this.smoothedVelocity.length();
        if (speed > 0.1) {
            // Calculate stretch based on speed
            this.stretchAmount = Math.min(speed * config.movementStretch, 0.3);

            // Stretch axis is movement direction
            this.stretchAxis.copy(this.smoothedVelocity).normalize();
        } else {
            // Fade stretch when stopped
            this.stretchAmount *= Math.pow(0.1, delta * 5);
        }

        // === PARTICLE MOMENTUM DECAY ===
        this.particleMomentum.multiplyScalar(Math.pow(0.3, delta * 5));

        // === GROUND SAG (low-pressure tire bulge) ===
        const targetSag = this.isGrounded ? config.groundSag : 0;
        this.currentGroundSag = THREE.MathUtils.lerp(
            this.currentGroundSag,
            targetSag,
            config.groundSagSmoothing * delta
        );

        // === ACCELERATION-BASED TURN BULGE (centrifugal effect) ===
        // Compute acceleration: change in velocity this frame
        const safeDelta = Math.max(delta, 0.001);
        this.acceleration.subVectors(this.currentVelocity, this.prevVelocity).divideScalar(safeDelta);

        // Smooth the acceleration for visual stability
        this.smoothedAcceleration.lerp(this.acceleration, 6 * delta);

        // Get horizontal velocity and acceleration
        const horizVel = new THREE.Vector3(this.currentVelocity.x, 0, this.currentVelocity.z);
        const horizAccel = new THREE.Vector3(this.smoothedAcceleration.x, 0, this.smoothedAcceleration.z);
        const currentSpeed = horizVel.length();

        // CRITICAL: Only use acceleration PERPENDICULAR to velocity (true lateral/centripetal)
        // This filters out forward/backward acceleration (speeding up/slowing down)
        // which should NOT cause centrifugal bulge - only turning does
        let perpendicularAccel = new THREE.Vector3();

        if (currentSpeed > 0.3) {
            // Get velocity direction
            const velDir = horizVel.clone().normalize();

            // Project acceleration onto velocity to get forward component
            const forwardComponent = velDir.clone().multiplyScalar(horizAccel.dot(velDir));

            // Subtract forward component to get perpendicular (lateral) component
            perpendicularAccel = horizAccel.clone().sub(forwardComponent);
        }

        const perpAccelMag = perpendicularAccel.length();

        // Get tuning values (from sliders if available, otherwise defaults)
        const tuning = this.tuning || {};
        const bulgeThreshold = tuning.bulgeThreshold ?? 6;
        const bulgeMultiplier = tuning.bulgeMultiplier ?? 0.08;
        const bulgeMax = tuning.bulgeMax ?? 0.5;
        const bulgeLerp = tuning.bulgeLerp ?? 18;
        const bulgeDirLerp = tuning.bulgeDirLerp ?? 6;
        const bulgeDecay = tuning.bulgeDecay ?? 0.38;

        // Only apply bulge when:
        // 1. Grounded (so blob contacts ground)
        // 2. Moving at reasonable speed
        // 3. Experiencing perpendicular acceleration (actual turning, not just stopping)
        if (this.isGrounded && currentSpeed > 0.5 && perpAccelMag > bulgeThreshold) {
            // Bulge strength based on perpendicular acceleration magnitude
            const targetBulge = Math.min(perpAccelMag * bulgeMultiplier, bulgeMax);

            // Smooth the bulge amount
            this.turnBulgeAmount = THREE.MathUtils.lerp(
                this.turnBulgeAmount, targetBulge, bulgeLerp * delta
            );

            // Bulge direction is OPPOSITE to lateral acceleration (inertia/centrifugal)
            // Smooth the direction change to avoid snapping
            const targetDir = perpendicularAccel.clone().normalize().negate();
            this.turnBulgeDir.lerp(targetDir, bulgeDirLerp * delta);
            this.turnBulgeDir.normalize();
        } else {
            // Gradual decay when not turning (slower to avoid snap)
            this.turnBulgeAmount *= Math.pow(bulgeDecay, delta);

            // Below threshold, zero it out completely
            if (this.turnBulgeAmount < 0.005) {
                this.turnBulgeAmount = 0;
            }
        }

        // Return state for shader uniforms
        return this.getShaderState();
    }

    /**
     * Get current state for shader uniforms
     */
    getShaderState() {
        // Combine deformation, wobble, and ground sag
        const wobbleDeform = this.wobbleAmplitude * Math.sin(this.wobblePhase) * 0.3;
        const totalDeform = this.deformation + wobbleDeform + this.currentGroundSag;

        // Ground sag deforms downward (Y axis compression)
        const deformAxis = this.currentGroundSag > 0.01
            ? new THREE.Vector3(0, 1, 0).lerp(this.deformAxis, this.deformation / (this.deformation + this.currentGroundSag + 0.001))
            : this.deformAxis;

        return {
            // Main deformation
            deformation: Math.max(0, Math.min(1, totalDeform)),
            deformAxis: deformAxis.clone(),

            // Ground sag (low-pressure tire bulge)
            groundSag: this.currentGroundSag,

            // Turn bulge (centrifugal effect)
            turnBulge: this.turnBulgeAmount,
            turnBulgeDir: this.turnBulgeDir.clone(),

            // Wobble
            wobblePhase: this.wobblePhase,
            wobbleAmplitude: this.wobbleAmplitude,
            wobbleAxis: this.wobbleAxis.clone(),

            // Movement stretch
            stretchAmount: this.stretchAmount,
            stretchAxis: this.stretchAxis.clone(),

            // Particle momentum
            particleMomentum: this.particleMomentum.clone()
        };
    }

    /**
     * Get particle offset based on current physics state
     * Used to shift internal particles during impacts
     * @param {THREE.Vector3} particlePos - Original particle position
     * @returns {THREE.Vector3} Offset to apply
     */
    getParticleOffset(particlePos) {
        const offset = new THREE.Vector3();

        // Apply momentum-based shift
        offset.add(this.particleMomentum);

        // Add wobble-based oscillation
        if (this.wobbleAmplitude > 0.01) {
            const wobble = Math.sin(this.wobblePhase) * this.wobbleAmplitude * 0.1;
            offset.x += this.wobbleAxis.x * wobble;
            offset.y += this.wobbleAxis.y * wobble;
            offset.z += this.wobbleAxis.z * wobble;
        }

        // Add stretch-based shift (particles lag behind movement)
        if (this.stretchAmount > 0.01) {
            const lag = -this.stretchAmount * 0.2;
            offset.x += this.stretchAxis.x * lag;
            offset.y += this.stretchAxis.y * lag;
            offset.z += this.stretchAxis.z * lag;
        }

        return offset;
    }

    /**
     * Test if currently in impact recovery
     */
    isDeforming() {
        return this.deformation > 0.01 || this.wobbleAmplitude > 0.01;
    }

    /**
     * Get impact intensity for visual effects
     */
    getImpactIntensity() {
        const timeSinceImpact = (performance.now() - this.lastImpactTime) / 1000;
        if (timeSinceImpact > 1) return 0;
        return this.impactIntensity * Math.exp(-timeSinceImpact * 3);
    }
}

/**
 * Create bubble shader with deformation support
 * Returns vertex and fragment shader code
 */
export function createBubbleShaderCode() {
    const vertexShader = `
        uniform float uTime;
        uniform float uWobbleStrength;

        // Deformation uniforms
        uniform float uDeformation;
        uniform vec3 uDeformAxis;
        uniform float uWobblePhase;
        uniform float uWobbleAmplitude;
        uniform vec3 uWobbleAxis;
        uniform float uStretchAmount;
        uniform vec3 uStretchAxis;
        uniform float uGroundSag;  // Ground sag (low-pressure tire effect)
        uniform float uTurnBulge;  // Turn bulge amount (centrifugal effect)
        uniform vec3 uTurnBulgeDir;  // Direction of turn bulge

        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;

        void main() {
            vec3 pos = position;

            // === GROUND SAG (flat contact patch like ball on floor) ===
            // Creates a flat spot at bottom where ball contacts ground
            if (uGroundSag > 0.001) {
                // How far up from the bottom to flatten (0 = no flatten, 1 = flatten whole bottom half)
                float flattenAmount = uGroundSag * 0.8;  // 0.35 * 0.8 = 0.28, so flatten bottom 28%

                // The Y level where flattening starts (in normalized sphere coords -1 to 1)
                float flattenThreshold = -1.0 + flattenAmount * 2.0;  // -1 + 0.56 = -0.44

                // Flatten everything below the threshold to a single plane
                if (pos.y < flattenThreshold) {
                    // Push vertices up to the threshold level (creates flat bottom)
                    float flatY = flattenThreshold;

                    // Smooth blend zone to avoid hard edge
                    float blendStart = flattenThreshold - 0.3;
                    float t = smoothstep(blendStart, flattenThreshold, pos.y);
                    pos.y = mix(flatY, pos.y, t);
                }

                // Bulge out the sides just above the flat area (displaced material)
                float bulgeStart = flattenThreshold;
                float bulgeEnd = flattenThreshold + 0.5;
                float bulgeStrength = smoothstep(bulgeStart, bulgeStart + 0.2, pos.y) *
                                      smoothstep(bulgeEnd, bulgeStart + 0.2, pos.y);
                float bulgeFactor = bulgeStrength * uGroundSag * 1.5;
                pos.x *= 1.0 + bulgeFactor;
                pos.z *= 1.0 + bulgeFactor;

                // Slight overall vertical compression
                pos.y *= 1.0 - uGroundSag * 0.15;
            }

            // === TURN BULGE (centrifugal effect when turning while moving) ===
            // Bulges the bottom of the blob outward in the direction opposite to the turn
            if (uTurnBulge > 0.001) {
                // Bottom half bulges more (0 at top, 1 at very bottom)
                float bottomWeight = smoothstep(-0.2, 0.8, -pos.y);

                // Simple directional push - entire bottom shifts in bulge direction
                float bulgeAmount = bottomWeight * uTurnBulge;
                pos.x += uTurnBulgeDir.x * bulgeAmount;
                pos.z += uTurnBulgeDir.z * bulgeAmount;
            }

            // === IMPACT DEFORMATION ===
            // Squash along deform axis
            float axisAlignment = dot(normalize(pos), uDeformAxis);
            float squashFactor = 1.0 - uDeformation * abs(axisAlignment);
            float bulgeFactor = 1.0 + uDeformation * 0.5 * (1.0 - abs(axisAlignment));

            // Apply squash perpendicular to axis, bulge along axis
            pos = pos * bulgeFactor;
            pos -= uDeformAxis * (dot(pos, uDeformAxis)) * uDeformation * 0.5;

            // === WOBBLE ===
            if (uWobbleAmplitude > 0.001) {
                float wobbleOffset = sin(uWobblePhase + dot(pos, uWobbleAxis) * 3.0);
                pos += uWobbleAxis * wobbleOffset * uWobbleAmplitude * 0.1;

                // Secondary wobble perpendicular
                vec3 wobbleAxis2 = cross(uWobbleAxis, uDeformAxis);
                float wobble2 = sin(uWobblePhase * 1.3 + dot(pos, wobbleAxis2) * 2.0);
                pos += wobbleAxis2 * wobble2 * uWobbleAmplitude * 0.05;
            }

            // === MOVEMENT STRETCH ===
            if (uStretchAmount > 0.001) {
                float stretchAlignment = dot(normalize(pos), uStretchAxis);
                // Elongate along movement direction
                pos += uStretchAxis * stretchAlignment * uStretchAmount * 0.5;
                // Compress perpendicular to maintain volume
                vec3 perpendicular = pos - uStretchAxis * dot(pos, uStretchAxis);
                pos -= perpendicular * uStretchAmount * 0.15;
            }

            // === ORGANIC WOBBLE (slow jiggle) ===
            float wobble = sin(position.x * 3.0 + uTime * 0.5) *
                           sin(position.y * 3.0 + uTime * 0.42) *
                           sin(position.z * 3.0 + uTime * 0.58);
            pos += normal * wobble * uWobbleStrength;

            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            vViewDir = normalize(cameraPosition - worldPos.xyz);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uFresnelPower;
        uniform float uTime;
        uniform float uDeformation;
        uniform float uWobbleAmplitude;

        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;

        void main() {
            // Fresnel: more visible at edges
            float fresnel = pow(1.0 - abs(dot(vViewDir, vNormal)), uFresnelPower);

            // Subtle color shift
            vec3 color = uColor;
            color += vNormal * 0.1;

            // Impact flash - brief white flash on deformation
            float impactFlash = uDeformation * 0.3;
            color = mix(color, vec3(1.0), impactFlash);

            // Wobble causes slight iridescence
            float iridescence = uWobbleAmplitude * 0.2;
            color += vec3(
                sin(vWorldPos.x * 10.0 + uTime) * iridescence,
                sin(vWorldPos.y * 10.0 + uTime * 1.1) * iridescence,
                sin(vWorldPos.z * 10.0 + uTime * 1.2) * iridescence
            );

            // Shimmer effect (slowed down)
            float shimmer = sin(vWorldPos.x * 10.0 + vWorldPos.y * 10.0 + uTime * 0.75) * 0.05;

            // Membrane stress during deformation
            float stress = uDeformation * 0.2 + uWobbleAmplitude * 0.1;
            float alpha = uOpacity + fresnel * 0.4 + shimmer + stress;

            gl_FragColor = vec4(color, alpha);
        }
    `;

    return { vertexShader, fragmentShader };
}

/**
 * Default uniform values for the bubble shader
 */
export function getDefaultBubbleUniforms(bubbleColor, bubbleOpacity) {
    return {
        uColor: { value: bubbleColor },
        uOpacity: { value: bubbleOpacity },
        uFresnelPower: { value: 2.5 },
        uTime: { value: 0 },
        uWobbleStrength: { value: 0.095 },  // User tuned
        // Deformation uniforms
        uDeformation: { value: 0 },
        uDeformAxis: { value: new THREE.Vector3(0, 1, 0) },
        uGroundSag: { value: 0 },  // Ground sag (low-pressure tire effect)
        uTurnBulge: { value: 0 },  // Turn bulge (centrifugal effect)
        uTurnBulgeDir: { value: new THREE.Vector3(1, 0, 0) },
        uWobblePhase: { value: 0 },
        uWobbleAmplitude: { value: 0 },
        uWobbleAxis: { value: new THREE.Vector3(1, 0, 0) },
        uStretchAmount: { value: 0 },
        uStretchAxis: { value: new THREE.Vector3(0, 0, 1) }
    };
}
