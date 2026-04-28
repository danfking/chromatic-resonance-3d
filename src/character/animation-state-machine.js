// animation-state-machine.js - Player animation state management with crossfading

import * as THREE from 'three';

// Animation states
export const ANIMATION_STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    RUN: 'run',
    SLIDE: 'slide',
    JUMP: 'jump',
    FALL: 'fall',
    LAND: 'land'
};

// Crossfade durations between states (seconds)
const CROSSFADE_DURATIONS = {
    'idle->walk': 0.2,
    'walk->idle': 0.25,
    'idle->run': 0.15,
    'walk->run': 0.15,
    'run->walk': 0.2,
    'run->idle': 0.25,
    'run->slide': 0.1,
    'walk->slide': 0.1,
    'slide->idle': 0.2,
    'slide->walk': 0.15,
    'slide->run': 0.15,
    'any->jump': 0.1,
    'jump->fall': 0.15,
    'fall->land': 0.05,
    'land->idle': 0.15,
    'land->walk': 0.1,
    'land->run': 0.1,
    'default': 0.2
};

// State priorities (higher = harder to interrupt)
const STATE_PRIORITIES = {
    [ANIMATION_STATES.IDLE]: 0,
    [ANIMATION_STATES.WALK]: 1,
    [ANIMATION_STATES.RUN]: 1,
    [ANIMATION_STATES.SLIDE]: 3,
    [ANIMATION_STATES.JUMP]: 2,
    [ANIMATION_STATES.FALL]: 2,
    [ANIMATION_STATES.LAND]: 4
};

