// human-wobbler.js - TABS-style wobbler human characters
// 15-part procedural bodies with googly eyes, ~200 triangles per character

import * as THREE from 'three';
import { TextureManager } from '../systems/texture-manager.js';

// Human type configurations
export const HUMAN_TYPES = {
    civilian: {
        speed: 0.15, hp: 30, damage: 5,
        behavior: 'flee',
        bodyColor: 0x8B7355,
        clothingColor: 0x4169E1,
        scaleRange: [0.9, 1.1],
    },
    police: {
        speed: 0.12, hp: 80, damage: 15,
        behavior: 'pursue',
        bodyColor: 0xC4A882,
        clothingColor: 0x000080,
        scaleRange: [1.0, 1.0],
    },
    soldier: {
        speed: 0.10, hp: 120, damage: 25,
        behavior: 'tactical',
        bodyColor: 0xC4A882,
        clothingColor: 0x556B2F,
        helmetColor: 0x808080,
        scaleRange: [1.05, 1.05],
    },
    riotShield: {
        speed: 0.06, hp: 200, damage: 10,
        behavior: 'block',
        bodyColor: 0xC4A882,
        clothingColor: 0x2F4F4F,
        scaleRange: [1.15, 1.15],
        hasShield: true,
    },
    sniper: {
        speed: 0.08, hp: 60, damage: 50,
        behavior: 'ranged',
        bodyColor: 0xC4A882,
        clothingColor: 0x6B8E23,
        scaleRange: [0.95, 0.95],
    },
    commander: {
        speed: 0.10, hp: 500, damage: 30,
        behavior: 'boss',
        bodyColor: 0xC4A882,
        clothingColor: 0x8B0000,
        scaleRange: [1.25, 1.25],
        isBoss: true,
    },
    // Zone-specific types
    securityGuard: {
        speed: 0.12, hp: 50, damage: 8,
        behavior: 'pursue',
        bodyColor: 0xC4A882,
        clothingColor: 0x2C3E50,  // Dark navy uniform
        scaleRange: [0.95, 1.05],
    },
    militia: {
        speed: 0.11, hp: 80, damage: 15,
        behavior: 'tactical',
        bodyColor: 0xBDA07A,
        clothingColor: 0x4B5320,  // Camo olive drab
        helmetColor: 0x556B2F,
        scaleRange: [1.0, 1.1],
    },
    dog: {
        speed: 0.25, hp: 30, damage: 12,
        behavior: 'pursue',
        bodyColor: 0x8B6914,       // Tan/brown fur
        clothingColor: 0x8B6914,   // Same as body (no clothing)
        scaleRange: [0.5, 0.6],    // Small & low
        isDog: true,
    },
    truckDriver: {
        speed: 0.10, hp: 90, damage: 12,
        behavior: 'tactical',
        bodyColor: 0xBDA07A,
        clothingColor: 0x696969,  // Gray work clothes
        helmetColor: 0xDAA520,    // Hard hat / trucker cap
        scaleRange: [1.05, 1.15],
    },
};

// Wobbler type → clothing texture ID mapping
const CLOTHING_TEXTURE_MAP = {
    civilian: 'clothing-civilian-casual',
    police: 'clothing-police-uniform',
    soldier: 'clothing-soldier-camo',
    riotShield: 'clothing-riot-gear',
    commander: 'clothing-commander-dress',
    securityGuard: 'clothing-security-uniform',
    militia: 'clothing-militia-camo',
    truckDriver: 'clothing-trucker-work',
    // dog has no clothing texture
};

// Shared geometries - created once, reused across all wobblers
let _sharedGeoms = null;

