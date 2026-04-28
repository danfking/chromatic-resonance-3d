// blob-player-controller.js - Player controller using ParticleLifeCreature blobs
// Replaces humanoid character with procedural blob creatures

import * as THREE from 'three';
import { ParticleLifeCreature, WAND_TIERS } from '../creatures/particle-life-creature.js';
import { CORE_TYPES } from '../systems/core-system.js';

export class BlobPlayerController {
    constructor(camera, domElement, scene, platformSystem = null) {
        this.camera = camera;
        this.domElement = domElement;
        this.scene = scene;
        this.platformSystem = platformSystem;

        // Character position (blob center)
        this.character = new THREE.Group();
        this.characterHeight = 0.4; // Blob radius-based (halved)
        this.characterRadius = 0.4;

        // === MOMENTUM-BASED MOVEMENT (same as ThirdPersonController) ===
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.momentumVector = new THREE.Vector3();

        // Movement physics (tuned for snappy Megabonk feel)
        this.acceleration = 50;
        this.deceleration = 35;
        this.maxSpeed = 7;
        this.currentSpeed = 0;
        this.walkSpeed = 3.5;
        this.runSpeed = 7;

        // Jump physics
        this.gravity = 32;
        this.jumpForce = 9;
        this.jumpHeldDuration = 0;
        this.maxJumpHoldTime = 0.12;
        this.jumpForcePerFrame = 35;
        this.isJumpHeld = false;
        this.hasJumped = false;
        this.wasGrounded = true;
        this.coyoteTime = 0.1;
        this.coyoteTimer = 0;
        this.jumpBufferTime = 0.15;
        this.jumpBufferTimer = 0;

        // === SLIDING MECHANIC ===
        this.isSliding = false;
        this.slideSpeed = 11;
        this.slideDuration = 0.4;
        this.slideCooldown = 0.5;
        this.slideTimer = 0;
        this.slideCooldownTimer = 0;
        this.slideDirection = new THREE.Vector3();
        this.slideStartSpeed = 0;

        // Ground state
        this.isGrounded = true;
        this.groundNormal = new THREE.Vector3(0, 1, 0);
        this.currentPlatform = null;
        this.groundLevel = 0;

        // Camera (raised to clear nearby vehicle chassis)
        this.cameraOffset = new THREE.Vector3(0, 5.0, 6.0);
        this.cameraLookOffset = new THREE.Vector3(0, 0.15, 0); // Blob center
        this.cameraSmoothness = 10;
        this.baseCameraOffset = new THREE.Vector3(0, 5.0, 6.0);
        this.slideCameraOffset = new THREE.Vector3(0, 3.5, 4.5);

        // Mouse look
        this.yaw = 0;
        this.pitch = 0;
        this.pitchMin = -Math.PI / 3;
        this.pitchMax = Math.PI / 3;
        this.mouseSensitivity = 0.002;

        // Physics tracking (acceleration-based approach)
        // The blob physics system computes acceleration internally from velocity changes

        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            slide: false,
            absorb: false
        };

        this.isPointerLocked = false;

        // Collision detection
        this.collisionRadius = 0.5;
        this.raycaster = new THREE.Raycaster();

        // World bounds (can be updated for different level sizes)
        this.bounds = { minX: -19, maxX: 19, minZ: -19, maxZ: 19 };

        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;

        // Animation state
        this.isMoving = false;
        this.isRunning = false;
        this.justLanded = false;
        this.facingRotation = 0;

        // === BLOB CREATURES ===
        this.bodyBlob = null;
        this.wandBlob = null;
        this.wandOffset = new THREE.Vector3(0.4, 0, 0);
        this.wandTier = 'apprentice';
        this.movementDirection = new THREE.Vector3();

        // Health/Essence sync callbacks
        this.onHealthChange = null;
        this.onEssenceChange = null;

        // Core system integration — particle budget drives blob size
        this.coreSystem = null;
        this.baseParticleCount = 10; // Start tiny (~10 particles)

