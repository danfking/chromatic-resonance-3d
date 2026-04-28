// jiggle-ball.js - Spring-damper physics for satellite metaballs using Verlet integration

import * as THREE from 'three';

export class JiggleBall {
    /**
     * @param {THREE.Vector3} restOffset - Rest position in 0-1 MarchingCubes space relative to body center
     * @param {number} strength - Metaball strength for mc.addBall()
     * @param {boolean} subtract - Whether this ball subtracts from the field
     */
    constructor(restOffset, strength = 0.6, subtract = false) {
        this.restOffset = restOffset.clone();
        this.position = restOffset.clone();
        this.previousPosition = restOffset.clone();
        this.strength = strength;
        this.subtract = subtract;

        // Spring-damper parameters
        this.stiffness = 0.15;
        this.damping = 0.08;

        // Size in MC space (fraction of grid)
        this.size = 0.08;
    }

    /**
     * Tick physics using Verlet integration
     * @param {number} delta - Frame time in seconds
     * @param {THREE.Vector3} blobCenter - Current blob center in MC space (usually 0.5,0.5,0.5)
     * @param {THREE.Vector3} externalForce - External force to apply (world-space impulse mapped to MC space)
     */
    update(delta, blobCenter, externalForce) {
        // Target position = blob center + rest offset
        const target = _v1.copy(blobCenter).add(this.restOffset);

        // Verlet integration: new = 2*current - previous + acceleration*dt^2
        const nx = this.position.x;
        const ny = this.position.y;
        const nz = this.position.z;

        // Spring force toward rest position
        const springX = (target.x - nx) * this.stiffness;
        const springY = (target.y - ny) * this.stiffness;
        const springZ = (target.z - nz) * this.stiffness;

        // Verlet velocity (implicit from position difference)
        const vx = nx - this.previousPosition.x;
        const vy = ny - this.previousPosition.y;
        const vz = nz - this.previousPosition.z;

        // Damping force
        const dampX = -vx * this.damping;
        const dampY = -vy * this.damping;
        const dampZ = -vz * this.damping;

        // External force contribution
        const ex = externalForce ? externalForce.x * 0.02 : 0;
        const ey = externalForce ? externalForce.y * 0.02 : 0;
        const ez = externalForce ? externalForce.z * 0.02 : 0;

        // Store previous
        this.previousPosition.x = nx;
        this.previousPosition.y = ny;
        this.previousPosition.z = nz;

        // Integrate
        this.position.x = nx + vx + springX + dampX + ex;
        this.position.y = ny + vy + springY + dampY + ey;
        this.position.z = nz + vz + springZ + dampZ + ez;

        // Clamp to valid MC space (0-1) with small margin
        this.position.x = THREE.MathUtils.clamp(this.position.x, 0.05, 0.95);
        this.position.y = THREE.MathUtils.clamp(this.position.y, 0.05, 0.95);
        this.position.z = THREE.MathUtils.clamp(this.position.z, 0.05, 0.95);
    }

    /**
     * Add this ball to the MarchingCubes field
     * @param {MarchingCubes} mc
     */
    applyToMarchingCubes(mc) {
        // subtract param = field threshold (positive number, typically 12)
        // For subtractive balls, use negative strength instead
        mc.addBall(
            this.position.x,
            this.position.y,
            this.position.z,
            this.subtract ? -this.strength : this.strength,
            12
        );
    }

    /**
     * Apply an impulse by displacing previousPosition (Verlet kick)
     * @param {THREE.Vector3} force - Impulse direction and magnitude in MC space
     */
    applyImpulse(force) {
        // Displacing previousPosition creates velocity in the next Verlet step
        this.previousPosition.x -= force.x;
        this.previousPosition.y -= force.y;
        this.previousPosition.z -= force.z;
    }

    /**
     * Snap to rest position (no jiggle)
     * @param {THREE.Vector3} blobCenter
     */
    reset(blobCenter) {
        const target = _v1.copy(blobCenter).add(this.restOffset);
        this.position.copy(target);
        this.previousPosition.copy(target);
    }
}

// Reusable temp vector
const _v1 = new THREE.Vector3();