function getSharedGeometries() {
    if (_sharedGeoms) return _sharedGeoms;

    _sharedGeoms = {
        // Head - LatheGeometry for portrait-matched chin profile
        head: createWobblerHeadGeometry(),
        // Eyes
        eyeWhite: new THREE.SphereGeometry(0.06, 6, 6),
        eyePupil: new THREE.SphereGeometry(0.03, 4, 4),
        // Neck
        neck: new THREE.CylinderGeometry(0.12, 0.15, 0.2, 5),
        // Torso
        torsoUpper: new THREE.CylinderGeometry(0.25, 0.35, 0.5, 5),
        torsoLower: new THREE.CylinderGeometry(0.28, 0.22, 0.35, 5),
        // Pelvis
        pelvis: new THREE.CylinderGeometry(0.22, 0.2, 0.15, 5),
        // Shoulders
        shoulder: new THREE.SphereGeometry(0.1, 6, 6),
        // Arms
        upperArm: new THREE.CapsuleGeometry(0.06, 0.25, 2, 4),
        lowerArm: new THREE.CapsuleGeometry(0.05, 0.22, 2, 4),
        // Legs
        thigh: new THREE.CapsuleGeometry(0.07, 0.25, 2, 4),
        shin: new THREE.CapsuleGeometry(0.05, 0.22, 2, 4),
        // Feet
        foot: new THREE.BoxGeometry(0.12, 0.05, 0.18),
        // Shield (for riot shield type)
        shield: new THREE.BoxGeometry(0.4, 0.6, 0.04),
        // Helmet (half sphere)
        helmet: new THREE.SphereGeometry(0.22, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    };

    return _sharedGeoms;
}

function createWobblerHeadGeometry() {
    const points = [];
    const segments = 10;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let x, y;

        if (t < 0.15) {
            // Chin - narrow
            const chinT = t / 0.15;
            x = 0.25 + chinT * 0.45;
            y = t * 2;
        } else if (t < 0.4) {
            // Cheeks - widening
            const faceT = (t - 0.15) / 0.25;
            x = 0.7 + Math.sin(faceT * Math.PI * 0.5) * 0.3;
            y = 0.3 + (t - 0.15) * 2.4;
        } else if (t < 0.7) {
            // Forehead
            x = 1.0 - (t - 0.4) * 0.1;
            y = 0.9 + (t - 0.4) * 2;
        } else {
            // Crown
            const topT = (t - 0.7) / 0.3;
            x = 0.9 * (1 - topT * topT);
            y = 1.5 + topT * 0.5;
        }

        points.push(new THREE.Vector2(x * 0.22, y * 0.22 - 0.22));
    }

    return new THREE.LatheGeometry(points, 8);
}

/**
 * Creates a TABS-style wobbler humanoid with 15 body parts
 * @param {string} type - Key from HUMAN_TYPES
 * @param {number} scale - Overall scale multiplier
 * @param {function} rng - Random number generator (returns 0-1), defaults to Math.random
 * @returns {{ group: THREE.Group, parts: Object }}
 */
