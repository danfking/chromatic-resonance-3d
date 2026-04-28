// model-manager.js - GLTF/FBX model loading and management for enemies

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Model configuration for each enemy type
// Supports .glb, .gltf, and .fbx formats
// Note: assets/ is served at root due to vite publicDir config
// targetHeight is in game units (roughly meters)
// bodyVariant maps to BODY_VARIANTS in humanoid-geometry.js for procedural fallback
const MODEL_CONFIG = {
    // Regular enemies - using Mixamo animated humanoid
    shade: {
        path: '/models/humanoid-animated.fbx',
        targetHeight: 1.2,  // Small ghostly
        tint: 0x666688,     // Light purple-grey
        bodyVariant: 'shade',
        // Unique visual: elongated, ghostly
        scaleModifier: { x: 0.9, y: 1.1, z: 0.9 },
        emissiveIntensity: 0.3,
        animations: ['idle', 'walk', 'attack', 'hit', 'death', 'floating']
    },
    crimsonWraith: {
        path: '/models/humanoid-animated.fbx',
        targetHeight: 1.5,  // Medium
        tint: 0xcc4444,     // Bright red
        bodyVariant: 'crimsonWraith',
        // Unique visual: wide, aggressive
        scaleModifier: { x: 1.15, y: 1.0, z: 1.1 },
        emissiveIntensity: 0.4,
        animations: ['idle', 'walk', 'attack', 'hit', 'death', 'berserk']
    },
    azurePhantom: {
        path: '/models/humanoid-animated.fbx',
        targetHeight: 1.4,  // Medium
        tint: 0x4488cc,     // Bright blue
        bodyVariant: 'azurePhantom',
        // Unique visual: tall, ethereal
        scaleModifier: { x: 0.85, y: 1.15, z: 0.85 },
        emissiveIntensity: 0.35,
        animations: ['idle', 'walk', 'attack', 'hit', 'death', 'teleport']
    },
    verdantSlime: {
        path: '/models/humanoid-animated.fbx',
        targetHeight: 1.8,  // Slightly larger
        tint: 0x44cc66,     // Bright green
        bodyVariant: 'verdantSlime',
        // Unique visual: chunky, blobby
        scaleModifier: { x: 1.3, y: 0.85, z: 1.3 },
        emissiveIntensity: 0.25,
        animations: ['idle', 'walk', 'attack', 'hit', 'death', 'wobble']
    },
    // Boss enemies
    chromaticGuardian: {
        path: '/models/humanoid-animated.fbx',
        targetHeight: 2.5,  // Large boss
        tint: 0xffaa44,     // Bright orange
        bodyVariant: 'chromaticGuardian',
        // Unique visual: imposing, broad
        scaleModifier: { x: 1.2, y: 1.0, z: 1.15 },
        emissiveIntensity: 0.5,
        animations: ['idle', 'walk', 'attack', 'hit', 'death']
    },
    voidHarbinger: {
        path: '/models/humanoid-animated.fbx',
        targetHeight: 3.0,  // Largest boss
        tint: 0xaa66ff,     // Bright purple
        bodyVariant: 'voidHarbinger',
        // Unique visual: menacing, tall
        scaleModifier: { x: 1.0, y: 1.2, z: 1.0 },
        emissiveIntensity: 0.6,
        animations: ['idle', 'walk', 'attack', 'hit', 'death']
    }
};

