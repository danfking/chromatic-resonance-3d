// vehicle-controller.js - Player controller for MarchingCubes blob vehicle
// Adapts movement/input/camera patterns from BlobPlayerController

import * as THREE from 'three';
import { BlobVehicle } from '../vehicle/blob-vehicle.js';
import { TEST_COMPONENTS, COMPONENT_CATEGORIES } from '../vehicle/vehicle-components.js';

export class VehicleController {
    constructor(camera, domElement, scene, platformSystem = null) {
        this.camera = camera;
        this.domElement = domElement;
        this.scene = scene;
        this.platformSystem = platformSystem;

        // Vehicle group
        this.character = new THREE.Group();
        this.characterHeight = 0.6; // Blob center height from ground
        this.characterRadius = 0.6;

        // === MOMENTUM-BASED MOVEMENT ===
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.momentumVector = new THREE.Vector3();

        // Base movement physics (modified by components)
        this.baseMaxSpeed = 7;
        this.baseJumpForce = 9;
        this.acceleration = 50;
        this.deceleration = 35;
        this.maxSpeed = this.baseMaxSpeed;
        this.currentSpeed = 0;

        // Jump physics
        this.gravity = 32;
        this.jumpForce = this.baseJumpForce;
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

        // Ground state
        this.isGrounded = true;
        this.groundNormal = new THREE.Vector3(0, 1, 0);
        this.currentPlatform = null;
        this.groundLevel = 0;

        // Camera
        this.cameraOffset = new THREE.Vector3(0, 1.2, 2.5);
        this.cameraLookOffset = new THREE.Vector3(0, 0.15, 0);
        this.cameraSmoothness = 10;

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
            interact: false,
        };

        this.isPointerLocked = false;

        // Collision detection
        this.collisionRadius = 0.6;
        this.raycaster = new THREE.Raycaster();

        // World bounds
        this.bounds = { minX: -19, maxX: 19, minZ: -19, maxZ: 19 };

        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;

        // Animation state
        this.isMoving = false;

        // === BLOB VEHICLE ===
        this.blobVehicle = null;

        // Component pickup system
        this.worldPickups = []; // { mesh, componentId, position }
        this.pickupRange = 2.0;
        this.nextFreeSlot = 0; // Auto-assign to next available slot

