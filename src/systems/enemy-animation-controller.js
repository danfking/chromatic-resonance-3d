// enemy-animation-controller.js - Enemy animation state management

import * as THREE from 'three';

// Enemy animation states
export const ENEMY_ANIMATION_STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    ATTACK: 'attack',
    HIT: 'hit',
    DEATH: 'death',
    // Special animations for specific enemy types
    BERSERK: 'berserk',
    FLOATING: 'floating',
    WOBBLE: 'wobble',
    TELEPORT: 'teleport'
};

// Crossfade durations for enemy animations
const CROSSFADE_DURATIONS = {
    'idle->walk': 0.2,
    'walk->idle': 0.25,
    'idle->attack': 0.1,
    'walk->attack': 0.1,
    'attack->idle': 0.2,
    'attack->walk': 0.15,
    'any->hit': 0.05,
    'hit->idle': 0.2,
    'hit->walk': 0.15,
    'any->death': 0.1,
    'idle->berserk': 0.15,
    'walk->berserk': 0.1,
    'berserk->idle': 0.2,
    'idle->floating': 0.3,
    'floating->idle': 0.3,
    'walk->wobble': 0.2,
    'wobble->walk': 0.2,
    'default': 0.2
};

// Animation priorities (higher = harder to interrupt)
const ANIMATION_PRIORITIES = {
    [ENEMY_ANIMATION_STATES.IDLE]: 0,
    [ENEMY_ANIMATION_STATES.WALK]: 1,
    [ENEMY_ANIMATION_STATES.FLOATING]: 1,
    [ENEMY_ANIMATION_STATES.WOBBLE]: 1,
    [ENEMY_ANIMATION_STATES.BERSERK]: 2,
    [ENEMY_ANIMATION_STATES.ATTACK]: 3,
    [ENEMY_ANIMATION_STATES.HIT]: 4,
    [ENEMY_ANIMATION_STATES.DEATH]: 5,
    [ENEMY_ANIMATION_STATES.TELEPORT]: 5
};

export class EnemyAnimationController {
    constructor(mixer, enemyType = 'shade') {
        this.mixer = mixer;
        this.enemyType = enemyType;
        this.animations = new Map();
        this.currentState = ENEMY_ANIMATION_STATES.IDLE;
        this.previousState = null;
        this.currentAction = null;
        this.stateTimer = 0;
        this.locked = false;
        this.lockDuration = 0;

        // Enemy-specific settings
        this.specialAnimations = this.getSpecialAnimations(enemyType);

        // Callbacks
        this.onAnimationComplete = null;
        this.onStateChange = null;
    }

    /**
     * Get special animations for enemy type
     */
    getSpecialAnimations(enemyType) {
        const specials = {
            shade: ['floating'],
            crimsonWraith: ['berserk'],
            azurePhantom: ['teleport'],
            verdantSlime: ['wobble'],
            chromaticGuardian: [],
            voidHarbinger: []
        };
        return specials[enemyType] || [];
    }

    /**
     * Register an animation clip
     */
    registerAnimation(stateName, clip, options = {}) {
        if (!clip || !this.mixer) return;

        const action = this.mixer.clipAction(clip);

        // Configure looping
        const nonLoopingStates = [
            ENEMY_ANIMATION_STATES.ATTACK,
            ENEMY_ANIMATION_STATES.HIT,
            ENEMY_ANIMATION_STATES.DEATH,
            ENEMY_ANIMATION_STATES.TELEPORT
        ];

        if (options.loop === false || nonLoopingStates.includes(stateName)) {
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
        } else {
            action.setLoop(THREE.LoopRepeat);
        }

        if (options.timeScale !== undefined) {
            action.timeScale = options.timeScale;
        }

        this.animations.set(stateName, action);

        // Start with idle
        if (stateName === ENEMY_ANIMATION_STATES.IDLE && !this.currentAction) {
            action.play();
            this.currentAction = action;
        }
    }

