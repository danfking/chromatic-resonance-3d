// vegetation-system.js - Per-chunk vegetation placement (trees, rocks, modern props)
// Places objects on terrain surface, skipping steep slopes, water, and spawn area

import * as THREE from 'three';
import { seededRNG } from './terrain-noise.js';
import { CHUNK_SIZE } from './terrain-chunk.js';
import { createOakTree, createPineTree, createBirchTree, createDeadTree } from './tree-generators.js';
import { createBoulder, createSlab, createRockCluster } from './rock-generators.js';
import { TextureManager } from '../../systems/texture-manager.js';

const TREES_PER_CHUNK_MIN = 2;
const TREES_PER_CHUNK_MAX = 5;
const ROCKS_PER_CHUNK_MIN = 1;
const ROCKS_PER_CHUNK_MAX = 3;
const PROPS_PER_CHUNK_MIN = 0;
const PROPS_PER_CHUNK_MAX = 2;

const MIN_SLOPE_Y = 0.7;
const MIN_HEIGHT = 2.0;
const SPAWN_CLEAR_RADIUS = 35;
const WORLD_CENTER = 512;

const treeGenerators = [createOakTree, createPineTree, createBirchTree, createDeadTree];
const treeWeights = [0.35, 0.30, 0.20, 0.15]; // cumulative selection weights

const rockGenerators = [createBoulder, createSlab, createRockCluster];
const rockWeights = [0.45, 0.30, 0.25];

// --- Modern Earth props ---

const poleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6B6B6B'),
    roughness: 0.7,
    metalness: 0.3,
});

const lampMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFFFEE'),
    emissive: new THREE.Color('#FFFFE0'),
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.1,
});

const fenceMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8B7355'),
    roughness: 0.85,
    metalness: 0.0,
});

/**
 * Streetlight: pole + lamp sphere
 * ~30 triangles
 */
function createStreetlight(scale) {
    const group = new THREE.Group();
    group.userData.type = 'streetlight';

    const s = scale;
    const poleHeight = 4.0 * s;

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.06 * s, 0.08 * s, poleHeight, 5, 1);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = poleHeight / 2;
    pole.castShadow = true;
    group.add(pole);

    // Lamp arm (short horizontal cylinder)
    const armLen = 0.6 * s;
    const armGeo = new THREE.CylinderGeometry(0.03 * s, 0.03 * s, armLen, 4, 1);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(armLen / 2, poleHeight - 0.1 * s, 0);
    arm.rotation.z = Math.PI / 2;
    group.add(arm);

    // Lamp globe
    const lampGeo = new THREE.SphereGeometry(0.15 * s, 6, 4);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(armLen, poleHeight - 0.2 * s, 0);
    group.add(lamp);

    return group;
}

/**
 * Fence section: horizontal bars + vertical slats
 * ~50 triangles per section
 */
function createFence(length, rng) {
    const group = new THREE.Group();
    group.userData.type = 'fence';

    const height = 1.0;
    const postSpacing = 1.5;
    const postCount = Math.max(2, Math.floor(length / postSpacing) + 1);
    const actualLength = (postCount - 1) * postSpacing;

    // Vertical posts
    for (let i = 0; i < postCount; i++) {
        const postGeo = new THREE.BoxGeometry(0.08, height, 0.08);
        const post = new THREE.Mesh(postGeo, fenceMat);
        post.position.set(i * postSpacing - actualLength / 2, height / 2, 0);
        post.castShadow = true;
        group.add(post);
    }

    // Two horizontal bars
    for (let barY of [height * 0.3, height * 0.7]) {
        const barGeo = new THREE.BoxGeometry(actualLength, 0.06, 0.04);
        const bar = new THREE.Mesh(barGeo, fenceMat);
        bar.position.y = barY;
        bar.castShadow = true;
        group.add(bar);
    }

    // Random rotation for variety
    group.rotation.y = rng() * Math.PI;

    return group;
}

/**
 * Parked car: simplified box body + wheel cylinders
 * ~80 triangles, collidable
 */
