// atmosphere-system.js - Fog, floating particles, distant mountain silhouettes

import * as THREE from 'three';
import { seededRNG } from './terrain-noise.js';

const FOG_DENSITY = 0.004;
const PARTICLE_COUNT = 700;
const PARTICLE_RADIUS = 100;      // radius around camera
const MOUNTAIN_DISTANCES = [600, 800, 1000];
const MOUNTAINS_PER_RING = [8, 12, 16];

export class AtmosphereSystem {
    constructor(scene, seed, worldSize) {
        this.scene = scene;
        this.seed = seed;
        this.worldSize = worldSize;

        // Fog
        this._setupFog();

        // Floating particles (pollen/dust)
        this._createParticles();

        // Distant mountain silhouettes
        this._createMountains();
    }

    _setupFog() {
        // Exponential fog for natural distance falloff
        const fogColor = new THREE.Color(0xc8d8e8); // sky horizon color
        this.scene.fog = new THREE.FogExp2(fogColor, FOG_DENSITY);
    }

    _createParticles() {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const phases = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Random position in sphere around origin (will be repositioned around camera)
            positions[i * 3] = (Math.random() - 0.5) * PARTICLE_RADIUS * 2;
            positions[i * 3 + 1] = 1 + Math.random() * 15; // 1-16 units high
            positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_RADIUS * 2;

            // Gentle drift velocity
            velocities[i * 3] = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;

            phases[i] = Math.random() * Math.PI * 2;
        }

        this._particleVelocities = velocities;
        this._particlePhases = phases;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xeeddbb,
            size: 0.15,
            transparent: true,
            opacity: 0.4,
            blending: THREE.NormalBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        this.particles = new THREE.Points(geo, mat);
        this.particles.frustumCulled = false;
        this.scene.add(this.particles);
    }

    _createMountains() {
        const rng = seededRNG(this.seed + 7000);
        this.mountains = new THREE.Group();
        this.mountains.name = 'distant-mountains';

        for (let ring = 0; ring < MOUNTAIN_DISTANCES.length; ring++) {
            const distance = MOUNTAIN_DISTANCES[ring];
            const count = MOUNTAINS_PER_RING[ring];
            const alpha = 0.3 - ring * 0.08; // farther = more transparent
            const color = ring === 0 ? 0x6b7b8d :
                ring === 1 ? 0x8899aa : 0xa0b0c0;

            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: alpha,
                fog: true,
                side: THREE.DoubleSide,
            });

            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + rng() * 0.3;
                const baseWidth = 40 + rng() * 80;
                const height = 30 + rng() * 60;

                // Cone mountain
                const geo = new THREE.ConeGeometry(baseWidth, height, 4 + Math.floor(rng() * 4));
                const mesh = new THREE.Mesh(geo, mat);

                const centerX = this.worldSize / 2;
                const centerZ = this.worldSize / 2;
                mesh.position.set(
                    centerX + Math.cos(angle) * distance,
                    height * 0.3, // Partially below horizon
                    centerZ + Math.sin(angle) * distance
                );
                mesh.rotation.y = rng() * Math.PI * 2;
                mesh.userData = { type: 'distant-mountain' };

                this.mountains.add(mesh);
            }
        }

        this.scene.add(this.mountains);
    }

    /**
     * Update atmosphere effects
     * @param {number} dt - delta time
     * @param {THREE.Vector3} cameraPosition - current camera world position
     */
    update(dt, cameraPosition) {
        if (!cameraPosition) return;

        const time = performance.now() * 0.001;
        const posAttr = this.particles.geometry.attributes.position;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            let px = posAttr.getX(i);
            let py = posAttr.getY(i);
            let pz = posAttr.getZ(i);

            // Sine drift
            const phase = this._particlePhases[i];
            px += (this._particleVelocities[i * 3] + Math.sin(time + phase) * 0.1) * dt;
            py += (this._particleVelocities[i * 3 + 1] + Math.sin(time * 0.5 + phase) * 0.02) * dt;
            pz += (this._particleVelocities[i * 3 + 2] + Math.cos(time * 0.7 + phase) * 0.1) * dt;

            // Wrap around camera (keep particles within radius)
            const dx = px - cameraPosition.x;
            const dz = pz - cameraPosition.z;
            if (Math.abs(dx) > PARTICLE_RADIUS) {
                px = cameraPosition.x + (Math.random() - 0.5) * PARTICLE_RADIUS * 2;
            }
            if (Math.abs(dz) > PARTICLE_RADIUS) {
                pz = cameraPosition.z + (Math.random() - 0.5) * PARTICLE_RADIUS * 2;
            }
            // Keep in height range
            if (py < 1) py = 1 + Math.random() * 15;
            if (py > 20) py = 1 + Math.random() * 5;

            posAttr.setXYZ(i, px, py, pz);
        }

        posAttr.needsUpdate = true;
    }

    /**
     * Set fog color (match sky horizon)
     */
    setFogColor(color) {
        if (this.scene.fog) {
            this.scene.fog.color.set(color);
        }
    }

    dispose() {
        this.scene.remove(this.particles);
        this.particles.geometry.dispose();
        this.particles.material.dispose();

        this.scene.remove(this.mountains);
        this.mountains.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        if (this.scene.fog) {
            this.scene.fog = null;
        }
    }
}
