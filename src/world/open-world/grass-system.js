// grass-system.js - Per-chunk instanced grass with LOD support
// Scatters grass blades on terrain surface using InstancedBufferGeometry
// LOD0 (near): 800 blades, 3-segment blades (7 verts)
// LOD1 (far):  400 blades, 1-segment blades (3 verts)

import * as THREE from 'three';
import { createGrassMaterial } from './grass-material.js';
import { seededRNG } from './terrain-noise.js';
import { CHUNK_SIZE } from './terrain-chunk.js';

const LOD0_BLADES_PER_CHUNK = 800;
const LOD1_BLADES_PER_CHUNK = 400;
const LOD0_SEGMENTS = 3;     // 7 vertices per blade
const LOD1_SEGMENTS = 1;     // 3 vertices per blade
const LOD0_DISTANCE = 50;    // world units
const LOD1_DISTANCE = 100;

const MIN_BLADE_HEIGHT = 0.3;
const MAX_BLADE_HEIGHT = 0.8;
const BLADE_WIDTH = 0.06;
const MIN_SLOPE_Y = 0.7;     // skip steep slopes (normal.y threshold)
const MIN_HEIGHT = 2.0;      // skip water areas
const SPAWN_CLEAR_RADIUS = 30; // clear area around world center

/**
 * Build a single grass blade geometry as a tapered triangle strip.
 * @param {number} segments - number of vertical segments (1 = simple triangle, 3 = curved blade)
 * @returns {THREE.BufferGeometry}
 */
function buildBladeGeometry(segments) {
    const vertCount = segments * 2 + 1; // base pair + mid pairs + tip
    const positions = new Float32Array(vertCount * 3);
    const indices = [];

    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const y = t;
        // Taper width from full at base to narrow near tip
        const width = BLADE_WIDTH * (1 - t * 0.7);
        const idx = i * 2;

        // Left vertex
        positions[idx * 3]     = -width;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = 0;

        // Right vertex
        positions[(idx + 1) * 3]     = width;
        positions[(idx + 1) * 3 + 1] = y;
        positions[(idx + 1) * 3 + 2] = 0;
    }

    // Tip vertex (single point at top center)
    const tipIdx = segments * 2;
    positions[tipIdx * 3]     = 0;
    positions[tipIdx * 3 + 1] = 1;
    positions[tipIdx * 3 + 2] = 0;

    // Build triangle indices (triangle strip as indexed triangles)
    for (let i = 0; i < segments - 1; i++) {
        const bl = i * 2;
        const br = i * 2 + 1;
        const tl = (i + 1) * 2;
        const tr = (i + 1) * 2 + 1;
        // Two triangles per quad segment
        indices.push(bl, br, tl);
        indices.push(br, tr, tl);
    }

    // Final segment connects last pair to tip
    const lastL = (segments - 1) * 2;
    const lastR = (segments - 1) * 2 + 1;
    indices.push(lastL, lastR, tipIdx);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
}

/**
 * Scatter blade positions on a terrain chunk, respecting slope and height filters.
 * @param {object} chunk - TerrainChunk with getHeightAt(), worldX, worldZ
 * @param {number} count - number of blades to attempt
 * @param {number} seed - RNG seed
 * @returns {{ positions: Float32Array, heights: Float32Array, phases: Float32Array, colors: Float32Array, count: number }}
 */
function scatterBlades(chunk, count, seed) {
    const rng = seededRNG(seed);
    const worldCenterX = 512;
    const worldCenterZ = 512;

    // Over-sample then filter
    const maxAttempts = count * 2;
    const posArr = [];
    const heightArr = [];
    const phaseArr = [];
    const colorArr = [];
    let placed = 0;

    for (let i = 0; i < maxAttempts && placed < count; i++) {
        const lx = rng() * CHUNK_SIZE;
        const lz = rng() * CHUNK_SIZE;
        const wx = chunk.worldX + lx;
        const wz = chunk.worldZ + lz;

        // Skip spawn clear zone
        const dsx = wx - worldCenterX;
        const dsz = wz - worldCenterZ;
        if (dsx * dsx + dsz * dsz < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS) continue;

        const h = chunk.getHeightAt(wx, wz);
        if (h === null || h < MIN_HEIGHT) continue;

        // Check slope via finite differences
        const eps = 0.5;
        const hL = chunk.getHeightAt(wx - eps, wz);
        const hR = chunk.getHeightAt(wx + eps, wz);
        const hD = chunk.getHeightAt(wx, wz - eps);
        const hU = chunk.getHeightAt(wx, wz + eps);
        if (hL === null || hR === null || hD === null || hU === null) continue;

        const nx = hL - hR;
        const ny = 2 * eps;
        const nz = hD - hU;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const normalY = ny / len;
        if (normalY < MIN_SLOPE_Y) continue;

        // Blade properties
        posArr.push(wx, h, wz);
        heightArr.push(MIN_BLADE_HEIGHT + rng() * (MAX_BLADE_HEIGHT - MIN_BLADE_HEIGHT));
        phaseArr.push(rng() * Math.PI * 2);

        // Color variation: slight per-blade tint around (1, 1, 1) with green bias
        const r = 0.85 + rng() * 0.3;
        const g = 0.9 + rng() * 0.2;
        const b = 0.8 + rng() * 0.3;
        colorArr.push(r, g, b);

        placed++;
    }

    return {
        positions: new Float32Array(posArr),
        heights: new Float32Array(heightArr),
        phases: new Float32Array(phaseArr),
        colors: new Float32Array(colorArr),
        count: placed,
    };
}

