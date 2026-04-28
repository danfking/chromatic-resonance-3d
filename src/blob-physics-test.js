// blob-physics-test.js - Dedicated test environment for blob physics verification
// Tests: ground sag, turn bulge (centrifugal), impact deformation, movement stretch

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ParticleLifeCreature } from './creatures/particle-life-creature.js';
import { BubblePhysics } from './creatures/bubble-physics.js';

class BlobPhysicsTest {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.blob = null;
        this.physics = null;

        // Manual control state
        this.position = new THREE.Vector3(0, 0.5, 0);
        this.velocity = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.isGrounded = true;
        this.yaw = 0;

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

        // Physics tracking for display
        this.physicsDisplay = {
            velocity: new THREE.Vector3(),
            acceleration: new THREE.Vector3(),
            turnBulge: 0,
            turnBulgeDir: new THREE.Vector3(),
            groundSag: 0
        };

        // Test scenario automation
        this.activeScenario = null;
        this.scenarioTimer = 0;
        this.scenarioPhase = 0;

        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a4a);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 3, 5);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        // Orbit controls for free camera movement
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0.5, 0);
        this.controls.enableDamping = true;

        // Lighting
        const ambient = new THREE.AmbientLight(0x606080, 0.8);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 1.2);
        directional.position.set(5, 10, 5);
        this.scene.add(directional);

        // Ground plane
        const groundGeo = new THREE.PlaneGeometry(20, 20);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x444466,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // Grid helper
        const grid = new THREE.GridHelper(20, 20, 0x666688, 0x333344);
        this.scene.add(grid);

        // Create blob character
        this.createBlob();

        // Direction indicator (shows where blob is moving/turning)
        this.createDirectionIndicators();

        // Event listeners
        this.setupEventListeners();

        // Start animation loop
        this.lastTime = performance.now();
        this.animate();

        // Expose for Playwright testing
        window.blobPhysicsTest = this;
    }

    createBlob() {
        // Create player-style blob
        this.blob = new ParticleLifeCreature('player', {
            particles: 100,
            radius: 0.4,
            disableEssence: true
        });
        this.blob.group.position.copy(this.position);
        this.scene.add(this.blob.group);

        // Keep reference to physics for direct inspection
        this.physics = this.blob.physics;
    }

    createDirectionIndicators() {
        // Velocity indicator (green arrow)
        const velArrowGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
        const velArrowMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
        this.velocityArrow = new THREE.Mesh(velArrowGeo, velArrowMat);
        this.velocityArrow.rotation.x = Math.PI / 2;
        this.scene.add(this.velocityArrow);

        // Acceleration indicator (yellow arrow)
        const accelArrowGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
        const accelArrowMat = new THREE.MeshBasicMaterial({ color: 0xffff44 });
        this.accelArrow = new THREE.Mesh(accelArrowGeo, accelArrowMat);
        this.accelArrow.rotation.x = Math.PI / 2;
        this.scene.add(this.accelArrow);

        // Turn bulge indicator (red arrow)
        const bulgeArrowGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
        const bulgeArrowMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        this.bulgeArrow = new THREE.Mesh(bulgeArrowGeo, bulgeArrowMat);
        this.bulgeArrow.rotation.x = Math.PI / 2;
        this.scene.add(this.bulgeArrow);
    }

    setupEventListeners() {
        // Pointer lock
        this.renderer.domElement.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
            this.controls.enabled = !this.isPointerLocked;
        });

        // Mouse movement for yaw control
        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                this.yaw -= e.movementX * 0.002;
            }
        });

        // Keyboard
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
            case 'Space': this.keys.jump = true; break;
            case 'ShiftLeft': case 'ShiftRight': this.keys.slide = true; break;
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ShiftLeft': case 'ShiftRight': this.keys.slide = false; break;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const delta = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        // Update test scenario if active
        if (this.activeScenario) {
            this.updateScenario(delta);
        } else {
            // Manual control
            this.updateManualControl(delta);
        }

        // Apply physics to blob
        this.updateBlobPhysics(delta);

        // Update direction indicators
        this.updateIndicators();

        // Update display
        this.updatePhysicsDisplay();

        // Update orbit controls
        if (!this.isPointerLocked) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateManualControl(delta) {
        // Calculate input direction
        const inputDir = new THREE.Vector3();
        if (this.keys.forward) inputDir.z -= 1;
        if (this.keys.backward) inputDir.z += 1;
        if (this.keys.left) inputDir.x -= 1;
        if (this.keys.right) inputDir.x += 1;

        const hasInput = inputDir.lengthSq() > 0;

        if (hasInput) {
            inputDir.normalize();
            inputDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

            // Accelerate toward input direction
            this.targetVelocity.copy(inputDir).multiplyScalar(5);
        } else {
            this.targetVelocity.set(0, 0, 0);
        }

        // Smooth velocity (momentum-based)
        const accelRate = hasInput ? 30 : 20;
        this.velocity.lerp(this.targetVelocity, accelRate * delta);

        // Jump
        if (this.keys.jump && this.isGrounded) {
            this.velocity.y = 8;
            this.isGrounded = false;
        }

        // Gravity
        if (!this.isGrounded) {
            this.velocity.y -= 25 * delta;
        }

        // Apply velocity
        this.position.addScaledVector(this.velocity, delta);

        // Ground check
        if (this.position.y < 0.5) {
            this.position.y = 0.5;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        // Boundary clamp
        this.position.x = THREE.MathUtils.clamp(this.position.x, -9, 9);
        this.position.z = THREE.MathUtils.clamp(this.position.z, -9, 9);
    }

    updateBlobPhysics(delta) {
        // Update blob position
        this.blob.group.position.copy(this.position);

        // Set grounded state
        this.blob.setGrounded(this.isGrounded);

        // Pass velocity for acceleration-based physics
        this.blob.setVelocityForPhysics(this.velocity);

        // Update blob
        this.blob.update(delta);

        // Capture physics state for display
        if (this.physics) {
            this.physicsDisplay.velocity.copy(this.velocity);
            this.physicsDisplay.acceleration.copy(this.physics.smoothedAcceleration);
            this.physicsDisplay.turnBulge = this.physics.turnBulgeAmount;
            this.physicsDisplay.turnBulgeDir.copy(this.physics.turnBulgeDir);
            this.physicsDisplay.groundSag = this.physics.currentGroundSag;
        }
    }

    updateIndicators() {
        const blobPos = this.blob.group.position.clone();

        // Velocity arrow (green) - points in velocity direction
        const velMag = this.velocity.length();
        if (velMag > 0.1) {
            this.velocityArrow.visible = true;
            this.velocityArrow.position.copy(blobPos).add(new THREE.Vector3(0, 0.8, 0));
            this.velocityArrow.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                this.velocity.clone().normalize()
            );
            this.velocityArrow.scale.setScalar(velMag * 0.3);
        } else {
            this.velocityArrow.visible = false;
        }

        // Acceleration arrow (yellow) - points in acceleration direction
        const accelMag = this.physicsDisplay.acceleration.length();
        if (accelMag > 1) {
            this.accelArrow.visible = true;
            this.accelArrow.position.copy(blobPos).add(new THREE.Vector3(0, 0.6, 0));
            this.accelArrow.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                this.physicsDisplay.acceleration.clone().normalize()
            );
            this.accelArrow.scale.setScalar(accelMag * 0.02);
        } else {
            this.accelArrow.visible = false;
        }

        // Turn bulge arrow (red) - points in bulge direction
        if (this.physicsDisplay.turnBulge > 0.02) {
            this.bulgeArrow.visible = true;
            this.bulgeArrow.position.copy(blobPos).add(new THREE.Vector3(0, 0.2, 0));
            const bulgeDir = this.physicsDisplay.turnBulgeDir.clone();
            if (bulgeDir.lengthSq() > 0.01) {
                this.bulgeArrow.quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 0, 1),
                    bulgeDir.normalize()
                );
            }
            this.bulgeArrow.scale.setScalar(this.physicsDisplay.turnBulge * 2);
        } else {
            this.bulgeArrow.visible = false;
        }
    }

    updatePhysicsDisplay() {
        const el = document.getElementById('physics-data');
        if (!el) return;

        const v = this.physicsDisplay.velocity;
        const a = this.physicsDisplay.acceleration;
        const bd = this.physicsDisplay.turnBulgeDir;

        el.innerHTML = `
<b>Velocity:</b> (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})
  <span style="color:#44ff44">mag: ${v.length().toFixed(2)}</span>

<b>Acceleration:</b> (${a.x.toFixed(2)}, ${a.y.toFixed(2)}, ${a.z.toFixed(2)})
  <span style="color:#ffff44">mag: ${a.length().toFixed(2)}</span>

<b>Ground Sag:</b> ${this.physicsDisplay.groundSag.toFixed(3)}
  <span style="color:#8888ff">${this.isGrounded ? 'GROUNDED' : 'AIRBORNE'}</span>

<b>Turn Bulge:</b> ${this.physicsDisplay.turnBulge.toFixed(3)}
  dir: (${bd.x.toFixed(2)}, ${bd.z.toFixed(2)})
  <span style="color:#ff4444">${this.physicsDisplay.turnBulge > 0.05 ? 'BULGING' : 'none'}</span>

<b>Scenario:</b> ${this.activeScenario || 'Manual Control'}
        `;
    }

    // === TEST SCENARIOS ===

    updateScenario(delta) {
        this.scenarioTimer += delta;

        switch (this.activeScenario) {
            case 'circleLeft':
                this.runCircleScenario(delta, 1);
                break;
            case 'circleRight':
                this.runCircleScenario(delta, -1);
                break;
            case 'zigzag':
                this.runZigzagScenario(delta);
                break;
            case 'strafeLeft':
                this.runStrafeScenario(delta, 1);
                break;
            case 'strafeRight':
                this.runStrafeScenario(delta, -1);
                break;
            case 'jumpLand':
                this.runJumpScenario(delta);
                break;
            case 'slideForward':
                this.runSlideScenario(delta);
                break;
            case 'impact':
                this.runImpactScenario(delta);
                break;
        }
    }

    runCircleScenario(delta, direction) {
        // Run in a circle to test centrifugal bulge
        const radius = 3;
        const speed = 2;
        const angle = this.scenarioTimer * speed * direction;

        // Calculate position on circle
        const targetX = Math.cos(angle) * radius;
        const targetZ = Math.sin(angle) * radius;

        // Calculate tangent velocity (perpendicular to radius)
        const tangentX = -Math.sin(angle) * 5 * direction;
        const tangentZ = Math.cos(angle) * 5 * direction;

        // Smooth toward target position
        this.position.x = THREE.MathUtils.lerp(this.position.x, targetX, 5 * delta);
        this.position.z = THREE.MathUtils.lerp(this.position.z, targetZ, 5 * delta);

        // Set velocity to tangent direction
        this.velocity.x = tangentX;
        this.velocity.z = tangentZ;

        // End after 2 full circles
        if (this.scenarioTimer > Math.PI * 4 / speed) {
            this.endScenario();
        }
    }

    runZigzagScenario(delta) {
        // Alternating left/right movement
        const period = 1.5;
        const phase = Math.floor(this.scenarioTimer / period) % 2;

        const targetVelX = phase === 0 ? 5 : -5;
        this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, 10 * delta);
        this.velocity.z = -3;

        this.position.addScaledVector(this.velocity, delta);

        // End after 8 zigzags
        if (this.scenarioTimer > period * 8) {
            this.endScenario();
        }
    }

    runStrafeScenario(delta, direction) {
        // Move forward while strafing sideways
        const forwardSpeed = 4;
        const strafeSpeed = 3 * direction;

        this.velocity.z = -forwardSpeed;
        this.velocity.x = strafeSpeed;

        this.position.addScaledVector(this.velocity, delta);

        // End after 3 seconds
        if (this.scenarioTimer > 3) {
            this.endScenario();
        }
    }

    runJumpScenario(delta) {
        const phase = this.scenarioPhase;

        if (phase === 0) {
            // Move forward
            this.velocity.z = -3;
            this.position.addScaledVector(this.velocity, delta);

            if (this.scenarioTimer > 1) {
                this.scenarioPhase = 1;
            }
        } else if (phase === 1) {
            // Jump
            this.velocity.y = 8;
            this.isGrounded = false;
            this.scenarioPhase = 2;
        } else if (phase === 2) {
            // In air
            this.velocity.y -= 25 * delta;
            this.position.addScaledVector(this.velocity, delta);

            if (this.position.y < 0.5) {
                this.position.y = 0.5;
                this.velocity.y = 0;
                this.isGrounded = true;
                this.scenarioPhase = 3;
            }
        } else if (phase === 3) {
            // Land recovery
            if (this.scenarioTimer > 3) {
                this.endScenario();
            }
        }
    }

    runSlideScenario(delta) {
        // Fast forward slide
        const slideSpeed = 10;

        if (this.scenarioTimer < 0.5) {
            // Accelerate
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, -slideSpeed, 8 * delta);
        } else if (this.scenarioTimer < 1.0) {
            // Maintain slide speed
            this.velocity.z = -slideSpeed * 0.8;
        } else {
            // Decelerate
            this.velocity.z *= 0.9;
        }

        this.position.addScaledVector(this.velocity, delta);

        if (this.scenarioTimer > 2) {
            this.endScenario();
        }
    }

    runImpactScenario(delta) {
        if (this.scenarioPhase === 0) {
            // Trigger impact
            this.blob.applyImpact(new THREE.Vector3(1, 0, 0), 0.6);
            this.scenarioPhase = 1;
        }

        // Wait for wobble to settle
        if (this.scenarioTimer > 3) {
            this.endScenario();
        }
    }

    endScenario() {
        this.activeScenario = null;
        this.scenarioTimer = 0;
        this.scenarioPhase = 0;
    }

    // === PUBLIC API (for Playwright testing) ===

    getPhysicsState() {
        return {
            position: this.position.clone(),
            velocity: this.velocity.clone(),
            acceleration: this.physics ? this.physics.smoothedAcceleration.clone() : new THREE.Vector3(),
            isGrounded: this.isGrounded,
            groundSag: this.physics ? this.physics.currentGroundSag : 0,
            turnBulge: this.physics ? this.physics.turnBulgeAmount : 0,
            turnBulgeDir: this.physics ? this.physics.turnBulgeDir.clone() : new THREE.Vector3(),
            deformation: this.physics ? this.physics.deformation : 0,
            wobbleAmplitude: this.physics ? this.physics.wobbleAmplitude : 0
        };
    }

    // Start a test scenario
    startScenario(name) {
        this.activeScenario = name;
        this.scenarioTimer = 0;
        this.scenarioPhase = 0;
        this.position.set(0, 0.5, 0);
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
    }

    // Reset to initial state
    reset() {
        this.position.set(0, 0.5, 0);
        this.velocity.set(0, 0, 0);
        this.targetVelocity.set(0, 0, 0);
        this.isGrounded = true;
        this.yaw = 0;
        this.activeScenario = null;
        this.scenarioTimer = 0;
        this.scenarioPhase = 0;

        // Reset physics
        if (this.physics) {
            this.physics.prevVelocity.set(0, 0, 0);
            this.physics.currentVelocity.set(0, 0, 0);
            this.physics.acceleration.set(0, 0, 0);
            this.physics.smoothedAcceleration.set(0, 0, 0);
            this.physics.turnBulgeAmount = 0;
            this.physics.currentGroundSag = 0;
        }

        this.blob.group.position.copy(this.position);
    }
}