    /**
     * Register animations from clips array with smart name matching
     */
    registerFromClips(clips) {
        if (!clips || clips.length === 0) return;

        // Map common names to states
        const nameMapping = {
            'idle': ENEMY_ANIMATION_STATES.IDLE,
            'breathing': ENEMY_ANIMATION_STATES.IDLE,
            'standing': ENEMY_ANIMATION_STATES.IDLE,
            'scratch': ENEMY_ANIMATION_STATES.IDLE, // zombie scratch idle
            'walk': ENEMY_ANIMATION_STATES.WALK,
            'walking': ENEMY_ANIMATION_STATES.WALK,
            'run': ENEMY_ANIMATION_STATES.WALK, // Map run to walk for enemies
            'running': ENEMY_ANIMATION_STATES.WALK,
            'attack': ENEMY_ANIMATION_STATES.ATTACK,
            'punch': ENEMY_ANIMATION_STATES.ATTACK,
            'kick': ENEMY_ANIMATION_STATES.ATTACK,
            'headbutt': ENEMY_ANIMATION_STATES.ATTACK,
            'slash': ENEMY_ANIMATION_STATES.ATTACK,
            'hit': ENEMY_ANIMATION_STATES.HIT,
            'reaction': ENEMY_ANIMATION_STATES.HIT,
            'flinch': ENEMY_ANIMATION_STATES.HIT,
            'stumbl': ENEMY_ANIMATION_STATES.HIT, // stumbling
            'death': ENEMY_ANIMATION_STATES.DEATH,
            'dying': ENEMY_ANIMATION_STATES.DEATH,
            'die': ENEMY_ANIMATION_STATES.DEATH,
            'agoniz': ENEMY_ANIMATION_STATES.DEATH, // agonizing
            'berserk': ENEMY_ANIMATION_STATES.BERSERK,
            'rage': ENEMY_ANIMATION_STATES.BERSERK,
            'float': ENEMY_ANIMATION_STATES.FLOATING,
            'hover': ENEMY_ANIMATION_STATES.FLOATING,
            'wobble': ENEMY_ANIMATION_STATES.WOBBLE,
            'bounce': ENEMY_ANIMATION_STATES.WOBBLE,
            'teleport': ENEMY_ANIMATION_STATES.TELEPORT,
            'warp': ENEMY_ANIMATION_STATES.TELEPORT
        };

        clips.forEach(clip => {
            const lowerName = clip.name.toLowerCase();

            for (const [key, state] of Object.entries(nameMapping)) {
                if (lowerName.includes(key)) {
                    // Only register if we don't already have this state
                    // (first match wins, avoids duplicates like "zombie idle (2)")
                    if (!this.animations.has(state)) {
                        this.registerAnimation(state, clip);
                        console.log(`Enemy ${this.enemyType}: Registered ${clip.name} -> ${state}`);
                    }
                    break;
                }
            }
        });

        // Default: first animation as idle
        if (!this.animations.has(ENEMY_ANIMATION_STATES.IDLE) && clips.length > 0) {
            this.registerAnimation(ENEMY_ANIMATION_STATES.IDLE, clips[0]);
        }
    }

    /**
     * Get crossfade duration
     */
    getCrossfadeDuration(fromState, toState) {
        const key = `${fromState}->${toState}`;
        if (CROSSFADE_DURATIONS[key] !== undefined) {
            return CROSSFADE_DURATIONS[key];
        }

        const anyKey = `any->${toState}`;
        if (CROSSFADE_DURATIONS[anyKey] !== undefined) {
            return CROSSFADE_DURATIONS[anyKey];
        }

        return CROSSFADE_DURATIONS.default;
    }

