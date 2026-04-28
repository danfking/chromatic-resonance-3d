// third-person-controller.js - Third-person character controller with momentum-based movement

import * as THREE from 'three';
import { createEnhancedHumanoidGroup, BODY_VARIANTS } from '../systems/humanoid-geometry.js';
import { TextureManager } from '../systems/texture-manager.js';
import { modelManager } from '../systems/model-manager.js';
import { AnimationStateMachine, ANIMATION_STATES } from './animation-state-machine.js';
import { ProceduralArmIK, createWandMesh } from './procedural-arm-ik.js';
import { animationLoader } from '../systems/animation-loader.js';

export class ThirdPersonController {
    constructor(camera, domElement, scene, platformSystem = null) {
        this.camera = camera;
        this.domElement = domElement;
        this.scene = scene;
        this.platformSystem = platformSystem;

        // Character capsule
        this.character = null;
        this.characterHeight = 1.8;
        this.characterRadius = 0.3;

        // Player avatar mesh (visible humanoid)
        this.playerMesh = null;
        this.playerBodyParts = null;
        this.playerMaterial = null;

        // GLTF model support
        this.gltfModel = null;
        this.mixer = null;
        this.currentAction = null;
        this.hasGLTFModel = false;

        // Animation state machine
        this.animationStateMachine = null;

        // Procedural arm IK for wand aiming
        this.armIK = null;
        this.wandMesh = null;

        // === MOMENTUM-BASED MOVEMENT ===
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.momentumVector = new THREE.Vector3();

        // Movement physics (tuned for snappy Megabonk feel)
        this.acceleration = 50;        // Units/sec^2 - responsive but not twitchy
        this.deceleration = 35;        // Friction when stopping
        this.maxSpeed = 7;             // Max horizontal speed (reduced from 12)
        this.currentSpeed = 0;         // Current velocity magnitude
        this.walkSpeed = 3.5;          // Walking speed threshold
        this.runSpeed = 7;             // Running speed

        // Jump physics (tuned for punchy, less floaty jumps)
        this.gravity = 32;             // Higher = punchier landings
        this.jumpForce = 9;            // Initial jump impulse (reduced from 14)
        this.jumpHeldDuration = 0;     // How long jump is held
        this.maxJumpHoldTime = 0.12;   // Max time to hold for higher jump
        this.jumpForcePerFrame = 35;   // Additional force while holding (reduced from 60)
        this.isJumpHeld = false;
        this.hasJumped = false;        // Tracks if jump was initiated
        this.wasGrounded = true;       // For landing detection
        this.coyoteTime = 0.1;         // Grace period for late jumps
        this.coyoteTimer = 0;
        this.jumpBufferTime = 0.15;    // Buffer for early jump presses
        this.jumpBufferTimer = 0;

        // === SLIDING MECHANIC ===
        this.isSliding = false;
        this.slideSpeed = 11;          // Speed during slide (~1.5x max speed)
        this.slideDuration = 0.4;      // Slide lasts 0.4 seconds
        this.slideCooldown = 0.5;      // Cooldown between slides - more frequent
        this.slideTimer = 0;
        this.slideCooldownTimer = 0;
        this.slideDirection = new THREE.Vector3();
        this.slideStartSpeed = 0;

        // Ground state
        this.isGrounded = true;
        this.groundNormal = new THREE.Vector3(0, 1, 0);
        this.currentPlatform = null;
        this.groundLevel = 0;

        // Camera
        this.cameraOffset = new THREE.Vector3(0, 2.5, 5);
        this.cameraLookOffset = new THREE.Vector3(0, 1, 0);
        this.cameraSmoothness = 10;
        this.baseCameraOffset = new THREE.Vector3(0, 2.5, 5);
        this.slideCameraOffset = new THREE.Vector3(0, 1.5, 4); // Lower during slide

        // Mouse look
        this.yaw = 0;
        this.pitch = 0;
        this.pitchMin = -Math.PI / 3;
        this.pitchMax = Math.PI / 3;
        this.mouseSensitivity = 0.002;

        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            slide: false
        };

        this.isPointerLocked = false;

        // Collision detection
        this.collisionRadius = 0.5;
        this.raycaster = new THREE.Raycaster();

        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;

