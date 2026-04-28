// water-system.js - Water body management for open world
// Places water at terrain depressions, creates PlaneGeometry with shader material

import * as THREE from 'three';
import { createWaterMaterial } from './water-material.js';
import { fbmNoise, seededRNG } from './terrain-noise.js';

const WATER_LEVEL = 3.0;            // Default water surface height
const WATER_BODY_SIZE = 40;          // Default size of water planes
const MAX_WATER_BODIES = 5;

/**
 * Find terrain depressions where water would collect
 */
function findWaterLocations(seed, worldSize, count) {
    const rng = seededRNG(seed + 5000);
    const noiseSeed = seed + 1000;
    const locations = [];

    // Sample terrain and find local minima
    const sampleStep = 32;
    const candidates = [];

    for (let z = 64; z < worldSize - 64; z += sampleStep) {
        for (let x = 64; x < worldSize - 64; x += sampleStep) {
            const h = fbmNoise(x, z, noiseSeed);

            // Check if this is a local minimum
            const hN = fbmNoise(x, z - sampleStep, noiseSeed);
            const hS = fbmNoise(x, z + sampleStep, noiseSeed);
            const hE = fbmNoise(x + sampleStep, z, noiseSeed);
            const hW = fbmNoise(x - sampleStep, z, noiseSeed);

            if (h < hN && h < hS && h < hE && h < hW && h < 8) {
                candidates.push({ x, z, height: h });
            }
        }
    }

    // Sort by height (lowest first) and take top N
    candidates.sort((a, b) => a.height - b.height);

    // Filter for spacing (at least 100 units apart)
    for (const c of candidates) {
        if (locations.length >= count) break;
        const tooClose = locations.some(l => {
            const dx = l.x - c.x, dz = l.z - c.z;
            return Math.sqrt(dx * dx + dz * dz) < 100;
        });
        if (!tooClose) {
            locations.push({
                x: c.x,
                z: c.z,
                waterLevel: c.height + 0.5, // water slightly above terrain minimum
                size: WATER_BODY_SIZE + rng() * 30,
            });
        }
    }

    return locations;
}

export class WaterSystem {
    constructor(scene, seed, worldSize) {
        this.scene = scene;
        this.seed = seed;
        this.worldSize = worldSize;

        this.waterBodies = [];
        this.material = createWaterMaterial();

        // Find and create water bodies
        const locations = findWaterLocations(seed, worldSize, MAX_WATER_BODIES);
        for (const loc of locations) {
            this._createWaterBody(loc);
        }
    }

    _createWaterBody(location) {
        const geo = new THREE.PlaneGeometry(location.size, location.size, 16, 16);
        const mesh = new THREE.Mesh(geo, this.material);

        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(location.x, location.waterLevel, location.z);
        mesh.userData = { type: 'water', waterLevel: location.waterLevel };

        this.scene.add(mesh);
        this.waterBodies.push({
            mesh,
            location,
        });
    }

    /**
     * Check if a world position is in water
     * @returns {number|null} water level if in water, null if not
     */
    getWaterLevelAt(wx, wz) {
        for (const body of this.waterBodies) {
            const loc = body.location;
            const halfSize = loc.size / 2;
            if (wx >= loc.x - halfSize && wx <= loc.x + halfSize &&
                wz >= loc.z - halfSize && wz <= loc.z + halfSize) {
                return loc.waterLevel;
            }
        }
        return null;
    }

    update(dt) {
        this.material.uniforms.time.value += dt;
    }

    dispose() {
        for (const body of this.waterBodies) {
            this.scene.remove(body.mesh);
            body.mesh.geometry.dispose();
        }
        this.material.dispose();
        this.waterBodies = [];
    }
}
