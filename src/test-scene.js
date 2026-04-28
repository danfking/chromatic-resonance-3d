// test-scene.js - Isolated animation test environment
// A blank canvas with just the player model for accurate visual testing

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { modelManager } from './systems/model-manager.js';
import { AnimationStateMachine, ANIMATION_STATES } from './character/animation-state-machine.js';
import { animationLoader } from './systems/animation-loader.js';

class AnimationTestScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        // Character
        this.model = null;
        this.mixer = null;
        this.animationStateMachine = null;

        // Wand
        this.wandMesh = null;

        // Test state
        this.currentAction = 'idle';
        this.actionQueue = [];

        // UI elements
        this.stateDisplay = null;
        this.actionButtons = null;

        this.init();
    }

    async init() {
        // Create scene with neutral background
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x404040); // Neutral gray

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.5, 3);

        // Renderer - NO post-processing for clean comparison
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1); // Consistent pixel ratio for tests
        document.body.appendChild(this.renderer.domElement);

        // Orbit controls for manual inspection
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1, 0);
        this.controls.update();

        // Simple lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        // Floor grid for reference
        const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
        this.scene.add(gridHelper);

        // Floor plane
        const floorGeom = new THREE.PlaneGeometry(10, 10);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const floor = new THREE.Mesh(floorGeom, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.01;
        this.scene.add(floor);

        // Load character model
        await this.loadCharacter();

        // Create UI
        this.createUI();

        // Start render loop
        this.animate();

        // Expose for testing
        window.testScene = this;

        console.log('Animation Test Scene initialized');
        console.log('Access via window.testScene');
    }

    async loadCharacter() {
        try {
            const result = await modelManager.loadModel('/models/humanoid-animated.fbx');

            if (result && result.scene) {
                this.model = result.scene;
                this.model.position.set(0, 0, 0);
                this.model.scale.setScalar(0.01); // Scale down FBX
                this.scene.add(this.model);

                // Setup animation mixer
                this.mixer = new THREE.AnimationMixer(this.model);

                // Setup animation state machine
                this.animationStateMachine = new AnimationStateMachine(this.mixer);

                // Register base animations from the model
                if (result.animations && result.animations.length > 0) {
                    this.animationStateMachine.registerFromClips(result.animations);
                }

                // Load additional animations
                await this.loadAdditionalAnimations();

                // Find hand bone and attach wand
                this.attachWand();

                console.log('Character loaded successfully');
            }
        } catch (error) {
            console.error('Failed to load character:', error);
            // Create placeholder
            this.createPlaceholderCharacter();
        }
    }

    async loadAdditionalAnimations() {
        if (!this.animationStateMachine || !this.mixer) return;

        try {
            const results = await animationLoader.loadPlayerAnimations(
                this.animationStateMachine,
                this.mixer
            );
            console.log('Additional animations loaded:', results);
        } catch (error) {
            console.warn('Could not load additional animations:', error);
        }
    }

    attachWand() {
        if (!this.model) return;

        // Find right hand bone
        let handBone = null;
        this.model.traverse((child) => {
            if (child.isBone && child.name.toLowerCase().includes('righthand')) {
                handBone = child;
            }
        });

        if (!handBone) {
            console.warn('Right hand bone not found');
            return;
        }

        // Create simple wand
        const wandGroup = new THREE.Group();

        // Shaft
        const shaftGeom = new THREE.CylinderGeometry(0.015, 0.02, 0.35, 8);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
        const shaft = new THREE.Mesh(shaftGeom, shaftMat);
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = 0.175;
        wandGroup.add(shaft);

        // Tip (glowing)
        const tipGeom = new THREE.SphereGeometry(0.025, 8, 8);
        const tipMat = new THREE.MeshStandardMaterial({
            color: 0x88aaff,
            emissive: 0x88aaff,
            emissiveIntensity: 0.5
        });
        const tip = new THREE.Mesh(tipGeom, tipMat);
        tip.position.z = 0.35;
        wandGroup.add(tip);

        // Attach to hand
        handBone.add(wandGroup);
        wandGroup.position.set(0.02, 0.05, 0);
        wandGroup.rotation.set(0, 0, -Math.PI / 6);

        this.wandMesh = {
            group: wandGroup,
            tip: tip,
            tipMat: tipMat,
            originalZ: wandGroup.position.z,
            casting: false,
            castTime: 0,
            setTipGlow: (intensity) => {
                tipMat.emissiveIntensity = intensity;
            },
            triggerCast: () => {
                this.wandMesh.casting = true;
                this.wandMesh.castTime = 0;
                tipMat.emissiveIntensity = 3.0;
                tip.scale.setScalar(2.0);
            },
            update: (delta) => {
                if (!this.wandMesh.casting) return;

                this.wandMesh.castTime += delta;
                const duration = 0.15;
                const t = this.wandMesh.castTime / duration;

                if (t < 1.0) {
                    // Recoil animation
                    const recoil = Math.sin(t * Math.PI) * 0.08;
                    wandGroup.position.z = this.wandMesh.originalZ - recoil;
                    tip.scale.setScalar(2.0 - t);
                    tipMat.emissiveIntensity = 3.0 - t * 2.5;
                } else {
                    // Reset
                    this.wandMesh.casting = false;
                    wandGroup.position.z = this.wandMesh.originalZ;
                    tip.scale.setScalar(1.0);
                    tipMat.emissiveIntensity = 0.5;
                }
            }
        };

        console.log('Wand attached to hand');
    }

    createPlaceholderCharacter() {
        // Simple capsule placeholder
        const group = new THREE.Group();

        const bodyGeom = new THREE.CapsuleGeometry(0.3, 1, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4488ff });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 1;
        group.add(body);

        const headGeom = new THREE.SphereGeometry(0.2, 16, 16);
        const head = new THREE.Mesh(headGeom, bodyMat);
        head.position.y = 1.8;
        group.add(head);

        this.model = group;
        this.scene.add(group);
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'test-ui';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px;
            font-family: monospace;
            font-size: 14px;
            border-radius: 8px;
            z-index: 1000;
        `;

        // State display
        this.stateDisplay = document.createElement('div');
        this.stateDisplay.innerHTML = `
            <div style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">Animation Test Scene</div>
            <div id="current-state">State: idle</div>
            <div id="wand-state">Wand: ready</div>
        `;
        container.appendChild(this.stateDisplay);

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '15px';

        const actions = [
            { label: 'Idle', action: 'idle' },
            { label: 'Walk', action: 'walk' },
            { label: 'Run', action: 'run' },
            { label: 'Jump', action: 'jump' },
            { label: 'Cast Wand', action: 'cast' }
        ];

        actions.forEach(({ label, action }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `
                margin: 2px;
                padding: 8px 12px;
                cursor: pointer;
                background: #444;
                color: white;
                border: 1px solid #666;
                border-radius: 4px;
            `;
            btn.onclick = () => this.triggerAction(action);
            buttonContainer.appendChild(btn);
        });

        container.appendChild(buttonContainer);

        // Instructions
        const instructions = document.createElement('div');
        instructions.style.cssText = 'margin-top: 15px; font-size: 12px; color: #aaa;';
        instructions.innerHTML = `
            <div>Drag to orbit camera</div>
            <div>Scroll to zoom</div>
            <div style="margin-top: 5px;">window.testScene.triggerAction('cast')</div>
        `;
        container.appendChild(instructions);

        document.body.appendChild(container);
    }

    triggerAction(action) {
        console.log(`Triggering action: ${action}`);

        switch (action) {
            case 'idle':
                if (this.animationStateMachine) {
                    this.animationStateMachine.transitionTo(ANIMATION_STATES.IDLE);
                }
                this.currentAction = 'idle';
                break;

            case 'walk':
                if (this.animationStateMachine) {
                    this.animationStateMachine.transitionTo(ANIMATION_STATES.WALK);
                }
                this.currentAction = 'walk';
                break;

            case 'run':
                if (this.animationStateMachine) {
                    this.animationStateMachine.transitionTo(ANIMATION_STATES.RUN);
                }
                this.currentAction = 'run';
                break;

            case 'jump':
                if (this.animationStateMachine) {
                    this.animationStateMachine.transitionTo(ANIMATION_STATES.JUMP);
                    // Return to idle after jump
                    setTimeout(() => {
                        this.animationStateMachine.transitionTo(ANIMATION_STATES.IDLE);
                        this.currentAction = 'idle';
                    }, 1000);
                }
                this.currentAction = 'jump';
                break;

            case 'cast':
                if (this.wandMesh) {
                    this.wandMesh.triggerCast();
                }
                break;
        }

        this.updateStateDisplay();
    }

    updateStateDisplay() {
        const stateEl = document.getElementById('current-state');
        const wandEl = document.getElementById('wand-state');

        if (stateEl) {
            const state = this.animationStateMachine?.currentState || this.currentAction;
            stateEl.textContent = `State: ${state}`;
        }

        if (wandEl) {
            const casting = this.wandMesh?.casting ? 'CASTING' : 'ready';
            wandEl.textContent = `Wand: ${casting}`;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Update wand animation
        if (this.wandMesh) {
            this.wandMesh.update(delta);
        }

        // Update controls
        this.controls.update();

        // Update state display
        this.updateStateDisplay();

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    // API for automated testing
    getState() {
        return {
            animationState: this.animationStateMachine?.currentState || 'unknown',
            isCasting: this.wandMesh?.casting || false,
            tipGlow: this.wandMesh?.tipMat?.emissiveIntensity || 0
        };
    }

    getBonePositions() {
        if (!this.model) return null;

        const positions = {};
        this.model.traverse((child) => {
            if (child.isBone) {
                child.updateWorldMatrix(true, false);
                const m = child.matrixWorld.elements;
                positions[child.name] = { x: m[12], y: m[13], z: m[14] };
            }
        });
        return positions;
    }
}

// Auto-start
new AnimationTestScene();
