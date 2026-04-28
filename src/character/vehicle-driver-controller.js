// vehicle-driver-controller.js - Enter/exit state machine + unified controller
// Manages transitions between on-foot blob and driving vehicle
// Implements same API as BlobPlayerController for main.js compatibility

import * as THREE from 'three';
import { ParticleTransfer } from '../vehicle/particle-transfer.js';

const ENTER_PROXIMITY = 4.0;       // max distance to enter vehicle
const ENTER_KEY = 'KeyE';

/**
 * Controller states
 */
export const DRIVER_STATE = {
    ON_FOOT: 'ON_FOOT',
    ENTERING: 'ENTERING',
    DRIVING: 'DRIVING',
    EXITING: 'EXITING',
    DESTROYED: 'DESTROYED',
};

/**
 * VehicleDriverController - wraps BlobPlayerController and JeepController
 * with enter/exit transitions between them
 */
export class VehicleDriverController {
    /**
     * @param {THREE.Camera} camera
     * @param {HTMLElement} domElement
     * @param {THREE.Scene} scene
     * @param {object} blobController - BlobPlayerController instance (for on-foot)
     * @param {object} vehicleController - JeepController instance (for driving)
     * @param {object} vehicleMesh - VehicleMesh instance (for proximity check)
     */
    constructor(camera, domElement, scene, blobController, vehicleController, vehicleMesh) {
        this.camera = camera;
        this.domElement = domElement;
        this.scene = scene;

        this.blobController = blobController;
        this.vehicleController = vehicleController;
        this.vehicleMesh = vehicleMesh;

        this.state = DRIVER_STATE.ON_FOOT;
        this._activeController = blobController;

        // Particle transfer animation
        this.particleTransfer = new ParticleTransfer(scene);

        // Camera transition
        this._cameraTransition = false;
        this._cameraTransitionTime = 0;
        this._cameraTransitionDuration = 0.5;
        this._cameraStart = new THREE.Vector3();
        this._cameraEnd = new THREE.Vector3();

        // Input binding — must use document, not domElement,
        // because pointer lock sends key events to document
        this._onKeyDown = this._handleKeyDown.bind(this);
        document.addEventListener('keydown', this._onKeyDown);

        // Damage system reference (set externally)
        this.damageSystem = null;

        // Callbacks
        this.onStateChanged = null;

        // Element color for particle transfer visuals
        this.elementColor = 0xff6600;
    }

    _handleKeyDown(e) {
        if (e.code !== ENTER_KEY) return;

        if (this.state === DRIVER_STATE.ON_FOOT) {
            this._tryEnterVehicle();
        } else if (this.state === DRIVER_STATE.DRIVING) {
            this._startExitVehicle();
        }
    }

    _tryEnterVehicle() {
        if (!this.vehicleMesh) return;

        // Check horizontal (XZ) proximity to vehicle — ignore Y difference
        // so slopes don't prevent entry
        const playerPos = this.blobController.getPosition();
        const vehiclePos = this.vehicleMesh.position;
        const dx = playerPos.x - vehiclePos.x;
        const dz = playerPos.z - vehiclePos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > ENTER_PROXIMITY) return;

        this._setState(DRIVER_STATE.ENTERING);

        // Start particle transfer animation
        this.particleTransfer.startEnter(
            playerPos.clone(),
            vehiclePos.clone().add(new THREE.Vector3(0, 0.5, 0)),
            this.elementColor
        );