export function createWobblerHumanoid(type, scale = 1.0, rng = Math.random) {
    const config = HUMAN_TYPES[type] || HUMAN_TYPES.civilian;
    const geoms = getSharedGeometries();

    // Determine final scale
    const [sMin, sMax] = config.scaleRange;
    const finalScale = scale * (sMin + rng() * (sMax - sMin));

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
        color: config.bodyColor,
        roughness: 0.8,
        metalness: 0.05,
    });
    const clothMat = new THREE.MeshStandardMaterial({
        color: config.clothingColor,
        roughness: 0.7,
        metalness: 0.1,
    });
    // Apply clothing texture if available (graceful fallback to solid color)
    const clothingTexId = CLOTHING_TEXTURE_MAP[type];
    if (clothingTexId) {
        const clothTex = TextureManager.getTextureSync(clothingTexId);
        if (clothTex) {
            clothMat.map = clothTex;
        }
    }
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.3,
        metalness: 0.0,
    });
    const eyePupilMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.2,
        metalness: 0.0,
    });

    const group = new THREE.Group();
    const parts = {};

    // Helper to create and register a body part
    function addPart(name, geometry, material, position, parentName) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.castShadow = true;
        mesh.userData.bodyPart = name;
        mesh.userData.parentPart = parentName || null;
        mesh.userData.restPosition = position.clone();
        group.add(mesh);
        parts[name] = mesh;
        return mesh;
    }

    // --- Build body from bottom up (positions relative to group origin at feet) ---

    // Feet (y = 0.025, half foot height above ground)
    const footY = 0.025;
    addPart('leftFoot', geoms.foot, clothMat,
        new THREE.Vector3(-0.1, footY, 0.02), 'leftShin');
    addPart('rightFoot', geoms.foot, clothMat,
        new THREE.Vector3(0.1, footY, 0.02), 'rightShin');

    // Shins (above feet)
    const shinY = footY + 0.025 + 0.11 + 0.05; // foot top + capsule half-length + gap
    addPart('leftShin', geoms.shin, clothMat,
        new THREE.Vector3(-0.1, shinY, 0), 'leftThigh');
    addPart('rightShin', geoms.shin, clothMat,
        new THREE.Vector3(0.1, shinY, 0), 'rightThigh');

    // Thighs (above shins)
    const thighY = shinY + 0.11 + 0.025 + 0.125; // shin top + gap + thigh half-length
    addPart('leftThigh', geoms.thigh, clothMat,
        new THREE.Vector3(-0.1, thighY, 0), 'pelvis');
    addPart('rightThigh', geoms.thigh, clothMat,
        new THREE.Vector3(0.1, thighY, 0), 'pelvis');

    // Pelvis
    const pelvisY = thighY + 0.125 + 0.075; // thigh top + pelvis half-height
    addPart('pelvis', geoms.pelvis, clothMat,
        new THREE.Vector3(0, pelvisY, 0), 'torsoLower');

    // Torso Lower
    const torsoLowerY = pelvisY + 0.075 + 0.175; // pelvis top + lower torso half-height
    addPart('torsoLower', geoms.torsoLower, clothMat,
        new THREE.Vector3(0, torsoLowerY, 0), 'torsoUpper');

    // Torso Upper
    const torsoUpperY = torsoLowerY + 0.175 + 0.25; // lower top + upper half-height
    addPart('torsoUpper', geoms.torsoUpper, clothMat,
        new THREE.Vector3(0, torsoUpperY, 0), null);

    // Shoulders
    const shoulderY = torsoUpperY + 0.15;
    addPart('leftShoulder', geoms.shoulder, clothMat,
        new THREE.Vector3(-0.35, shoulderY, 0), 'torsoUpper');
    addPart('rightShoulder', geoms.shoulder, clothMat,
        new THREE.Vector3(0.35, shoulderY, 0), 'torsoUpper');

    // Upper Arms (hanging from shoulders)
    const upperArmY = shoulderY - 0.2;
    addPart('leftUpperArm', geoms.upperArm, clothMat,
        new THREE.Vector3(-0.38, upperArmY, 0), 'leftShoulder');
    addPart('rightUpperArm', geoms.upperArm, clothMat,
        new THREE.Vector3(0.38, upperArmY, 0), 'rightShoulder');

    // Lower Arms (below upper arms)
    const lowerArmY = upperArmY - 0.28;
    addPart('leftLowerArm', geoms.lowerArm, bodyMat,
        new THREE.Vector3(-0.38, lowerArmY, 0), 'leftUpperArm');
    addPart('rightLowerArm', geoms.lowerArm, bodyMat,
        new THREE.Vector3(0.38, lowerArmY, 0), 'rightUpperArm');

    // Neck
    const neckY = torsoUpperY + 0.25 + 0.1; // torso top + neck half-height
    addPart('neck', geoms.neck, bodyMat,
        new THREE.Vector3(0, neckY, 0), 'torsoUpper');

    // Head
    const headY = neckY + 0.1 + 0.18; // neck top + head center offset
    addPart('head', geoms.head, bodyMat,
        new THREE.Vector3(0, headY, 0), 'neck');

    // --- Googly Eyes ---
    const eyeY = headY + 0.04;
    const eyeZ = 0.15;
    const eyeSpacing = 0.08;

    // Left eye (white)
    const leftEye = addPart('leftEye', geoms.eyeWhite, eyeWhiteMat,
        new THREE.Vector3(-eyeSpacing, eyeY, eyeZ), 'head');

    // Left pupil (offset forward and slightly down for comedic look)
    const leftPupil = new THREE.Mesh(geoms.eyePupil, eyePupilMat);
    leftPupil.position.set(0, -0.01, 0.04);
    leftPupil.userData.bodyPart = 'leftPupil';
    leftEye.add(leftPupil);

    // Right eye (white)
    const rightEye = addPart('rightEye', geoms.eyeWhite, eyeWhiteMat,
        new THREE.Vector3(eyeSpacing, eyeY, eyeZ), 'head');

    // Right pupil
    const rightPupil = new THREE.Mesh(geoms.eyePupil, eyePupilMat);
    rightPupil.position.set(0, -0.01, 0.04);
    rightPupil.userData.bodyPart = 'rightPupil';
    rightEye.add(rightPupil);

    // --- Optional: Helmet ---
    if (config.helmetColor) {
        const helmetMat = new THREE.MeshStandardMaterial({
            color: config.helmetColor,
            roughness: 0.4,
            metalness: 0.3,
        });
        const helmet = new THREE.Mesh(geoms.helmet, helmetMat);
        helmet.position.set(0, headY + 0.08, 0);
        helmet.castShadow = true;
        helmet.userData.bodyPart = 'helmet';
        group.add(helmet);
        parts.helmet = helmet;
    }

    // --- Optional: Shield ---
    if (config.hasShield) {
        const shieldMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.3,
            metalness: 0.5,
            transparent: true,
            opacity: 0.85,
        });
        const shield = new THREE.Mesh(geoms.shield, shieldMat);
        shield.position.set(-0.55, torsoUpperY, 0.15);
        shield.castShadow = true;
        shield.userData.bodyPart = 'shield';
        group.add(shield);
        parts.shield = shield;
    }

    // --- Dog modification: flatten into quadruped shape ---
    if (config.isDog) {
        // Remove arm parts (dogs don't have arms)
        for (const armPart of ['leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm']) {
            if (parts[armPart]) {
                group.remove(parts[armPart]);
                delete parts[armPart];
            }
        }

        // Rotate torso horizontal (dog body is along Z axis)
        if (parts.torsoUpper) {
            parts.torsoUpper.rotation.x = Math.PI / 2;
            parts.torsoUpper.position.y = 0.3;
            parts.torsoUpper.position.z = -0.1;
        }
        if (parts.torsoLower) {
            parts.torsoLower.rotation.x = Math.PI / 2;
            parts.torsoLower.position.y = 0.3;
            parts.torsoLower.position.z = 0.15;
        }

        // Head forward at front of body
        if (parts.head) {
            parts.head.position.set(0, 0.35, -0.35);
            parts.head.userData.restPosition = parts.head.position.clone();
        }
        if (parts.neck) {
            parts.neck.rotation.x = Math.PI / 4;
            parts.neck.position.set(0, 0.35, -0.25);
        }

        // Spread legs to corners (front-left, front-right, back-left, back-right)
        if (parts.leftThigh) {
            parts.leftThigh.position.set(-0.12, 0.2, -0.2);
            parts.leftThigh.userData.restPosition = parts.leftThigh.position.clone();
        }
        if (parts.rightThigh) {
            parts.rightThigh.position.set(0.12, 0.2, -0.2);
            parts.rightThigh.userData.restPosition = parts.rightThigh.position.clone();
        }
        if (parts.leftShin) {
            parts.leftShin.position.set(-0.12, 0.1, 0.2);
            parts.leftShin.userData.restPosition = parts.leftShin.position.clone();
        }
        if (parts.rightShin) {
            parts.rightShin.position.set(0.12, 0.1, 0.2);
            parts.rightShin.userData.restPosition = parts.rightShin.position.clone();
        }
        if (parts.leftFoot) {
            parts.leftFoot.position.set(-0.12, 0.025, -0.22);
            parts.leftFoot.userData.restPosition = parts.leftFoot.position.clone();
        }
        if (parts.rightFoot) {
            parts.rightFoot.position.set(0.12, 0.025, -0.22);
            parts.rightFoot.userData.restPosition = parts.rightFoot.position.clone();
        }

        // Remove pelvis visibility (tuck it into body)
        if (parts.pelvis) {
            parts.pelvis.position.set(0, 0.3, 0.25);
            parts.pelvis.userData.restPosition = parts.pelvis.position.clone();
        }

        // Squash eyes together and move forward
        if (parts.leftEye) {
            parts.leftEye.position.set(-0.05, 0.4, -0.45);
        }
        if (parts.rightEye) {
            parts.rightEye.position.set(0.05, 0.4, -0.45);
        }
    }

    // Apply overall scale
    group.scale.setScalar(finalScale);

    return { group, parts };
}