        this.init();
    }

    init() {
        this.createVehicle();
        this.setupEventListeners();
    }

    createVehicle() {
        this.character.position.set(0, this.characterHeight, 0);
        this.scene.add(this.character);

        this.blobVehicle = new BlobVehicle();
        this.character.add(this.blobVehicle);
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

    triggerShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration / 1000;
        this.shakeTimer = this.shakeDuration;
    }

    onMouseMove(event) {
        if (!this.isPointerLocked) return;
        this.yaw -= (event.movementX || 0) * this.mouseSensitivity;
        this.pitch += (event.movementY || 0) * this.mouseSensitivity;
        this.pitch = Math.max(this.pitchMin, Math.min(this.pitchMax, this.pitch));
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp':
                this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown':
                this.keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft':
                this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight':
                this.keys.right = true; break;
            case 'Space':
                this.keys.jump = true;
                this.isJumpHeld = true;
                this.jumpBufferTimer = this.jumpBufferTime;
                break;
            case 'KeyE':
                this.keys.interact = true;
                this.tryPickupComponent();
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp':
                this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown':
                this.keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft':
                this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight':
                this.keys.right = false; break;
            case 'Space':
                this.keys.jump = false;
                this.isJumpHeld = false;
                break;
            case 'KeyE':
                this.keys.interact = false; break;
        }
    }

    // === MAIN UPDATE ===

    update(delta) {
        if (!this.character) return;

        // Update timers
        this.updateTimers(delta);

        // Track previous grounded state
        this.wasGrounded = this.isGrounded;

        // Movement
        this.updateMovement(delta);

        // Ground detection
        this.updateGroundDetection(delta);

        // Jump
        this.updateJump(delta);

        // Gravity
        if (!this.isGrounded) {
            this.velocity.y -= this.gravity * delta;
        }

        // Apply movement
        this.applyMovement(delta);

        // Landing detection
        if (this.isGrounded && !this.wasGrounded) {
            this.hasJumped = false;
            const fallSpeed = Math.abs(this.velocity.y);
            if (this.blobVehicle) {
                this.blobVehicle.applyLandingImpact(fallSpeed);
            }
            window.dispatchEvent(new CustomEvent('player-land', {
                detail: { position: this.character.position.clone(), fallSpeed }
            }));
        }

        // Apply component effects
        this.applyComponentEffects();

        // Animate world pickups
        this.updatePickups(delta);

        // Update blob vehicle physics and rendering
        if (this.blobVehicle) {
            this.blobVehicle.setVelocity(this.momentumVector);
            this.blobVehicle.update(delta);
        }

        // Camera
        this.updateCamera(delta);
    }

    updateTimers(delta) {
        if (this.isGrounded) {
            this.coyoteTimer = this.coyoteTime;
        } else if (this.coyoteTimer > 0) {
            this.coyoteTimer -= delta;
        }
        if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer -= delta;
        }
    }

    updateMovement(delta) {
        this.direction.set(0, 0, 0);

        if (this.keys.forward) this.direction.z -= 1;
        if (this.keys.backward) this.direction.z += 1;
        if (this.keys.left) this.direction.x -= 1;
        if (this.keys.right) this.direction.x += 1;

        const hasInput = this.direction.lengthSq() > 0;

        if (hasInput) {
            this.direction.normalize();
            this.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

            const targetVelocity = this.direction.clone().multiplyScalar(this.maxSpeed);

            this.momentumVector.x = THREE.MathUtils.lerp(
                this.momentumVector.x, targetVelocity.x,
                this.acceleration * delta / this.maxSpeed
            );
            this.momentumVector.z = THREE.MathUtils.lerp(
                this.momentumVector.z, targetVelocity.z,
                this.acceleration * delta / this.maxSpeed
            );
        } else {
            const decel = 1 - (this.deceleration * delta / this.maxSpeed);
            this.momentumVector.x *= Math.max(0, decel);
            this.momentumVector.z *= Math.max(0, decel);

            if (this.momentumVector.lengthSq() < 0.01) {
                this.momentumVector.set(0, 0, 0);
            }
        }

        this.currentSpeed = this.momentumVector.length();
        if (this.currentSpeed > this.maxSpeed) {
            this.momentumVector.normalize().multiplyScalar(this.maxSpeed);
            this.currentSpeed = this.maxSpeed;
        }

        this.velocity.x = this.momentumVector.x;
        this.velocity.z = this.momentumVector.z;

        this.isMoving = this.currentSpeed > 0.5;
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

            // Jump impact on blob
            if (this.blobVehicle) {
                this.blobVehicle.applyImpact(new THREE.Vector3(0, 1, 0), 0.8);
            }

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
    }

    applyMovement(delta) {
        const moveX = this.velocity.x * delta;
        const moveZ = this.velocity.z * delta;

        if (moveX !== 0) {
            const canMove = this.checkCollision(
                new THREE.Vector3(moveX > 0 ? 1 : -1, 0, 0),
                Math.abs(moveX) + this.collisionRadius
            );
            if (canMove) {
                this.character.position.x += moveX;
            } else {
                this.momentumVector.x *= 0.2;
                // Wall impact on blob
                if (this.blobVehicle) {
                    this.blobVehicle.applyImpact(new THREE.Vector3(moveX > 0 ? -1 : 1, 0, 0), 0.5);
                }
            }
        }

        if (moveZ !== 0) {
            const canMove = this.checkCollision(
                new THREE.Vector3(0, 0, moveZ > 0 ? 1 : -1),
                Math.abs(moveZ) + this.collisionRadius
            );
            if (canMove) {
                this.character.position.z += moveZ;
            } else {
                this.momentumVector.z *= 0.2;
                if (this.blobVehicle) {
                    this.blobVehicle.applyImpact(new THREE.Vector3(0, 0, moveZ > 0 ? -1 : 1), 0.5);
                }
            }
        }

        this.character.position.y += this.velocity.y * delta;

        // Boundary clamp
        this.character.position.x = THREE.MathUtils.clamp(
            this.character.position.x, this.bounds.minX, this.bounds.maxX
        );
        this.character.position.z = THREE.MathUtils.clamp(
            this.character.position.z, this.bounds.minZ, this.bounds.maxZ
        );

        // Floor clamp
        if (this.character.position.y < this.characterHeight) {
            this.character.position.y = this.characterHeight;
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

        const isVehicleDescendant = (obj) => {
            let parent = obj.parent;
            while (parent) {
                if (parent === this.character) return true;
                parent = parent.parent;
            }
            return false;
        };

        const collidables = [];
        this.scene.traverse(obj => {
            if (obj === this.character) return;
            if (isVehicleDescendant(obj)) return;
            if (obj.userData?.extractable) return;
            if (obj.userData?.isParticles) return;
            if (obj.userData?.isPickup) return; // Don't collide with pickup items
            if (obj instanceof THREE.GridHelper) return;
            if (obj instanceof THREE.Light) return;
            if (obj instanceof THREE.Points) return;
            if (obj.isMesh && obj.userData?.type === 'wall') {
                collidables.push(obj);
            } else if (obj.isMesh && obj.userData?.type === 'cover') {
                collidables.push(obj);
            }
        });

        return this.raycaster.intersectObjects(collidables, false).length === 0;
    }

    // === COMPONENT SYSTEM ===

    /**
     * Apply component effects to movement stats
     */
    applyComponentEffects() {
        if (!this.blobVehicle) return;
        const effects = this.blobVehicle.getComponentSystem().getAggregateEffects();
        this.maxSpeed = this.baseMaxSpeed + effects.maxSpeed;
        this.jumpForce = this.baseJumpForce + effects.jumpForce;
    }

    /**
     * Try to pick up the nearest component in range
     */
    tryPickupComponent() {
        const playerPos = this.character.position;
        let closest = null;
        let closestDist = this.pickupRange;

        for (let i = this.worldPickups.length - 1; i >= 0; i--) {
            const pickup = this.worldPickups[i];
            const dist = playerPos.distanceTo(pickup.position);
            if (dist < closestDist) {
                closest = pickup;
                closestDist = dist;
            }
        }

        if (!closest) return;

        // Find next free slot
        const slotIndex = this.findFreeSlot(closest.componentId);
        if (slotIndex === -1) return; // No free slots

        // Attach to vehicle
        const success = this.blobVehicle.attachComponent(closest.componentId, slotIndex);
        if (!success) return;

        // Remove from world
        if (closest.mesh.parent) {
            closest.mesh.parent.remove(closest.mesh);
        }
        if (closest.mesh.geometry) closest.mesh.geometry.dispose();
        if (closest.mesh.material) closest.mesh.material.dispose();

        const idx = this.worldPickups.indexOf(closest);
        if (idx !== -1) this.worldPickups.splice(idx, 1);

        console.log(`Picked up: ${closest.componentId} → slot ${slotIndex}`);
    }

    /**
     * Find a free slot appropriate for the component's category
     * @param {string} componentId
     * @returns {number} slot index, or -1 if no free slot
     */
    findFreeSlot(componentId) {
        const def = TEST_COMPONENTS[componentId];
        if (!def) return -1;

        const cat = COMPONENT_CATEGORIES[def.category];
        if (!cat) return -1;

        // Search within category's slot range
        for (let i = cat.startSlot; i < cat.startSlot + cat.slotCount; i++) {
            if (!this.blobVehicle.getComponentSystem().slots[i]) {
                return i;
            }
        }

        return -1; // All category slots full
    }

    /**
     * Update pickup item animations (bob and spin)
     * @param {number} delta
     */
    updatePickups(delta) {
        const time = performance.now() * 0.001;
        for (const pickup of this.worldPickups) {
            pickup.mesh.position.y = pickup.baseY + Math.sin(time * 2 + pickup.phase) * 0.15;
            pickup.mesh.rotation.y += delta * 1.5;
        }
    }

    /**
     * Spawn test component pickups in the world for testing
     * @param {THREE.Scene} scene
     */
    spawnTestComponents(scene) {
        const componentIds = Object.keys(TEST_COMPONENTS);
        const spawnRadius = 8;
        const playerPos = this.character.position;

        for (let i = 0; i < componentIds.length; i++) {
            const id = componentIds[i];
            const def = TEST_COMPONENTS[id];
            const angle = (i / componentIds.length) * Math.PI * 2;
            const x = playerPos.x + Math.cos(angle) * spawnRadius;
            const z = playerPos.z + Math.sin(angle) * spawnRadius;

            this.spawnPickup(scene, id, x, 0.5, z);
        }

        console.log(`Spawned ${componentIds.length} test components in a ring`);
    }

    /**
     * Spawn a single component pickup in the world
     * @param {THREE.Scene} scene
     * @param {string} componentId
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    spawnPickup(scene, componentId, x, y, z) {
        const def = TEST_COMPONENTS[componentId];
        if (!def) return;

        // Create a glowing pickup mesh
        const pickupMesh = def.meshFactory();
        pickupMesh.scale.setScalar(2); // Bigger for visibility
        pickupMesh.position.set(x, y, z);
        pickupMesh.userData.isPickup = true;
        pickupMesh.userData.componentId = componentId;

        // Add glow ring
        const ringGeo = new THREE.RingGeometry(0.25, 0.35, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffff88,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.2;
        pickupMesh.add(ring);

        scene.add(pickupMesh);

        this.worldPickups.push({
            mesh: pickupMesh,
            componentId,
            position: new THREE.Vector3(x, y, z),
            baseY: y,
            phase: Math.random() * Math.PI * 2,
        });
    }

    // === PUBLIC API (matches BlobPlayerController) ===

    getPosition() {
        return this.character ? this.character.position : new THREE.Vector3();
    }

    setPosition(x, y, z) {
        if (this.character) {
            this.character.position.set(x, y, z);
            this.velocity.set(0, 0, 0);
            this.momentumVector.set(0, 0, 0);
            this.currentSpeed = 0;
        }
    }

    setBounds(minX, maxX, minZ, maxZ) {
        this.bounds = { minX, maxX, minZ, maxZ };
    }

    getYaw() {
        return this.yaw;
    }

    getCharacter() {
        return this.character;
    }

    dispose() {
        if (this.blobVehicle) {
            this.blobVehicle.dispose();
        }
        // Clean up world pickups
        for (const pickup of this.worldPickups) {
            if (pickup.mesh.parent) pickup.mesh.parent.remove(pickup.mesh);
            if (pickup.mesh.geometry) pickup.mesh.geometry.dispose();
            if (pickup.mesh.material) pickup.mesh.material.dispose();
        }
        this.worldPickups.length = 0;

        if (this.character) {
            this.scene.remove(this.character);
        }
    }
}

