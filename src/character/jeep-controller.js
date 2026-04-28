// jeep-controller.js - Player controller for drivable jeep on outdoor terrain
// Matches existing controller API (getPosition, setPosition, setBounds, getYaw, getCharacter, dispose)

import * as THREE from 'three';
import { JeepVehicle } from '../vehicle/jeep-vehicle.js';
import { JeepPhysics } from '../vehicle/jeep-physics.js';

// Collidable obstacle types from outdoor-level.js
const COLLIDABLE_TYPES = new Set([
    'tree-trunk', 'rock', 'ruin-pillar', 'ruin-wall',
    'hybrid-shell-trunk', 'hybrid-shell-rock', 'hybrid-shell-pillar', 'hybrid-shell-wall',
]);

export class JeepController {
    /**
     * @param {THREE.Camera} camera
     * @param {HTMLElement} domElement
     * @param {THREE.Scene} scene
     * @param {object} platformSystem - Platform system from level (used as fallback)
     */
    constructor(camera, domElement, scene, platformSystem = null) {
        this.camera = camera;
        this.domElement = domElement;
        this.scene = scene;
        this.platformSystem = platformSystem;

        // Level reference for direct heightmap access
        this._level = null;

        // Vehicle mesh
        this.character = new THREE.Group();
        this.character.name = 'jeep-player';
        this.jeep = JeepVehicle.buildDefault();
        this.character.add(this.jeep);
        this.scene.add(this.character);

        // Physics — wire height functions (using platformSystem fallback initially)
        this.physics = new JeepPhysics(
            (x, z) => this._getHeight(x, z),
            (x, z) => this._getNormal(x, z)
        );

        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            handbrake: false,
        };

        // Camera state
        this._cameraYaw = 0;     // Mouse orbit yaw (independent of vehicle heading)
        this._cameraPitch = 0.15; // Slight downward pitch default
        this._cameraPos = new THREE.Vector3();
        this._cameraTarget = new THREE.Vector3();
        this.mouseSensitivity = 0.002;
        this.isPointerLocked = false;

        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;

        // Suspension visual state (smoothed per-wheel offsets)
        this._wheelRestY = [];  // populated on first sync
        this._wheelSuspension = [0, 0, 0, 0];
        this._chassisTilt = { pitch: 0, roll: 0 };

        // Collision detection
        this.raycaster = new THREE.Raycaster();
        this._collidables = null; // Cached obstacle list
        this._collidableCacheTime = 0;

        // Audio reference (set externally)
        this.vehicleAudio = null;

        // Damage system reference (set externally for collision damage)
        this.damageSystem = null;

        // Bounds
        this.bounds = { minX: 0, maxX: 200, minZ: 0, maxZ: 200 };

        // Temp vectors
        this._tmpVec3 = new THREE.Vector3();
        this._tmpVec3b = new THREE.Vector3();

