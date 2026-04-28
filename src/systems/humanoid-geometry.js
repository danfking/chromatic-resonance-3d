// humanoid-geometry.js - Enhanced humanoid geometry factory for enemies
// Uses portrait-matched proportions for better watercolor texture projection

import * as THREE from 'three';

// Body variant configurations for different enemy types
export const BODY_VARIANTS = {
    shade: {
        headScale: [1, 1.3, 1],      // Elongated ghostly head
        torsoScale: [0.9, 1, 0.9],   // Slim torso
        armScale: [0.8, 1.1, 0.8],   // Long thin arms
        shoulderWidth: 0.9,
        neckLength: 1.1
    },
    verdantSlime: {
        headScale: [1.2, 0.9, 1.2],  // Wide blobby head
        torsoScale: [1.3, 0.9, 1.3], // Chunky torso
        armScale: [1.2, 0.9, 1.2],   // Stubby arms
        shoulderWidth: 1.2,
        neckLength: 0.7
    },
    crimsonWraith: {
        headScale: [1, 1.1, 1],      // Slightly tall head
        torsoScale: [1.1, 1, 1.1],   // Wide fiery torso
        armScale: [1, 1, 1],         // Normal arms
        shoulderWidth: 1.15,
        neckLength: 0.9
    },
    azurePhantom: {
        headScale: [0.95, 1.15, 0.95], // Ethereal elongated
        torsoScale: [0.85, 1.1, 0.85], // Slim ethereal
        armScale: [0.9, 1.15, 0.9],    // Long flowing arms
        shoulderWidth: 0.85,
        neckLength: 1.2
    },
    chromaticGuardian: {
        headScale: [1.1, 1, 1.1],    // Boss - imposing head
        torsoScale: [1.2, 1.1, 1.2], // Large torso
        armScale: [1.1, 1.1, 1.1],   // Strong arms
        shoulderWidth: 1.3,
        neckLength: 0.8
    },
    voidHarbinger: {
        headScale: [1.15, 1.2, 1.15], // Final boss - menacing
        torsoScale: [1.25, 1.15, 1.25],
        armScale: [1.15, 1.2, 1.15],
        shoulderWidth: 1.35,
        neckLength: 0.85
    },
    default: {
        headScale: [1, 1, 1],
        torsoScale: [1, 1, 1],
        armScale: [1, 1, 1],
        shoulderWidth: 1,
        neckLength: 1
    }
};

// Shared base geometries (before variant scaling)
const sharedGeometries = {
    head: null,
    neck: null,
    shoulder: null,
    torsoUpper: null,
    torsoLower: null,
    upperArm: null,
    lowerArm: null,
    bleedPlane: new THREE.PlaneGeometry(2, 2, 16, 16)
};

/**
 * Creates a head geometry using LatheGeometry for portrait-matched chin profile
 */
function createHeadGeometry() {
    if (sharedGeometries.head) return sharedGeometries.head;

    // Profile points for head shape (from bottom/chin to top)
    // Creates an elongated oval with defined chin
    const points = [];
    const segments = 16;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let x, y;

        if (t < 0.15) {
            // Chin point - narrow
            const chinT = t / 0.15;
            x = 0.3 + chinT * 0.4;
            y = t * 2;
        } else if (t < 0.4) {
            // Lower face - widening to cheeks
            const faceT = (t - 0.15) / 0.25;
            x = 0.7 + Math.sin(faceT * Math.PI * 0.5) * 0.3;
            y = 0.3 + (t - 0.15) * 2.4;
        } else if (t < 0.7) {
            // Mid face to forehead - full width
            x = 1.0 - (t - 0.4) * 0.1;
            y = 0.9 + (t - 0.4) * 2;
        } else {
            // Top of head - curves inward
            const topT = (t - 0.7) / 0.3;
            x = 0.9 * (1 - topT * topT);
            y = 1.5 + topT * 0.5;
        }

        points.push(new THREE.Vector2(x * 0.5, y - 1)); // Center around origin
    }

    sharedGeometries.head = new THREE.LatheGeometry(points, 16);
    return sharedGeometries.head;
}