function createParkedCar(color, rng) {
    const group = new THREE.Group();
    group.userData.type = 'parked-car';

    const carMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.4,
        metalness: 0.3,
    });

    // Body (lower block)
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 0.9);
    const body = new THREE.Mesh(bodyGeo, carMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Cabin (upper block, narrower)
    const cabinGeo = new THREE.BoxGeometry(1.0, 0.45, 0.8);
    const cabin = new THREE.Mesh(cabinGeo, carMat);
    cabin.position.set(-0.1, 0.95, 0);
    cabin.castShadow = true;
    group.add(cabin);

    // Windows (dark)
    const windowMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1a1a2e'),
        roughness: 0.1,
        metalness: 0.5,
    });
    const windowGeo = new THREE.BoxGeometry(0.98, 0.35, 0.82);
    const windows = new THREE.Mesh(windowGeo, windowMat);
    windows.position.set(-0.1, 1.0, 0);
    group.add(windows);

    // 4 wheels
    const wheelMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#222222'),
        roughness: 0.8,
        metalness: 0.1,
    });
    const wheelPositions = [
        [0.55, 0.2, 0.45],
        [0.55, 0.2, -0.45],
        [-0.55, 0.2, 0.45],
        [-0.55, 0.2, -0.45],
    ];
    for (const [wx, wy, wz] of wheelPositions) {
        const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 6, 1);
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, wy, wz);
        group.add(wheel);
    }

    // Random yaw
    group.rotation.y = rng() * Math.PI * 2;

    return group;
}

const CAR_COLORS = ['#8B0000', '#1B3F8B', '#2E5E3E', '#4A4A4A', '#EEEEEE', '#C4A35A'];

const hydrantMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#CC2222'),
    roughness: 0.6,
    metalness: 0.2,
});

const mailboxMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2255AA'),
    roughness: 0.5,
    metalness: 0.2,
});

const roadMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#333338'),
    roughness: 0.95,
    metalness: 0.0,
});

/**
 * Fire hydrant: cylinder body + cap + two side nozzles
 * ~30 triangles
 */
function createFireHydrant(scale) {
    const group = new THREE.Group();
    group.userData.type = 'fire-hydrant';

    const s = scale;

    // Main body
    const bodyGeo = new THREE.CylinderGeometry(0.12 * s, 0.15 * s, 0.6 * s, 6, 1);
    const body = new THREE.Mesh(bodyGeo, hydrantMat);
    body.position.y = 0.3 * s;
    body.castShadow = true;
    group.add(body);

    // Cap
    const capGeo = new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 0.12 * s, 6, 1);
    const cap = new THREE.Mesh(capGeo, hydrantMat);
    cap.position.y = 0.66 * s;
    group.add(cap);

    // Two side nozzles
    for (const side of [-1, 1]) {
        const nozzleGeo = new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.1 * s, 4, 1);
        const nozzle = new THREE.Mesh(nozzleGeo, hydrantMat);
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.set(side * 0.15 * s, 0.4 * s, 0);
        group.add(nozzle);
    }

    return group;
}

/**
 * Mailbox: post + box body
 * ~24 triangles
 */
function createMailbox(scale, rng) {
    const group = new THREE.Group();
    group.userData.type = 'mailbox';

    const s = scale;

    // Post
    const postGeo = new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 1.0 * s, 4, 1);
    const post = new THREE.Mesh(postGeo, poleMat);
    post.position.y = 0.5 * s;
    post.castShadow = true;
    group.add(post);

    // Box
    const boxGeo = new THREE.BoxGeometry(0.3 * s, 0.25 * s, 0.2 * s);
    const box = new THREE.Mesh(boxGeo, mailboxMat);
    box.position.y = 1.1 * s;
    box.castShadow = true;
    group.add(box);

    group.rotation.y = rng() * Math.PI * 2;
    return group;
}

/**
 * Road segment: dark flat plane strip
 * ~2 triangles
 */