/**
 * Procedural walk animation for wobbler humanoid
 * @param {Object} parts - Parts object from createWobblerHumanoid
 * @param {number} time - Current time in seconds
 * @param {number} speed - Walk speed multiplier (higher = faster animation)
 */
export function createWobblerWalkAnimation(parts, time, speed = 1.0) {
    // Calibrate stride frequency so foot contact matches ground speed.
    // Base stride: freq=4 at speed=0.12 (police). Scale linearly with speed,
    // clamped so very slow enemies take small steps, not frozen legs.
    const baseSpeed = 0.12;
    const baseFreq = 4.0;
    const freq = Math.max(1.5, (speed / baseSpeed) * baseFreq);
    const t = time * freq;

    // Amplitude scales with speed — small steps at low speed, longer strides at high speed
    const ampScale = Math.min(1.0, Math.max(0.3, speed / 0.15));

    // Leg swing - alternating sine
    const legSwing = Math.sin(t) * 0.4 * ampScale;
    const legSwingBack = Math.sin(t + Math.PI) * 0.4 * ampScale;

    if (parts.leftThigh) {
        parts.leftThigh.rotation.x = legSwing;
    }
    if (parts.rightThigh) {
        parts.rightThigh.rotation.x = legSwingBack;
    }

    // Shin follows thigh with a phase delay for knee bend
    const kneeLeft = Math.max(0, Math.sin(t - 0.6)) * 0.5;
    const kneeRight = Math.max(0, Math.sin(t + Math.PI - 0.6)) * 0.5;

    if (parts.leftShin) {
        parts.leftShin.rotation.x = -kneeLeft;
    }
    if (parts.rightShin) {
        parts.rightShin.rotation.x = -kneeRight;
    }

    // Feet stay relatively flat
    if (parts.leftFoot) {
        parts.leftFoot.rotation.x = kneeLeft * 0.3;
    }
    if (parts.rightFoot) {
        parts.rightFoot.rotation.x = kneeRight * 0.3;
    }

    // Arms swing opposite to legs (scaled with speed)
    const armSwing = Math.sin(t + Math.PI) * 0.35 * ampScale;
    const armSwingBack = Math.sin(t) * 0.35 * ampScale;

    if (parts.leftUpperArm) {
        parts.leftUpperArm.rotation.x = armSwing;
    }
    if (parts.rightUpperArm) {
        parts.rightUpperArm.rotation.x = armSwingBack;
    }

    // Forearms bend slightly on back swing
    const elbowLeft = Math.max(0, -armSwing) * 0.4;
    const elbowRight = Math.max(0, -armSwingBack) * 0.4;

    if (parts.leftLowerArm) {
        parts.leftLowerArm.rotation.x = -elbowLeft;
    }
    if (parts.rightLowerArm) {
        parts.rightLowerArm.rotation.x = -elbowRight;
    }

    // Head bob (scaled with speed)
    if (parts.head) {
        parts.head.position.y = parts.head.userData.restPosition.y +
            Math.abs(Math.sin(t * 2)) * 0.012 * ampScale;
    }

    // Torso twist (subtle counter-rotation, scaled)
    if (parts.torsoUpper) {
        parts.torsoUpper.rotation.y = Math.sin(t) * 0.06 * ampScale;
    }

    // Torso bob (scaled with speed)
    if (parts.pelvis) {
        parts.pelvis.position.y = parts.pelvis.userData.restPosition.y +
            Math.abs(Math.sin(t * 2)) * 0.006 * ampScale;
    }
}

