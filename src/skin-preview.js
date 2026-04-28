// skin-preview.js - POC for AI-generated watercolor character skins
// Demonstrates the triplanar projection system with various watercolor textures

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { modelManager } from './systems/model-manager.js';
import { TextureManager } from './systems/texture-manager.js';
import { AnimationStateMachine, ANIMATION_STATES } from './character/animation-state-machine.js';
import { animationLoader } from './systems/animation-loader.js';

// Body variant definitions - bone scaling for different silhouettes
const BODY_VARIANTS = {
    // Default humanoid proportions
    standard: {
        spine: { x: 1.0, y: 1.0, z: 1.0 },
        chest: { x: 1.0, y: 1.0, z: 1.0 },
        head: { x: 1.0, y: 1.0, z: 1.0 },
        arms: { x: 1.0, y: 1.0, z: 1.0 },
        legs: { x: 1.0, y: 1.0, z: 1.0 }
    },
    // Shade: Elongated, ghostly - thin and tall
    shade: {
        spine: { x: 0.85, y: 1.15, z: 0.85 },
        chest: { x: 0.8, y: 1.1, z: 0.8 },
        head: { x: 0.9, y: 1.1, z: 0.9 },
        arms: { x: 0.8, y: 1.2, z: 0.8 },
        legs: { x: 0.85, y: 1.15, z: 0.85 }
    },
    // Crimson Wraith: Wide, aggressive - bulky upper body
    crimson: {
        spine: { x: 1.2, y: 0.95, z: 1.15 },
        chest: { x: 1.35, y: 1.0, z: 1.3 },
        head: { x: 1.1, y: 0.95, z: 1.1 },
        arms: { x: 1.25, y: 1.0, z: 1.25 },
        legs: { x: 1.1, y: 0.95, z: 1.1 }
    },
    // Azure Phantom: Tall, ethereal - elongated limbs
    azure: {
        spine: { x: 0.9, y: 1.1, z: 0.9 },
        chest: { x: 0.85, y: 1.05, z: 0.85 },
        head: { x: 0.95, y: 1.15, z: 0.95 },
        arms: { x: 0.85, y: 1.25, z: 0.85 },
        legs: { x: 0.9, y: 1.2, z: 0.9 }
    },
    // Verdant Slime: Chunky, blobby - wide and squat
    verdant: {
        spine: { x: 1.4, y: 0.85, z: 1.4 },
        chest: { x: 1.5, y: 0.9, z: 1.5 },
        head: { x: 1.3, y: 0.9, z: 1.3 },
        arms: { x: 1.3, y: 0.85, z: 1.3 },
        legs: { x: 1.4, y: 0.8, z: 1.4 }
    },
    // Guardian: Imposing, broad - heroic proportions
    guardian: {
        spine: { x: 1.15, y: 1.05, z: 1.1 },
        chest: { x: 1.3, y: 1.1, z: 1.2 },
        head: { x: 1.05, y: 1.0, z: 1.05 },
        arms: { x: 1.2, y: 1.1, z: 1.2 },
        legs: { x: 1.15, y: 1.05, z: 1.15 }
    }
};

// Skin definitions with watercolor textures and body variants
const SKINS = [
    {
        id: 'player',
        name: 'Mage',
        texture: 'player',
        tint: 0x6688aa,
        preview: '/assets/sprites/player-character.png',
        bodyVariant: 'standard'
    },
    {
        id: 'shade',
        name: 'Shade',
        texture: 'shade',
        tint: 0x666688,
        preview: '/assets/sprites/color-shade.png',
        bodyVariant: 'shade'
    },
    {
        id: 'crimson',
        name: 'Crimson',
        texture: 'crimsonWraith',
        tint: 0xcc4444,
        preview: '/assets/sprites/crimson-wraith.png',
        bodyVariant: 'crimson'
    },
    {
        id: 'azure',
        name: 'Azure',
        texture: 'azurePhantom',
        tint: 0x4488cc,
        preview: '/assets/sprites/azure-phantom.png',
        bodyVariant: 'azure'
    },
    {
        id: 'verdant',
        name: 'Verdant',
        texture: 'verdantSlime',
        tint: 0x44aa44,
        preview: '/assets/sprites/verdant-slime.png',
        bodyVariant: 'verdant'
    },
    {
        id: 'guardian',
        name: 'Guardian',
        texture: 'chromaticGuardian',
        tint: 0xffaa44,
        preview: '/assets/sprites/chromatic-guardian.png',
        bodyVariant: 'guardian'
    }
];

class SkinPreview {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        this.model = null;
        this.mixer = null;
        this.animationStateMachine = null;

        this.currentSkin = SKINS[0];
        this.materialParams = {
            edgeSoftness: 0.5,
            bottomBleed: 0.4,
            tintStrength: 0.25
        };

