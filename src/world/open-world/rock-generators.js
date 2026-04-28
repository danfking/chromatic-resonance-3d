// rock-generators.js - 3 procedural rock types using Three.js primitives
// Each returns a THREE.Mesh or Group with userData.type = 'rock' for collision

import * as THREE from 'three';

const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7A7268'),  // gray-brown
    roughness: 0.9,
    metalness: 0.05,
});

const darkRockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5A524A'),
    roughness: 0.95,
    metalness: 0.05,
});

/**
 * Displace vertices of an IcosahedronGeometry for organic rock shape.
 * @param {THREE.BufferGeometry} geo
 * @param {function} rng - seeded RNG
 * @param {number} strength - displacement amount (0-1)
 */
function displaceVertices(geo, rng, strength) {
    const posAttr = geo.attributes.position;
    // Track displaced positions by original position to keep shared verts consistent
    const displaced = new Map();

    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);

        // Use rounded coords as key to merge shared vertices
        const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;

        if (!displaced.has(key)) {
            const len = Math.sqrt(x * x + y * y + z * z);
            const scale = 1 + (rng() - 0.5) * 2 * strength;
            displaced.set(key, {
                x: x * scale,
                y: y * scale,
                z: z * scale,
            });
        }

        const d = displaced.get(key);
        posAttr.setXYZ(i, d.x, d.y, d.z);
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
}

/**
 * Boulder: displaced icosahedron, organic rock shape
 * ~80 triangles
 * @param {number} scale - size multiplier (0.5-2.0)
 * @param {function} rng - seeded RNG
 * @returns {THREE.Mesh}
 */
export function createBoulder(scale, rng) {
    const radius = (0.5 + rng() * 0.5) * scale;
    const geo = new THREE.IcosahedronGeometry(radius, 1);

    displaceVertices(geo, rng, 0.25);

    // Slightly flatten Y for a grounded look
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        posAttr.setY(i, posAttr.getY(i) * (0.6 + rng() * 0.3));
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    // Pick material with slight variation
    const mat = rng() > 0.5 ? rockMat : darkRockMat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = 'rock';

    // Random rotation for variety
    mesh.rotation.y = rng() * Math.PI * 2;

    return mesh;
}

/**
 * Slab: wide flat box with slight random scaling and rotation
 * ~12 triangles
 * @param {number} scale
 * @param {function} rng
 * @returns {THREE.Mesh}
 */
export function createSlab(scale, rng) {
    const width = (1.0 + rng() * 1.5) * scale;
    const height = (0.2 + rng() * 0.3) * scale;
    const depth = (0.6 + rng() * 1.0) * scale;

    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, rockMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = 'rock';

    // Slight tilt for natural look
    mesh.rotation.x = (rng() - 0.5) * 0.15;
    mesh.rotation.y = rng() * Math.PI * 2;
    mesh.rotation.z = (rng() - 0.5) * 0.1;

    // Offset Y so bottom sits near ground
    mesh.position.y = height / 2;

    return mesh;
}

/**
 * Rock cluster: 3-5 small boulders grouped together
 * ~200-400 triangles
 * @param {number} scale
 * @param {function} rng
 * @returns {THREE.Group}
 */
export function createRockCluster(scale, rng) {
    const group = new THREE.Group();
    group.userData.type = 'rock';

    const count = 3 + Math.floor(rng() * 3); // 3-5

    for (let i = 0; i < count; i++) {
        const subScale = (0.3 + rng() * 0.5) * scale;
        const boulder = createBoulder(subScale, rng);

        // Scatter around center
        const angle = (i / count) * Math.PI * 2 + rng() * 1.0;
        const dist = rng() * 0.8 * scale;
        boulder.position.x = Math.sin(angle) * dist;
        boulder.position.z = Math.cos(angle) * dist;

        group.add(boulder);
    }

    return group;
}
