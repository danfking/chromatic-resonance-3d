// terrain-chunk.js - Individual terrain chunk geometry + material
// Each chunk is 64x64 world units with 33x33 vertices (LOD0) or 17x17 (LOD1)

import * as THREE from 'three';
import { fbmNoise } from './terrain-noise.js';
import { TextureManager } from '../../systems/texture-manager.js';

export const CHUNK_SIZE = 64;
const LOD0_RES = 33;  // vertices per side for near chunks
const LOD1_RES = 17;  // vertices per side for far chunks

// Height-based colors (matches outdoor-level.js)
const lowColor = new THREE.Color('#7aba6a');   // Bright green (0-8)
const midColor = new THREE.Color('#c8b67a');   // Warm golden (8-15)
const highColor = new THREE.Color('#a89786');  // Light gray-brown rock (15-25)

export class TerrainChunk {
    /**
     * @param {number} chunkX - chunk grid X coordinate
     * @param {number} chunkZ - chunk grid Z coordinate
     * @param {number} seed - world seed
     * @param {number} lod - 0 for near, 1 for far
     */
    constructor(chunkX, chunkZ, seed, lod = 0) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.seed = seed;
        this.lod = lod;

        // World-space origin of this chunk
        this.worldX = chunkX * CHUNK_SIZE;
        this.worldZ = chunkZ * CHUNK_SIZE;

        this.mesh = null;
        this.heightmap = null;
        this.res = lod === 0 ? LOD0_RES : LOD1_RES;

        this._disposed = false;
    }

    /**
     * Build the chunk geometry and heightmap
     */
    build() {
        const res = this.res;
        const noiseSeed = this.seed + 1000; // match outdoor-level.js offset

        // Generate heightmap for this chunk
        this.heightmap = new Float32Array(res * res);

        for (let z = 0; z < res; z++) {
            for (let x = 0; x < res; x++) {
                const wx = this.worldX + (x / (res - 1)) * CHUNK_SIZE;
                const wz = this.worldZ + (z / (res - 1)) * CHUNK_SIZE;

                let h = fbmNoise(wx, wz, noiseSeed);

                // Directional spawn flattening — elongated clearing northward (-Z)
                const spawnCenterX = 512;
                const spawnCenterZ = 512;
                const dx = wx - spawnCenterX;
                const dz = wz - spawnCenterZ;
                const xRadius = 25;
                const zRadius = dz < 0 ? 60 : 20;  // Longer northward (-Z)
                const ellipseDist = Math.sqrt((dx / xRadius) ** 2 + (dz / zRadius) ** 2);
                if (ellipseDist < 1.0) {
                    const t = ellipseDist;
                    const flattenFactor = 0.5 * (1 - Math.cos(t * Math.PI));
                    h *= flattenFactor;
                }

                this.heightmap[z * res + x] = h;
            }
        }

        // Create geometry
        const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, res - 1, res - 1);
        const posAttr = geo.attributes.position;

        // Apply heightmap to Z component (PlaneGeometry lies in XY, we rotate to XZ)
        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setZ(i, this.heightmap[i]);
        }

        geo.computeVertexNormals();

        // Per-vertex colors based on height
        const colors = new Float32Array(posAttr.count * 3);
        const tmpColor = new THREE.Color();

        for (let i = 0; i < posAttr.count; i++) {
            const h = this.heightmap[i];
            if (h < 8) {
                const t = Math.max(0, h / 8);
                tmpColor.copy(lowColor).lerp(midColor, t);
            } else if (h < 15) {
                const t = (h - 8) / 7;
                tmpColor.copy(midColor).lerp(highColor, t);
            } else {
                tmpColor.copy(highColor);
            }
            colors[i * 3] = tmpColor.r;
            colors[i * 3 + 1] = tmpColor.g;
            colors[i * 3 + 2] = tmpColor.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Material — simpler for LOD1
        // Try to apply grass texture; vertex colors tint it by height
        const grassTex = TextureManager.getTextureSync('ground-grass-lawn');
        const matOptions = {
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.0,
            ...(this.lod === 1 ? { flatShading: true } : {}),
        };
        if (grassTex) {
            const tex = grassTex.clone();
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(8, 8);
            matOptions.map = tex;
        }
        const mat = new THREE.MeshStandardMaterial(matOptions);

        this.mesh = new THREE.Mesh(geo, mat);
        // PlaneGeometry is in XY plane, rotate to lie flat in XZ
        this.mesh.rotation.x = -Math.PI / 2;
        // Position chunk center in world space
        this.mesh.position.set(
            this.worldX + CHUNK_SIZE / 2,
            0,
            this.worldZ + CHUNK_SIZE / 2
        );
        this.mesh.receiveShadow = true;
        this.mesh.userData = { type: 'terrain', chunkX: this.chunkX, chunkZ: this.chunkZ };

        return this.mesh;
    }

    /**
     * Get height at world position within this chunk (bilinear interpolation)
     * Returns null if position is outside chunk bounds
     */
    getHeightAt(wx, wz) {
        if (!this.heightmap) return null;

        // Convert world coords to chunk-local normalized coords
        const localX = wx - this.worldX;
        const localZ = wz - this.worldZ;

        if (localX < 0 || localX > CHUNK_SIZE || localZ < 0 || localZ > CHUNK_SIZE) {
            return null;
        }

        const res = this.res;
        const nx = (localX / CHUNK_SIZE) * (res - 1);
        const nz = (localZ / CHUNK_SIZE) * (res - 1);

        const ix = Math.floor(nx);
        const iz = Math.floor(nz);
        const fx = nx - ix;
        const fz = nz - iz;

        if (ix < 0 || ix >= res - 1 || iz < 0 || iz >= res - 1) return null;

        const v00 = this.heightmap[iz * res + ix];
        const v10 = this.heightmap[iz * res + ix + 1];
        const v01 = this.heightmap[(iz + 1) * res + ix];
        const v11 = this.heightmap[(iz + 1) * res + ix + 1];

        const v0 = v00 * (1 - fx) + v10 * fx;
        const v1 = v01 * (1 - fx) + v11 * fx;
        return v0 * (1 - fz) + v1 * fz;
    }

    /**
     * Get terrain normal at world position within this chunk
     */
    getTerrainNormal(wx, wz) {
        const eps = 0.5;
        const hL = this.getHeightAt(wx - eps, wz) ?? this._fallbackHeight(wx - eps, wz);
        const hR = this.getHeightAt(wx + eps, wz) ?? this._fallbackHeight(wx + eps, wz);
        const hD = this.getHeightAt(wx, wz - eps) ?? this._fallbackHeight(wx, wz - eps);
        const hU = this.getHeightAt(wx, wz + eps) ?? this._fallbackHeight(wx, wz + eps);

        const nx = (hL - hR);
        const ny = 2 * eps;
        const nz = (hD - hU);
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return { x: nx / len, y: ny / len, z: nz / len };
    }

    /**
     * Fallback height computation for positions at chunk edges
     */
    _fallbackHeight(wx, wz) {
        return fbmNoise(wx, wz, this.seed + 1000);
    }

    /**
     * Switch LOD level (rebuilds geometry)
     */
    setLOD(newLOD) {
        if (newLOD === this.lod) return;
        this.lod = newLOD;
        this.res = newLOD === 0 ? LOD0_RES : LOD1_RES;

        if (this.mesh) {
            const parent = this.mesh.parent;
            this.dispose();
            this._disposed = false;
            this.build();
            if (parent) parent.add(this.mesh);
        }
    }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;

        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (this.mesh.material.map) this.mesh.material.map.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
        this.heightmap = null;
    }
}