// Initialize test environment
const test = new BlobPhysicsTest();

// Global functions for HTML buttons
window.testScenario = (name) => test.startScenario(name);
window.resetTest = () => test.reset();

// === SLIDER SYSTEM ===

// Default values for all physics parameters (user tuned)
const DEFAULTS = {
    groundSag: 0.34,
    groundSagSmoothing: 11,
    bulgeThreshold: 6,
    bulgeMultiplier: 0.08,
    bulgeMax: 0.5,
    bulgeLerp: 18,
    bulgeDirLerp: 6,
    bulgeDecay: 0.38,
    wobbleFreq: 50,
    wobbleStrength: 0.095,
    wobbleDecay: 0.55,
    stretchAmount: 0.2,
    stretchSmooth: 11
};

// Current tuning values (exposed for physics to read)
window.physicsTuning = { ...DEFAULTS };

// Setup slider event listeners
function setupSliders() {
    const sliderIds = Object.keys(DEFAULTS);

    sliderIds.forEach(id => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(`${id}-val`);

        if (slider && valueSpan) {
            // Set initial value
            slider.value = DEFAULTS[id];
            valueSpan.textContent = formatValue(id, DEFAULTS[id]);

            // Add change listener
            slider.addEventListener('input', () => {
                const val = parseFloat(slider.value);
                window.physicsTuning[id] = val;
                valueSpan.textContent = formatValue(id, val);
                applyTuning();
            });
        }
    });
}

