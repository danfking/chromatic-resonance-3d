// tree-generators.js - 4 procedural tree species using Three.js primitives
// Each returns a THREE.Group with userData.type = 'tree-trunk' for collision

import * as THREE from 'three';

const TRUNK_COLOR = new THREE.Color('#5C4033');
const BIRCH_TRUNK_COLOR = new THREE.Color('#E8DCC8');
const BIRCH_BARK_STRIPE = new THREE.Color('#3B3226');

// Shared materials (created once, reused across all trees of each type)
const trunkMat = new THREE.MeshStandardMaterial({
    color: TRUNK_COLOR,
    roughness: 0.9,
    metalness: 0.0,
});

const birchTrunkMat = new THREE.MeshStandardMaterial({
    color: BIRCH_TRUNK_COLOR,
    roughness: 0.8,
    metalness: 0.0,
});

const deadTrunkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4A3B2A'),
    roughness: 0.95,
    metalness: 0.0,
});

function makeLeafMaterial(baseHue) {
    // Slight per-tree color variation
    const color = new THREE.Color();
    color.setHSL(baseHue, 0.55, 0.35);
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        metalness: 0.0,
    });
}

/**
 * Oak tree: wide canopy of 2-3 overlapping spheroids + thick trunk + branches
 * ~300-500 triangles
 * @param {number} scale - overall scale multiplier (0.7-1.3)
 * @param {function} rng - seeded RNG returning 0-1
 * @returns {THREE.Group}
 */
export function createOakTree(scale, rng) {
    const group = new THREE.Group();
    group.userData.type = 'tree-trunk';

    const s = scale;
    const trunkHeight = (3.5 + rng() * 1.5) * s;
    const trunkRadius = (0.25 + rng() * 0.1) * s;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 6, 1);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Canopy: 2-3 overlapping spheroids
    const canopyCount = 2 + Math.floor(rng() * 2); // 2 or 3
    const leafHue = 0.28 + rng() * 0.06; // green range
    const leafMat = makeLeafMaterial(leafHue);

    for (let i = 0; i < canopyCount; i++) {
        const radius = (1.5 + rng() * 1.0) * s;
        const canopyGeo = new THREE.IcosahedronGeometry(radius, 1);

        // Flatten Y, widen XZ for spheroid shape
        const posAttr = canopyGeo.attributes.position;
        for (let v = 0; v < posAttr.count; v++) {
            posAttr.setY(v, posAttr.getY(v) * 0.6);
            posAttr.setX(v, posAttr.getX(v) * 1.2);
            posAttr.setZ(v, posAttr.getZ(v) * 1.2);
        }
        posAttr.needsUpdate = true;
        canopyGeo.computeVertexNormals();

        const canopy = new THREE.Mesh(canopyGeo, leafMat);
        canopy.position.set(
            (rng() - 0.5) * 0.8 * s,
            trunkHeight + (rng() - 0.3) * 0.6 * s,
            (rng() - 0.5) * 0.8 * s
        );
        canopy.castShadow = true;
        canopy.userData.isCanopy = true;
        group.add(canopy);
    }

    // 1-2 branch cylinders from trunk to canopy
    const branchCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < branchCount; i++) {
        const branchLen = (1.0 + rng() * 0.8) * s;
        const branchGeo = new THREE.CylinderGeometry(0.06 * s, 0.1 * s, branchLen, 4, 1);
        const branch = new THREE.Mesh(branchGeo, trunkMat);

        const angle = rng() * Math.PI * 2;
        const tilt = 0.4 + rng() * 0.5; // radians from vertical
        branch.position.set(
            Math.sin(angle) * branchLen * 0.3,
            trunkHeight * (0.6 + rng() * 0.3),
            Math.cos(angle) * branchLen * 0.3
        );
        branch.rotation.z = Math.cos(angle) * tilt;
        branch.rotation.x = Math.sin(angle) * tilt;
        branch.castShadow = true;
        group.add(branch);
    }

    return group;
}

/**
 * Pine tree: 3-4 stacked cone layers + thin trunk
 * ~200-400 triangles
 */
export function createPineTree(scale, rng) {
    const group = new THREE.Group();
    group.userData.type = 'tree-trunk';

    const s = scale;
    const trunkHeight = (4.0 + rng() * 2.0) * s;
    const trunkRadius = (0.15 + rng() * 0.05) * s;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.6, trunkRadius, trunkHeight, 5, 1);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Cone layers: 3-4, decreasing radius going up
    const layers = 3 + Math.floor(rng() * 2);
    const leafHue = 0.30 + rng() * 0.05; // darker green for pine
    const leafMat = makeLeafMaterial(leafHue);

    for (let i = 0; i < layers; i++) {
        const t = i / layers;
        const layerRadius = (1.8 - t * 1.2) * s;
        const layerHeight = (1.5 - t * 0.3) * s;
        const coneGeo = new THREE.ConeGeometry(layerRadius, layerHeight, 6, 1);
        const cone = new THREE.Mesh(coneGeo, leafMat);

        cone.position.y = trunkHeight * (0.4 + t * 0.55) + layerHeight * 0.3;
        cone.castShadow = true;
        cone.userData.isCanopy = true;
        group.add(cone);
    }

    return group;
}