function createRoadSegment(length, rng) {
    const width = 4.0;
    const geo = new THREE.PlaneGeometry(length, width);
    // Try to use asphalt texture; fall back to solid roadMat
    const asphaltTex = TextureManager.getTextureSync('ground-asphalt');
    let mat = roadMat;
    if (asphaltTex) {
        const tex = asphaltTex.clone();
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(length / 4, 1);
        mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.95,
            metalness: 0.0,
        });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02; // slight offset above terrain to avoid z-fighting
    mesh.rotation.y = rng() * Math.PI; // random orientation (note: applied before x rotation is consumed)
    mesh.receiveShadow = true;
    mesh.userData.type = 'road';
    return mesh;
}

// --- Weighted selection helper ---

function weightedSelect(generators, weights, rng) {
    const r = rng();
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) return generators[i];
    }
    return generators[generators.length - 1];
}

// --- Placement validation ---

function isValidPlacement(wx, wz, chunk) {
    // Skip spawn area
    const dx = wx - WORLD_CENTER;
    const dz = wz - WORLD_CENTER;
    if (dx * dx + dz * dz < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS) return false;

    const h = chunk.getHeightAt(wx, wz);
    if (h === null || h < MIN_HEIGHT) return false;

    // Slope check
    const eps = 0.5;
    const hL = chunk.getHeightAt(wx - eps, wz);
    const hR = chunk.getHeightAt(wx + eps, wz);
    const hD = chunk.getHeightAt(wx, wz - eps);
    const hU = chunk.getHeightAt(wx, wz + eps);
    if (hL === null || hR === null || hD === null || hU === null) return false;

    const nx = hL - hR;
    const ny = 2 * eps;
    const nz = hD - hU;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if ((ny / len) < MIN_SLOPE_Y) return false;

    return true;
}

/**
 * Try to find a valid placement position within the chunk.
 * @returns {{ x: number, y: number, z: number } | null}
 */
function findPlacement(chunk, rng, maxAttempts) {
    for (let i = 0; i < maxAttempts; i++) {
        // Inset from chunk edges by 2 units to avoid border artifacts
        const lx = 2 + rng() * (CHUNK_SIZE - 4);
        const lz = 2 + rng() * (CHUNK_SIZE - 4);
        const wx = chunk.worldX + lx;
        const wz = chunk.worldZ + lz;

        if (!isValidPlacement(wx, wz, chunk)) continue;

        const h = chunk.getHeightAt(wx, wz);
        return { x: wx, y: h, z: wz };
    }
    return null;
}

// --- VegetationSystem ---

export class VegetationSystem {
    constructor() {
        this.chunkVegetation = new Map(); // "chunkX,chunkZ" -> { group, objects[], canopies[] }
    }

