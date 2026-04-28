// formation-system.js - FormationController for particle formations (Layer 2)
// Conscripts particles into visible shapes via attractor forces

import * as THREE from 'three';

export class FormationController {
    /**
     * @param {import('../creatures/particle-life-creature.js').ParticleLifeCreature} creature
     * @param {object} formationData - { type, attractors, particleCount, stability, element }
     */
    constructor(creature, formationData) {
        this.creature = creature;
        this.formationData = formationData;
        this.type = formationData.type;
        this.stability = formationData.stability;
        this.element = formationData.element;
        this.targetParticleCount = formationData.particleCount;

        // Maximum radius attractors can occupy (stay well inside the bubble boundary)
        // The creature's boundary force starts at 0.85 * radius, so keep formations inside that
        this.maxRadius = creature.radius * 0.65;

        // Attractor positions (in local space, rotated by orientation)
        // Uniformly scale all attractors to preserve shape while fitting inside the bubble
        const rawAttractors = formationData.attractors.map(a =>
            new THREE.Vector3(a.pos.x, a.pos.y, a.pos.z)
        );
        let maxDist = 0;
        for (const pos of rawAttractors) {
            maxDist = Math.max(maxDist, pos.length());
        }
        const scaleFactor = maxDist > this.maxRadius ? this.maxRadius / maxDist : 1;

        this.baseAttractors = formationData.attractors.map((a, idx) => {
            const pos = rawAttractors[idx].multiplyScalar(scaleFactor);
            return { pos, strength: a.strength };
        });

        // Rotated attractors (updated by setOrientation)
        this.attractors = this.baseAttractors.map(a => ({
            pos: a.pos.clone(),
            strength: a.strength
        }));

        // Conscripted particle indices
        this.conscriptedIndices = [];

        // Current orientation yaw
        this.yaw = 0;

        // Visual boost: scale conscripted particles up to make formations visible
        // Stored per-particle so we can animate in/out
        this.sizeBoost = 1.4 + this.stability * 0.6; // 1.4x to 2.0x size for conscripted particles

        // Original sizes of conscripted particles (for restore on dispose)
        this.originalSizes = [];

        this.conscriptParticles();
        this.applyVisualBoost();
    }

    /**
     * Find particles of the target element and conscript up to particleCount
     */
    conscriptParticles() {
        this.conscriptedIndices = [];

        // Build set of already-conscripted particles from other formations on this creature
        const taken = new Set();
        if (this.creature.formationControllers) {
            for (const fc of this.creature.formationControllers) {
                if (fc === this) continue;
                for (const idx of fc.conscriptedIndices) {
                    taken.add(idx);
                }
            }
        }

        // Find particles matching the formation element
        const elementToType = this.mapElementToParticleType();
        if (elementToType === -1) {
            // Element not present in creature, conscript random available particles
            for (let i = 0; i < this.creature.particleCount && this.conscriptedIndices.length < this.targetParticleCount; i++) {
                if (!taken.has(i)) {
                    this.conscriptedIndices.push(i);
                }
            }
            return;
        }

        // Collect indices of matching particles that aren't already taken
        const matchingIndices = [];
        for (let i = 0; i < this.creature.particleCount; i++) {
            if (this.creature.particleTypes[i] === elementToType && !taken.has(i)) {
                matchingIndices.push(i);
            }
        }

        // Take up to particleCount from matching, or fill with random if not enough
        const count = Math.min(this.targetParticleCount, this.creature.particleCount - taken.size);
        for (let i = 0; i < count; i++) {
            if (i < matchingIndices.length) {
                this.conscriptedIndices.push(matchingIndices[i]);
            } else {
                // Grab a random non-conscripted, non-taken particle
                for (let j = 0; j < this.creature.particleCount; j++) {
                    if (!taken.has(j) && !this.conscriptedIndices.includes(j)) {
                        this.conscriptedIndices.push(j);
                        break;
                    }
                }
            }
        }
    }