/**
 * Creates neck geometry - small cylinder connector
 */
function createNeckGeometry() {
    if (sharedGeometries.neck) return sharedGeometries.neck;
    sharedGeometries.neck = new THREE.CylinderGeometry(0.25, 0.3, 0.4, 8);
    return sharedGeometries.neck;
}

/**
 * Creates shoulder joint geometry - spheres
 */
function createShoulderGeometry() {
    if (sharedGeometries.shoulder) return sharedGeometries.shoulder;
    sharedGeometries.shoulder = new THREE.SphereGeometry(0.2, 8, 8);
    return sharedGeometries.shoulder;
}

/**
 * Creates tapered torso geometry (wide shoulders to narrow waist)
 */
function createTorsoGeometry() {
    if (sharedGeometries.torsoUpper) return { upper: sharedGeometries.torsoUpper, lower: sharedGeometries.torsoLower };

    // Upper torso - wide shoulders
    sharedGeometries.torsoUpper = new THREE.CylinderGeometry(0.35, 0.5, 0.8, 8);

    // Lower torso - tapers to waist
    sharedGeometries.torsoLower = new THREE.CylinderGeometry(0.3, 0.35, 0.6, 8);

    return { upper: sharedGeometries.torsoUpper, lower: sharedGeometries.torsoLower };
}

/**
 * Creates arm segment geometries (upper + lower with elbow definition)
 */
function createArmGeometries() {
    if (sharedGeometries.upperArm) return { upper: sharedGeometries.upperArm, lower: sharedGeometries.lowerArm };

    // Upper arm - slightly tapered
    sharedGeometries.upperArm = new THREE.CapsuleGeometry(0.12, 0.5, 4, 8);

    // Lower arm - thinner, tapered to wrist
    sharedGeometries.lowerArm = new THREE.CapsuleGeometry(0.1, 0.45, 4, 8);

    return { upper: sharedGeometries.upperArm, lower: sharedGeometries.lowerArm };
}

// Legacy shared geometries export for backward compatibility
export const SHARED_GEOMETRIES = {
    head: new THREE.SphereGeometry(1, 16, 16),
    torso: new THREE.CapsuleGeometry(1, 2, 8, 8),
    arm: new THREE.CapsuleGeometry(0.3, 1.3, 4, 4),
    bleedPlane: sharedGeometries.bleedPlane
};

/**
 * Creates a humanoid upper body group (head, torso, arms - no legs)
 * Legacy function - uses simple primitives
 * @param {number} size - Base size multiplier for the humanoid
 * @param {THREE.Material} material - Material to apply to all body parts
 * @returns {Object} Object containing group and references to body parts
 */
