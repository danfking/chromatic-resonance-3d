// animation-loader.js - Load and manage additional animation FBX files

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/**
 * Animation file mappings
 * Maps state names to FBX file paths
 */
const PLAYER_ANIMATIONS = {
    // Core locomotion (required for proper animation states)
    idle: '/models/Locomotion Pack/idle.fbx',
    walk: '/models/Locomotion Pack/walking.fbx',
    run: '/models/Running Fast.fbx',  // Fast sprint animation

    // Jump/fall/land
    jump: '/models/Jump.fbx',
    fall: '/models/Falling Idle.fbx',
    land: '/models/Falling To Landing.fbx',
    slide: '/models/Running Slide.fbx',

    // Strafing
    strafeLeft: '/models/Locomotion Pack/left strafe walking.fbx',
    strafeRight: '/models/Locomotion Pack/right strafe walking.fbx',

    // Action Adventure alternatives
    hardLand: '/models/Action Adventure Pack/hard landing.fbx',
    rollLand: '/models/Action Adventure Pack/falling to roll.fbx',

    // Hit reactions
    hitHead: '/models/Head Hit.fbx',
    hitBody: '/models/Hit To Body.fbx',
    hitBig: '/models/Big Hit To Head.fbx'
};

const ENEMY_ANIMATIONS = {
    // Basic locomotion (zombie style for enemies)
    idle: '/models/Zombie Pack/zombie idle.fbx',
    walk: '/models/Zombie Pack/walking.fbx',
    run: '/models/Zombie Pack/zombie running.fbx',

    // Attack animations
    attack: '/models/Zombie Pack/zombie attack.fbx',
    attackPunch: '/models/Zombie Pack/zombie punching.fbx',
    attackKick: '/models/Zombie Pack/zombie kicking.fbx',
    attackHeadbutt: '/models/Zombie Pack/zombie headbutt.fbx',

    // Hit reactions
    hit: '/models/Zombie Pack/zombie reaction hit.fbx',
    hitAlt: '/models/Zombie Pack/zombie reaction hit (2).fbx',
    stumble: '/models/Zombie Pack/zombie stumbling.fbx',

    // Death/incapacitated
    death: '/models/Zombie Pack/zombie agonizing.fbx',
    getUp: '/models/Zombie Pack/zombie stand up.fbx',

    // Special states
    transition: '/models/Zombie Pack/zombie transition.fbx',
    scratchIdle: '/models/Zombie Pack/zombie scratch idle.fbx'
};

/**
 * Animation loader for FBX animation files
 */
export class AnimationLoader {
    constructor() {
        this.fbxLoader = new FBXLoader();
        this.cache = new Map(); // path -> AnimationClip[]
        this.loading = new Map(); // path -> Promise
    }

    /**
     * Remap bone names in animation tracks to match target skeleton
     * Handles Mixamo naming variations (mixamorig1 vs mixamorig)
     * @param {THREE.AnimationClip} clip
     * @returns {THREE.AnimationClip}
     */
    remapBoneNames(clip) {
        // Common bone name remappings (source -> target)
        const remappings = [
            // Mixamo numbered variants -> standard
            [/mixamorig\d+/g, 'mixamorig'],
        ];

        let needsRemap = false;

        // Check if any tracks need remapping
        for (const track of clip.tracks) {
            for (const [pattern] of remappings) {
                if (pattern.test(track.name)) {
                    needsRemap = true;
                    break;
                }
            }
            if (needsRemap) break;
        }

        if (!needsRemap) return clip;

        // Remap track names
        const remappedTracks = clip.tracks.map(track => {
            let newName = track.name;
            for (const [pattern, replacement] of remappings) {
                newName = newName.replace(pattern, replacement);
            }

            if (newName !== track.name) {
                // Clone the track with new name
                const TrackClass = track.constructor;
                const newTrack = new TrackClass(newName, track.times, track.values);
                return newTrack;
            }
            return track;
        });

        console.log(`Remapped bone names in ${clip.name} (mixamorig1 -> mixamorig)`);

        return new THREE.AnimationClip(
            clip.name,
            clip.duration,
            remappedTracks,
            clip.blendMode
        );
    }

    /**
     * Strip root motion tracks from an animation clip
     * Removes position tracks from root/hips bones to prevent animation
     * from moving the character (we control position via physics)
     * @param {THREE.AnimationClip} clip
     * @returns {THREE.AnimationClip}
     */
    stripRootMotion(clip) {
        // Root bone names that commonly have unwanted position tracks
        const rootBonePatterns = [
            'hips.position',
            'Hips.position',
            'mixamorigHips.position',
            'root.position',
            'Root.position',
            'pelvis.position',
            'Pelvis.position'
        ];

        // Filter out root position tracks
        const filteredTracks = clip.tracks.filter(track => {
            const trackNameLower = track.name.toLowerCase();

            // Check if this is a root position track
            for (const pattern of rootBonePatterns) {
                if (trackNameLower.includes(pattern.toLowerCase())) {
                    console.log(`Stripped root motion track: ${track.name} from ${clip.name}`);
                    return false; // Remove this track
                }
            }
            return true; // Keep this track
        });

        // Create new clip with filtered tracks
        const newClip = new THREE.AnimationClip(
            clip.name,
            clip.duration,
            filteredTracks,
            clip.blendMode
        );

        return newClip;
    }

