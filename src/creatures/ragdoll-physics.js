// ragdoll-physics.js - Simple constraint-based ragdoll physics for wobbler humans
// No external physics library - pure position-based dynamics

import * as THREE from 'three';

// Joint constraint definitions
const JOINT_CONSTRAINTS = {
    neck:           { parent: 'torsoUpper', child: 'head',          axis: 'x',   min: -30, max: 45 },
    leftShoulder:   { parent: 'torsoUpper', child: 'leftUpperArm',  axis: 'xyz', min: -90, max: 90 },
    leftElbow:      { parent: 'leftUpperArm', child: 'leftLowerArm', axis: 'x',  min: 0,   max: 120 },
    rightShoulder:  { parent: 'torsoUpper', child: 'rightUpperArm', axis: 'xyz', min: -90, max: 90 },
    rightElbow:     { parent: 'rightUpperArm', child: 'rightLowerArm', axis: 'x', min: 0,  max: 120 },
    leftHip:        { parent: 'pelvis',    child: 'leftThigh',     axis: 'xyz', min: -30, max: 90 },
    leftKnee:       { parent: 'leftThigh', child: 'leftShin',      axis: 'x',   min: 0,   max: 135 },
    leftAnkle:      { parent: 'leftShin',  child: 'leftFoot',      axis: 'x',   min: -20, max: 45 },
    rightHip:       { parent: 'pelvis',    child: 'rightThigh',    axis: 'xyz', min: -30, max: 90 },
    rightKnee:      { parent: 'rightThigh', child: 'rightShin',    axis: 'x',   min: 0,   max: 135 },
    rightAnkle:     { parent: 'rightShin', child: 'rightFoot',     axis: 'x',   min: -20, max: 45 },
    upperLowerTorso: { parent: 'torsoUpper', child: 'torsoLower',  axis: 'x',   min: -15, max: 15 },
    torsoPelvis:    { parent: 'torsoLower', child: 'pelvis',       axis: 'x',   min: -15, max: 15 },
    neckConnect:    { parent: 'torsoUpper', child: 'neck',         axis: 'x',   min: -10, max: 10 },
};

// Part names that participate in ragdoll physics
const RAGDOLL_PARTS = [
    'head', 'neck',
    'torsoUpper', 'torsoLower', 'pelvis',
    'leftUpperArm', 'leftLowerArm',
    'rightUpperArm', 'rightLowerArm',
    'leftThigh', 'leftShin', 'leftFoot',
    'rightThigh', 'rightShin', 'rightFoot',
];

// Approximate mass for each part (proportional to body part size)
const PART_MASS = {
    head: 4.0,
    neck: 1.0,
    torsoUpper: 12.0,
    torsoLower: 8.0,
    pelvis: 6.0,
    leftUpperArm: 2.5,
    leftLowerArm: 1.5,
    rightUpperArm: 2.5,
    rightLowerArm: 1.5,
    leftThigh: 5.0,
    leftShin: 3.0,
    leftFoot: 1.0,
    rightThigh: 5.0,
    rightShin: 3.0,
    rightFoot: 1.0,
};

// Joint rest distances (approximate distance between connected parts)
const JOINT_REST_DISTANCES = {};

const _tempVec = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();

/**
 * Ragdoll constraint physics for wobbler humanoids.
 * Activates on impact, simulates flying body parts with joint constraints.
 */