export function createHumanoidGroup(size, material) {
    const group = new THREE.Group();

    // Head - positioned at top
    const head = new THREE.Mesh(SHARED_GEOMETRIES.head, material);
    head.scale.setScalar(size * 0.25);
    head.position.y = size * 0.6;
    head.castShadow = true;
    group.add(head);

    // Torso - center mass
    const torso = new THREE.Mesh(SHARED_GEOMETRIES.torso, material);
    torso.scale.set(size * 0.3, size * 0.4, size * 0.25);
    torso.position.y = size * 0.2;
    torso.castShadow = true;
    group.add(torso);

    // Left arm - positioned at side
    const leftArm = new THREE.Mesh(SHARED_GEOMETRIES.arm, material);
    leftArm.scale.setScalar(size * 0.2);
    leftArm.position.set(-size * 0.35, size * 0.15, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;
    group.add(leftArm);

    // Right arm - mirrored from left
    const rightArm = new THREE.Mesh(SHARED_GEOMETRIES.arm, material);
    rightArm.scale.setScalar(size * 0.2);
    rightArm.position.set(size * 0.35, size * 0.15, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = true;
    group.add(rightArm);

    return { group, head, torso, leftArm, rightArm };
}

/**
 * Creates an enhanced humanoid with portrait-matched proportions
 * Uses LatheGeometry head, neck, shoulders, tapered torso, segmented arms
 * @param {number} size - Base size multiplier
 * @param {THREE.Material} material - Material for all body parts
 * @param {string} enemyType - Enemy type key for body variant selection
 * @returns {Object} Object containing group and references to all body parts
 */
export function createEnhancedHumanoidGroup(size, material, enemyType = 'default') {
    const group = new THREE.Group();
    const variant = BODY_VARIANTS[enemyType] || BODY_VARIANTS.default;

    // Get geometries
    const headGeom = createHeadGeometry();
    const neckGeom = createNeckGeometry();
    const shoulderGeom = createShoulderGeometry();
    const torsoGeoms = createTorsoGeometry();
    const armGeoms = createArmGeometries();

    // === HEAD ===
    // Positioned at top 30% of body height (matches portrait layout)
    const head = new THREE.Mesh(headGeom, material);
    const headScale = size * 0.22;
    head.scale.set(
        headScale * variant.headScale[0],
        headScale * variant.headScale[1],
        headScale * variant.headScale[2]
    );
    head.position.y = size * 0.7; // At 70% height
    head.castShadow = true;
    head.userData.bodyPart = 'head';
    group.add(head);

    // === NECK ===
    const neck = new THREE.Mesh(neckGeom, material);
    const neckScale = size * 0.3 * variant.neckLength;
    neck.scale.set(neckScale, neckScale, neckScale);
    neck.position.y = size * 0.55;
    neck.castShadow = true;
    neck.userData.bodyPart = 'neck';
    group.add(neck);

    // === TORSO (Upper) ===
    const torsoUpper = new THREE.Mesh(torsoGeoms.upper, material);
    torsoUpper.scale.set(
        size * 0.35 * variant.torsoScale[0],
        size * 0.3 * variant.torsoScale[1],
        size * 0.3 * variant.torsoScale[2]
    );
    torsoUpper.position.y = size * 0.38;
    torsoUpper.castShadow = true;
    torsoUpper.userData.bodyPart = 'torso';
    group.add(torsoUpper);

    // === TORSO (Lower) ===
    const torsoLower = new THREE.Mesh(torsoGeoms.lower, material);
    torsoLower.scale.set(
        size * 0.32 * variant.torsoScale[0],
        size * 0.25 * variant.torsoScale[1],
        size * 0.28 * variant.torsoScale[2]
    );
    torsoLower.position.y = size * 0.12;
    torsoLower.castShadow = true;
    torsoLower.userData.bodyPart = 'torso';
    group.add(torsoLower);

    // === SHOULDERS ===
    const shoulderOffset = size * 0.38 * variant.shoulderWidth;

    const leftShoulder = new THREE.Mesh(shoulderGeom, material);
    leftShoulder.scale.setScalar(size * 0.25);
    leftShoulder.position.set(-shoulderOffset, size * 0.45, 0);
    leftShoulder.castShadow = true;
    leftShoulder.userData.bodyPart = 'shoulder';
    group.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeom, material);
    rightShoulder.scale.setScalar(size * 0.25);
    rightShoulder.position.set(shoulderOffset, size * 0.45, 0);
    rightShoulder.castShadow = true;
    rightShoulder.userData.bodyPart = 'shoulder';
    group.add(rightShoulder);

    // === LEFT ARM (Upper + Lower) ===
    const leftUpperArm = new THREE.Mesh(armGeoms.upper, material);
    leftUpperArm.scale.set(
        size * 0.2 * variant.armScale[0],
        size * 0.22 * variant.armScale[1],
        size * 0.2 * variant.armScale[2]
    );
    leftUpperArm.position.set(-shoulderOffset - size * 0.08, size * 0.32, 0);
    leftUpperArm.rotation.z = 0.25;
    leftUpperArm.castShadow = true;
    leftUpperArm.userData.bodyPart = 'upperArm';
    group.add(leftUpperArm);

    const leftLowerArm = new THREE.Mesh(armGeoms.lower, material);
    leftLowerArm.scale.set(
        size * 0.18 * variant.armScale[0],
        size * 0.2 * variant.armScale[1],
        size * 0.18 * variant.armScale[2]
    );
    leftLowerArm.position.set(-shoulderOffset - size * 0.15, size * 0.12, 0);
    leftLowerArm.rotation.z = 0.15;
    leftLowerArm.castShadow = true;
    leftLowerArm.userData.bodyPart = 'lowerArm';
    group.add(leftLowerArm);

    // === RIGHT ARM (Upper + Lower) ===
    const rightUpperArm = new THREE.Mesh(armGeoms.upper, material);
    rightUpperArm.scale.set(
        size * 0.2 * variant.armScale[0],
        size * 0.22 * variant.armScale[1],
        size * 0.2 * variant.armScale[2]
    );
    rightUpperArm.position.set(shoulderOffset + size * 0.08, size * 0.32, 0);
    rightUpperArm.rotation.z = -0.25;
    rightUpperArm.castShadow = true;
    rightUpperArm.userData.bodyPart = 'upperArm';
    group.add(rightUpperArm);

    const rightLowerArm = new THREE.Mesh(armGeoms.lower, material);
    rightLowerArm.scale.set(
        size * 0.18 * variant.armScale[0],
        size * 0.2 * variant.armScale[1],
        size * 0.18 * variant.armScale[2]
    );
    rightLowerArm.position.set(shoulderOffset + size * 0.15, size * 0.12, 0);
    rightLowerArm.rotation.z = -0.15;
    rightLowerArm.castShadow = true;
    rightLowerArm.userData.bodyPart = 'lowerArm';
    group.add(rightLowerArm);

    // Return all parts for animation control
    return {
        group,
        head,
        neck,
        torso: torsoUpper, // Main torso reference for compatibility
        torsoUpper,
        torsoLower,
        leftShoulder,
        rightShoulder,
        leftUpperArm,
        leftLowerArm,
        rightUpperArm,
        rightLowerArm,
        // Legacy aliases for backward compatibility
        leftArm: leftUpperArm,
        rightArm: rightUpperArm
    };
}

/**
 * Creates the watercolor bleed shader material for ground effect
 * @param {number} color - Hex color for the bleed effect
 * @returns {THREE.ShaderMaterial} Shader material for bleed effect
 */
export function createBleedMaterial(color) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            color: { value: new THREE.Color(color) },
            time: { value: 0 },
            opacity: { value: 0.5 },
            scale: { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform float time;
            uniform float opacity;
            uniform float scale;
            varying vec2 vUv;

            // Simple noise function for organic edges
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                // Distance from center
                float dist = length(vUv - 0.5) * 2.0;

                // Add noise for organic watercolor edge
                float noise = hash(vUv * 10.0 + time * 0.1);
                float noise2 = hash(vUv * 20.0 - time * 0.05);

                // Combine distance and noise for irregular edge
                float edge = dist + (noise - 0.5) * 0.3 + (noise2 - 0.5) * 0.15;

                // Soft alpha falloff
                float alpha = (1.0 - smoothstep(0.3 * scale, 1.0 * scale, edge)) * opacity;

                // Color variation for painterly effect
                vec3 finalColor = color * (0.9 + noise * 0.2);

                gl_FragColor = vec4(finalColor, alpha);
            }
        `
    });
}

/**
 * Creates a bleed plane mesh for an enemy
 * @param {number} size - Size of the enemy (affects bleed size)
 * @param {number} color - Hex color for the bleed
 * @returns {Object} Object containing mesh and material for animation control
 */
export function createBleedPlane(size, color) {
    const material = createBleedMaterial(color);
    const mesh = new THREE.Mesh(sharedGeometries.bleedPlane, material);

    // Position flat on ground, slightly above to prevent z-fighting
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    mesh.scale.setScalar(size * 1.5);

    return { mesh, material };
}