    /**
     * Transition to new animation state
     */
    transitionTo(newState, force = false) {
        if (newState === this.currentState && !force) {
            return false;
        }

        // Check lock
        if (this.locked && !force) {
            const currentPriority = ANIMATION_PRIORITIES[this.currentState] || 0;
            const newPriority = ANIMATION_PRIORITIES[newState] || 0;

            if (newPriority <= currentPriority) {
                return false;
            }
        }

        const newAction = this.animations.get(newState);
        if (!newAction) {
            // Try idle as fallback
            if (newState !== ENEMY_ANIMATION_STATES.IDLE) {
                return this.transitionTo(ENEMY_ANIMATION_STATES.IDLE, force);
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

        this.previousState = this.currentState;
        this.currentState = newState;
        this.currentAction = newAction;
        this.stateTimer = 0;

        // Lock for one-shot animations
        if (newState === ENEMY_ANIMATION_STATES.ATTACK) {
            this.lock(0.5);
        } else if (newState === ENEMY_ANIMATION_STATES.HIT) {
            this.lock(0.3);
        } else if (newState === ENEMY_ANIMATION_STATES.DEATH) {
            this.lock(10); // Effectively permanent
        }

        if (this.onStateChange) {
            this.onStateChange(this.previousState, this.currentState);
        }

        return true;
    }

    /**
     * Play attack animation
     */
    playAttack() {
        return this.transitionTo(ENEMY_ANIMATION_STATES.ATTACK, true);
    }

    /**
     * Play hit reaction
     */
    playHit() {
        return this.transitionTo(ENEMY_ANIMATION_STATES.HIT, true);
    }

    /**
     * Play death animation
     */
    playDeath() {
        return this.transitionTo(ENEMY_ANIMATION_STATES.DEATH, true);
    }

    /**
     * Lock state
     */
    lock(duration) {
        this.locked = true;
        this.lockDuration = duration;
    }

    /**
     * Unlock state
     */
    unlock() {
        this.locked = false;
        this.lockDuration = 0;
    }

    /**
     * Update the controller
     */
    update(delta, behaviorState = {}) {
        this.stateTimer += delta;

        // Update lock
        if (this.locked && this.lockDuration > 0) {
            this.lockDuration -= delta;
            if (this.lockDuration <= 0) {
                this.unlock();

                // After one-shot animations complete, return to appropriate state
                if (this.currentState === ENEMY_ANIMATION_STATES.ATTACK ||
                    this.currentState === ENEMY_ANIMATION_STATES.HIT) {
                    const nextState = behaviorState.isMoving ?
                        ENEMY_ANIMATION_STATES.WALK : ENEMY_ANIMATION_STATES.IDLE;
                    this.transitionTo(nextState);
                }
            }
        }

        // Don't auto-transition during locked states
        if (this.locked) return;

        // Determine target state based on behavior
        const targetState = this.determineTargetState(behaviorState);

        if (targetState !== this.currentState) {
            this.transitionTo(targetState);
        }
    }

    /**
     * Determine target state from behavior
     */
    determineTargetState(behaviorState) {
        const {
            isMoving = false,
            isAttacking = false,
            isBerserker = false,
            isFloating = false,
            isWobbling = false
        } = behaviorState;

        // Check for special states first
        if (isBerserker && this.specialAnimations.includes('berserk')) {
            return ENEMY_ANIMATION_STATES.BERSERK;
        }

        if (isFloating && this.specialAnimations.includes('floating')) {
            return ENEMY_ANIMATION_STATES.FLOATING;
        }

        if (isWobbling && this.specialAnimations.includes('wobble')) {
            return ENEMY_ANIMATION_STATES.WOBBLE;
        }

        // Standard states
        if (isAttacking) {
            return ENEMY_ANIMATION_STATES.ATTACK;
        }

        if (isMoving) {
            return ENEMY_ANIMATION_STATES.WALK;
        }

        return ENEMY_ANIMATION_STATES.IDLE;
    }

    /**
     * Get current state
     */
    getState() {
        return this.currentState;
    }

    /**
     * Set time scale
     */
    setTimeScale(scale) {
        if (this.currentAction) {
            this.currentAction.timeScale = scale;
        }
    }

    /**
     * Dispose
     */
    dispose() {
        this.animations.forEach(action => {
            action.stop();
        });
        this.animations.clear();
        this.currentAction = null;
    }
}
