// blob-vehicle.js - MarchingCubes body with jiggle physics and component integration

import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { JiggleBall } from './jiggle-ball.js';
import { VehicleComponentSystem, TOTAL_SLOTS } from './vehicle-components.js';

// MC space center
const MC_CENTER = new THREE.Vector3(0.5, 0.5, 0.5);

// Vehicle-shaped ambient ball layout:
// Wider on X (left/right), flatter on Y, longer on Z (front/back)
// Keep offsets small so they stay merged with the body
const AMBIENT_OFFSETS = [
    // Wide sides (wheels area)
    new THREE.Vector3( 0.08, -0.02,  0.04),   // right-front
    new THREE.Vector3(-0.08, -0.02,  0.04),   // left-front
    new THREE.Vector3( 0.08, -0.02, -0.04),   // right-rear
    new THREE.Vector3(-0.08, -0.02, -0.04),   // left-rear
    // Front/rear bumpers
    new THREE.Vector3( 0.0,  -0.01,  0.07),   // front
    new THREE.Vector3( 0.0,  -0.01, -0.06),   // rear
    // Top (cabin bump)
    new THREE.Vector3( 0.0,   0.05,  0.0),    // roof
];

export class BlobVehicle extends THREE.Group {
    constructor() {
        super();

        // MarchingCubes mesh: resolution 40, 8000 max polys
        this.material = new THREE.MeshStandardMaterial({
            color: 0x3388ff,
            emissive: 0x112244,
            roughness: 0.35,
            metalness: 0.3,
        });
        this.mc = new MarchingCubes(40, this.material, false, false, 8000);
        this.mc.isolation = 80;

        // Scale MC mesh to world size
        // Surface radius formula: sqrt(strength / (isolation + subtract)) * mcWorldSize
        // With strength=1.5, isolation=80, subtract=12: sqrt(1.5/92) * 4 = ~0.51 world units radius
        this.mcWorldSize = 4;
        this.mc.scale.setScalar(this.mcWorldSize);
        // Center the MC mesh (it goes from 0 to scale, so offset by -half)
        this.mc.position.set(
            -this.mcWorldSize / 2,
            -this.mcWorldSize / 2,
            -this.mcWorldSize / 2
        );
        this.mc.frustumCulled = false; // MC bounding box can be stale
        this.add(this.mc);

        // Body ball parameters — dominant central mass
        this.bodyStrength = 2.0;

        // Ambient jiggle balls — subtle shape modifiers that stay merged with body
        this.ambientBalls = AMBIENT_OFFSETS.map(
            offset => new JiggleBall(offset, 0.5)
        );
        // Tighten springs so ambient balls can't fly apart
        for (const ball of this.ambientBalls) {
            ball.stiffness = 0.25;  // stronger pull to rest (default 0.15)
            ball.damping = 0.15;    // more damping (default 0.08)
        }

        // Component balls (one per slot, created on attach)
        this.componentBalls = new Array(TOTAL_SLOTS).fill(null);

        // Component system
        this.componentSystem = new VehicleComponentSystem();

        // Component meshes container (children of this group)
        this.componentMeshGroup = new THREE.Group();
        this.add(this.componentMeshGroup);

        // Squash-and-stretch state
        this.stretchAxis = new THREE.Vector3(0, 0, 1);
        this.currentStretch = 1;
        this.currentSquash = 1;

        // Velocity for squash-stretch (set externally by controller)
        this._velocity = new THREE.Vector3();

        // Initialize all jiggle balls to rest
        for (const ball of this.ambientBalls) {
            ball.reset(MC_CENTER);
        }
    }

    /**
     * Set velocity for squash-stretch calculation (called by controller)
     * @param {THREE.Vector3} vel
     */
    setVelocity(vel) {
        this._velocity.copy(vel);
    }

    /**
     * Apply impact force to all jiggle balls (e.g. from jump, landing, collision)
     * @param {THREE.Vector3} force - World-space force direction
     * @param {number} magnitude - Force magnitude
     */
    applyImpact(force, magnitude = 1) {
        // Convert world force to MC-space impulse
        const mcForce = _v1.copy(force).multiplyScalar(magnitude * 0.03);

        for (const ball of this.ambientBalls) {
            ball.applyImpulse(mcForce);
        }
        for (const ball of this.componentBalls) {
            if (ball) ball.applyImpulse(mcForce);
        }
    }

    /**
     * Apply landing impact (vertical squish)
     * @param {number} fallSpeed - Absolute fall speed
     */
    applyLandingImpact(fallSpeed) {
        const mag = Math.min(fallSpeed * 0.15, 1.5);
        this.applyImpact(new THREE.Vector3(0, -1, 0), mag);
    }

    /**
     * Attach a component to a slot
     * @param {string} componentId
     * @param {number} slotIndex
     * @returns {boolean}
     */
    attachComponent(componentId, slotIndex) {
        const success = this.componentSystem.addComponent(componentId, slotIndex);
        if (!success) return false;

        const slot = this.componentSystem.slots[slotIndex];
        if (!slot) return false;

        // Add component mesh to our group
        this.componentMeshGroup.add(slot.mesh);

        // Create a jiggle ball for this component slot
        const mcOffset = this.componentSystem.attachmentPoints[slotIndex]
            .clone().multiplyScalar(0.15); // MC-space radius for component attachment
        this.componentBalls[slotIndex] = new JiggleBall(
            mcOffset,
            slot.component.ballStrength || 0.3
        );
        this.componentBalls[slotIndex].reset(MC_CENTER);

        return true;
    }