// Format value for display
function formatValue(id, val) {
    if (id.includes('Multiplier') || id === 'wobbleStrength') {
        return val.toFixed(3);
    } else if (id.includes('Decay') || id === 'stretchAmount' || id === 'groundSag' || id === 'bulgeMax' || id === 'bulgeThreshold') {
        return val.toFixed(2);
    } else if (Number.isInteger(val)) {
        return val.toString();
    } else {
        return val.toFixed(1);
    }
}

// Apply current tuning to physics system
function applyTuning() {
    const physics = test.physics;
    if (!physics) return;

    const t = window.physicsTuning;

    // Ground sag (flatten when standing)
    physics.config.groundSag = t.groundSag;
    physics.config.groundSagSmoothing = t.groundSagSmoothing;

    // Impact wobble (after hits/jumps)
    physics.config.wobbleFrequency = t.wobbleFreq;
    physics.config.wobbleDecay = t.wobbleDecay;

    // Movement elongation (stretch when moving)
    physics.config.movementStretch = t.stretchAmount;
    physics.config.stretchSmoothing = t.stretchSmooth;

    // Turn bulge params (mass shifts when turning)
    physics.tuning = {
        bulgeThreshold: t.bulgeThreshold,
        bulgeMultiplier: t.bulgeMultiplier,
        bulgeMax: t.bulgeMax,
        bulgeLerp: t.bulgeLerp,
        bulgeDirLerp: t.bulgeDirLerp,
        bulgeDecay: t.bulgeDecay
    };

    // Organic jiggle (ambient wobble) - goes to shader
    if (test.blob && test.blob.bubbleMesh && test.blob.bubbleMesh.material) {
        test.blob.bubbleMesh.material.uniforms.uWobbleStrength.value = t.wobbleStrength;
    }
}

