// procedural-arm-ik.js - Procedural arm override for wand aiming
// Overrides the right arm to point toward aim direction while body animates normally

import * as THREE from 'three';

/**
 * Bone name mappings for different rig conventions
 */
const BONE_NAME_VARIANTS = {
    rightShoulder: ['RightShoulder', 'mixamorigRightShoulder', 'Right_Shoulder', 'shoulder_r', 'Shoulder.R'],
    rightArm: ['RightArm', 'mixamorigRightArm', 'Right_Arm', 'upperarm_r', 'UpperArm.R'],
    rightForeArm: ['RightForeArm', 'mixamorigRightForeArm', 'Right_ForeArm', 'lowerarm_r', 'ForeArm.R'],
    rightHand: ['RightHand', 'mixamorigRightHand', 'Right_Hand', 'hand_r', 'Hand.R'],
    spine: ['Spine', 'mixamorigSpine', 'Spine1', 'spine_01'],
    spine1: ['Spine1', 'mixamorigSpine1', 'Spine2', 'spine_02'],
    spine2: ['Spine2', 'mixamorigSpine2', 'Spine3', 'spine_03']
};

/**
 * Find a bone by trying multiple name variants
 */
function findBone(skeleton, boneType) {
    const variants = BONE_NAME_VARIANTS[boneType] || [boneType];

    for (const name of variants) {
        const bone = skeleton.bones.find(b => b.name === name);
        if (bone) return bone;
    }

    // Try partial match
    for (const name of variants) {
        const bone = skeleton.bones.find(b =>
            b.name.toLowerCase().includes(name.toLowerCase())
        );
        if (bone) return bone;
    }

    return null;
}

/**
 * Procedural arm IK system for wand aiming
 */
export class ProceduralArmIK {
    constructor(model) {
        this.model = model;
        this.skeleton = null;
        this.enabled = true;

        // Bone references
        this.bones = {
            rightShoulder: null,
            rightArm: null,
            rightForeArm: null,
            rightHand: null,
            spine: null,
            spine1: null,
            spine2: null
        };

        // Aim parameters
        this.aimTarget = new THREE.Vector3(0, 0, -1); // World space aim direction
        this.aimWeight = 0.5;           // 0-1, how much to apply aim (start subtle)
        this.aimSmoothing = 10;         // Lerp speed for smooth aiming
        this.currentAimRotation = new THREE.Quaternion();

        // Casting animation state
        this.isCasting = false;
        this.castTimer = 0;
        this.castDuration = 0.15;       // Quick cast flourish
        this.castRecoilAngle = 0.3;     // Radians of recoil
        this.castRecoveryDuration = 0.2; // Return to aim pose

        // Upper body twist for extreme aim angles
        this.spineWeight = 0.3;         // How much spine contributes to aim

        // Arm pose offsets (tweak for natural look)
        this.shoulderOffset = new THREE.Euler(0, 0.2, -0.1);  // Slight forward rotation
        this.armOffset = new THREE.Euler(-0.3, 0, 0.5);       // Arm raised, pointed forward
        this.foreArmOffset = new THREE.Euler(0, 0, 0.2);      // Slight bend
        this.handOffset = new THREE.Euler(0, 0, 0);           // Wrist neutral

        this.initialized = false;

        this.init();
    }

    init() {
        if (!this.model) return;

        // Find skeleton
        this.model.traverse((child) => {
            if (child.isSkinnedMesh && child.skeleton) {
                this.skeleton = child.skeleton;
            }
        });

        if (!this.skeleton) {
            console.warn('ProceduralArmIK: No skeleton found in model');
            return;
        }

        // Find bones
        for (const boneType of Object.keys(this.bones)) {
            this.bones[boneType] = findBone(this.skeleton, boneType);
        }

        // Verify we have the essential bones
        if (!this.bones.rightArm || !this.bones.rightForeArm) {
            console.warn('ProceduralArmIK: Missing essential arm bones');
            return;
        }

        this.initialized = true;
        console.log('ProceduralArmIK initialized with bones:',
            Object.entries(this.bones)
                .filter(([_, b]) => b)
                .map(([name, _]) => name)
                .join(', ')
        );
    }

    /**
     * Set aim target in world space
     * @param {THREE.Vector3} worldDirection - Normalized direction to aim
     */
    setAimDirection(worldDirection) {
        this.aimTarget.copy(worldDirection);
    }

    /**
     * Set aim weight for blending
     * @param {number} weight - 0 (no aim) to 1 (full aim)
     */
    setAimWeight(weight) {
        this.aimWeight = THREE.MathUtils.clamp(weight, 0, 1);
    }

    /**
     * Trigger casting animation flourish
     */
    triggerCast() {
        this.isCasting = true;
        this.castTimer = 0;
    }