    /**
     * Detach a component from a slot
     * @param {number} slotIndex
     */
    detachComponent(slotIndex) {
        const slot = this.componentSystem.slots[slotIndex];
        if (slot && slot.mesh.parent === this.componentMeshGroup) {
            this.componentMeshGroup.remove(slot.mesh);
        }

        this.componentSystem.removeComponent(slotIndex);
        this.componentBalls[slotIndex] = null;
    }

    /**
     * Get the component system for external use
     * @returns {VehicleComponentSystem}
     */
    getComponentSystem() {
        return this.componentSystem;
    }

    /**
     * Main update loop
     * @param {number} delta
     */
    update(delta) {
        // External force from velocity (makes blobs jiggle in movement direction)
        const externalForce = _v1.copy(this._velocity);

        // --- Physics: update all jiggle balls ---
        for (const ball of this.ambientBalls) {
            ball.update(delta, MC_CENTER, externalForce);
        }
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            if (this.componentBalls[i]) {
                this.componentBalls[i].update(delta, MC_CENTER, externalForce);
            }
        }

        // --- Rebuild MC field ---
        this.mc.reset();

        // Body core (centered, dominant)
        this.mc.addBall(
            MC_CENTER.x, MC_CENTER.y, MC_CENTER.z,
            this.bodyStrength,
            12
        );
        // Flatten: add a wide, low ellipsoid effect via two side balls
        this.mc.addBall(MC_CENTER.x + 0.06, MC_CENTER.y - 0.02, MC_CENTER.z, 0.8, 12);
        this.mc.addBall(MC_CENTER.x - 0.06, MC_CENTER.y - 0.02, MC_CENTER.z, 0.8, 12);

        // Ambient jiggle balls
        for (const ball of this.ambientBalls) {
            ball.applyToMarchingCubes(this.mc);
        }

        // Component jiggle balls
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            if (this.componentBalls[i]) {
                this.componentBalls[i].applyToMarchingCubes(this.mc);
            }
        }

        // Polygonize the field into triangles
        this.mc.update();

        // --- Update component mesh positions ---
        this._updateComponentMeshPositions();

        // --- Squash-and-stretch ---
        this._updateSquashStretch();
    }

    /**
     * Position component meshes on the blob surface
     */
    _updateComponentMeshPositions() {
        // Surface radius ≈ sqrt(bodyStrength / (isolation + subtract)) * mcWorldSize ≈ 0.51
        const surfaceRadius = 0.55;

        for (let i = 0; i < TOTAL_SLOTS; i++) {
            const slot = this.componentSystem.slots[i];
            if (!slot || !slot.mesh) continue;

            const attachDir = this.componentSystem.attachmentPoints[i];
            const worldOffset = _v2.copy(attachDir).multiplyScalar(surfaceRadius);

            slot.mesh.position.copy(worldOffset);

            // Orient component to face outward from blob center
            slot.mesh.lookAt(
                worldOffset.x * 2,
                worldOffset.y * 2,
                worldOffset.z * 2
            );
        }
    }

    /**
     * Apply velocity-based squash-and-stretch to the MC mesh
     */
    _updateSquashStretch() {
        const speed = this._velocity.length();

        // Stretch along velocity direction
        const targetStretch = 1 + THREE.MathUtils.clamp(speed * 0.06, 0, 0.4);
        const targetSquash = 1 / Math.sqrt(targetStretch); // Volume preservation

        // Smooth transition
        this.currentStretch = THREE.MathUtils.lerp(this.currentStretch, targetStretch, 0.15);
        this.currentSquash = THREE.MathUtils.lerp(this.currentSquash, targetSquash, 0.15);

        if (speed > 0.5) {
            // Align stretch to velocity direction
            this.stretchAxis.copy(this._velocity).normalize();
        }

        // Build scale quaternion: stretch along velocity, squash perpendicular
        // We apply this to the MC mesh scale
        // Simple approach: use the dominant horizontal velocity axis
        const absX = Math.abs(this.stretchAxis.x);
        const absZ = Math.abs(this.stretchAxis.z);

        if (absX > absZ) {
            this.mc.scale.set(
                this.mcWorldSize * this.currentStretch,
                this.mcWorldSize * this.currentSquash,
                this.mcWorldSize * this.currentSquash
            );
        } else {
            this.mc.scale.set(
                this.mcWorldSize * this.currentSquash,
                this.mcWorldSize * this.currentSquash,
                this.mcWorldSize * this.currentStretch
            );
        }

        // Re-center after scale change
        this.mc.position.set(
            -this.mc.scale.x / 2,
            -this.mc.scale.y / 2,
            -this.mc.scale.z / 2
        );
    }

    dispose() {
        this.componentSystem.dispose();

        if (this.mc.geometry) this.mc.geometry.dispose();
        if (this.material) this.material.dispose();

        this.ambientBalls.length = 0;
        this.componentBalls.fill(null);
    }
}

// Reusable temp vectors
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