class ModelManager {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        this.cache = new Map(); // path -> { scene, animations }
        this.loading = new Map(); // path -> Promise
        this.enabled = true;
    }

    /**
     * Check if models are available
     */
    async checkAvailability() {
        try {
            // Check for animated FBX model first (assets/ served at root)
            const animatedResponse = await fetch('/models/humanoid-animated.fbx', { method: 'HEAD' });
            if (animatedResponse.ok) {
                this.enabled = true;
                console.log('Model loading enabled (animated FBX)');
                return true;
            }

            // Check for static FBX model
            const fbxResponse = await fetch('/models/Base Humanoid Mesh/Humanoid.fbx', { method: 'HEAD' });
            if (fbxResponse.ok) {
                this.enabled = true;
                console.log('Model loading enabled (static FBX)');
                return true;
            }

            // Check for GLB model
            const glbResponse = await fetch('/models/humanoid-base.glb', { method: 'HEAD' });
            this.enabled = glbResponse.ok;
            console.log(`Model loading ${this.enabled ? 'enabled (GLB)' : 'disabled - no models found'}`);
        } catch {
            this.enabled = false;
            console.log('Model loading disabled - fetch failed');
        }
        return this.enabled;
    }

    /**
     * Load a GLTF or FBX model
     * @param {string} path - Path to the model file (.glb, .gltf, or .fbx)
     * @returns {Promise<{scene: THREE.Group, animations: THREE.AnimationClip[]}>}
     */
    async loadModel(path) {
        // Return cached model
        if (this.cache.has(path)) {
            return this.cloneModel(this.cache.get(path));
        }

        // Return existing loading promise
        if (this.loading.has(path)) {
            const result = await this.loading.get(path);
            return this.cloneModel(result);
        }

        // Determine loader based on file extension
        const isFBX = path.toLowerCase().endsWith('.fbx');
        const loader = isFBX ? this.fbxLoader : this.gltfLoader;

        // Start loading
        const loadPromise = new Promise((resolve, reject) => {
            loader.load(
                path,
                (loaded) => {
                    // FBX returns the scene directly, GLTF returns { scene, animations }
                    const scene = isFBX ? loaded : loaded.scene;
                    const animations = isFBX ? loaded.animations : (loaded.animations || []);

                    const result = { scene, animations };
                    this.cache.set(path, result);
                    console.log(`Loaded model: ${path}`);
                    resolve(result);
                },
                undefined, // progress callback
                (error) => {
                    console.warn(`Failed to load model: ${path}`, error);
                    reject(error);
                }
            );
        });

        this.loading.set(path, loadPromise);

        try {
            const result = await loadPromise;
            return this.cloneModel(result);
        } finally {
            this.loading.delete(path);
        }
    }

    /**
     * Clone a cached model for reuse
     * Special handling for SkinnedMesh to properly clone skeleton data
     */
    cloneModel(original) {
        const clonedScene = original.scene.clone();
        // Reset scale on clone to ensure clean state
        clonedScene.scale.set(1, 1, 1);

        // Fix SkinnedMesh skeleton references - Three.js clone() doesn't deep clone skeletons
        const skinnedMeshes = [];
        clonedScene.traverse((child) => {
            if (child.isSkinnedMesh) {
                skinnedMeshes.push(child);
            }
        });

        // For each SkinnedMesh, create new skeleton with cloned boneInverses
        skinnedMeshes.forEach((mesh) => {
            if (mesh.skeleton) {
                // Find the corresponding bones in the cloned scene
                const clonedBones = mesh.skeleton.bones.map(bone => {
                    // Find the bone by name in the cloned scene
                    let clonedBone = null;
                    clonedScene.traverse((child) => {
                        if (child.isBone && child.name === bone.name) {
                            clonedBone = child;
                        }
                    });
                    return clonedBone || bone;
                });

                // Clone the boneInverses
                const clonedBoneInverses = mesh.skeleton.boneInverses.map(m => m.clone());

                // Create new skeleton with cloned data
                const newSkeleton = new THREE.Skeleton(clonedBones, clonedBoneInverses);
                mesh.bind(newSkeleton, mesh.bindMatrix.clone());
            }
        });

        return {
            scene: clonedScene,
            animations: original.animations // Animations can be shared
        };
    }

    /**
     * Get model for enemy type
     * @param {string} enemyType - Enemy type key
     * @returns {Promise<{scene: THREE.Group, animations: THREE.AnimationClip[]}|null>}
     */
    async getEnemyModel(enemyType) {
        if (!this.enabled) return null;

        const config = MODEL_CONFIG[enemyType];
        if (!config) {
            console.warn(`No model config for enemy type: ${enemyType}`);
            return null;
        }

        try {
            const model = await this.loadModel(config.path);

            // Mixamo FBX files are in centimeters (standard for Maya/3DS Max)
            // The model height is ~181cm, we need to convert to game units (meters)
            // and then scale to target height

            // Reset root scale first
            model.scene.scale.set(1, 1, 1);

            // Normalize all transforms in hierarchy to bake scales into geometry positions
            // This handles FBX files with internal scale transforms
            model.scene.traverse((child) => {
                if (child !== model.scene) {
                    // Update the child's matrix to bake current transforms
                    child.updateMatrix();
                }
            });
            model.scene.updateMatrixWorld(true);

            // Measure the model bounding box (will be in cm for Mixamo FBX)
            const box = new THREE.Box3().setFromObject(model.scene);
            const size = new THREE.Vector3();
            box.getSize(size);
            const modelHeightCm = size.y;

            // Target height based on enemy type (in game units/meters)
            const targetHeight = config.targetHeight || 1.5;

            // Calculate scale: model geometry is in cm, game world is in meters
            // To convert 181cm model to 1.2m target: scale = 1.2 / 181 = 0.00663
            // This both converts cm->m AND scales to target height
            const dynamicScale = targetHeight / modelHeightCm;

            // Apply scale ONCE to the root - this is the ONLY place scaling happens
            // Three.js SkinnedMesh composes scene world matrix with skeleton automatically
            // NO bindMatrix or boneInverses modification needed!
            model.scene.scale.setScalar(dynamicScale);

            // Update skeleton matrices after scaling
            model.scene.traverse((child) => {
                if (child.isSkinnedMesh && child.skeleton) {
                    child.skeleton.update();
                }
            });

            // Store metadata for verification
            model.scene.userData.expectedHeight = targetHeight;
            model.scene.userData.appliedScale = dynamicScale;

            console.log(`Applied scale: ${dynamicScale.toFixed(6)}`);

            // Verify the final size
            model.scene.updateMatrixWorld(true);
            const verifyBox = new THREE.Box3().setFromObject(model.scene);
            const verifySize = new THREE.Vector3();
            verifyBox.getSize(verifySize);

            console.log(`Model ${enemyType}: original=${modelHeightCm.toFixed(1)}cm, target=${targetHeight}m, scale=${dynamicScale.toFixed(6)}, final=${verifySize.y.toFixed(2)}m`);

            // Apply scale modifier for unique silhouettes
            if (config.scaleModifier) {
                model.scene.scale.x *= config.scaleModifier.x;
                model.scene.scale.y *= config.scaleModifier.y;
                model.scene.scale.z *= config.scaleModifier.z;
            }

            // Apply tint to all meshes and hide skeleton/bones
            const emissiveIntensity = config.emissiveIntensity || 0.4;
            model.scene.traverse((child) => {
                // Hide skeleton helpers and bone objects
                if (child.isBone || child.type === 'Bone' || child.name.toLowerCase().includes('skeleton')) {
                    child.visible = false;
                }

                if (child.isMesh && child.material) {
                    // Clone material to avoid affecting cached model
                    child.material = child.material.clone();

                    if (child.material.color) {
                        // Set color directly (brighter than multiply)
                        const tintColor = new THREE.Color(config.tint);
                        // Blend original with tint (50% mix for visible but tinted)
                        child.material.color.lerp(tintColor, 0.6);
                    }

                    // Add stronger emissive glow for visibility - configurable per enemy
                    if (child.material.emissive !== undefined) {
                        child.material.emissive = new THREE.Color(config.tint);
                        child.material.emissiveIntensity = emissiveIntensity;
                    }

                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            return model;
        } catch (error) {
            // Try fallback model
            if (config.fallback && config.fallback !== config.path) {
                console.log(`Trying fallback model for ${enemyType}`);
                try {
                    const fallbackConfig = { ...config, path: config.fallback };
                    MODEL_CONFIG[enemyType] = fallbackConfig;
                    return this.getEnemyModel(enemyType);
                } catch {
                    return null;
                }
            }
            return null;
        }
    }

    /**
     * Preload all enemy models
     */
    async preloadAll() {
        if (!this.enabled) return;

        const paths = new Set(Object.values(MODEL_CONFIG).map(c => c.path));
        const promises = Array.from(paths).map(path =>
            this.loadModel(path).catch(() => null)
        );

        await Promise.all(promises);
        console.log('Model preloading complete');
    }

    /**
     * Get config for enemy type
     */
    getConfig(enemyType) {
        return MODEL_CONFIG[enemyType] || null;
    }

    /**
     * Check if models are enabled
     */
    isEnabled() {
        return this.enabled;
    }
}

// Singleton instance
export const modelManager = new ModelManager();

// Export for direct use
export { MODEL_CONFIG };