export class GrassSystem {
    constructor() {
        this.material = createGrassMaterial();
        this.chunkGrass = new Map(); // "chunkX,chunkZ" -> { mesh, lod }

        // Pre-build shared blade geometries
        this._bladeGeoLOD0 = buildBladeGeometry(LOD0_SEGMENTS);
        this._bladeGeoLOD1 = buildBladeGeometry(LOD1_SEGMENTS);
    }

    /**
     * Create grass instances for a terrain chunk.
     * @param {import('./terrain-chunk.js').TerrainChunk} chunk
     * @param {THREE.Group} parentGroup
     */
    addChunk(chunk, parentGroup) {
        const key = `${chunk.chunkX},${chunk.chunkZ}`;
        if (this.chunkGrass.has(key)) return;

        const lod = chunk.lod || 0;
        const bladeCount = lod === 0 ? LOD0_BLADES_PER_CHUNK : LOD1_BLADES_PER_CHUNK;
        const bladeGeo = lod === 0 ? this._bladeGeoLOD0 : this._bladeGeoLOD1;

        // Seed from chunk position for deterministic placement
        const seed = (chunk.chunkX * 73856093 + chunk.chunkZ * 19349669) | 0;

        const scattered = scatterBlades(chunk, bladeCount, seed);
        if (scattered.count === 0) {
            this.chunkGrass.set(key, { mesh: null, lod });
            return;
        }

        // Build InstancedBufferGeometry from shared blade + per-instance attributes
        const instancedGeo = new THREE.InstancedBufferGeometry();
        instancedGeo.index = bladeGeo.index;
        instancedGeo.setAttribute('position', bladeGeo.getAttribute('position'));

        instancedGeo.setAttribute('instancePosition',
            new THREE.InstancedBufferAttribute(scattered.positions, 3));
        instancedGeo.setAttribute('instanceHeight',
            new THREE.InstancedBufferAttribute(scattered.heights, 1));
        instancedGeo.setAttribute('instancePhase',
            new THREE.InstancedBufferAttribute(scattered.phases, 1));
        instancedGeo.setAttribute('instanceColor',
            new THREE.InstancedBufferAttribute(scattered.colors, 3));

        instancedGeo.instanceCount = scattered.count;

        // Bounding sphere for frustum culling
        const center = new THREE.Vector3(
            chunk.worldX + CHUNK_SIZE / 2,
            10,
            chunk.worldZ + CHUNK_SIZE / 2
        );
        instancedGeo.boundingSphere = new THREE.Sphere(center, CHUNK_SIZE);

        const mesh = new THREE.Mesh(instancedGeo, this.material);
        mesh.frustumCulled = true;
        mesh.userData = { type: 'grass', chunkKey: key };

        parentGroup.add(mesh);
        this.chunkGrass.set(key, { mesh, lod });
    }

    /**
     * Remove grass for a chunk.
     * @param {string} chunkKey - "chunkX,chunkZ"
     */
    removeChunk(chunkKey) {
        const entry = this.chunkGrass.get(chunkKey);
        if (!entry) return;

        if (entry.mesh) {
            if (entry.mesh.parent) entry.mesh.parent.remove(entry.mesh);
            // Dispose instanced attributes (not shared blade geo)
            const geo = entry.mesh.geometry;
            const attrs = ['instancePosition', 'instanceHeight', 'instancePhase', 'instanceColor'];
            for (const name of attrs) {
                const attr = geo.getAttribute(name);
                if (attr) attr.array = null;
            }
            geo.dispose();
        }

        this.chunkGrass.delete(chunkKey);
    }

    /**
     * Update wind animation and LOD switching.
     * @param {number} time - elapsed time in seconds
     * @param {THREE.Vector3} cameraPosition
     */
    update(time, cameraPosition) {
        this.material.uniforms.time.value = time;
    }

    dispose() {
        for (const [key] of this.chunkGrass) {
            this.removeChunk(key);
        }
        this.chunkGrass.clear();
        this.material.dispose();
        this._bladeGeoLOD0.dispose();
        this._bladeGeoLOD1.dispose();
    }
}
