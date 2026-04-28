// chunk-manager.js - Manages terrain chunk loading/unloading for open world
// World size: 1024x1024, chunk size: 64x64, 16x16 grid = 256 total chunks
// Loads chunks in radius around camera, unloads beyond threshold

import { TerrainChunk, CHUNK_SIZE } from './terrain-chunk.js';
import { fbmNoise } from './terrain-noise.js';

const WORLD_SIZE = 1024;
const CHUNKS_PER_SIDE = Math.ceil(WORLD_SIZE / CHUNK_SIZE); // 16
const LOAD_RADIUS = 3;          // chunks around camera to keep loaded
const UNLOAD_RADIUS = 5;        // unload chunks beyond this
const MAX_LOADS_PER_FRAME = 2;  // budget: max new chunks per update
const LOD0_RADIUS = 2;          // chunks within this get full detail
const GLOBAL_HEIGHTMAP_RES = 257; // low-res global heightmap

export class ChunkManager {
    /**
     * @param {THREE.Group} parentGroup - group to add chunk meshes to
     * @param {number} seed - world seed
     */
    constructor(parentGroup, seed) {
        this.parentGroup = parentGroup;
        this.seed = seed;

        // Active chunks: key = "chunkX,chunkZ" → TerrainChunk
        this.chunks = new Map();

        // Low-res global heightmap for physics queries outside loaded chunks
        this.globalHeightmap = null;
        this._buildGlobalHeightmap();

        // Camera position tracking
        this._lastCameraChunkX = -999;
        this._lastCameraChunkZ = -999;

        // Stats
        this.activeChunkCount = 0;
    }

    /**
     * Build lightweight global heightmap (4 units per sample)
     * Used for physics queries outside loaded chunks
     */
    _buildGlobalHeightmap() {
        const res = GLOBAL_HEIGHTMAP_RES;
        this.globalHeightmap = new Float32Array(res * res);
        const noiseSeed = this.seed + 1000;

        for (let z = 0; z < res; z++) {
            for (let x = 0; x < res; x++) {
                const wx = (x / (res - 1)) * WORLD_SIZE;
                const wz = (z / (res - 1)) * WORLD_SIZE;

                let h = fbmNoise(wx, wz, noiseSeed);

                // Directional spawn flattening — elongated clearing northward (-Z)
                // Creates a valley corridor guiding player toward objectives
                const spawnCX = WORLD_SIZE / 2;
                const spawnCZ = WORLD_SIZE / 2;
                const dx = wx - spawnCX;
                const dz = wz - spawnCZ;
                const xRadius = 25;
                const zRadius = dz < 0 ? 60 : 20;  // Longer northward (-Z)
                const ellipseDist = Math.sqrt((dx / xRadius) ** 2 + (dz / zRadius) ** 2);
                if (ellipseDist < 1.0) {
                    const t = ellipseDist;
                    h *= 0.5 * (1 - Math.cos(t * Math.PI));
                }

                this.globalHeightmap[z * res + x] = h;
            }
        }
    }

    /**
     * Get height at any world position.
     * Uses loaded chunk heightmap if available (full resolution),
     * falls back to global heightmap (low resolution).
     * API-compatible with OutdoorLevel.getHeightAt()
     */
    getHeightAt(wx, wz) {
        // Clamp to world bounds
        wx = Math.max(0, Math.min(WORLD_SIZE, wx));
        wz = Math.max(0, Math.min(WORLD_SIZE, wz));

        // Try loaded chunk first (full resolution)
        const chunkX = Math.floor(wx / CHUNK_SIZE);
        const chunkZ = Math.floor(wz / CHUNK_SIZE);
        const key = `${chunkX},${chunkZ}`;
        const chunk = this.chunks.get(key);

        if (chunk && chunk.heightmap) {
            const h = chunk.getHeightAt(wx, wz);
            if (h !== null) return h;
        }

        // Fallback: global heightmap (bilinear interpolation)
        return this._globalHeightAt(wx, wz);
    }

    /**
     * Get terrain normal at world position
     */
    getTerrainNormal(wx, wz) {
        const eps = 0.5;
        const hL = this.getHeightAt(wx - eps, wz);
        const hR = this.getHeightAt(wx + eps, wz);
        const hD = this.getHeightAt(wx, wz - eps);
        const hU = this.getHeightAt(wx, wz + eps);

        const nx = (hL - hR);
        const ny = 2 * eps;
        const nz = (hD - hU);
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return { x: nx / len, y: ny / len, z: nz / len };
    }