export class AnimationStateMachine {
    constructor(mixer) {
        this.mixer = mixer;
        this.animations = new Map(); // name -> AnimationAction
        this.currentState = ANIMATION_STATES.IDLE;
        this.previousState = null;
        this.currentAction = null;
        this.stateTimer = 0;
        this.locked = false;
        this.lockDuration = 0;

        // Callbacks for state transitions
        this.onStateChange = null;
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
     * Register an animation clip for a state
     * @param {string} stateName - State name from ANIMATION_STATES
     * @param {THREE.AnimationClip} clip - Animation clip
     * @param {object} options - Loop, clamp settings, stripRootMotion (default true)
     */
    registerAnimation(stateName, clip, options = {}) {
        if (!clip || !this.mixer) return;

        // Strip root motion by default to prevent animation from moving character
        const processedClip = options.stripRootMotion !== false
            ? this.stripRootMotion(clip)
            : clip;

        const action = this.mixer.clipAction(processedClip);

        // Configure action based on options
        if (options.loop === false) {
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
        } else {
            action.setLoop(THREE.LoopRepeat);
        }

        // Set time scale if provided
        if (options.timeScale !== undefined) {
            action.timeScale = options.timeScale;
        }

        this.animations.set(stateName, action);

        // Start with idle if this is the idle animation
        if (stateName === ANIMATION_STATES.IDLE && !this.currentAction) {
            action.play();
            this.currentAction = action;
        }
    }

    /**
     * Register animations from a model's animation array
     * @param {THREE.AnimationClip[]} clips - Array of animation clips
     */
    registerFromClips(clips) {
        if (!clips || clips.length === 0) return;

        // Map common animation names to states
        const nameMapping = {
            'idle': ANIMATION_STATES.IDLE,
            'breathing': ANIMATION_STATES.IDLE,
            'walk': ANIMATION_STATES.WALK,
            'walking': ANIMATION_STATES.WALK,
            'run': ANIMATION_STATES.RUN,
            'running': ANIMATION_STATES.RUN,
            'jog': ANIMATION_STATES.RUN,
            'slide': ANIMATION_STATES.SLIDE,
            'crouch': ANIMATION_STATES.SLIDE,
            'jump': ANIMATION_STATES.JUMP,
            'fall': ANIMATION_STATES.FALL,
            'falling': ANIMATION_STATES.FALL,
            'land': ANIMATION_STATES.LAND,
            'landing': ANIMATION_STATES.LAND
        };

        clips.forEach(clip => {
            const lowerName = clip.name.toLowerCase();

            // Find matching state
            for (const [key, state] of Object.entries(nameMapping)) {
                if (lowerName.includes(key)) {
                    const isLoop = ![ANIMATION_STATES.JUMP, ANIMATION_STATES.LAND].includes(state);
                    this.registerAnimation(state, clip, { loop: isLoop });
                    console.log(`Registered animation: ${clip.name} -> ${state}`);
                    break;
                }
            }
        });

        // If no idle was found, use the first animation as idle
        if (!this.animations.has(ANIMATION_STATES.IDLE) && clips.length > 0) {
            this.registerAnimation(ANIMATION_STATES.IDLE, clips[0], { loop: true });
        }
    }

    /**
     * Get crossfade duration for transition
     */
    getCrossfadeDuration(fromState, toState) {
        const key = `${fromState}->${toState}`;
        if (CROSSFADE_DURATIONS[key] !== undefined) {
            return CROSSFADE_DURATIONS[key];
        }

        // Check for 'any' transitions
        const anyKey = `any->${toState}`;
        if (CROSSFADE_DURATIONS[anyKey] !== undefined) {
            return CROSSFADE_DURATIONS[anyKey];
        }

        return CROSSFADE_DURATIONS.default;
    }

    /**
     * Transition to a new animation state
     * @param {string} newState - Target state
     * @param {boolean} force - Force transition even if locked
     * @returns {boolean} - Whether transition occurred
     */
    transitionTo(newState, force = false) {
        // Don't transition to same state
        if (newState === this.currentState && !force) {
            return false;
        }

        // Check if state is locked (for non-interruptible animations)
        if (this.locked && !force) {
            const currentPriority = STATE_PRIORITIES[this.currentState] || 0;
            const newPriority = STATE_PRIORITIES[newState] || 0;

            // Only allow higher priority to interrupt
            if (newPriority <= currentPriority) {
                return false;
            }
        }

        const newAction = this.animations.get(newState);
        if (!newAction) {
            // Fallback: if we don't have the animation, try to go to idle
            if (newState !== ANIMATION_STATES.IDLE) {
                return this.transitionTo(ANIMATION_STATES.IDLE, force);
            }
            return false;
        }

        const crossfadeDuration = this.getCrossfadeDuration(this.currentState, newState);

        // Fade out current
        if (this.currentAction) {
            this.currentAction.fadeOut(crossfadeDuration);
        }

        // Fade in new
        newAction.reset();
        newAction.fadeIn(crossfadeDuration);
        newAction.play();

        // Track state change
        this.previousState = this.currentState;
        this.currentState = newState;
        this.currentAction = newAction;
        this.stateTimer = 0;

        // Lock for one-shot animations
        if (newState === ANIMATION_STATES.LAND) {
            this.lock(0.3); // Land animation duration
        } else if (newState === ANIMATION_STATES.SLIDE) {
            // Slide lock handled externally via slideDuration
        }

        // Callback
        if (this.onStateChange) {
            this.onStateChange(this.previousState, this.currentState);
        }

        return true;
    }

    /**
     * Lock state transitions for a duration
     */
    lock(duration) {
        this.locked = true;
        this.lockDuration = duration;
    }

    /**
     * Unlock state transitions
     */
    unlock() {
        this.locked = false;
        this.lockDuration = 0;
    }

    /**
     * Update the state machine
     * @param {number} delta - Time since last frame
     * @param {object} inputState - Current input state
     */
    update(delta, inputState = {}) {
        this.stateTimer += delta;

        // Update lock duration
        if (this.locked && this.lockDuration > 0) {
            this.lockDuration -= delta;
            if (this.lockDuration <= 0) {
                this.unlock();
            }
        }

        // Handle one-shot animation completion
        if (this.currentAction && !this.currentAction.isRunning()) {
            // Animation finished, transition based on current state
            if (this.currentState === ANIMATION_STATES.LAND) {
                // After landing, go to idle or walk/run based on input
                if (inputState.isMoving) {
                    this.transitionTo(inputState.isRunning ? ANIMATION_STATES.RUN : ANIMATION_STATES.WALK);
                } else {
                    this.transitionTo(ANIMATION_STATES.IDLE);
                }
            } else if (this.currentState === ANIMATION_STATES.JUMP) {
                // Jump finished, go to fall
                this.transitionTo(ANIMATION_STATES.FALL);
            }
        }

        // Determine target state based on input
        const targetState = this.determineTargetState(inputState);

        // Try to transition
        if (targetState !== this.currentState) {
            this.transitionTo(targetState);
        }
    }

    /**
     * Determine the target animation state based on input
     */
    determineTargetState(inputState) {
        const {
            isGrounded = true,
            isMoving = false,
            isRunning = false,
            isSliding = false,
            isJumping = false,
            isFalling = false,
            justLanded = false
        } = inputState;

        // Priority order: land > jump > fall > slide > run > walk > idle

        if (justLanded) {
            return ANIMATION_STATES.LAND;
        }

        if (isJumping && !isGrounded) {
            return ANIMATION_STATES.JUMP;
        }

        if (isFalling && !isGrounded) {
            return ANIMATION_STATES.FALL;
        }

        if (isSliding) {
            return ANIMATION_STATES.SLIDE;
        }

        if (isMoving) {
            return isRunning ? ANIMATION_STATES.RUN : ANIMATION_STATES.WALK;
        }

        return ANIMATION_STATES.IDLE;
    }

    /**
     * Get current state
     */
    getState() {
        return this.currentState;
    }

    /**
     * Check if in specific state
     */
    isInState(state) {
        return this.currentState === state;
    }

    /**
     * Get state duration
     */
    getStateDuration() {
        return this.stateTimer;
    }

    /**
     * Set animation time scale (speed)
     */
    setTimeScale(scale) {
        if (this.currentAction) {
            this.currentAction.timeScale = scale;
        }
    }

    /**
     * Dispose of all animations
     */
    dispose() {
        this.animations.forEach(action => {
            action.stop();
        });
        this.animations.clear();
        this.currentAction = null;
    }
}