        this.particleTransfer.onPhaseComplete = () => {
            this._finishEnter();
        };
    }

    _finishEnter() {
        this._setState(DRIVER_STATE.DRIVING);
        this._activeController = this.vehicleController;

        // Hide blob
        const blobChar = this.blobController.getCharacter();
        if (blobChar) blobChar.visible = false;

        // Start camera transition to chase cam
        this._startCameraTransition();
    }

    _startExitVehicle() {
        this._setState(DRIVER_STATE.EXITING);

        // Determine spawn position (beside vehicle)
        const vehiclePos = this.vehicleController.getPosition();
        const yaw = this.vehicleController.getYaw();
        const exitOffset = new THREE.Vector3(-2, 0, 0); // exit to the left
        exitOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const exitPos = vehiclePos.clone().add(exitOffset);

        // Start particle transfer animation (exit)
        this.particleTransfer.startExit(
            vehiclePos.clone().add(new THREE.Vector3(0, 0.5, 0)),
            exitPos,
            this.elementColor
        );

        this.particleTransfer.onPhaseComplete = () => {
            this._finishExit(exitPos);
        };
    }

    _finishExit(exitPos) {
        this._setState(DRIVER_STATE.ON_FOOT);
        this._activeController = this.blobController;

        // Show and reposition blob
        const blobChar = this.blobController.getCharacter();
        if (blobChar) blobChar.visible = true;
        this.blobController.setPosition(exitPos.x, exitPos.y + 1, exitPos.z);

        this._startCameraTransition();
    }

    /**
     * Handle vehicle destruction (eject player)
     */
    onVehicleDestroyed() {
        if (this.state !== DRIVER_STATE.DRIVING) return;

        this._setState(DRIVER_STATE.DESTROYED);

        // Eject blob at vehicle position + upward impulse
        const vehiclePos = this.vehicleController.getPosition();
        const ejectPos = vehiclePos.clone().add(new THREE.Vector3(0, 3, 0));

        // Quick exit (no animation — it's an explosion)
        this._activeController = this.blobController;
        const blobChar = this.blobController.getCharacter();
        if (blobChar) blobChar.visible = true;
        this.blobController.setPosition(ejectPos.x, ejectPos.y, ejectPos.z);

        this._startCameraTransition();

        // Transition to ON_FOOT after a brief delay
        setTimeout(() => {
            this._setState(DRIVER_STATE.ON_FOOT);
        }, 500);
    }

    _setState(newState) {
        const oldState = this.state;
        this.state = newState;
        if (this.onStateChanged) this.onStateChanged(newState, oldState);
    }

    _startCameraTransition() {
        this._cameraTransition = true;
        this._cameraTransitionTime = 0;
        this._cameraStart.copy(this.camera.position);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PUBLIC API (matches BlobPlayerController / JeepController)
    // ═══════════════════════════════════════════════════════════════════

    update(delta) {
        // Update active controller
        if (this.state === DRIVER_STATE.ENTERING || this.state === DRIVER_STATE.EXITING) {
            // During transitions, update the particle transfer
            this.particleTransfer.update(delta);

            // Also update blob opacity during enter
            if (this.blobController.getCharacter()) {
                const opacity = this.particleTransfer.getBlobOpacity();
                const blobChar = this.blobController.getCharacter();
                if (blobChar) {
                    blobChar.traverse(child => {
                        if (child.material && child.material.opacity !== undefined) {
                            child.material.transparent = true;
                            child.material.opacity = opacity;
                        }
                    });
                }
            }
        } else {
            this._activeController.update(delta);
        }

        // Camera transition smoothing
        if (this._cameraTransition) {
            this._cameraTransitionTime += delta;
            const t = Math.min(1, this._cameraTransitionTime / this._cameraTransitionDuration);
            const eased = t * t * (3 - 2 * t); // smoothstep

            if (t >= 1) {
                this._cameraTransition = false;
            }
        }

        // Check for destruction
        if (this.state === DRIVER_STATE.DRIVING && this.damageSystem &&
            this.damageSystem.isDestroyed()) {
            this.onVehicleDestroyed();
        }
    }

    getPosition() {
        return this._activeController.getPosition();
    }

    setPosition(x, y, z) {
        this._activeController.setPosition(x, y, z);
    }

    setBounds(minX, maxX, minZ, maxZ) {
        this.blobController.setBounds(minX, maxX, minZ, maxZ);
        this.vehicleController.setBounds(minX, maxX, minZ, maxZ);
    }

    getYaw() {
        return this._activeController.getYaw();
    }

    getCharacter() {
        return this._activeController.getCharacter();
    }

    setLevel(level) {
        if (this.vehicleController.setLevel) {
            this.vehicleController.setLevel(level);
        }
        if (this.blobController.setLevel) {
            this.blobController.setLevel(level);
        }
    }

    isDriving() {
        return this.state === DRIVER_STATE.DRIVING;
    }

    isOnFoot() {
        return this.state === DRIVER_STATE.ON_FOOT;
    }

    isTransitioning() {
        return this.state === DRIVER_STATE.ENTERING || this.state === DRIVER_STATE.EXITING;
    }

    dispose() {
        document.removeEventListener('keydown', this._onKeyDown);
        this.particleTransfer.dispose();
    }
}