// Reset sliders to defaults
window.resetSliders = () => {
    Object.keys(DEFAULTS).forEach(id => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(`${id}-val`);
        if (slider && valueSpan) {
            slider.value = DEFAULTS[id];
            valueSpan.textContent = formatValue(id, DEFAULTS[id]);
            window.physicsTuning[id] = DEFAULTS[id];
        }
    });
    applyTuning();
};

// Copy current config to clipboard as code
window.copyConfig = () => {
    const t = window.physicsTuning;
    const code = `// Blob Physics Config
export const TUNED_PHYSICS = {
    // Ground Flatten
    groundSag: ${t.groundSag},
    groundSagSmoothing: ${t.groundSagSmoothing},

    // Turn Bulge (centrifugal)
    bulgeThreshold: ${t.bulgeThreshold},
    bulgeMultiplier: ${t.bulgeMultiplier},
    bulgeMax: ${t.bulgeMax},
    bulgeLerp: ${t.bulgeLerp},
    bulgeDirLerp: ${t.bulgeDirLerp},
    bulgeDecay: ${t.bulgeDecay},

    // Wobble
    wobbleFrequency: ${t.wobbleFreq},
    wobbleStrength: ${t.wobbleStrength},
    wobbleDecay: ${t.wobbleDecay},

    // Movement Stretch
    movementStretch: ${t.stretchAmount},
    stretchSmoothing: ${t.stretchSmooth}
};`;
    navigator.clipboard.writeText(code).then(() => {
        alert('Config copied to clipboard as code!');
    });
};

// Initialize sliders on load
setTimeout(() => {
    setupSliders();
    applyTuning();
}, 100);