/**
 * Birch tree: 2-3 thin white trunks + small leaf clusters on branch tips
 * ~300 triangles
 */
export function createBirchTree(scale, rng) {
    const group = new THREE.Group();
    group.userData.type = 'tree-trunk';

    const s = scale;
    const trunkCount = 2 + Math.floor(rng() * 2); // 2-3 trunks
    const leafHue = 0.25 + rng() * 0.08; // lighter green
    const leafMat = makeLeafMaterial(leafHue);

    for (let t = 0; t < trunkCount; t++) {
        const trunkHeight = (3.0 + rng() * 2.0) * s;
        const trunkRadius = (0.08 + rng() * 0.04) * s;

        // Thin white trunk
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.6, trunkRadius, trunkHeight, 5, 1);
        const trunk = new THREE.Mesh(trunkGeo, birchTrunkMat);

        // Offset each trunk slightly from center
        const offsetAngle = (t / trunkCount) * Math.PI * 2 + rng() * 0.5;
        const offsetDist = 0.2 * s + rng() * 0.3 * s;
        trunk.position.set(
            Math.sin(offsetAngle) * offsetDist,
            trunkHeight / 2,
            Math.cos(offsetAngle) * offsetDist
        );
        // Slight lean
        trunk.rotation.z = (rng() - 0.5) * 0.15;
        trunk.rotation.x = (rng() - 0.5) * 0.15;
        trunk.castShadow = true;
        group.add(trunk);

        // Small leaf clusters at top of each trunk (2-3 per trunk)
        const clusterCount = 2 + Math.floor(rng() * 2);
        for (let c = 0; c < clusterCount; c++) {
            const clusterRadius = (0.4 + rng() * 0.3) * s;
            const clusterGeo = new THREE.IcosahedronGeometry(clusterRadius, 1);
            const cluster = new THREE.Mesh(clusterGeo, leafMat);

            cluster.position.set(
                trunk.position.x + (rng() - 0.5) * 0.8 * s,
                trunkHeight * (0.7 + rng() * 0.3) + clusterRadius,
                trunk.position.z + (rng() - 0.5) * 0.8 * s
            );
            cluster.castShadow = true;
            cluster.userData.isCanopy = true;
            group.add(cluster);
        }
    }

    return group;
}

/**
 * Dead tree: bare twisted branches, no canopy
 * ~150-250 triangles
 */
export function createDeadTree(scale, rng) {
    const group = new THREE.Group();
    group.userData.type = 'tree-trunk';

    const s = scale;
    const trunkHeight = (3.0 + rng() * 2.0) * s;
    const trunkRadius = (0.2 + rng() * 0.08) * s;

    // Main trunk
    const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.5, trunkRadius, trunkHeight, 5, 1);
    const trunk = new THREE.Mesh(trunkGeo, deadTrunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // 3-6 bare branches at various angles
    const branchCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < branchCount; i++) {
        const branchLen = (0.8 + rng() * 1.2) * s;
        const branchRadius = (0.04 + rng() * 0.04) * s;
        const branchGeo = new THREE.CylinderGeometry(branchRadius * 0.4, branchRadius, branchLen, 4, 1);
        const branch = new THREE.Mesh(branchGeo, deadTrunkMat);

        const angle = (i / branchCount) * Math.PI * 2 + rng() * 0.6;
        const attachY = trunkHeight * (0.4 + rng() * 0.5);
        const tilt = 0.5 + rng() * 0.8; // more tilt for dead tree

        branch.position.set(
            Math.sin(angle) * branchLen * 0.35,
            attachY,
            Math.cos(angle) * branchLen * 0.35
        );
        branch.rotation.z = Math.cos(angle) * tilt;
        branch.rotation.x = Math.sin(angle) * tilt;
        branch.castShadow = true;
        group.add(branch);

        // Occasional sub-branch (30% chance)
        if (rng() < 0.3) {
            const subLen = branchLen * 0.5;
            const subGeo = new THREE.CylinderGeometry(branchRadius * 0.2, branchRadius * 0.5, subLen, 3, 1);
            const sub = new THREE.Mesh(subGeo, deadTrunkMat);
            sub.position.set(
                branch.position.x + Math.sin(angle + 1) * subLen * 0.3,
                attachY + branchLen * 0.2,
                branch.position.z + Math.cos(angle + 1) * subLen * 0.3
            );
            sub.rotation.z = Math.cos(angle + 1) * (tilt + 0.3);
            sub.rotation.x = Math.sin(angle + 1) * (tilt + 0.3);
            sub.castShadow = true;
            group.add(sub);
        }
    }

    return group;
}
