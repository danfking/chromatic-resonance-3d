// particle-transfer.js - Slime enter/exit vehicle particle animation
// Particles stream from blob into vehicle (enter) or vehicle to blob (exit)

import * as THREE from 'three';

const STREAM_PARTICLE_COUNT = 200;
const ENTER_DURATION = 1.8;        // total enter sequence time
const EXIT_DURATION = 1.4;         // total exit sequence time
const APPROACH_PHASE = 0.5;        // approach time
const STREAM_PHASE = 1.0;          // particle streaming time
const FINALIZE_PHASE = 0.3;        // cleanup time

/**
 * Manages the particle transfer animation between blob and vehicle
 */
export class ParticleTransfer {
    constructor(scene) {
        this.scene = scene;

        // Particle system for the stream effect
        const positions = new Float32Array(STREAM_PARTICLE_COUNT * 3);
        const colors = new Float32Array(STREAM_PARTICLE_COUNT * 3);
        const sizes = new Float32Array(STREAM_PARTICLE_COUNT);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        this.particles = new THREE.Points(geo, mat);
        this.particles.frustumCulled = false;
        this.particles.visible = false;
        scene.add(this.particles);

        // Animation state
        this.isPlaying = false;
        this.direction = 'enter'; // 'enter' or 'exit'
        this.elapsed = 0;
        this.duration = ENTER_DURATION;

        // References
        this.blobPosition = new THREE.Vector3();
        this.vehiclePosition = new THREE.Vector3();
        this.elementColor = new THREE.Color(0xff6600);

        // Per-particle progress (0-1 along stream path)
        this._particleProgress = new Float32Array(STREAM_PARTICLE_COUNT);
        this._particleSpeed = new Float32Array(STREAM_PARTICLE_COUNT);
        this._particleOffset = new Float32Array(STREAM_PARTICLE_COUNT * 3);

        // Callbacks
        this.onPhaseComplete = null; // Called with phase name
    }

    /**
     * Start enter animation (blob → vehicle)
     */
    startEnter(blobPosition, vehiclePosition, elementColor) {
        this.blobPosition.copy(blobPosition);
        this.vehiclePosition.copy(vehiclePosition);
        this.elementColor.set(elementColor);
        this.direction = 'enter';
        this.duration = ENTER_DURATION;
        this._begin();
    }

    /**
     * Start exit animation (vehicle → blob)
     */
    startExit(vehiclePosition, blobSpawnPosition, elementColor) {
        this.vehiclePosition.copy(vehiclePosition);
        this.blobPosition.copy(blobSpawnPosition);
        this.elementColor.set(elementColor);
        this.direction = 'exit';
        this.duration = EXIT_DURATION;
        this._begin();
    }

    _begin() {
        this.isPlaying = true;
        this.elapsed = 0;
        this.particles.visible = true;

        // Initialize particles
        for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
            this._particleProgress[i] = Math.random(); // stagger
            this._particleSpeed[i] = 0.5 + Math.random() * 0.5;
            this._particleOffset[i * 3] = (Math.random() - 0.5) * 0.3;
            this._particleOffset[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
            this._particleOffset[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }

        // Set particle colors from element
        const colorAttr = this.particles.geometry.attributes.color;
        for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
            // Vary color slightly per particle
            const r = this.elementColor.r * (0.8 + Math.random() * 0.4);
            const g = this.elementColor.g * (0.8 + Math.random() * 0.4);
            const b = this.elementColor.b * (0.8 + Math.random() * 0.4);
            colorAttr.setXYZ(i, r, g, b);
        }
        colorAttr.needsUpdate = true;
    }

    /**
     * Get current animation phase
     * @returns {string} 'approach', 'streaming', 'finalize', or 'done'
     */
    getPhase() {
        if (!this.isPlaying) return 'done';
        if (this.elapsed < APPROACH_PHASE) return 'approach';
        if (this.elapsed < APPROACH_PHASE + STREAM_PHASE) return 'streaming';
        if (this.elapsed < this.duration) return 'finalize';
        return 'done';
    }