        // Animation state
        this.animTime = 0;
        this.isMoving = false;
        this.isRunning = false;
        this.justLanded = false;
        this.facingRotation = 0; // Current facing direction (Y rotation)

        this.init();
    }

    init() {
        // Create character visual (simple capsule for now)
        this.createCharacter();

        // Set up event listeners
        this.setupEventListeners();
    }

    createCharacter() {
        // Create a group to hold character meshes
        this.character = new THREE.Group();
        this.character.position.set(0, this.characterHeight / 2, 0);

        // Create player material (azure-tinted for player distinction)
        this.playerMaterial = new THREE.MeshStandardMaterial({
            color: 0x6688aa, // Azure-tinted
            roughness: 0.4,
            metalness: 0.2,
            emissive: 0x6688aa,
            emissiveIntensity: 0.1
        });

        // Create enhanced humanoid body using player variant
        // Define player body variant (heroic proportions)
        const playerVariant = {
            headScale: [1, 1.05, 1],
            torsoScale: [1.05, 1, 1.05],
            armScale: [1, 1, 1],
            shoulderWidth: 1.1,
            neckLength: 0.9
        };

        // Temporarily add player variant to BODY_VARIANTS
        BODY_VARIANTS.player = playerVariant;

        // Create the humanoid mesh group
        this.playerBodyParts = createEnhancedHumanoidGroup(1.0, this.playerMaterial, 'player');

        // Position the mesh group within the character group
        this.playerBodyParts.group.position.y = -this.characterHeight / 2 + 0.1;
        this.character.add(this.playerBodyParts.group);

        // Store reference to main mesh for compatibility
        this.playerMesh = this.playerBodyParts.group;

        this.scene.add(this.character);

        // Try to load GLTF model first (async), falls back to procedural if unavailable
        this.loadPlayerModel();

        // Try to load player texture and apply triplanar mapping (for procedural fallback)
        this.loadPlayerTexture();
    }

    /**
     * Try to load GLTF model for player - mirrors enemy model loading
     */
    async loadPlayerModel() {
        if (!modelManager.isEnabled()) return;

        try {
            // Try to load humanoid-animated.fbx or player model
            const model = await modelManager.loadModel('/models/humanoid-animated.fbx');
            if (!model || !model.scene) return;

            // Remove procedural geometry
            if (this.playerBodyParts && this.playerBodyParts.group) {
                this.character.remove(this.playerBodyParts.group);
            }

            // Add GLTF model
            this.gltfModel = model.scene;

            // Scale to player height (1.8 units)
            const box = new THREE.Box3().setFromObject(this.gltfModel);
            const modelHeight = box.max.y - box.min.y;
            const targetHeight = 1.8;
            const scale = targetHeight / modelHeight;
            this.gltfModel.scale.setScalar(scale);

            // Position at character base
            this.gltfModel.position.y = -this.characterHeight / 2;

            // Apply azure tint to all materials
            this.gltfModel.traverse(child => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if (mat.color) {
                            // Tint toward azure
                            mat.color.setHex(0x6688aa);
                        }
                        if (mat.emissive) {
                            mat.emissive.setHex(0x6688aa);
                            mat.emissiveIntensity = 0.1;
                        }
                    });
                }
            });

            this.character.add(this.gltfModel);

            // Set up AnimationMixer if model has animations
            if (model.animations && model.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.gltfModel);

                // Create animation state machine
                this.animationStateMachine = new AnimationStateMachine(this.mixer);
                this.animationStateMachine.registerFromClips(model.animations);

                // Set up state change callback for effects
                this.animationStateMachine.onStateChange = (from, to) => {
                    // Could dispatch events for sound effects here
                    if (to === ANIMATION_STATES.SLIDE) {
                        // Slide started
                    } else if (to === ANIMATION_STATES.LAND) {
                        // Land impact
                    }
                };

                // Fallback: also set up legacy action for compatibility
                const walkAnim = model.animations.find(a =>
                    a.name.toLowerCase().includes('walk')
                ) || model.animations[0];

                if (walkAnim) {
                    this.currentAction = this.mixer.clipAction(walkAnim);
                    // Don't play directly - let state machine handle it
                }

                console.log(`Registered ${model.animations.length} base animations for player`);

                // Load additional animations from separate FBX files
                this.loadAdditionalAnimations();
            }

            // Clear procedural body parts reference
            this.playerBodyParts = null;
            this.hasGLTFModel = true;

            // Initialize procedural arm IK for wand aiming
            this.armIK = new ProceduralArmIK(this.gltfModel);

            // Create wand mesh attached to hand
            if (this.armIK.initialized && this.armIK.bones.rightHand) {
                this.wandMesh = createWandMesh(this.armIK.bones.rightHand, {
                    length: 0.35,
                    color: 0x5c4033,     // Dark wood
                    tipColor: 0x88aaff   // Azure glow
                });
                console.log('Wand mesh attached to right hand');
            }

            // Listen for wand fire events - visual feedback on wand mesh (no bone manipulation)
            window.addEventListener('ability-used', (e) => {
                if (e.detail.ability === 'wand-cast') {
                    // Trigger wand recoil animation (affects wand mesh only)
                    if (this.wandMesh && this.wandMesh.triggerCastAnimation) {
                        this.wandMesh.triggerCastAnimation();
                    }
                }
            });

            console.log('Loaded GLTF model for player');
        } catch (error) {
            // Keep using procedural geometry
            console.log('Using procedural geometry for player');
        }
    }

    /**
     * Load additional animations from separate FBX files
     */
    async loadAdditionalAnimations() {
        if (!this.animationStateMachine || !this.mixer) return;

        try {
            const results = await animationLoader.loadPlayerAnimations(
                this.animationStateMachine,
                this.mixer
            );
            console.log('Additional player animations loaded:', results);
        } catch (error) {
            console.warn('Could not load additional animations:', error.message);
        }
    }

    async loadPlayerTexture() {
        if (!TextureManager.isEnabled()) return;

        try {
            const texture = await TextureManager.getTexture('player');
            if (!texture) return;

            // Import triplanar material
            const { createBodyMaterial, createHeadMaterial } = await import('../systems/triplanar-portrait-material.js');

            // Create materials for head and body
            const headMaterial = createHeadMaterial(texture, 0x6688aa, 1.0, {
                edgeSoftness: 0.3,
                frontDominance: 2.5
            });

            const bodyMaterial = createBodyMaterial(texture, 0x6688aa, 1.0, {
                edgeSoftness: 0.4,
                frontDominance: 2.2
            });

            // Apply to body parts
            if (this.playerBodyParts) {
                this.playerBodyParts.head.material = headMaterial;
                if (this.playerBodyParts.neck) {
                    this.playerBodyParts.neck.material = headMaterial;
                }
                this.playerBodyParts.torso.material = bodyMaterial;
                if (this.playerBodyParts.torsoUpper) {
                    this.playerBodyParts.torsoUpper.material = bodyMaterial;
                }
                if (this.playerBodyParts.torsoLower) {
                    this.playerBodyParts.torsoLower.material = bodyMaterial;
                }
                this.playerBodyParts.leftArm.material = bodyMaterial;
                this.playerBodyParts.rightArm.material = bodyMaterial;
                if (this.playerBodyParts.leftLowerArm) {
                    this.playerBodyParts.leftLowerArm.material = bodyMaterial;
                }
                if (this.playerBodyParts.rightLowerArm) {
                    this.playerBodyParts.rightLowerArm.material = bodyMaterial;
                }
                if (this.playerBodyParts.leftShoulder) {
                    this.playerBodyParts.leftShoulder.material = bodyMaterial;
                }
                if (this.playerBodyParts.rightShoulder) {
                    this.playerBodyParts.rightShoulder.material = bodyMaterial;
                }
            }

            console.log('Player texture applied successfully');
        } catch (error) {
            console.log('Using default player material');
        }
    }

    setupEventListeners() {
        // Pointer lock on click
        this.domElement.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.domElement.requestPointerLock();
            }
        });

        // Pointer lock change
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.domElement;
            const controlsHint = document.getElementById('controls-hint');
            if (controlsHint) {
                controlsHint.style.opacity = this.isPointerLocked ? '0' : '1';
            }
        });

        // Mouse movement
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Keyboard
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Camera shake events
        window.addEventListener('camera-shake', (e) => {
            const { intensity, duration } = e.detail;
            this.triggerShake(intensity, duration);
        });
    }

    /**
     * Set platform system reference for collision detection
     */
    setPlatformSystem(platformSystem) {
        this.platformSystem = platformSystem;
    }

    triggerShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration / 1000; // Convert ms to seconds
        this.shakeTimer = this.shakeDuration;
    }

    onMouseMove(event) {
        if (!this.isPointerLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.yaw -= movementX * this.mouseSensitivity;
        this.pitch += movementY * this.mouseSensitivity;  // Inverted for natural feel

        // Clamp pitch
        this.pitch = Math.max(this.pitchMin, Math.min(this.pitchMax, this.pitch));
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = true;
                break;
            case 'Space':
                this.keys.jump = true;
                this.isJumpHeld = true;
                // Buffer jump input for slightly early presses
                this.jumpBufferTimer = this.jumpBufferTime;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.slide = true;
                this.tryStartSlide();
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = false;
                break;
            case 'Space':
                this.keys.jump = false;
                this.isJumpHeld = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.slide = false;
                break;
        }
    }

    /**
     * Try to start a slide
     */
    tryStartSlide() {
        // Can only slide if moving, grounded, and cooldown expired
        if (!this.isSliding &&
            this.isGrounded &&
            this.slideCooldownTimer <= 0 &&
            this.currentSpeed > 2) {

            this.isSliding = true;
            this.slideTimer = this.slideDuration;

            // Lock slide direction to current movement direction
            this.slideDirection.copy(this.momentumVector).normalize();
            if (this.slideDirection.lengthSq() < 0.1) {
                // If not moving, slide forward based on character facing
                const facing = this.gltfModel ? this.gltfModel.rotation.y : this.character.rotation.y;
                this.slideDirection.set(0, 0, -1).applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    facing
                );
            }

            // Boost to slide speed
            this.slideStartSpeed = Math.max(this.currentSpeed, this.slideSpeed * 0.8);

            // Visual: lower camera
            this.cameraOffset.copy(this.slideCameraOffset);

            // Dispatch slide event for audio/effects
            window.dispatchEvent(new CustomEvent('player-slide', {
                detail: { position: this.character.position.clone() }
            }));
        }
    }

    /**
     * End the slide
     */
    endSlide() {
        this.isSliding = false;
        this.slideCooldownTimer = this.slideCooldown;

        // Restore camera
        this.cameraOffset.copy(this.baseCameraOffset);

        // Preserve some momentum from slide
        this.currentSpeed = Math.min(this.maxSpeed, this.slideStartSpeed * 0.6);
    }

    update(delta) {
        if (!this.character) return;

        // Update animation time
        this.animTime += delta;

        // Update animation mixer for GLTF models
        // Root motion is stripped from clips during loading, so no position restoration needed
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Update timers
        this.updateTimers(delta);

        // Track previous grounded state for landing detection
        this.wasGrounded = this.isGrounded;
        this.justLanded = false;

        // === SLIDING UPDATE ===
        if (this.isSliding) {
            this.updateSlide(delta);
        } else {
            // === NORMAL MOVEMENT ===
            this.updateMovement(delta);
        }

        // === GROUND/PLATFORM DETECTION ===
        this.updateGroundDetection(delta);

        // === JUMP HANDLING ===
        this.updateJump(delta);

        // === APPLY GRAVITY ===
        if (!this.isGrounded) {
            this.velocity.y -= this.gravity * delta;
        }

        // === APPLY MOVEMENT ===
        this.applyMovement(delta);

        // Landing detection
        if (this.isGrounded && !this.wasGrounded) {
            this.justLanded = true;
            this.hasJumped = false;
            // Dispatch landing event
            window.dispatchEvent(new CustomEvent('player-land', {
                detail: {
                    position: this.character.position.clone(),
                    fallSpeed: Math.abs(this.velocity.y)
                }
            }));
        }

        // Calculate movement state for animation
        const horizontalVelocity = new THREE.Vector3(this.momentumVector.x, 0, this.momentumVector.z);
        this.isMoving = horizontalVelocity.length() > 0.5;
        this.isRunning = this.currentSpeed > this.walkSpeed * 1.2;

        // Update camera position
        this.updateCamera(delta);

        // Update animation state machine or procedural animation
        this.updateAnimation(delta);

        // Update procedural arm IK for wand aiming (AFTER animation update)
        this.updateArmIK(delta);
    }

    /**
     * Update wand visual effects
     * FIX: Bone manipulation disabled - only wand mesh animation runs
     */
    updateArmIK(delta) {
        // Update wand cast animation (affects wand mesh only, not arm bones)
        if (this.wandMesh && this.wandMesh.updateCastAnimation) {
            this.wandMesh.updateCastAnimation(delta);
        }
        // Arm IK bone manipulation disabled - causes skeleton disconnection
    }

    /**
     * Update various timers
     */
    updateTimers(delta) {
        // Slide cooldown
        if (this.slideCooldownTimer > 0) {
            this.slideCooldownTimer -= delta;
        }

        // Coyote time (grace period for jumping after leaving ground)
        if (this.isGrounded) {
            this.coyoteTimer = this.coyoteTime;
        } else if (this.coyoteTimer > 0) {
            this.coyoteTimer -= delta;
        }

        // Jump buffer
        if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer -= delta;
        }
    }

    /**
     * Update sliding mechanics
     */
    updateSlide(delta) {
        this.slideTimer -= delta;

        if (this.slideTimer <= 0) {
            this.endSlide();
            return;
        }

        // Calculate slide speed with slight deceleration
        const slideProgress = 1 - (this.slideTimer / this.slideDuration);
        const currentSlideSpeed = THREE.MathUtils.lerp(
            this.slideSpeed,
            this.slideSpeed * 0.7,
            slideProgress
        );

        // Apply slide movement
        this.momentumVector.copy(this.slideDirection).multiplyScalar(currentSlideSpeed);
        this.velocity.x = this.momentumVector.x;
        this.velocity.z = this.momentumVector.z;

        // Rotate character to face slide direction (slightly)
        // Apply rotation to model so it pivots at feet
        const targetRotation = Math.atan2(this.slideDirection.x, this.slideDirection.z);
        const currentRotation = this.gltfModel ? this.gltfModel.rotation.y : this.character.rotation.y;
        const newRotation = THREE.MathUtils.lerp(currentRotation, targetRotation, delta * 5);

        if (this.gltfModel) {
            this.gltfModel.rotation.y = newRotation;
        } else {
            this.character.rotation.y = newRotation;
        }
        this.facingRotation = newRotation;
    }

    /**
     * Update momentum-based movement
     */
    updateMovement(delta) {
        // Calculate input direction based on camera yaw
        this.direction.set(0, 0, 0);

        if (this.keys.forward) this.direction.z -= 1;
        if (this.keys.backward) this.direction.z += 1;
        if (this.keys.left) this.direction.x -= 1;
        if (this.keys.right) this.direction.x += 1;

        const hasMovementInput = this.direction.lengthSq() > 0;

        // Normalize and rotate by yaw
        if (hasMovementInput) {
            this.direction.normalize();
            this.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        }

        // === MOMENTUM PHYSICS ===
        if (hasMovementInput) {
            // Accelerate toward input direction
            const targetVelocity = this.direction.clone().multiplyScalar(this.maxSpeed);

            // Smooth acceleration
            this.momentumVector.x = THREE.MathUtils.lerp(
                this.momentumVector.x,
                targetVelocity.x,
                this.acceleration * delta / this.maxSpeed
            );
            this.momentumVector.z = THREE.MathUtils.lerp(
                this.momentumVector.z,
                targetVelocity.z,
                this.acceleration * delta / this.maxSpeed
            );

            // Rotate character to face movement direction
            // Apply rotation to model (not group) so it pivots at feet, not center
            const targetRotation = Math.atan2(this.direction.x, this.direction.z);
            const currentRotation = this.gltfModel ? this.gltfModel.rotation.y : this.character.rotation.y;
            const newRotation = THREE.MathUtils.lerp(currentRotation, targetRotation, delta * 10);

            if (this.gltfModel) {
                this.gltfModel.rotation.y = newRotation;
            } else {
                this.character.rotation.y = newRotation;
            }
            // Keep track of facing direction for other systems
            this.facingRotation = newRotation;
        } else {
            // Decelerate (friction)
            const decelerationFactor = 1 - (this.deceleration * delta / this.maxSpeed);
            this.momentumVector.x *= Math.max(0, decelerationFactor);
            this.momentumVector.z *= Math.max(0, decelerationFactor);

            // Stop completely if very slow
            if (this.momentumVector.lengthSq() < 0.01) {
                this.momentumVector.set(0, 0, 0);
            }
        }

        // Calculate current speed
        this.currentSpeed = this.momentumVector.length();

        // Clamp to max speed
        if (this.currentSpeed > this.maxSpeed) {
            this.momentumVector.normalize().multiplyScalar(this.maxSpeed);
            this.currentSpeed = this.maxSpeed;
        }

        // Apply momentum to velocity
        this.velocity.x = this.momentumVector.x;
        this.velocity.z = this.momentumVector.z;
    }

    /**
     * Update jump mechanics with variable height
     */
    updateJump(delta) {
        // Check if we can jump (grounded or within coyote time)
        const canJump = this.isGrounded || this.coyoteTimer > 0;

        // Handle jump initiation (with buffer)
        if ((this.keys.jump || this.jumpBufferTimer > 0) && canJump && !this.hasJumped) {
            // Initial jump force
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            this.hasJumped = true;
            this.jumpHeldDuration = 0;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;

            // Dispatch jump event
            window.dispatchEvent(new CustomEvent('player-jump', {
                detail: { position: this.character.position.clone() }
            }));
        }

        // Variable jump height - add force while jump is held
        if (this.hasJumped && this.isJumpHeld && this.velocity.y > 0) {
            this.jumpHeldDuration += delta;

            if (this.jumpHeldDuration < this.maxJumpHoldTime) {
                // Add additional upward force
                this.velocity.y += this.jumpForcePerFrame * delta;
            }
        }

        // Cut jump short if released early
        if (this.hasJumped && !this.isJumpHeld && this.velocity.y > 0) {
            // Reduce upward velocity for short hop
            this.velocity.y *= 0.5;
        }
    }

    /**
     * Detect ground and platform collisions
     */
    updateGroundDetection(delta) {
        const baseGroundLevel = this.characterHeight / 2;
        const feetY = this.character.position.y - this.characterHeight / 2;

        // Check for platforms below
        if (this.platformSystem) {
            // Raycast from slightly above feet level
            const checkPos = this.character.position.clone();
            checkPos.y = feetY + 0.1; // Just above feet

            const surface = this.platformSystem.getSurfaceBelow(checkPos, 2);

            if (surface && this.velocity.y <= 0) {
                // Calculate how far feet are from platform surface
                const feetToSurface = feetY - surface.point.y;

                if (feetToSurface <= 0.2 && feetToSurface >= -0.5) {
                    // Feet are within landing range of platform (slightly above or just below)
                    this.groundLevel = surface.point.y + this.characterHeight / 2;
                    this.groundNormal.copy(surface.normal);
                    this.currentPlatform = surface.object;

                    // Snap to platform surface and mark as grounded
                    this.character.position.y = this.groundLevel;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                } else if (feetToSurface > 0.2) {
                    // Feet are above platform - still falling
                    this.isGrounded = false;
                }
            } else if (!surface) {
                // No platform below at all
                this.currentPlatform = null;
            }
        }

        // Ground collision (main ground at Y=0) - only if not on a platform
        if (!this.currentPlatform) {
            if (feetY <= 0.1 && this.velocity.y <= 0) {
                // Landing on base ground
                this.character.position.y = baseGroundLevel;
                this.groundLevel = baseGroundLevel;
                this.velocity.y = 0;
                this.isGrounded = true;
            } else if (feetY > 0.2) {
                // Above ground - falling
                this.isGrounded = false;
                this.groundLevel = baseGroundLevel;
            }
        }
    }

    /**
     * Apply movement with collision detection
     */
    applyMovement(delta) {
        const moveX = this.velocity.x * delta;
        const moveZ = this.velocity.z * delta;

        // Check X movement
        if (moveX !== 0) {
            const canMoveX = this.checkCollision(
                new THREE.Vector3(moveX > 0 ? 1 : -1, 0, 0),
                Math.abs(moveX) + this.collisionRadius
            );
            if (canMoveX) {
                this.character.position.x += moveX;
            } else {
                // Hit wall - lose momentum in that direction
                this.momentumVector.x *= 0.2;
            }
        }

        // Check Z movement
        if (moveZ !== 0) {
            const canMoveZ = this.checkCollision(
                new THREE.Vector3(0, 0, moveZ > 0 ? 1 : -1),
                Math.abs(moveZ) + this.collisionRadius
            );
            if (canMoveZ) {
                this.character.position.z += moveZ;
            } else {
                // Hit wall - lose momentum in that direction
                this.momentumVector.z *= 0.2;
            }
        }

        // Y movement (gravity/jump)
        this.character.position.y += this.velocity.y * delta;

        // Boundary limits (stay within level)
        this.character.position.x = THREE.MathUtils.clamp(this.character.position.x, -19, 19);
        this.character.position.z = THREE.MathUtils.clamp(this.character.position.z, -19, 19);

        // Floor clamp
        const minY = this.characterHeight / 2;
        if (this.character.position.y < minY) {
            this.character.position.y = minY;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
    }

    /**
     * Update animation based on state
     */
    updateAnimation(delta) {
        // Build input state for animation state machine
        const inputState = {
            isGrounded: this.isGrounded,
            isMoving: this.isMoving,
            isRunning: this.isRunning,
            isSliding: this.isSliding,
            isJumping: this.hasJumped && this.velocity.y > 0,
            isFalling: !this.isGrounded && this.velocity.y < 0,
            justLanded: this.justLanded
        };

        // Use animation state machine if available
        if (this.animationStateMachine) {
            this.animationStateMachine.update(delta, inputState);

            // Scale animation speed based on actual movement speed
            // Mixamo animations are designed for ~1.4 m/s walk, ~5 m/s run
            const currentState = this.animationStateMachine.currentState;
            let timeScale = 1.0;

            if (currentState === 'walk') {
                // Walk animation expects ~2 units/sec, scale to match actual speed
                const expectedWalkSpeed = 2.0;
                timeScale = Math.max(0.5, Math.min(2.0, this.currentSpeed / expectedWalkSpeed));
            } else if (currentState === 'run') {
                // Run animation expects ~5 units/sec, scale to match actual speed
                const expectedRunSpeed = 5.0;
                timeScale = Math.max(0.8, Math.min(2.5, this.currentSpeed / expectedRunSpeed));
            } else if (currentState === 'slide') {
                timeScale = 1.5;
            }

            this.animationStateMachine.setTimeScale(timeScale);
        } else if (this.hasGLTFModel && this.mixer && this.currentAction) {
            // Fallback: Adjust animation speed based on movement
            let timeScale = 0.3; // Idle
            if (this.isSliding) {
                timeScale = 1.5;
            } else if (this.isRunning) {
                timeScale = 1.2;
            } else if (this.isMoving) {
                timeScale = 1.0;
            }
            this.currentAction.timeScale = timeScale;
        } else {
            // Procedural animation
            this.animatePlayer(delta);
        }
    }

    animatePlayer(delta) {
        if (!this.playerBodyParts) return;

        const walkSpeed = this.isMoving ? 8 : 2;
        const animIntensity = this.isMoving ? 1.0 : 0.3;

        // Arm swing
        const armSway = Math.sin(this.animTime * walkSpeed) * 0.2 * animIntensity;

        if (this.playerBodyParts.leftUpperArm) {
            this.playerBodyParts.leftUpperArm.rotation.z = 0.25 + armSway;
            this.playerBodyParts.rightUpperArm.rotation.z = -0.25 - armSway;

            // Counter-swing on lower arms
            if (this.playerBodyParts.leftLowerArm) {
                const lowerArmSway = Math.sin(this.animTime * walkSpeed - 0.3) * 0.15 * animIntensity;
                this.playerBodyParts.leftLowerArm.rotation.z = 0.15 + lowerArmSway;
                this.playerBodyParts.rightLowerArm.rotation.z = -0.15 - lowerArmSway;
            }
        } else {
            this.playerBodyParts.leftArm.rotation.z = 0.3 + armSway;
            this.playerBodyParts.rightArm.rotation.z = -0.3 - armSway;
        }

        // Head bob
        const headBob = Math.sin(this.animTime * walkSpeed * 1.5) * 0.03 * animIntensity;
        const baseHeadY = this.playerBodyParts.neck ? 0.7 : 0.6;
        this.playerBodyParts.head.position.y = baseHeadY + headBob;

        // Subtle head tilt
        this.playerBodyParts.head.rotation.z = Math.sin(this.animTime * 0.7) * 0.02;

        // Neck follows head
        if (this.playerBodyParts.neck) {
            this.playerBodyParts.neck.rotation.z = Math.sin(this.animTime * 0.7) * 0.015;
        }

        // Torso sway when moving
        if (this.isMoving) {
            const torsoSway = Math.sin(this.animTime * walkSpeed * 0.5) * 0.03;
            this.playerBodyParts.torso.rotation.y = torsoSway;

            if (this.playerBodyParts.torsoLower) {
                this.playerBodyParts.torsoLower.rotation.y = torsoSway * -0.3;
            }
        }

        // Shoulder breathing effect
        if (this.playerBodyParts.leftShoulder) {
            const breathe = Math.sin(this.animTime * 1.5) * 0.015;
            this.playerBodyParts.leftShoulder.position.y = 0.45 + breathe;
            this.playerBodyParts.rightShoulder.position.y = 0.45 + breathe;
        }
    }

    updateCamera(delta) {
        // Calculate desired camera position based on character position and yaw/pitch
        const offset = this.cameraOffset.clone();

        // Rotate offset by yaw
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

        // Apply pitch to camera height/distance
        const pitchOffset = Math.sin(this.pitch) * 3;
        offset.y += pitchOffset;

        // Target position
        const targetPosition = this.character.position.clone().add(offset);

        // Smooth camera movement
        this.camera.position.lerp(targetPosition, delta * this.cameraSmoothness);

        // Apply camera shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= delta;
            const shakeAmount = this.shakeIntensity * (this.shakeTimer / this.shakeDuration);
            this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
            this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
        }

        // Look at character (with offset for head height)
        const lookTarget = this.character.position.clone().add(this.cameraLookOffset);
        this.camera.lookAt(lookTarget);
    }

    getPosition() {
        return this.character ? this.character.position : new THREE.Vector3();
    }

    getYaw() {
        return this.yaw;
    }

    getCharacter() {
        return this.character;
    }

    /**
     * Get the wand mesh for external updates
     */
    getWandMesh() {
        return this.wandMesh;
    }

    /**
     * Update wand tip color based on active colors
     * @param {number} color - Hex color
     */
    setWandColor(color) {
        if (this.wandMesh) {
            this.wandMesh.setTipColor(color);
        }
    }

    /**
     * Trigger wand cast visual feedback (no bone manipulation)
     */
    triggerWandCast() {
        // Trigger wand recoil animation (affects wand mesh only)
        if (this.wandMesh && this.wandMesh.triggerCastAnimation) {
            this.wandMesh.triggerCastAnimation();
        }
    }

    checkCollision(direction, distance) {
        // Cast ray from character position in movement direction
        const origin = this.character.position.clone();
        origin.y = 0.5; // Check at lower height for walls/pillars

        this.raycaster.set(origin, direction);
        this.raycaster.far = distance;

        // Get all collidable objects (exclude character and extractable objects)
        const collidables = this.scene.children.filter(obj => {
            if (obj === this.character) return false;
            if (obj.userData?.extractable) return false;
            if (obj instanceof THREE.GridHelper) return false;
            if (obj instanceof THREE.Light) return false;
            return obj.isMesh;
        });

        const intersects = this.raycaster.intersectObjects(collidables, true);

        // If we hit something within distance, can't move
        return intersects.length === 0;
    }
}