/**
 * Procedural idle animation for wobbler humanoid
 * @param {Object} parts - Parts object from createWobblerHumanoid
 * @param {number} time - Current time in seconds
 */
export function createWobblerIdleAnimation(parts, time) {
    // Breathing - torso scale pulse
    const breathe = Math.sin(time * 1.8) * 0.02;

    if (parts.torsoUpper) {
        parts.torsoUpper.scale.x = 1.0 + breathe;
        parts.torsoUpper.scale.z = 1.0 + breathe;
        parts.torsoUpper.position.y = parts.torsoUpper.userData.restPosition.y +
            breathe * 0.5;
    }

    if (parts.torsoLower) {
        parts.torsoLower.scale.x = 1.0 + breathe * 0.5;
        parts.torsoLower.scale.z = 1.0 + breathe * 0.5;
    }

    // Head slight turn
    if (parts.head) {
        parts.head.rotation.y = Math.sin(time * 0.7) * 0.08;
        parts.head.rotation.x = Math.sin(time * 0.5) * 0.03;
    }

    // Arm sway
    const armSway = Math.sin(time * 1.2) * 0.04;

    if (parts.leftUpperArm) {
        parts.leftUpperArm.rotation.x = armSway;
        parts.leftUpperArm.rotation.z = 0.05 + Math.sin(time * 0.9) * 0.02;
    }
    if (parts.rightUpperArm) {
        parts.rightUpperArm.rotation.x = -armSway;
        parts.rightUpperArm.rotation.z = -0.05 - Math.sin(time * 0.9) * 0.02;
    }

    // Subtle weight shift
    if (parts.pelvis) {
        parts.pelvis.rotation.z = Math.sin(time * 0.6) * 0.015;
    }
}