    /**
     * Get interpolation factor for blob opacity (1 = fully visible, 0 = invisible)
     */
    getBlobOpacity() {
        if (!this.isPlaying) return this.direction === 'enter' ? 0 : 1;

        if (this.direction === 'enter') {
            // Blob fades out during streaming phase
            const streamStart = APPROACH_PHASE;
            const streamEnd = APPROACH_PHASE + STREAM_PHASE;
            if (this.elapsed < streamStart) return 1;
            if (this.elapsed > streamEnd) return 0;
            return 1 - (this.elapsed - streamStart) / STREAM_PHASE;
        } else {
            // Blob fades in during streaming phase
            const streamStart = 0.3;
            const streamEnd = 0.3 + STREAM_PHASE * 0.8;
            if (this.elapsed < streamStart) return 0;
            if (this.elapsed > streamEnd) return 1;
            return (this.elapsed - streamStart) / (STREAM_PHASE * 0.8);
        }
    }

    /**
     * Get approach position for blob (lerps toward vehicle door)
     */
    getApproachPosition(t) {
        // Lerp from blob start to vehicle door position
        const doorOffset = new THREE.Vector3(-1.0, 0, 0); // driver door side
        const doorPos = this.vehiclePosition.clone().add(doorOffset);
        return this.blobPosition.clone().lerp(doorPos, t);
    }

    update(dt) {
        if (!this.isPlaying) return;

        this.elapsed += dt;

        if (this.elapsed >= this.duration) {
            this._finish();
            return;
        }

        // Update stream particles
        const posAttr = this.particles.geometry.attributes.position;
        const sizeAttr = this.particles.geometry.attributes.size;

        const phase = this.getPhase();

        // Source and target depend on direction
        const source = this.direction === 'enter' ? this.blobPosition : this.vehiclePosition;
        const target = this.direction === 'enter' ? this.vehiclePosition : this.blobPosition;

        // During approach, particles stay at source
        // During streaming, particles flow from source to target
        const streamActive = phase === 'streaming' || phase === 'finalize';

        for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
            if (streamActive) {
                // Advance particle along path
                this._particleProgress[i] += this._particleSpeed[i] * dt * 2;
                if (this._particleProgress[i] > 1) {
                    this._particleProgress[i] -= 1;
                }

                const t = this._particleProgress[i];

                // Bezier-like arc from source to target
                const mid = source.clone().lerp(target, 0.5);
                mid.y += 1.5; // arc upward

                // Quadratic bezier: (1-t)^2*P0 + 2*(1-t)*t*P1 + t^2*P2
                const omt = 1 - t;
                const px = omt * omt * source.x + 2 * omt * t * mid.x + t * t * target.x;
                const py = omt * omt * source.y + 2 * omt * t * mid.y + t * t * target.y;
                const pz = omt * omt * source.z + 2 * omt * t * mid.z + t * t * target.z;

                // Add per-particle offset for volume
                posAttr.setXYZ(i,
                    px + this._particleOffset[i * 3] * (1 - t), // offset decreases toward target
                    py + this._particleOffset[i * 3 + 1] * (1 - t),
                    pz + this._particleOffset[i * 3 + 2] * (1 - t)
                );

                // Size: larger in middle, smaller at ends
                sizeAttr.setX(i, 0.05 + Math.sin(t * Math.PI) * 0.12);
            } else {
                // Particles orbit source during approach
                const time = this.elapsed * 3 + i * 0.1;
                const r = 0.5 + Math.sin(i * 0.3) * 0.2;
                posAttr.setXYZ(i,
                    source.x + Math.cos(time + i) * r,
                    source.y + 0.5 + Math.sin(time * 0.5 + i * 0.7) * 0.3,
                    source.z + Math.sin(time + i) * r
                );
                sizeAttr.setX(i, 0.08);
            }
        }

        posAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
    }

    _finish() {
        this.isPlaying = false;
        this.particles.visible = false;
        if (this.onPhaseComplete) this.onPhaseComplete('done');
    }

    isComplete() {
        return !this.isPlaying;
    }

    dispose() {
        this.scene.remove(this.particles);
        this.particles.geometry.dispose();
        this.particles.material.dispose();
    }
}