        this._setupEventListeners();
    }

    // ═══════════════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════

    _setupEventListeners() {
        this.domElement.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.domElement;
            const hint = document.getElementById('controls-hint');
            if (hint) hint.style.opacity = this.isPointerLocked ? '0' : '1';
        });

        document.addEventListener('mousemove', (e) => this._onMouseMove(e));
        document.addEventListener('keydown', (e) => this._onKeyDown(e));
        document.addEventListener('keyup', (e) => this._onKeyUp(e));

        window.addEventListener('camera-shake', (e) => {
            this.triggerShake(e.detail.intensity, e.detail.duration);
        });
    }

    _onMouseMove(e) {
        if (!this.isPointerLocked) return;
        this._cameraYaw -= (e.movementX || 0) * this.mouseSensitivity;
        this._cameraPitch += (e.movementY || 0) * this.mouseSensitivity;
        this._cameraPitch = Math.max(-0.5, Math.min(1.0, this._cameraPitch));
    }

    _onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':    this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown':  this.keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft':  this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
            case 'Space': this.keys.handbrake = true; break;
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':    this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown':  this.keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft':  this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
            case 'Space': this.keys.handbrake = false; break;
        }
    }

    triggerShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration / 1000;
        this.shakeTimer = this.shakeDuration;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TERRAIN ACCESS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get terrain height at world position.
     * Uses direct level.getHeightAt() if available, falls back to platformSystem.
     */
    _getHeight(x, z) {
        if (this._level && this._level.getHeightAt) {
            return this._level.getHeightAt(x, z);
        }
        // Fallback to platformSystem
        if (this.platformSystem) {
            const pos = this._tmpVec3.set(x, 100, z);
            const surface = this.platformSystem.getSurfaceBelow(pos, 200);
            if (surface) {
                // platformSystem adds blobGroundOffset (0.25), subtract it for raw height
                const isOutdoor = this.platformSystem.isOutdoorTerrain;
                return surface.point.y - (isOutdoor ? 0.25 : 0);
            }
        }
        return 0;
    }

    /**
     * Get terrain normal at world position.
     * Uses direct level._getTerrainNormal() if available.
     */
    _getNormal(x, z) {
        if (this._level && this._level._getTerrainNormal) {
            return this._level._getTerrainNormal(x, z);
        }
        // Fallback: finite difference from height samples
        const eps = 0.5;
        const hL = this._getHeight(x - eps, z);
        const hR = this._getHeight(x + eps, z);
        const hD = this._getHeight(x, z - eps);
        const hU = this._getHeight(x, z + eps);
        const nx = hL - hR;
        const ny = 2 * eps;
        const nz = hD - hU;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return { x: nx / len, y: ny / len, z: nz / len };
    }

    // ═══════════════════════════════════════════════════════════════════
    // MAIN UPDATE
    // ═══════════════════════════════════════════════════════════════════

    update(delta) {
        if (!this.character) return;

        // 1. Build input from key state
        const input = {
            throttle: 0,
            brake: 0,
            steer: 0,
            handbrake: this.keys.handbrake,
        };

        if (this.keys.forward) input.throttle = 1;
        if (this.keys.backward) {
            if (this.physics.speed > 0.5) {
                input.brake = 1;
            } else {
                input.throttle = -0.5; // Reverse
            }
        }
        // Steer signs are swapped because physics +Z forward + chase camera facing +Z
        // mirrors screen X (world -X = screen right). Positive steer = screen left.
        if (this.keys.left) input.steer = 1;
        if (this.keys.right) input.steer = -1;

        // 2. Step physics
        this.physics.update(delta, input);

        // 3. Obstacle collisions
        this._checkObstacleCollisions();

        // 4. Sync mesh to physics state
        this._syncVehicleMesh(delta);

        // 5. Update camera
        this._updateCamera(delta);
    }

    // ═══════════════════════════════════════════════════════════════════
    // MESH SYNC
    // ═══════════════════════════════════════════════════════════════════

    _syncVehicleMesh(dt) {
        const state = this.physics;

        // Position
        this.character.position.set(state.positionX, state.positionY, state.positionZ);

        // Rotation — YXZ order: yaw first, then pitch, then roll
        // Physics forward is +Z at yaw=0 (sin(yaw), cos(yaw)).
        // The jeep mesh has hood at +Z, so they align directly — no PI offset.
        // (A PI offset would invert pitch and roll in the YXZ-rotated frame.)
        this.character.rotation.order = 'YXZ';
        this.character.rotation.set(state.pitch, state.yaw, state.roll);

        // Wheel meshes: order is [FR, FL, RR, RL] in jeep-vehicle.js
        // Physics suspension: [FL, FR, RL, RR]
        // Mapping: physics[0]=FL -> wheels[1], physics[1]=FR -> wheels[0],
        //          physics[2]=RL -> wheels[3], physics[3]=RR -> wheels[2]
        const SUSPENSION_MAP = [1, 0, 3, 2];
        const MAX_TRAVEL = 0.15;
        const wheels = this.jeep.wheelMeshes;

        // Cache rest Y positions on first call
        if (this._wheelRestY.length === 0 && wheels.length > 0) {
            for (const w of wheels) {
                this._wheelRestY.push(w.position.y);
            }
        }

        // Smooth suspension offsets and apply to wheel Y
        const lerpFactor = dt ? (1 - Math.exp(-15 * dt)) : 1;
        for (let pi = 0; pi < 4; pi++) {
            const wi = SUSPENSION_MAP[pi];
            if (!wheels[wi]) continue;

            const target = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, state.suspension[pi]));
            this._wheelSuspension[pi] += (target - this._wheelSuspension[pi]) * lerpFactor;
            wheels[wi].position.y = this._wheelRestY[wi] + this._wheelSuspension[pi];
        }

        // Front wheels — steer + spin with YXZ order so steer (Y) applies first
        // in world space, then spin (X) in the steered frame. Default XYZ causes
        // the steer axis to precess with wheel spin, producing visible wobble.
        for (let i = 0; i < 2; i++) {
            if (wheels[i]) {
                wheels[i].rotation.order = 'YXZ';
                wheels[i].rotation.set(state.wheelSpinAngle, state.steerAngle, 0);
            }
        }
        // Rear wheels — spin only
        for (let i = 2; i < wheels.length; i++) {
            if (wheels[i]) {
                wheels[i].rotation.x = state.wheelSpinAngle;
            }
        }

        // Subtle chassis body roll from left-right suspension difference
        const leftAvg = (this._wheelSuspension[0] + this._wheelSuspension[2]) * 0.5;  // FL, RL
        const rightAvg = (this._wheelSuspension[1] + this._wheelSuspension[3]) * 0.5; // FR, RR
        const tiltRoll = Math.atan2(rightAvg - leftAvg, 1.95) * 0.3; // subtle multiplier
        this._chassisTilt.roll += (tiltRoll - this._chassisTilt.roll) * lerpFactor;

        // Apply body tilt to jeep sub-group (not the root character, which has physics rotation)
        this.jeep.rotation.z = this._chassisTilt.roll;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CHASE CAMERA
    // ═══════════════════════════════════════════════════════════════════

    _updateCamera(dt) {
        const state = this.physics;
        const speed = Math.abs(state.speed);

        // Chase distance and height scale with speed
        const distance = 10 + speed * 0.05;
        const height = 5.5 + speed * 0.1;

        // Camera position: behind vehicle heading, orbited by mouse yaw
        const followYaw = state.yaw + this._cameraYaw;
        const camX = state.positionX - Math.sin(followYaw) * distance;
        const camZ = state.positionZ - Math.cos(followYaw) * distance;
        const camY = state.positionY + height + Math.sin(this._cameraPitch) * distance * 0.5;

        // Terrain clearance for camera
        const terrainH = this._getHeight(camX, camZ);
        const minCamY = terrainH + 3;

        this._cameraPos.set(camX, Math.max(camY, minCamY), camZ);

        // Look target: ahead of vehicle center
        const lookAheadDist = 5;
        const lookX = state.positionX + Math.sin(state.yaw) * lookAheadDist;
        const lookZ = state.positionZ + Math.cos(state.yaw) * lookAheadDist;
        const lookY = state.positionY + 2.5;
        this._cameraTarget.set(lookX, lookY, lookZ);

        // Smooth camera follow
        const posLerp = 1 - Math.exp(-5 * dt);
        const targetLerp = 1 - Math.exp(-8 * dt);
        this.camera.position.lerp(this._cameraPos, posLerp);

        // Look at with smoothed target
        this._tmpVec3b.copy(this._cameraTarget);
        this.camera.lookAt(this._tmpVec3b);

        // Camera shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const shakeAmount = this.shakeIntensity * (this.shakeTimer / this.shakeDuration);
            this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
            this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // OBSTACLE COLLISION
    // ═══════════════════════════════════════════════════════════════════

    _getCollidables() {
        // Cache collidable list for ~1 second to avoid traversal every frame
        const now = performance.now();
        if (this._collidables && now - this._collidableCacheTime < 1000) {
            return this._collidables;
        }

        const collidables = [];
        this.scene.traverse(obj => {
            if (!obj.isMesh) return;
            if (obj.parent === this.character || obj.parent?.parent === this.character) return;
            if (COLLIDABLE_TYPES.has(obj.userData?.type)) {
                collidables.push(obj);
            }
        });

        this._collidables = collidables;
        this._collidableCacheTime = now;
        return collidables;
    }

    _checkObstacleCollisions() {
        const speed = Math.abs(this.physics.speed);
        if (speed < 0.5) return; // No collision check when nearly stationary

        const probes = this.physics.getCollisionProbePoints();
        const collidables = this._getCollidables();
        if (collidables.length === 0) return;

        // Velocity direction for raycast
        const velDir = this._tmpVec3.set(this.physics.velocityX, 0, this.physics.velocityZ).normalize();
        if (velDir.lengthSq() < 0.001) return;

        const checkDist = Math.max(1.0, speed * 0.1);

        for (const probe of probes) {
            const origin = this._tmpVec3b.set(probe.x, probe.y + 0.5, probe.z);
            this.raycaster.set(origin, velDir);
            this.raycaster.far = checkDist;

            const hits = this.raycaster.intersectObjects(collidables, false);
            if (hits.length > 0) {
                const hit = hits[0];
                const hitNormal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : velDir.clone().negate();

                this.physics.applyCollisionResponse(
                    { x: hitNormal.x, y: hitNormal.y, z: hitNormal.z },
                    Math.max(0.1, checkDist - hit.distance)
                );

                // Camera shake on impact
                this.triggerShake(Math.min(speed * 0.15, 0.5), 200);

                // Collision audio
                if (this.vehicleAudio) {
                    this.vehicleAudio.playCollision(speed);
                }

                // Collision damage
                if (this.damageSystem) {
                    this.damageSystem.applyCollisionDamage(speed);
                }
                break; // One collision per frame is enough
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PUBLIC API (matches VehicleController / BlobPlayerController)
    // ═══════════════════════════════════════════════════════════════════

    getPosition() {
        return this.character ? this.character.position : new THREE.Vector3();
    }

    setPosition(x, y, z) {
        this.physics.reset(x, y, z, this.physics.yaw);
        if (this.character) {
            this.character.position.set(x, y, z);
        }
        // Reset camera to behind vehicle
        this._cameraYaw = 0;
    }

    setBounds(minX, maxX, minZ, maxZ) {
        this.bounds = { minX, maxX, minZ, maxZ };
        this.physics.boundsMinX = minX;
        this.physics.boundsMaxX = maxX;
        this.physics.boundsMinZ = minZ;
        this.physics.boundsMaxZ = maxZ;
    }

    getYaw() {
        return this.physics.yaw;
    }

    getCharacter() {
        return this.character;
    }

    /**
     * Wire direct access to outdoor level for heightmap queries
     * @param {OutdoorLevel} level
     */
    setLevel(level) {
        this._level = level;
    }

    dispose() {
        if (this.jeep) {
            this.jeep.dispose();
        }
        if (this.character) {
            this.scene.remove(this.character);
        }
        this._collidables = null;
    }
}