    /**
     * Update procedural arm IK
     * Call this AFTER the animation mixer updates but BEFORE rendering
     * @param {number} delta - Time since last frame
     * @param {THREE.Object3D} character - The character root for world transform
     */
    update(delta, character) {
        if (!this.initialized || !this.enabled) return;
        if (this.aimWeight <= 0) return;

        // Update cast animation
        if (this.isCasting) {
            this.castTimer += delta;
            if (this.castTimer >= this.castDuration + this.castRecoveryDuration) {
                this.isCasting = false;
                this.castTimer = 0;
            }
        }

        // Calculate aim rotation in character local space
        const worldToLocal = new THREE.Matrix4();
        if (character) {
            worldToLocal.copy(character.matrixWorld).invert();
        }

        const localAimDir = this.aimTarget.clone().applyMatrix4(worldToLocal).normalize();

        // Calculate angles to target (limited range for subtle effect)
        const aimYaw = THREE.MathUtils.clamp(
            Math.atan2(localAimDir.x, -localAimDir.z),
            -0.5, 0.5  // Limit horizontal aim adjustment
        );
        const aimPitch = THREE.MathUtils.clamp(
            Math.asin(THREE.MathUtils.clamp(localAimDir.y, -1, 1)),
            -0.4, 0.4  // Limit vertical aim adjustment
        );

        // Apply arm pose (subtle additive)
        this.applyArmPose(aimYaw, aimPitch, delta);
    }

    /**
     * Apply procedural arm pose
     * FIX: Disabled bone manipulation - causes skeleton disconnection
     * Visual feedback now handled by wand mesh animation only
     */
    applyArmPose(aimYaw, aimPitch, delta) {
        // FIXED: Do not manipulate bones directly
        // Wand mesh handles visual feedback for casting
        return;
    }

    /**
     * Reset arm to animation-driven pose
     * Note: This doesn't do anything special anymore since we use additive rotations
     */
    reset() {
        // Additive rotations are applied each frame after animation
        // So there's nothing to reset - animation will restore on next frame
    }

    /**
     * Enable/disable the system
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.reset();
        }
    }

    /**
     * Dispose
     */
    dispose() {
        this.bones = {};
        this.skeleton = null;
        this.initialized = false;
    }
}

/**
 * Helper to create wand visual attached to hand
 */
export function createWandMesh(handBone, options = {}) {
    const {
        length = 0.4,
        radius = 0.02,
        color = 0x8b4513,  // Wood brown
        tipColor = 0x88aaff // Magic blue tip
    } = options;

    const wandGroup = new THREE.Group();

    // Wand shaft
    const shaftGeom = new THREE.CylinderGeometry(radius, radius * 1.2, length, 8);
    const shaftMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.1
    });
    const shaft = new THREE.Mesh(shaftGeom, shaftMat);
    shaft.rotation.x = Math.PI / 2; // Point forward
    shaft.position.z = length / 2;
    wandGroup.add(shaft);

    // Wand tip (glowing)
    const tipGeom = new THREE.SphereGeometry(radius * 1.5, 8, 8);
    const tipMat = new THREE.MeshStandardMaterial({
        color: tipColor,
        emissive: tipColor,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.5
    });
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.position.z = length;
    wandGroup.add(tip);

    // Attach to hand
    if (handBone) {
        handBone.add(wandGroup);
        // Offset to be in palm
        wandGroup.position.set(0.02, 0.05, 0);
        wandGroup.rotation.set(0, 0, -Math.PI / 6);
    }

    // Cast animation state (affects wand mesh only, not skeleton)
    let castAnimating = false;
    let castTime = 0;
    const castDuration = 0.15;
    const recoilDistance = 0.08;
    const originalZ = wandGroup.position.z;

    // Store original tip scale
    const originalTipScale = tip.scale.x;

    return {
        group: wandGroup,
        tip: tip,
        setTipGlow: (intensity) => {
            tipMat.emissiveIntensity = intensity;
        },
        setTipColor: (color) => {
            tipMat.color.setHex(color);
            tipMat.emissive.setHex(color);
        },
        // Trigger cast animation on wand mesh (no bone manipulation)
        triggerCastAnimation: () => {
            castAnimating = true;
            castTime = 0;
            // Immediate effects
            tipMat.emissiveIntensity = 3.0;  // Bright flash
            tip.scale.setScalar(originalTipScale * 2.0);  // Tip expands
        },
        // Update cast animation (call each frame)
        updateCastAnimation: (delta) => {
            if (!castAnimating) return;

            castTime += delta;
            const t = castTime / castDuration;

            if (t < 1.0) {
                // Recoil: wand pulls back then returns
                const recoilT = Math.sin(t * Math.PI);
                wandGroup.position.z = originalZ - recoilDistance * recoilT;

                // Tip shrinks back
                const tipScale = originalTipScale * (2.0 - t);
                tip.scale.setScalar(Math.max(originalTipScale, tipScale));

                // Glow fades
                tipMat.emissiveIntensity = 3.0 - t * 2.5;
            } else {
                // Animation complete - reset
                castAnimating = false;
                wandGroup.position.z = originalZ;
                tip.scale.setScalar(originalTipScale);
                tipMat.emissiveIntensity = 0.5;
            }
        },
        isCasting: () => castAnimating
    };
}