    /**
     * Populate vegetation for a terrain chunk.
     * @param {import('./terrain-chunk.js').TerrainChunk} chunk
     * @param {THREE.Group} parentGroup
     */
    addChunk(chunk, parentGroup) {
        const key = `${chunk.chunkX},${chunk.chunkZ}`;
        if (this.chunkVegetation.has(key)) return;

        const seed = (chunk.chunkX * 48271 + chunk.chunkZ * 65521 + 7919) | 0;
        const rng = seededRNG(seed);

        const group = new THREE.Group();
        group.userData = { type: 'vegetation-chunk', chunkKey: key };
        const objects = [];
        const canopies = []; // { mesh, restPosition, hash } for wind sway

        // Trees: 2-5 per chunk
        const treeCount = TREES_PER_CHUNK_MIN + Math.floor(rng() * (TREES_PER_CHUNK_MAX - TREES_PER_CHUNK_MIN + 1));
        for (let i = 0; i < treeCount; i++) {
            const pos = findPlacement(chunk, rng, 8);
            if (!pos) continue;

            const generator = weightedSelect(treeGenerators, treeWeights, rng);
            const isDeadTree = generator === createDeadTree;
            const scale = 0.8 + rng() * 0.5; // 0.8-1.3
            const tree = generator(scale, rng);
            tree.position.set(pos.x, pos.y, pos.z);
            tree.rotation.y = rng() * Math.PI * 2;

            // Collect canopy meshes for wind sway (skip dead trees)
            if (!isDeadTree) {
                const hash = pos.x * 73.1 + pos.z * 37.9 + i * 5.3;
                tree.traverse((child) => {
                    if (child.userData.isCanopy) {
                        canopies.push({
                            mesh: child,
                            restX: child.position.x,
                            restZ: child.position.z,
                            hash,
                        });
                    }
                });
            }

            group.add(tree);
            objects.push(tree);
        }

        // Rocks: 1-3 per chunk
        const rockCount = ROCKS_PER_CHUNK_MIN + Math.floor(rng() * (ROCKS_PER_CHUNK_MAX - ROCKS_PER_CHUNK_MIN + 1));
        for (let i = 0; i < rockCount; i++) {
            const pos = findPlacement(chunk, rng, 6);
            if (!pos) continue;

            const generator = weightedSelect(rockGenerators, rockWeights, rng);
            const scale = 0.6 + rng() * 0.8; // 0.6-1.4
            const rock = generator(scale, rng);
            rock.position.set(pos.x, pos.y, pos.z);

            group.add(rock);
            objects.push(rock);
        }

        // Modern props: 0-2 per chunk
        const propCount = PROPS_PER_CHUNK_MIN + Math.floor(rng() * (PROPS_PER_CHUNK_MAX - PROPS_PER_CHUNK_MIN + 1));
        for (let i = 0; i < propCount; i++) {
            const pos = findPlacement(chunk, rng, 6);
            if (!pos) continue;

            const propType = rng();
            let prop;

            if (propType < 0.22) {
                prop = createStreetlight(0.9 + rng() * 0.2);
            } else if (propType < 0.40) {
                prop = createFence(2 + rng() * 3, rng);
            } else if (propType < 0.55) {
                const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
                prop = createParkedCar(color, rng);
            } else if (propType < 0.68) {
                prop = createFireHydrant(0.9 + rng() * 0.2);
            } else if (propType < 0.80) {
                prop = createMailbox(0.9 + rng() * 0.2, rng);
            } else {
                prop = createRoadSegment(6 + rng() * 8, rng);
            }

            prop.position.set(pos.x, pos.y, pos.z);
            group.add(prop);
            objects.push(prop);
        }

        parentGroup.add(group);
        this.chunkVegetation.set(key, { group, objects, canopies });
    }

    /**
     * Remove vegetation for a chunk.
     * @param {string} chunkKey
     */
    removeChunk(chunkKey) {
        const entry = this.chunkVegetation.get(chunkKey);
        if (!entry) return;

        // Dispose all meshes in objects
        for (const obj of entry.objects) {
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    // Only dispose non-shared materials
                    if (child.material && child.material !== poleMat &&
                        child.material !== lampMat && child.material !== fenceMat) {
                        child.material.dispose();
                    }
                }
            });
        }

        if (entry.group.parent) entry.group.parent.remove(entry.group);
        this.chunkVegetation.delete(chunkKey);
    }

    /**
     * Update canopy wind sway animation.
     * @param {number} time - elapsed time in seconds
     */
    update(time) {
        for (const entry of this.chunkVegetation.values()) {
            for (const c of entry.canopies) {
                const sway = Math.sin(time * 1.2 + c.hash) * 0.02;
                c.mesh.rotation.x = sway;
                c.mesh.rotation.z = Math.sin(time * 0.9 + c.hash + 1.7) * 0.015;
            }
        }
    }

    /**
     * Get all collidable objects across loaded chunks for collision queries.
     * @returns {THREE.Object3D[]}
     */
    getCollidables() {
        const result = [];
        for (const entry of this.chunkVegetation.values()) {
            for (const obj of entry.objects) {
                if (obj.userData.type === 'tree-trunk' ||
                    obj.userData.type === 'rock' ||
                    obj.userData.type === 'parked-car') {
                    result.push(obj);
                }
            }
        }
        return result;
    }

    dispose() {
        for (const key of [...this.chunkVegetation.keys()]) {
            this.removeChunk(key);
        }
        this.chunkVegetation.clear();
    }
}