        // Absorb mechanic (E key)
        this.absorbRange = 3.0; // Units
        this.absorbCooldown = 0;
        this.absorbCooldownTime = 0.5; // Seconds

        this.init();
    }

    init() {
        this.createBlobCharacter();
        this.setupEventListeners();
    }

    createBlobCharacter() {
        // Position character group
        this.character.position.set(0, this.characterHeight, 0);
        this.scene.add(this.character);

        // BODY BLOB - starts tiny (~10 particles), grows as cores level up
        this.bodyBlob = new ParticleLifeCreature('player', {
            particles: this.baseParticleCount,
            radius: 0.25, // Tiny starting radius
            disableEssence: true
        });
        this.bodyBlob.group.position.set(0, 0, 0);
        this.character.add(this.bodyBlob.group);

        // WAND BLOB - mana/offense only (smaller companion)
        // Wand only shows if Spark Core is unlocked (checked in update)
        const tier = WAND_TIERS[this.wandTier];
        this.wandBlob = new ParticleLifeCreature('wandCompanion', {
            particles: tier.particles,
            radius: tier.radius,
            disableVitality: true,
            disableArmor: true
        });
        this.wandBlob.group.position.copy(this.wandOffset);
        this.wandBlob.group.visible = false; // Hidden until Spark Core found
        this.character.add(this.wandBlob.group);

        // Start with no armor (tiny blob is fragile)
        this.bodyBlob.setArmorTier('none');
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

    setPlatformSystem(platformSystem) {
        this.platformSystem = platformSystem;
    }

    /**
     * Wire direct access to level for heightmap queries (e.g. ChunkManager terrain).
     * When set, ground detection uses level.getHeightAt() before platformSystem.
     * @param {object} level - Level with getHeightAt(x, z) method
     */
    setLevel(level) {
        this._level = level;
    }

    triggerShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration / 1000;
        this.shakeTimer = this.shakeDuration;
    }

    onMouseMove(event) {
        if (!this.isPointerLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.yaw -= movementX * this.mouseSensitivity;
        this.pitch += movementY * this.mouseSensitivity;

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
                this.jumpBufferTimer = this.jumpBufferTime;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.slide = true;
                this.tryStartSlide();
                break;
            case 'KeyE':
                this.keys.absorb = true;
                this.tryAbsorb();
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
            case 'KeyE':
                this.keys.absorb = false;
                break;
        }
    }

    tryStartSlide() {
        if (!this.isSliding &&
            this.isGrounded &&
            this.slideCooldownTimer <= 0 &&
            this.currentSpeed > 2) {

            this.isSliding = true;
            this.slideTimer = this.slideDuration;

            this.slideDirection.copy(this.momentumVector).normalize();
            if (this.slideDirection.lengthSq() < 0.1) {
                this.slideDirection.set(0, 0, -1).applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    this.facingRotation
                );
            }

            this.slideStartSpeed = Math.max(this.currentSpeed, this.slideSpeed * 0.8);
            this.cameraOffset.copy(this.slideCameraOffset);

            // Apply slide squish to body blob (tripled wobble)
            this.bodyBlob.applyImpact(new THREE.Vector3(0, -1, 0), 0.9);

            window.dispatchEvent(new CustomEvent('player-slide', {
                detail: { position: this.character.position.clone() }
            }));
        }
    }

    endSlide() {
        this.isSliding = false;
        this.slideCooldownTimer = this.slideCooldown;
        this.cameraOffset.copy(this.baseCameraOffset);
        this.currentSpeed = Math.min(this.maxSpeed, this.slideStartSpeed * 0.6);
    }

    update(delta) {
        if (!this.character) return;

        // Update blob physics with velocity for acceleration-based deformation
        // The physics system computes acceleration internally from velocity changes
        if (this.bodyBlob) {
            this.bodyBlob.setGrounded(this.isGrounded);
            // Pass current velocity - physics system will compute acceleration
            this.bodyBlob.setVelocityForPhysics(this.momentumVector);
            this.bodyBlob.update(delta);
        }
        if (this.wandBlob) {
            this.wandBlob.update(delta);
        }

        // Update timers
        this.updateTimers(delta);

        // Track previous grounded state
        this.wasGrounded = this.isGrounded;
        this.justLanded = false;

        // === SLIDING UPDATE ===
        if (this.isSliding) {
            this.updateSlide(delta);
        } else {
            this.updateMovement(delta);
        }

        // === GROUND DETECTION ===
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

            // Landing impact on blobs (tripled wobble)
            this.bodyBlob.applyLandingImpact(1.2);

            window.dispatchEvent(new CustomEvent('player-land', {
                detail: {
                    position: this.character.position.clone(),
                    fallSpeed: Math.abs(this.velocity.y)
                }
            }));
        }

        // Calculate movement state
        const horizontalVelocity = new THREE.Vector3(this.momentumVector.x, 0, this.momentumVector.z);
        this.isMoving = horizontalVelocity.length() > 0.5;
        this.isRunning = this.currentSpeed > this.walkSpeed * 1.2;

        // Update absorb cooldown
        if (this.absorbCooldown > 0) {
            this.absorbCooldown -= delta;
        }

        // Update wand-blob position (follows body)
        this.updateWandPosition(delta);

        // Update camera
        this.updateCamera(delta);
    }

    updateWandPosition(delta) {
        if (!this.wandBlob) return;

        // Wand-blob follows body, staying in direction the mouse/camera is facing
        const targetOffset = new THREE.Vector3();

        // Always use camera facing direction (yaw), not movement direction
        // Forward is negative Z in Three.js, rotated by yaw
        const facingDir = new THREE.Vector3(0, 0, -1);
        facingDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

        // Position wand in front of body (where player is looking)
        targetOffset.copy(facingDir).multiplyScalar(0.6);
        targetOffset.y = 0.05; // Slight vertical offset

        // Elastic follow (smooth, slightly laggy)
        this.wandOffset.lerp(targetOffset, delta * 8);

        // Update wand blob position relative to body
        this.wandBlob.group.position.copy(this.wandOffset);
    }

    updateTimers(delta) {
        if (this.slideCooldownTimer > 0) {
            this.slideCooldownTimer -= delta;
        }

        if (this.isGrounded) {
            this.coyoteTimer = this.coyoteTime;
        } else if (this.coyoteTimer > 0) {
            this.coyoteTimer -= delta;
        }

        if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer -= delta;
        }
    }

    updateSlide(delta) {
        this.slideTimer -= delta;

        if (this.slideTimer <= 0) {
            this.endSlide();
            return;
        }

        const slideProgress = 1 - (this.slideTimer / this.slideDuration);
        const currentSlideSpeed = THREE.MathUtils.lerp(
            this.slideSpeed,
            this.slideSpeed * 0.7,
            slideProgress
        );

        this.momentumVector.copy(this.slideDirection).multiplyScalar(currentSlideSpeed);
        this.velocity.x = this.momentumVector.x;
        this.velocity.z = this.momentumVector.z;

        // Track movement direction
        this.movementDirection.copy(this.slideDirection);
    }

    updateMovement(delta) {
        this.direction.set(0, 0, 0);

        if (this.keys.forward) this.direction.z -= 1;
        if (this.keys.backward) this.direction.z += 1;
        if (this.keys.left) this.direction.x -= 1;
        if (this.keys.right) this.direction.x += 1;

        const hasMovementInput = this.direction.lengthSq() > 0;

        if (hasMovementInput) {
            this.direction.normalize();
            this.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        }

        if (hasMovementInput) {
            const targetVelocity = this.direction.clone().multiplyScalar(this.maxSpeed);

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

            // Store movement direction for wand positioning
            this.movementDirection.copy(this.direction);

            this.facingRotation = Math.atan2(this.direction.x, this.direction.z);
        } else {
            const decelerationFactor = 1 - (this.deceleration * delta / this.maxSpeed);
            this.momentumVector.x *= Math.max(0, decelerationFactor);
            this.momentumVector.z *= Math.max(0, decelerationFactor);

            if (this.momentumVector.lengthSq() < 0.01) {
                this.momentumVector.set(0, 0, 0);
                this.movementDirection.set(0, 0, 0);
            }
        }

        this.currentSpeed = this.momentumVector.length();

        if (this.currentSpeed > this.maxSpeed) {
            this.momentumVector.normalize().multiplyScalar(this.maxSpeed);
            this.currentSpeed = this.maxSpeed;
        }

        this.velocity.x = this.momentumVector.x;
        this.velocity.z = this.momentumVector.z;
    }

    updateJump(delta) {
        const canJump = this.isGrounded || this.coyoteTimer > 0;

        if ((this.keys.jump || this.jumpBufferTimer > 0) && canJump && !this.hasJumped) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            this.hasJumped = true;
            this.jumpHeldDuration = 0;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;

            // Jump squish effect on blob (tripled wobble)
            this.bodyBlob.applyImpact(new THREE.Vector3(0, 1, 0), 0.9);

            window.dispatchEvent(new CustomEvent('player-jump', {
                detail: { position: this.character.position.clone() }
            }));
        }

        if (this.hasJumped && this.isJumpHeld && this.velocity.y > 0) {
            this.jumpHeldDuration += delta;

            if (this.jumpHeldDuration < this.maxJumpHoldTime) {
                this.velocity.y += this.jumpForcePerFrame * delta;
            }
        }

        if (this.hasJumped && !this.isJumpHeld && this.velocity.y > 0) {
            this.velocity.y *= 0.5;
        }
    }

    updateGroundDetection(delta) {
        const baseGroundLevel = this.characterHeight;
        const feetY = this.character.position.y - this.characterHeight;
        const px = this.character.position.x;
        const pz = this.character.position.z;

        // Priority 1: Direct level heightmap (ChunkManager terrain)
        if (this._level && this._level.getHeightAt) {
            const terrainH = this._level.getHeightAt(px, pz);
            if (terrainH !== undefined && terrainH !== null) {
                const targetY = terrainH + this.characterHeight;
                const feetToTerrain = feetY - terrainH;

                if (feetToTerrain <= 0.3 && feetToTerrain >= -1.0 && this.velocity.y <= 0) {
                    this.groundLevel = targetY;
                    this.groundNormal.set(0, 1, 0);
                    this.currentPlatform = true; // mark as on terrain
                    this.character.position.y = targetY;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    return;
                } else if (feetToTerrain > 0.3) {
                    this.isGrounded = false;
                }
            }
        }

        // Priority 2: platformSystem raycasts
        if (this.platformSystem) {
            const checkPos = this.character.position.clone();
            checkPos.y = feetY + 0.1;

            const surface = this.platformSystem.getSurfaceBelow(checkPos, 2);

            if (surface && this.velocity.y <= 0) {
                const feetToSurface = feetY - surface.point.y;

                if (feetToSurface <= 0.2 && feetToSurface >= -0.5) {
                    this.groundLevel = surface.point.y + this.characterHeight;
                    this.groundNormal.copy(surface.normal);
                    this.currentPlatform = surface.object;
                    this.character.position.y = this.groundLevel;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                } else if (feetToSurface > 0.2) {
                    this.isGrounded = false;
                }
            } else if (!surface) {
                this.currentPlatform = null;
            }
        }

        if (!this.currentPlatform) {
            if (feetY <= 0.1 && this.velocity.y <= 0) {
                this.character.position.y = baseGroundLevel;
                this.groundLevel = baseGroundLevel;
                this.velocity.y = 0;
                this.isGrounded = true;
            } else if (feetY > 0.2) {
                this.isGrounded = false;
                this.groundLevel = baseGroundLevel;
            }
        }

        // Safety net: if fallen far below any expected ground, try to recover
        if (this.character.position.y < -10) {
            // Re-query terrain at current XZ and place character on top
            if (this._level && this._level.getHeightAt) {
                const terrainH = this._level.getHeightAt(px, pz);
                if (terrainH !== undefined && terrainH !== null) {
                    this.character.position.y = terrainH + this.characterHeight;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    return;
                }
            }
            if (this.platformSystem) {
                const rescuePos = this.character.position.clone();
                rescuePos.y = 100; // query from high above
                const surface = this.platformSystem.getSurfaceBelow(rescuePos, 200);
                if (surface) {
                    this.character.position.y = surface.point.y + this.characterHeight;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    return;
                }
            }
            // Absolute fallback: place at Y=2
            this.character.position.y = this.characterHeight + 2;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
    }

    applyMovement(delta) {
        const moveX = this.velocity.x * delta;
        const moveZ = this.velocity.z * delta;

        if (moveX !== 0) {
            const canMoveX = this.checkCollision(
                new THREE.Vector3(moveX > 0 ? 1 : -1, 0, 0),
                Math.abs(moveX) + this.collisionRadius
            );
            if (canMoveX) {
                this.character.position.x += moveX;
            } else {
                this.momentumVector.x *= 0.2;
            }
        }

        if (moveZ !== 0) {
            const canMoveZ = this.checkCollision(
                new THREE.Vector3(0, 0, moveZ > 0 ? 1 : -1),
                Math.abs(moveZ) + this.collisionRadius
            );
            if (canMoveZ) {
                this.character.position.z += moveZ;
            } else {
                this.momentumVector.z *= 0.2;
            }
        }

        this.character.position.y += this.velocity.y * delta;

        // Boundary limits (configurable for different level sizes)
        this.character.position.x = THREE.MathUtils.clamp(
            this.character.position.x,
            this.bounds.minX,
            this.bounds.maxX
        );
        this.character.position.z = THREE.MathUtils.clamp(
            this.character.position.z,
            this.bounds.minZ,
            this.bounds.maxZ
        );

        // Floor clamp
        const minY = this.characterHeight;
        if (this.character.position.y < minY) {
            this.character.position.y = minY;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
    }

    updateCamera(delta) {
        const offset = this.cameraOffset.clone();

        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

        const pitchOffset = Math.sin(this.pitch) * 3;
        offset.y += pitchOffset;

        const targetPosition = this.character.position.clone().add(offset);

        this.camera.position.lerp(targetPosition, delta * this.cameraSmoothness);

        // Camera shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= delta;
            const shakeAmount = this.shakeIntensity * (this.shakeTimer / this.shakeDuration);
            this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
            this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
        }

        const lookTarget = this.character.position.clone().add(this.cameraLookOffset);
        this.camera.lookAt(lookTarget);
    }

    checkCollision(direction, distance) {
        const origin = this.character.position.clone();
        origin.y = 0.5;

        this.raycaster.set(origin, direction);
        this.raycaster.far = distance;

        // Helper to check if object is descendant of player
        const isPlayerDescendant = (obj) => {
            let parent = obj.parent;
            while (parent) {
                if (parent === this.character) return true;
                parent = parent.parent;
            }
            return false;
        };

        // Collect collidable objects including those nested in groups
        // NOTE: Exclude floors and player's own meshes
        const collidables = [];
        this.scene.traverse(obj => {
            if (obj === this.character) return;
            if (isPlayerDescendant(obj)) return; // Skip player's blob meshes
            if (obj.userData?.extractable) return;
            if (obj.userData?.isParticles) return;
            if (obj instanceof THREE.GridHelper) return;
            if (obj instanceof THREE.Light) return;
            if (obj instanceof THREE.Points) return;
            // Include walls and cover objects, but NOT floors
            if (obj.isMesh && obj.userData?.type === 'wall') {
                collidables.push(obj);
            } else if (obj.isMesh && obj.userData?.type === 'cover') {
                collidables.push(obj);
            }
            // Note: Removed legacy mesh inclusion - only explicit wall/cover types are collidable
        });

        const intersects = this.raycaster.intersectObjects(collidables, false);

        return intersects.length === 0;
    }

    // === PUBLIC API ===

    getPosition() {
        return this.character ? this.character.position : new THREE.Vector3();
    }

    /**
     * Set player position (for spawn points, teleportation, etc.)
     */
    setPosition(x, y, z) {
        if (this.character) {
            this.character.position.set(x, y, z);
            // Reset velocity to prevent flying off
            this.velocity.set(0, 0, 0);
            this.momentumVector.set(0, 0, 0);
            this.currentSpeed = 0;
        }
    }

    /**
     * Set world bounds for movement clamping
     */
    setBounds(minX, maxX, minZ, maxZ) {
        const margin = 10;
        this.bounds = { minX: minX + margin, maxX: maxX - margin, minZ: minZ + margin, maxZ: maxZ - margin };
    }

    getYaw() {
        return this.yaw;
    }

    getCharacter() {
        return this.character;
    }

    getBodyBlob() {
        return this.bodyBlob;
    }

    getWandBlob() {
        return this.wandBlob;
    }

    /**
     * Get wand blob world position (for projectile origin)
     */
    getWandPosition() {
        if (this.wandBlob) {
            return this.wandBlob.getWorldPosition();
        }
        return this.character.position.clone();
    }

    /**
     * Set wand tier (affects wand blob size)
     */
    setWandTier(tierName) {
        const tier = WAND_TIERS[tierName];
        if (!tier) return;

        this.wandTier = tierName;

        // Recreate wand blob with new tier
        if (this.wandBlob) {
            this.character.remove(this.wandBlob.group);
            this.wandBlob.dispose();
        }

        this.wandBlob = new ParticleLifeCreature('wandCompanion', {
            particles: tier.particles,
            radius: tier.radius,
            disableVitality: true,
            disableArmor: true
        });
        this.wandBlob.group.position.copy(this.wandOffset);
        this.character.add(this.wandBlob.group);
    }

    /**
     * Sync health from PlayerHealth system to body blob vitality
     */
    syncHealth(health, maxHealth) {
        if (this.bodyBlob) {
            this.bodyBlob.maxVitality = maxHealth;
            this.bodyBlob.setVitality(health);
        }
    }

    /**
     * Sync essence from ColorInventory to wand blob essence
     */
    syncEssence(essence, maxEssence) {
        if (this.wandBlob) {
            this.wandBlob.maxEssence = maxEssence;
            this.wandBlob.setEssence(essence);
        }
    }

    /**
     * Take damage - applies to body blob
     */
    takeDamage(amount, knockbackDir = null) {
        if (this.bodyBlob) {
            const result = this.bodyBlob.takeDamage(amount);

            // Apply knockback
            if (knockbackDir) {
                this.bodyBlob.applyImpact(knockbackDir, 0.4);
            }

            return result;
        }
        return { absorbed: 0, vitalityDamage: amount, died: false };
    }

    /**
     * Set armor tier on body blob
     */
    setArmorTier(tierName) {
        if (this.bodyBlob) {
            this.bodyBlob.setArmorTier(tierName);
        }
    }

    /**
     * Trigger wand cast visual (shrink/pulse wand blob + body recoil)
     */
    triggerWandCast() {
        // Get firing direction (camera facing)
        const fireDir = new THREE.Vector3(0, 0, -1);
        fireDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

        if (this.wandBlob) {
            // Apply outward impact to simulate firing
            this.wandBlob.applyImpact(fireDir, 0.6);
        }

        // Apply ACTUAL movement recoil (push player backward)
        const recoilStrength = 3.0;  // Units per second of backward push
        const recoilDir = fireDir.clone().negate();
        this.momentumVector.x += recoilDir.x * recoilStrength;
        this.momentumVector.z += recoilDir.z * recoilStrength;

        if (this.bodyBlob) {
            // Also apply visual wobble to body
            this.bodyBlob.applyImpact(recoilDir, 0.4);
        }
    }

    /**
     * Wire the core system for particle budget scaling.
     * @param {CoreSystem} coreSystem
     */
    setCoreSystem(coreSystem) {
        this.coreSystem = coreSystem;

        // Listen for core unlocks to show/hide wand
        window.addEventListener('core-unlocked', (e) => {
            if (e.detail.type === CORE_TYPES.SPARK && this.wandBlob) {
                this.wandBlob.group.visible = true;
                console.log('[BlobController] Spark Core found! Wand blob visible.');
            }
        });

        // Listen for core level-ups and upgrades to scale blob
        window.addEventListener('core-leveled', () => {
            this._updateBlobFromCores();
        });
        window.addEventListener('core-upgraded', () => {
            this._updateBlobFromCores();
        });
        // Re-sync after new run (fragment bonuses change core stats)
        window.addEventListener('run-reset', () => {
            // Delay slightly so core-system processes reset first
            setTimeout(() => this._updateBlobFromCores(), 50);
        });

        // Initial sync
        this._updateBlobFromCores();
    }

    /**
     * Update blob particle count and movement speed from core budgets.
     */
    _updateBlobFromCores() {
        if (!this.coreSystem) return;

        const vitality = this.coreSystem.getParticleBudget(CORE_TYPES.VITALITY);
        const shell = this.coreSystem.getParticleBudget(CORE_TYPES.SHELL);
        const essence = this.coreSystem.getParticleBudget(CORE_TYPES.ESSENCE);
        const spark = this.coreSystem.isUnlocked(CORE_TYPES.SPARK)
            ? this.coreSystem.getParticleBudget(CORE_TYPES.SPARK) : 0;
        const totalParticles = vitality + shell + essence + spark;

        // Scale movement speed with particle count (more particles = slightly faster)
        // Base: 4 at 10 particles, max 7 at 50+ particles
        this.maxSpeed = THREE.MathUtils.clamp(4 + (totalParticles - 10) * 0.075, 4, 7);
        this.runSpeed = this.maxSpeed;
        this.walkSpeed = this.maxSpeed * 0.5;

        // Scale blob radius with particle count
        const targetRadius = THREE.MathUtils.clamp(0.25 + totalParticles * 0.005, 0.25, 0.5);
        if (this.bodyBlob) {
            this.bodyBlob.radius = targetRadius;
        }

        // Update armor tier based on shell capacity
        if (this.bodyBlob) {
            if (shell >= 8) this.bodyBlob.setArmorTier('heavy');
            else if (shell >= 5) this.bodyBlob.setArmorTier('medium');
            else if (shell >= 3) this.bodyBlob.setArmorTier('light');
            else this.bodyBlob.setArmorTier('none');
        }

        // Show wand blob if spark core unlocked
        if (this.wandBlob && this.coreSystem.isUnlocked(CORE_TYPES.SPARK)) {
            this.wandBlob.group.visible = true;
        }
    }

    /**
     * Try to absorb nearby objects (E key).
     * Dispatches 'player-absorb' event for other systems to handle.
     */
    tryAbsorb() {
        if (this.absorbCooldown > 0) return;

        this.absorbCooldown = this.absorbCooldownTime;

        const playerPos = this.getPosition();

        // Dispatch absorb event — other systems (item system, zone manager) handle what gets absorbed
        window.dispatchEvent(new CustomEvent('player-absorb', {
            detail: {
                position: playerPos.clone(),
                range: this.absorbRange
            }
        }));

        // Visual feedback: blob pulses outward
        if (this.bodyBlob) {
            this.bodyBlob.applyImpact(new THREE.Vector3(0, 0.5, 0), 0.4);
        }
    }

    /**
     * Dispose all resources
     */
    dispose() {
        if (this.bodyBlob) {
            this.bodyBlob.dispose();
        }
        if (this.wandBlob) {
            this.wandBlob.dispose();
        }
        if (this.character) {
            this.scene.remove(this.character);
        }
    }
}