    /**
     * Map formation element (ELEMENT_TYPES value) to creature's particle type index
     */
    mapElementToParticleType() {
        if (!this.creature.elements) return -1;

        for (let i = 0; i < this.creature.elements.length; i++) {
            if (this.creature.elements[i] === this.element) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Apply visual size boost to conscripted particles so formations are visible
     */
    applyVisualBoost() {
        if (!this.creature.particleSizes) return;

        this.originalSizes = [];
        for (const i of this.conscriptedIndices) {
            this.originalSizes.push(this.creature.particleSizes[i]);
            this.creature.particleSizes[i] *= this.sizeBoost;
        }

        // Mark GPU buffer for update
        if (this.creature.particleMesh) {
            const sizeAttr = this.creature.particleMesh.geometry.attributes.size;
            if (sizeAttr) sizeAttr.needsUpdate = true;
        }
    }

    /**
     * Restore original particle sizes
     */
    removeVisualBoost() {
        if (!this.creature.particleSizes || this.originalSizes.length === 0) return;

        for (let idx = 0; idx < this.conscriptedIndices.length; idx++) {
            const i = this.conscriptedIndices[idx];
            if (idx < this.originalSizes.length) {
                this.creature.particleSizes[i] = this.originalSizes[idx];
            }
        }

        if (this.creature.particleMesh) {
            const sizeAttr = this.creature.particleMesh.geometry.attributes.size;
            if (sizeAttr) sizeAttr.needsUpdate = true;
        }

        this.originalSizes = [];
    }

    /**
     * Apply formation attractor forces to conscripted particles
     * Uses a spring-damper model: strong pull toward target, with damping to prevent oscillation
     * Called each frame from creature.update() after main force loop
     */
    applyForces(delta) {
        if (this.conscriptedIndices.length === 0 || this.attractors.length === 0) return;

        const attractorCount = this.attractors.length;
        const boundaryRadius = this.creature.radius * 0.85;
        const boundarySq = boundaryRadius * boundaryRadius;

        // Spring stiffness scales with stability (rarity)
        // Needs to overpower the main Particle Life forces
        const stiffness = 30 + this.stability * 70; // 30 (Uncommon) to 96.5 (Legendary)
        const damping = 0.85; // Velocity damping for smooth convergence

        for (let idx = 0; idx < this.conscriptedIndices.length; idx++) {
            const i = this.conscriptedIndices[idx];
            const i3 = i * 3;

            const px = this.creature.positions[i3];
            const py = this.creature.positions[i3 + 1];
            const pz = this.creature.positions[i3 + 2];

            // Distribute particles across attractors
            const attractorIdx = idx % attractorCount;
            const attractor = this.attractors[attractorIdx];

            // Direction to attractor (spring displacement)
            const dx = attractor.pos.x - px;
            const dy = attractor.pos.y - py;
            const dz = attractor.pos.z - pz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < 0.001) continue; // Already at target

            // Check attractor is inside boundary
            const targetDistSq = attractor.pos.x * attractor.pos.x +
                                 attractor.pos.y * attractor.pos.y +
                                 attractor.pos.z * attractor.pos.z;

            // Spring force: stronger pull at greater distance
            let forceMag = stiffness * attractor.strength * delta;

            // Reduce force if attractor is near boundary
            if (targetDistSq > boundarySq * 0.8) {
                forceMag *= 0.5;
            }

            // Apply spring force
            this.creature.velocities[i3] += dx * forceMag;
            this.creature.velocities[i3 + 1] += dy * forceMag;
            this.creature.velocities[i3 + 2] += dz * forceMag;

            // Apply extra damping to conscripted particles for smooth formation
            this.creature.velocities[i3] *= damping;
            this.creature.velocities[i3 + 1] *= damping;
            this.creature.velocities[i3 + 2] *= damping;
        }
    }

    /**
     * Rotate attractor positions to match player facing direction
     * @param {number} yaw - Player yaw angle in radians
     */
    setOrientation(yaw) {
        if (Math.abs(yaw - this.yaw) < 0.01) return; // Skip if barely changed
        this.yaw = yaw;

        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);

        for (let i = 0; i < this.baseAttractors.length; i++) {
            const base = this.baseAttractors[i].pos;
            const rotated = this.attractors[i].pos;

            // Rotate around Y axis
            rotated.x = base.x * cosY + base.z * sinY;
            rotated.y = base.y;
            rotated.z = -base.x * sinY + base.z * cosY;
        }
    }

    /**
     * Release conscripted particles and restore visuals
     */
    dispose() {
        this.removeVisualBoost();
        this.conscriptedIndices = [];
        this.attractors = [];
    }
}