/**
 * Procedural trot animation for dog wobbler (4-legged gait)
 * @param {Object} parts - Parts object from createWobblerHumanoid (dog variant)
 * @param {number} time - Current time in seconds
 * @param {number} speed - Walk speed multiplier
 */
export function createWobblerDogAnimation(parts, time, speed = 1.0) {
    const freq = speed * 6.0; // Faster gait for dogs
    const t = time * freq;

    // Front legs (leftThigh, rightThigh) - diagonal gait
    if (parts.leftThigh) {
        parts.leftThigh.rotation.x = Math.sin(t) * 0.35;
    }
    if (parts.rightThigh) {
        parts.rightThigh.rotation.x = Math.sin(t + Math.PI) * 0.35;
    }

    // Back legs (leftShin, rightShin used as back legs) - opposite diagonal
    if (parts.leftShin) {
        parts.leftShin.rotation.x = Math.sin(t + Math.PI) * 0.35;
    }
    if (parts.rightShin) {
        parts.rightShin.rotation.x = Math.sin(t) * 0.35;
    }

    // Body bounce
    if (parts.torsoUpper) {
        parts.torsoUpper.position.y = 0.3 + Math.abs(Math.sin(t * 2)) * 0.02;
    }

    // Head bob
    if (parts.head) {
        parts.head.position.y = 0.35 + Math.sin(t * 2) * 0.015;
        parts.head.rotation.y = Math.sin(t * 0.5) * 0.1;
    }
}