        this.init();
    }

    async init() {
        this.setupScene();
        this.setupUI();
        await this.loadModel();
        await this.applySkin(this.currentSkin);
        this.animate();
        this.updateStatus('Ready - Click a skin to preview');
    }

    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a3a);

        // Camera
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.2, 3);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0.9, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.update();

        // Lighting - soft for watercolor look
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xfff8f0, 0.8);
        keyLight.position.set(3, 5, 3);
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xf0f0ff, 0.3);
        fillLight.position.set(-3, 2, -2);
        this.scene.add(fillLight);

        // Floor with subtle grid
        const floorGeom = new THREE.CircleGeometry(3, 64);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a4a,
            roughness: 0.9
        });
        const floor = new THREE.Mesh(floorGeom, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    setupUI() {
        // Create skin buttons
        const container = document.getElementById('skin-buttons');
        SKINS.forEach(skin => {
            const btn = document.createElement('button');
            btn.className = 'skin-btn' + (skin.id === this.currentSkin.id ? ' active' : '');
            btn.innerHTML = `
                <div class="preview" style="background-image: url('${skin.preview}')"></div>
                <span class="color-dot" style="background: #${skin.tint.toString(16).padStart(6, '0')}"></span>
                ${skin.name}
            `;
            btn.onclick = () => this.selectSkin(skin);
            container.appendChild(btn);
        });

        // Sliders
        document.getElementById('edge-softness').oninput = (e) => {
            this.materialParams.edgeSoftness = parseFloat(e.target.value);
            document.getElementById('edge-val').textContent = e.target.value;
            this.updateMaterial();
        };

        document.getElementById('bottom-bleed').oninput = (e) => {
            this.materialParams.bottomBleed = parseFloat(e.target.value);
            document.getElementById('bleed-val').textContent = e.target.value;
            this.updateMaterial();
        };

        document.getElementById('tint-strength').oninput = (e) => {
            this.materialParams.tintStrength = parseFloat(e.target.value);
            document.getElementById('tint-val').textContent = e.target.value;
            this.updateMaterial();
        };
    }

    async loadModel() {
        this.updateStatus('Loading model...');

        try {
            const result = await modelManager.loadModel('/models/humanoid-animated.fbx');

            if (result && result.scene) {
                this.model = result.scene;

                // Scale to fit
                const box = new THREE.Box3().setFromObject(this.model);
                const height = box.max.y - box.min.y;
                const scale = 1.8 / height;
                this.model.scale.setScalar(scale);
                this.model.position.y = 0;

                this.scene.add(this.model);

                // Setup animations
                if (result.animations && result.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.model);
                    this.animationStateMachine = new AnimationStateMachine(this.mixer);
                    this.animationStateMachine.registerFromClips(result.animations);

                    // Load additional animations
                    await animationLoader.loadPlayerAnimations(this.animationStateMachine, this.mixer);
                }

                this.updateStatus('Model loaded');
            }
        } catch (error) {
            console.error('Failed to load model:', error);
            this.updateStatus('Error loading model');
        }
    }

    async applySkin(skin) {
        if (!this.model) return;

        this.updateStatus(`Applying ${skin.name} skin...`);

        try {
            // Apply body variant (bone scaling) first
            this.applyBodyVariant(skin.bodyVariant || 'standard');

            // Load texture using the texture manager
            const texture = await TextureManager.getTexture(skin.texture);

            if (texture) {
                // Create watercolor material with triplanar projection
                const material = this.createWatercolorMaterial(texture, skin.tint);

                // Apply to all meshes
                this.model.traverse(child => {
                    if (child.isMesh) {
                        child.material = material;
                    }
                });

                this.currentMaterial = material;
                this.updateStatus(`${skin.name} skin applied`);
            } else {
                // Fallback to tinted standard material with emissive glow
                console.log(`No texture for ${skin.texture}, using tinted material`);
                const material = new THREE.MeshStandardMaterial({
                    color: skin.tint,
                    roughness: 0.6,
                    metalness: 0.1,
                    emissive: skin.tint,
                    emissiveIntensity: 0.15
                });

                this.model.traverse(child => {
                    if (child.isMesh) {
                        child.material = material;
                    }
                });

                this.currentMaterial = null; // No shader uniforms to update
                this.updateStatus(`${skin.name} (tinted - no texture)`);
            }
        } catch (error) {
            console.error('Failed to apply skin:', error);
            this.updateStatus('Error: ' + error.message);
        }
    }

    applyBodyVariant(variantName) {
        const variant = BODY_VARIANTS[variantName] || BODY_VARIANTS.standard;

        // Bone name mappings for Mixamo skeleton
        const boneGroups = {
            spine: ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'],
            chest: ['mixamorigSpine2'], // Upper spine is chest
            head: ['mixamorigHead', 'mixamorigNeck'],
            arms: [
                'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
                'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand'
            ],
            legs: [
                'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase',
                'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase'
            ]
        };

        // Apply scaling to bones
        this.model.traverse(child => {
            if (child.isBone) {
                const boneName = child.name;

                // Find which group this bone belongs to
                for (const [groupName, boneNames] of Object.entries(boneGroups)) {
                    if (boneNames.includes(boneName)) {
                        const scale = variant[groupName];
                        if (scale) {
                            child.scale.set(scale.x, scale.y, scale.z);
                        }
                        break;
                    }
                }
            }
        });

        console.log(`Applied body variant: ${variantName}`);
    }

    createWatercolorMaterial(texture, tintColor) {
        // Custom shader for watercolor effect with triplanar projection
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: texture },
                uTint: { value: new THREE.Color(tintColor) },
                uTintStrength: { value: this.materialParams.tintStrength },
                uEdgeSoftness: { value: this.materialParams.edgeSoftness },
                uBottomBleed: { value: this.materialParams.bottomBleed },
                uTime: { value: 0 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;
                varying vec2 vUv;
                varying float vHeight;

                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vUv = uv;

                    // Normalized height (0 = bottom, 1 = top)
                    vHeight = (position.y + 1.0) / 2.0;

                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                uniform vec3 uTint;
                uniform float uTintStrength;
                uniform float uEdgeSoftness;
                uniform float uBottomBleed;
                uniform float uTime;

                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;
                varying vec2 vUv;
                varying float vHeight;

                // Simple noise for organic edges
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                        f.y
                    );
                }

                void main() {
                    // Triplanar projection - favor front view
                    vec3 blend = abs(vWorldNormal);
                    blend = pow(blend, vec3(4.0)); // Sharp blend
                    blend /= (blend.x + blend.y + blend.z);

                    // Front projection (Z axis) - main view
                    vec2 uvFront = vWorldPosition.xy * 0.5 + 0.5;
                    uvFront.y = 1.0 - uvFront.y; // Flip Y

                    // Side projection (X axis)
                    vec2 uvSide = vWorldPosition.zy * 0.5 + 0.5;
                    uvSide.y = 1.0 - uvSide.y;

                    // Top projection (Y axis)
                    vec2 uvTop = vWorldPosition.xz * 0.5 + 0.5;

                    // Sample texture from each direction
                    vec4 texFront = texture2D(uTexture, uvFront);
                    vec4 texSide = texture2D(uTexture, uvSide);
                    vec4 texTop = texture2D(uTexture, uvTop);

                    // Blend with front dominance
                    float frontWeight = 2.5;
                    vec4 texColor = (
                        texFront * blend.z * frontWeight +
                        texSide * blend.x +
                        texTop * blend.y
                    ) / (blend.z * frontWeight + blend.x + blend.y);

                    // Apply tint
                    vec3 tinted = mix(texColor.rgb, texColor.rgb * uTint, uTintStrength);

                    // Edge softness (fresnel-like)
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    float fresnel = 1.0 - abs(dot(viewDir, vWorldNormal));
                    float edgeFade = smoothstep(0.0, uEdgeSoftness, 1.0 - fresnel);

                    // Bottom bleed effect
                    float bleedNoise = noise(vWorldPosition.xz * 10.0) * 0.3;
                    float bottomFade = smoothstep(0.0, uBottomBleed + bleedNoise, vHeight);

                    // Combine alpha
                    float alpha = texColor.a * edgeFade * bottomFade;

                    // Simple lighting
                    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
                    float diffuse = max(dot(vWorldNormal, lightDir), 0.0) * 0.4 + 0.6;

                    gl_FragColor = vec4(tinted * diffuse, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        return material;
    }

    updateMaterial() {
        if (this.currentMaterial && this.currentMaterial.uniforms) {
            this.currentMaterial.uniforms.uEdgeSoftness.value = this.materialParams.edgeSoftness;
            this.currentMaterial.uniforms.uBottomBleed.value = this.materialParams.bottomBleed;
            this.currentMaterial.uniforms.uTintStrength.value = this.materialParams.tintStrength;
        }
    }

    selectSkin(skin) {
        this.currentSkin = skin;

        // Update UI - only select skin buttons, not animation buttons
        document.querySelectorAll('#skin-buttons .skin-btn').forEach((btn, i) => {
            btn.classList.toggle('active', SKINS[i].id === skin.id);
        });

        this.applySkin(skin);
    }

    setAnimation(name) {
        if (this.animationStateMachine) {
            const state = ANIMATION_STATES[name.toUpperCase()] || name;
            this.animationStateMachine.transitionTo(state, true);
            this.updateStatus(`Animation: ${name}`);
        }
    }

    updateStatus(msg) {
        document.getElementById('status').textContent = msg;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update animations
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Update material time
        if (this.currentMaterial && this.currentMaterial.uniforms) {
            this.currentMaterial.uniforms.uTime.value += delta;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize
const skinPreview = new SkinPreview();
window.skinPreview = skinPreview;