export class RagdollPhysics {
    /**
     * @param {Object} parts - The parts object from createWobblerHumanoid
     * @param {THREE.Group} group - The wobbler group
     */
    constructor(parts, group) {
        this._parts = parts;
        this._group = group;
        this._active = false;
        this._settled = false;
        this._settleTimer = 0;
        this._groundHeight = 0;

        // Per-part physics state
        this._state = {};

        for (const name of RAGDOLL_PARTS) {
            const mesh = parts[name];
            if (!mesh) continue;

            this._state[name] = {
                // World-space position (will be computed on activation)
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Vector3(),
                mass: PART_MASS[name] || 2.0,
                // Store rest position for constraint distances
                restPosition: mesh.userData.restPosition
                    ? mesh.userData.restPosition.clone()
                    : mesh.position.clone(),
                mesh: mesh,
            };
        }

        // Pre-compute joint rest distances from rest positions
        this._jointRestDistances = {};
        for (const [jointName, constraint] of Object.entries(JOINT_CONSTRAINTS)) {
            const parentState = this._state[constraint.parent];
            const childState = this._state[constraint.child];
            if (parentState && childState) {
                this._jointRestDistances[jointName] =
                    parentState.restPosition.distanceTo(childState.restPosition);
            }
        }
    }

    /**
     * Set the ground height for collision
     * @param {number} height - Ground Y level
     */
    setGroundHeight(height) {
        this._groundHeight = height;
    }

    /**
     * Activate ragdoll mode with an impact velocity
     * @param {THREE.Vector3} impactVelocity - Velocity of the impacting object
     * @param {THREE.Vector3} [impactPoint] - Optional world-space impact point
     */
    activate(impactVelocity, impactPoint) {
        if (this._active) return;
        this._active = true;
        this._settled = false;
        this._settleTimer = 0;

        // Get group world transform to convert local positions to world space
        const groupPos = new THREE.Vector3();
        const groupQuat = new THREE.Quaternion();
        const groupScale = new THREE.Vector3();
        this._group.getWorldPosition(groupPos);
        this._group.getWorldQuaternion(groupQuat);
        this._group.getWorldScale(groupScale);

        const scaleVal = groupScale.x; // uniform scale assumed

        for (const name of RAGDOLL_PARTS) {
            const state = this._state[name];
            if (!state) continue;

            // Convert mesh local position to world position
            state.position.copy(state.mesh.position)
                .multiplyScalar(scaleVal)
                .applyQuaternion(groupQuat)
                .add(groupPos);

            // Base velocity from impact with randomness for chaotic tumble
            const chaos = 0.3 + Math.random() * 0.5;
            state.velocity.set(
                impactVelocity.x * chaos + (Math.random() - 0.5) * 3,
                Math.abs(impactVelocity.y) * chaos + 2 + Math.random() * 4,
                impactVelocity.z * chaos + (Math.random() - 0.5) * 3
            );

            // If we have an impact point, parts further from it get more sideways force
            if (impactPoint) {
                _tempVec.copy(state.position).sub(impactPoint);
                const dist = _tempVec.length();
                if (dist > 0.01) {
                    _tempVec.normalize().multiplyScalar(5.0 / (1 + dist));
                    _tempVec.y = Math.abs(_tempVec.y) + 1; // always push up
                    state.velocity.add(_tempVec);
                }
            }

            // Head and extremities fly more
            if (name === 'head' || name.includes('Foot') || name.includes('LowerArm')) {
                state.velocity.multiplyScalar(1.3);
            }

            // Random angular velocity for tumbling
            state.angularVelocity.set(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            );
        }

        // Detach meshes from group and add to group's parent (scene)
        // so they can move independently in world space
        const parent = this._group.parent;
        if (parent) {
            for (const name of RAGDOLL_PARTS) {
                const state = this._state[name];
                if (!state) continue;

                const mesh = state.mesh;
                this._group.remove(mesh);
                parent.add(mesh);

                // Set world position
                mesh.position.copy(state.position);
                // Scale parts to match group scale
                mesh.scale.setScalar(scaleVal);
            }

            // Also detach optional parts (eyes, helmet, shield) that aren't in RAGDOLL_PARTS
            // Eyes are children of the eye meshes, so they move with them
            // Helmet and shield follow their parent body parts
            if (this._parts.helmet) {
                const helmet = this._parts.helmet;
                const helmetWorldPos = new THREE.Vector3();
                helmet.getWorldPosition(helmetWorldPos);
                this._group.remove(helmet);
                parent.add(helmet);
                helmet.position.copy(helmetWorldPos);
                helmet.scale.setScalar(scaleVal);
            }
            if (this._parts.shield) {
                const shield = this._parts.shield;
                const shieldWorldPos = new THREE.Vector3();
                shield.getWorldPosition(shieldWorldPos);
                this._group.remove(shield);
                parent.add(shield);
                shield.position.copy(shieldWorldPos);
                shield.scale.setScalar(scaleVal);
            }
        }
    }