    /**
     * Load animations from an FBX file
     * @param {string} path - Path to FBX file
     * @param {boolean} stripRoot - Whether to strip root motion (default: true)
     * @returns {Promise<THREE.AnimationClip[]>}
     */
    async loadAnimations(path, stripRoot = true) {
        // Cache key includes stripRoot setting
        const cacheKey = `${path}:${stripRoot}`;

        // Return cached
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Return existing loading promise
        if (this.loading.has(cacheKey)) {
            return this.loading.get(cacheKey);
        }

        // Start loading
        const loadPromise = new Promise((resolve, reject) => {
            this.fbxLoader.load(
                path,
                (fbx) => {
                    let animations = fbx.animations || [];

                    // Process animations: remap bone names, then strip root motion
                    if (animations.length > 0) {
                        animations = animations.map(clip => {
                            // First remap bone names (handles mixamorig1 -> mixamorig)
                            let processed = this.remapBoneNames(clip);
                            // Then strip root motion if requested
                            if (stripRoot) {
                                processed = this.stripRootMotion(processed);
                            }
                            return processed;
                        });
                    }

                    this.cache.set(cacheKey, animations);

                    if (animations.length > 0) {
                        console.log(`Loaded ${animations.length} animation(s) from ${path}:`,
                            animations.map(a => a.name).join(', ')
                        );
                    }

                    resolve(animations);
                },
                undefined,
                (error) => {
                    console.warn(`Failed to load animations from ${path}:`, error.message);
                    resolve([]); // Return empty array on failure
                }
            );
        });

        this.loading.set(cacheKey, loadPromise);

        try {
            return await loadPromise;
        } finally {
            this.loading.delete(cacheKey);
        }
    }

    /**
     * Load all player animations and register them with a state machine
     * @param {AnimationStateMachine} stateMachine
     * @param {THREE.AnimationMixer} mixer
     */
    async loadPlayerAnimations(stateMachine, mixer) {
        const results = {};

        for (const [state, path] of Object.entries(PLAYER_ANIMATIONS)) {
            try {
                const clips = await this.loadAnimations(path);
                if (clips.length > 0) {
                    // Use the first clip (most FBX files have one main animation)
                    const clip = clips[0];

                    // Determine if this should loop
                    const nonLooping = ['jump', 'land', 'hitHead', 'hitBody', 'hitBig'];
                    const shouldLoop = !nonLooping.includes(state);

                    // Register with state machine
                    stateMachine.registerAnimation(state, clip, { loop: shouldLoop });
                    results[state] = true;
                }
            } catch (error) {
                console.warn(`Could not load animation for ${state}:`, error.message);
                results[state] = false;
            }
        }

        console.log('Player animations loaded:', results);
        return results;
    }

    /**
     * Load all enemy animations and register them with a controller
     * @param {EnemyAnimationController} controller
     * @param {THREE.AnimationMixer} mixer
     */
    async loadEnemyAnimations(controller, mixer) {
        const results = {};

        for (const [state, path] of Object.entries(ENEMY_ANIMATIONS)) {
            try {
                const clips = await this.loadAnimations(path);
                if (clips.length > 0) {
                    const clip = clips[0];
                    controller.registerAnimation(state, clip);
                    results[state] = true;
                }
            } catch (error) {
                results[state] = false;
            }
        }

        return results;
    }

    /**
     * Load a single animation and return the clip
     * @param {string} path
     * @returns {Promise<THREE.AnimationClip|null>}
     */
    async loadSingleAnimation(path) {
        const clips = await this.loadAnimations(path);
        return clips.length > 0 ? clips[0] : null;
    }

    /**
     * Check which animation files are available
     */
    async checkAvailability() {
        const available = {};

        const allPaths = [
            ...Object.entries(PLAYER_ANIMATIONS),
            ...Object.entries(ENEMY_ANIMATIONS)
        ];

        for (const [name, path] of allPaths) {
            try {
                const response = await fetch(path, { method: 'HEAD' });
                available[name] = response.ok;
            } catch {
                available[name] = false;
            }
        }

        console.log('Animation availability:', available);
        return available;
    }

    /**
     * Get animation mappings
     */
    static getPlayerAnimationPaths() {
        return { ...PLAYER_ANIMATIONS };
    }

    static getEnemyAnimationPaths() {
        return { ...ENEMY_ANIMATIONS };
    }
}

// Singleton instance
export const animationLoader = new AnimationLoader();