    /**
     * Low-res global heightmap query with bilinear interpolation
     */
    _globalHeightAt(wx, wz) {
        if (!this.globalHeightmap) return 0;

        const res = GLOBAL_HEIGHTMAP_RES;
        const nx = (wx / WORLD_SIZE) * (res - 1);
        const nz = (wz / WORLD_SIZE) * (res - 1);

        const ix = Math.floor(nx);
        const iz = Math.floor(nz);
        const fx = nx - ix;
        const fz = nz - iz;

        if (ix < 0 || ix >= res - 1 || iz < 0 || iz >= res - 1) return 0;

        const v00 = this.globalHeightmap[iz * res + ix];
        const v10 = this.globalHeightmap[iz * res + ix + 1];
        const v01 = this.globalHeightmap[(iz + 1) * res + ix];
        const v11 = this.globalHeightmap[(iz + 1) * res + ix + 1];

        const v0 = v00 * (1 - fx) + v10 * fx;
        const v1 = v01 * (1 - fx) + v11 * fx;
        return v0 * (1 - fz) + v1 * fz;
    }

    /**
     * Update chunk loading/unloading based on camera position
     * Call every frame from the level's update()
     * @param {number} cameraX - camera world X
     * @param {number} cameraZ - camera world Z
     */
    update(cameraX, cameraZ) {
        const camChunkX = Math.floor(cameraX / CHUNK_SIZE);
        const camChunkZ = Math.floor(cameraZ / CHUNK_SIZE);

        // Only recalculate if camera moved to a new chunk
        if (camChunkX === this._lastCameraChunkX && camChunkZ === this._lastCameraChunkZ) {
            return;
        }
        this._lastCameraChunkX = camChunkX;
        this._lastCameraChunkZ = camChunkZ;

        // 1. Determine which chunks should be loaded
        const desiredChunks = new Set();
        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
            for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
                const cx = camChunkX + dx;
                const cz = camChunkZ + dz;
                // Skip out-of-bounds
                if (cx < 0 || cx >= CHUNKS_PER_SIDE || cz < 0 || cz >= CHUNKS_PER_SIDE) continue;
                desiredChunks.add(`${cx},${cz}`);
            }
        }

        // 2. Unload chunks beyond unload radius
        for (const [key, chunk] of this.chunks) {
            const dx = chunk.chunkX - camChunkX;
            const dz = chunk.chunkZ - camChunkZ;
            const dist = Math.max(Math.abs(dx), Math.abs(dz)); // Chebyshev distance

            if (dist > UNLOAD_RADIUS) {
                chunk.dispose();
                this.chunks.delete(key);
            } else {
                // Update LOD
                const newLOD = dist <= LOD0_RADIUS ? 0 : 1;
                if (chunk.lod !== newLOD) {
                    chunk.setLOD(newLOD);
                }
            }
        }

        // 3. Load new chunks (budgeted)
        let loadsThisFrame = 0;
        for (const key of desiredChunks) {
            if (this.chunks.has(key)) continue;
            if (loadsThisFrame >= MAX_LOADS_PER_FRAME) break;

            const [cx, cz] = key.split(',').map(Number);
            const dx = cx - camChunkX;
            const dz = cz - camChunkZ;
            const dist = Math.max(Math.abs(dx), Math.abs(dz));
            const lod = dist <= LOD0_RADIUS ? 0 : 1;

            const chunk = new TerrainChunk(cx, cz, this.seed, lod);
            chunk.build();
            this.parentGroup.add(chunk.mesh);
            this.chunks.set(key, chunk);
            loadsThisFrame++;
        }

        this.activeChunkCount = this.chunks.size;
    }

    /**
     * Force-load chunks around a position (for initial build)
     */
    loadAroundPosition(wx, wz) {
        const camChunkX = Math.floor(wx / CHUNK_SIZE);
        const camChunkZ = Math.floor(wz / CHUNK_SIZE);

        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
            for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
                const cx = camChunkX + dx;
                const cz = camChunkZ + dz;
                if (cx < 0 || cx >= CHUNKS_PER_SIDE || cz < 0 || cz >= CHUNKS_PER_SIDE) continue;

                const key = `${cx},${cz}`;
                if (this.chunks.has(key)) continue;

                const dist = Math.max(Math.abs(dx), Math.abs(dz));
                const lod = dist <= LOD0_RADIUS ? 0 : 1;

                const chunk = new TerrainChunk(cx, cz, this.seed, lod);
                chunk.build();
                this.parentGroup.add(chunk.mesh);
                this.chunks.set(key, chunk);
            }
        }

        this._lastCameraChunkX = camChunkX;
        this._lastCameraChunkZ = camChunkZ;
        this.activeChunkCount = this.chunks.size;
    }

    /**
     * Get loaded chunk at grid position (or null)
     */
    getChunk(chunkX, chunkZ) {
        return this.chunks.get(`${chunkX},${chunkZ}`) || null;
    }

    /**
     * Iterate all loaded chunks
     */
    forEachChunk(callback) {
        for (const chunk of this.chunks.values()) {
            callback(chunk);
        }
    }

    /**
     * Get world bounds
     */
    getWorldSize() {
        return WORLD_SIZE;
    }

    getSpawnCenter() {
        return WORLD_SIZE / 2;
    }

    dispose() {
        for (const chunk of this.chunks.values()) {
            chunk.dispose();
        }
        this.chunks.clear();
        this.globalHeightmap = null;
    }
}

export { CHUNK_SIZE, WORLD_SIZE };