    /**
     * Update ragdoll simulation
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (!this._active || this._settled) return;

        // Clamp dt to avoid explosion on lag spikes
        dt = Math.min(dt, 1 / 30);

        const GRAVITY = 9.8;
        const AIR_DRAG = 0.98;
        const ANGULAR_DRAG = 0.95;
        const BOUNCE_FACTOR = 0.3;
        const FRICTION = 0.85;
        const GROUND = this._groundHeight;

        // --- 1. Apply gravity and update positions ---
        for (const name of RAGDOLL_PARTS) {
            const state = this._state[name];
            if (!state) continue;

            // Gravity
            state.velocity.y -= GRAVITY * dt;

            // Air drag
            state.velocity.multiplyScalar(AIR_DRAG);
            state.angularVelocity.multiplyScalar(ANGULAR_DRAG);

            // Integrate position
            state.position.x += state.velocity.x * dt;
            state.position.y += state.velocity.y * dt;
            state.position.z += state.velocity.z * dt;

            // --- 2. Ground collision ---
            const partRadius = 0.05; // approximate collision radius
            if (state.position.y < GROUND + partRadius) {
                state.position.y = GROUND + partRadius;

                // Bounce
                if (state.velocity.y < -0.5) {
                    state.velocity.y *= -BOUNCE_FACTOR;
                    // Add angular tumble on bounce
                    state.angularVelocity.x += (Math.random() - 0.5) * 3;
                    state.angularVelocity.z += (Math.random() - 0.5) * 3;
                } else {
                    state.velocity.y = 0;
                }

                // Ground friction
                state.velocity.x *= FRICTION;
                state.velocity.z *= FRICTION;
                state.angularVelocity.multiplyScalar(0.9);
            }
        }

        // --- 3. Enforce joint constraints (distance constraints) ---
        // Multiple iterations for stability
        for (let iter = 0; iter < 3; iter++) {
            for (const [jointName, constraint] of Object.entries(JOINT_CONSTRAINTS)) {
                const parentState = this._state[constraint.parent];
                const childState = this._state[constraint.child];
                if (!parentState || !childState) continue;

                const restDist = this._jointRestDistances[jointName];
                if (restDist === undefined) continue;

                // Current distance
                _tempVec.copy(childState.position).sub(parentState.position);
                const currentDist = _tempVec.length();

                if (currentDist < 0.001) continue;

                // Maximum stretch allowed (150% of rest distance to allow some flexibility)
                const maxDist = restDist * 1.5;
                // Minimum distance (50% of rest distance)
                const minDist = restDist * 0.5;

                if (currentDist > maxDist || currentDist < minDist) {
                    const targetDist = currentDist > maxDist ? maxDist :
                        currentDist < minDist ? minDist : currentDist;

                    // Direction from parent to child
                    _tempVec.normalize();

                    // Mass-weighted correction
                    const totalMass = parentState.mass + childState.mass;
                    const parentRatio = childState.mass / totalMass;
                    const childRatio = parentState.mass / totalMass;

                    const correction = targetDist - currentDist;

                    // Apply positional correction
                    _tempVec2.copy(_tempVec).multiplyScalar(correction);

                    parentState.position.x -= _tempVec2.x * parentRatio;
                    parentState.position.y -= _tempVec2.y * parentRatio;
                    parentState.position.z -= _tempVec2.z * parentRatio;

                    childState.position.x += _tempVec2.x * childRatio;
                    childState.position.y += _tempVec2.y * childRatio;
                    childState.position.z += _tempVec2.z * childRatio;

                    // Dampen relative velocity along constraint axis (spring effect)
                    _tempVec2.copy(childState.velocity).sub(parentState.velocity);
                    const relVelAlongAxis = _tempVec2.dot(_tempVec);
                    if (Math.abs(relVelAlongAxis) > 0.1) {
                        const dampFactor = 0.3;
                        _tempVec2.copy(_tempVec).multiplyScalar(relVelAlongAxis * dampFactor);
                        childState.velocity.sub(_tempVec2.clone().multiplyScalar(childRatio));
                        parentState.velocity.add(_tempVec2.multiplyScalar(parentRatio));
                    }
                }
            }
        }

        // --- 4. Update mesh transforms from physics state ---
        for (const name of RAGDOLL_PARTS) {
            const state = this._state[name];
            if (!state) continue;

            state.mesh.position.copy(state.position);

            // Apply angular velocity to rotation
            state.mesh.rotation.x += state.angularVelocity.x * dt;
            state.mesh.rotation.y += state.angularVelocity.y * dt;
            state.mesh.rotation.z += state.angularVelocity.z * dt;
        }

        // Update optional attached parts (helmet follows head, shield follows arm)
        if (this._parts.helmet && this._state.head) {
            this._parts.helmet.position.copy(this._state.head.position);
            this._parts.helmet.position.y += 0.08 * this._parts.helmet.scale.x;
            this._parts.helmet.rotation.copy(this._state.head.mesh.rotation);
        }
        if (this._parts.shield && this._state.leftLowerArm) {
            this._parts.shield.position.copy(this._state.leftLowerArm.position);
            this._parts.shield.position.x -= 0.15 * this._parts.shield.scale.x;
            this._parts.shield.rotation.copy(this._state.leftLowerArm.mesh.rotation);
        }

        // --- 5. Check if settled ---
        let totalKE = 0;
        for (const name of RAGDOLL_PARTS) {
            const state = this._state[name];
            if (!state) continue;
            totalKE += state.velocity.lengthSq() * state.mass;
            totalKE += state.angularVelocity.lengthSq() * 0.5;
        }

        if (totalKE < 0.1) {
            this._settleTimer += dt;
            if (this._settleTimer > 0.5) {
                this._settled = true;
                // Zero out all velocities
                for (const name of RAGDOLL_PARTS) {
                    const state = this._state[name];
                    if (!state) continue;
                    state.velocity.set(0, 0, 0);
                    state.angularVelocity.set(0, 0, 0);
                }
            }
        } else {
            this._settleTimer = 0;
        }
    }

    /**
     * Whether the ragdoll is currently active (simulating)
     * @returns {boolean}
     */
    isActive() {
        return this._active;
    }

    /**
     * Whether the ragdoll has settled (all parts at rest)
     * @returns {boolean}
     */
    isSettled() {
        return this._settled;
    }

    /**
     * Clean up - remove meshes from scene
     */
    dispose() {
        for (const name of RAGDOLL_PARTS) {
            const state = this._state[name];
            if (!state || !state.mesh) continue;

            if (state.mesh.parent) {
                state.mesh.parent.remove(state.mesh);
            }
            if (state.mesh.material && state.mesh.material.dispose) {
                state.mesh.material.dispose();
            }
        }

        // Also clean up optional parts
        for (const key of ['helmet', 'shield', 'leftEye', 'rightEye']) {
            const mesh = this._parts[key];
            if (mesh && mesh.parent) {
                mesh.parent.remove(mesh);
                if (mesh.material && mesh.material.dispose) {
                    mesh.material.dispose();
                }
            }
        }

        this._state = {};
        this._active = false;
    }
}
