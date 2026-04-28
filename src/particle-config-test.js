// particle-config-test.js - Test environment for tuning particle behavior

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ParticleLifeCreature } from './creatures/particle-life-creature.js';

// Default config for each particle type
const DEFAULT_CONFIGS = {
    main: {
        speed: 0.06,
        friction: 0.91,
        interactionRadius: 0.65,
        repulsionDist: 0.12,
        repulsionForce: 1.5,
        attractSame: 0.7,
        attractDiff: 0.1,
        attractRandom: 0.3,
        boundaryStart: 0.85,
        boundaryForce: 6,
        particleSize: 0.18,
        particleCount: 70,
        softness: 0.3,
        glow: 0.8,
        coreRadius: 0.8  // main particles use full blob radius
    },
    vitality: {
        speed: 0.15,
        friction: 0.92,
        interactionRadius: 0.4,
        repulsionDist: 0.08,
        repulsionForce: 2.0,
        attractSame: 0.3,
        attractDiff: 0.1,
        attractRandom: 0.4,
        boundaryStart: 0.7,
        boundaryForce: 8,
        particleSize: 0.12,
        particleCount: 30,
        softness: 0.4,
        glow: 0.5,
        coreRadius: 0.4  // vitality stays in inner core
    },
    essence: {
        speed: 0.1,
        friction: 0.95,
        interactionRadius: 0.3,
        repulsionDist: 0.05,
        repulsionForce: 1.0,
        attractSame: 0.2,
        attractDiff: 0.0,
        attractRandom: 0.3,
        boundaryStart: 0.8,
        boundaryForce: 5,
        particleSize: 0.1,
        particleCount: 40,
        softness: 0.0,  // Default to sharp (was missing blur control)
        glow: 0.0,
        coreRadius: 0.6,  // orbital radius
        orbitSpeed: 0.3
    },
    armor: {
        speed: 0.08,
        friction: 0.95,
        interactionRadius: 0.3,
        repulsionDist: 0.1,
        repulsionForce: 3.0,
        attractSame: 0.5,
        attractDiff: -0.2,
        attractRandom: 0.2,
        boundaryStart: 0.9,
        boundaryForce: 10,
        particleSize: 0.1,
        particleCount: 30,
        softness: 0.35,
        glow: 0.6,
        coreRadius: 0.5,  // orbit radius
        orbitSpeed: 0.4
    }
};

class ParticleConfigTest {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.blob = null;

        // Per-type configs
        this.configs = {
            main: { ...DEFAULT_CONFIGS.main },
            vitality: { ...DEFAULT_CONFIGS.vitality },
            essence: { ...DEFAULT_CONFIGS.essence },
            armor: { ...DEFAULT_CONFIGS.armor }
        };

        // Currently selected type
        this.selectedType = 'main';

        // Vitality particle physics data (separate from blob's internal data)
        this.vitalityVelocities = null;
        this.vitalityAttractions = null;

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1, 3);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        // Orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0.5, 0);
        this.controls.enableDamping = true;

        // Lighting
        const ambient = new THREE.AmbientLight(0x404060, 0.6);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(3, 5, 3);
        this.scene.add(directional);

        // Ground plane (subtle)
        const groundGeo = new THREE.PlaneGeometry(10, 10);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x333344,
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // Create blob
        this.createBlob();

        // Setup type tabs and sliders
        this.setupTypeTabs();
        this.setupSliders();
        this.updateSlidersForType();

        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Start loop
        this.lastTime = performance.now();
        this.animate();

        // Expose for testing
        window.particleConfigTest = this;
    }

    createBlob() {
        // Remove old blob if exists
        if (this.blob) {
            this.scene.remove(this.blob.group);
            this.blob.dispose();
        }

        const mainConfig = this.configs.main;

        // Create with max particle count to allow slider to increase
        // Slider max is 200, so create with that capacity
        const maxParticles = 200;

        // Create player-style blob
        this.blob = new ParticleLifeCreature('player', {
            particles: maxParticles,
            radius: 0.4,
            particleSize: mainConfig.particleSize,
            speed: mainConfig.speed
        });

        // Store visible count separately from allocated count
        this.visibleMainCount = mainConfig.particleCount;

        this.blob.group.position.set(0, 0.5, 0);
        this.scene.add(this.blob.group);

        // Set armor to light so we can see it
        this.blob.setArmorTier('light');

        // Initialize vitality velocities for custom physics
        if (this.blob.vitalityPositions) {
            const count = this.blob.maxVitalityParticles || 30;
            this.vitalityVelocities = new Float32Array(count * 3);
            // Initialize with small random velocities
            for (let i = 0; i < count * 3; i++) {
                this.vitalityVelocities[i] = (Math.random() - 0.5) * 0.1;
            }
            // Generate attraction matrix for vitality (single type)
            this.vitalityAttractions = [[this.configs.vitality.attractSame]];
        }

        // Apply current config
        this.applyConfig();

        // Set initial particle visibility based on count config
        this.updateParticleVisibility();
    }

    setupTypeTabs() {
        const tabs = document.querySelectorAll('.type-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active state
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Switch type
                this.selectedType = tab.dataset.type;
                this.updateSlidersForType();
                this.updateTypeSpecificUI();
            });
        });
    }

    updateTypeSpecificUI() {
        const coreRadiusRow = document.getElementById('coreRadius-row');
        const orbitSpeedRow = document.getElementById('orbitSpeed-row');
        const desc = document.getElementById('type-specific-desc');

        if (this.selectedType === 'armor') {
            coreRadiusRow.querySelector('label').textContent = 'Orbit Radius:';
            orbitSpeedRow.style.display = 'flex';
            desc.textContent = 'Orbit radius and speed for armor shell';
        } else if (this.selectedType === 'essence') {
            coreRadiusRow.querySelector('label').textContent = 'Orbit Radius:';
            orbitSpeedRow.style.display = 'flex';
            desc.textContent = 'Orbital shell between core and outer edge';
        } else if (this.selectedType === 'vitality') {
            coreRadiusRow.querySelector('label').textContent = 'Core Radius:';
            orbitSpeedRow.style.display = 'none';
            desc.textContent = 'Health particles stay within this radius';
        } else {
            coreRadiusRow.querySelector('label').textContent = 'Boundary:';
            orbitSpeedRow.style.display = 'none';
            desc.textContent = 'Main particle boundary (usually full blob)';
        }
    }

    updateSlidersForType() {
        const config = this.configs[this.selectedType];
        const sliderIds = [
            'speed', 'friction', 'interactionRadius', 'repulsionDist', 'repulsionForce',
            'attractSame', 'attractDiff', 'attractRandom', 'boundaryStart', 'boundaryForce',
            'particleSize', 'particleCount', 'softness', 'glow', 'coreRadius', 'orbitSpeed'
        ];

        sliderIds.forEach(id => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(`${id}-val`);
            if (slider && valueSpan && config[id] !== undefined) {
                slider.value = config[id];
                valueSpan.textContent = this.formatValue(config[id]);
            }
        });

        this.updateTypeSpecificUI();
    }

    applyConfig() {
        if (!this.blob) return;

        const mainConfig = this.configs.main;
        const vitalityConfig = this.configs.vitality;
        const armorConfig = this.configs.armor;

        // Store main config on blob for update loop
        this.blob.tuning = {
            interactionRadiusMult: mainConfig.interactionRadius,
            repulsionDist: mainConfig.repulsionDist,
            repulsionForce: mainConfig.repulsionForce,
            boundaryStart: mainConfig.boundaryStart,
            boundaryForce: mainConfig.boundaryForce,
            friction: mainConfig.friction
        };

        // Update main speed
        this.blob.speed = mainConfig.speed;

        // Update main particle size
        if (this.blob.particleMesh) {
            const sizes = this.blob.particleMesh.geometry.attributes.size;
            for (let i = 0; i < sizes.count; i++) {
                sizes.array[i] = mainConfig.particleSize * (0.8 + Math.random() * 0.4);
            }
            sizes.needsUpdate = true;

            // Update main particle blur/glow
            if (this.blob.particleMesh.material.uniforms) {
                this.blob.particleMesh.material.uniforms.uSoftness.value = mainConfig.softness;
                this.blob.particleMesh.material.uniforms.uGlow.value = mainConfig.glow;
            }
        }

        // Update main attraction matrix
        this.updateMainAttractionMatrix();

        // Update vitality core radius
        this.blob.vitalityCoreRadius = vitalityConfig.coreRadius * this.blob.radius;

        // Update vitality particle appearance
        if (this.blob.vitalityMesh) {
            const sizes = this.blob.vitalityMesh.geometry.attributes.size;
            if (sizes) {
                for (let i = 0; i < sizes.count; i++) {
                    sizes.array[i] = vitalityConfig.particleSize * (0.8 + Math.random() * 0.4);
                }
                sizes.needsUpdate = true;
            }

            if (this.blob.vitalityMesh.material.uniforms) {
                this.blob.vitalityMesh.material.uniforms.uSoftness.value = vitalityConfig.softness;
                this.blob.vitalityMesh.material.uniforms.uGlow.value = vitalityConfig.glow;
            }
        }

        // Update vitality attractions
        if (this.vitalityAttractions) {
            this.vitalityAttractions[0][0] = vitalityConfig.attractSame;
        }

        // Update armor orbit parameters
        this.blob.armorOrbitRadius = armorConfig.coreRadius * this.blob.radius;
        this.blob.armorOrbitSpeed = armorConfig.orbitSpeed || 0.4;

        // Update armor particle appearance
        if (this.blob.armorMesh) {
            const sizes = this.blob.armorMesh.geometry.attributes.size;
            if (sizes) {
                for (let i = 0; i < sizes.count; i++) {
                    sizes.array[i] = armorConfig.particleSize * (0.8 + Math.random() * 0.4);
                }
                sizes.needsUpdate = true;
            }

            if (this.blob.armorMesh.material.uniforms) {
                this.blob.armorMesh.material.uniforms.uSoftness.value = armorConfig.softness;
                this.blob.armorMesh.material.uniforms.uGlow.value = armorConfig.glow;
            }
        }

        // Update essence particle appearance
        const essenceConfig = this.configs.essence;
        if (this.blob.essenceMesh) {
            const sizes = this.blob.essenceMesh.geometry.attributes.size;
            if (sizes) {
                for (let i = 0; i < sizes.count; i++) {
                    sizes.array[i] = essenceConfig.particleSize * (0.8 + Math.random() * 0.4);
                }
                sizes.needsUpdate = true;
            }

            if (this.blob.essenceMesh.material.uniforms) {
                this.blob.essenceMesh.material.uniforms.uSoftness.value = essenceConfig.softness;
                this.blob.essenceMesh.material.uniforms.uGlow.value = essenceConfig.glow;
            }
        }
    }

    updateMainAttractionMatrix() {
        const c = this.configs.main;
        const types = this.blob.types;

        for (let i = 0; i < types; i++) {
            for (let j = 0; j < types; j++) {
                let attraction = (i === j) ? c.attractSame : c.attractDiff;
                attraction += (Math.random() - 0.5) * c.attractRandom * 2;
                attraction = Math.max(-1, Math.min(1, attraction));
                this.blob.attractions[i][j] = attraction;
            }
        }
    }

    setupSliders() {
        const sliderIds = [
            'speed', 'friction', 'interactionRadius', 'repulsionDist', 'repulsionForce',
            'attractSame', 'attractDiff', 'attractRandom', 'boundaryStart', 'boundaryForce',
            'particleSize', 'particleCount', 'softness', 'glow', 'coreRadius', 'orbitSpeed'
        ];

        sliderIds.forEach(id => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(`${id}-val`);

            if (slider && valueSpan) {
                // Live update on drag
                slider.addEventListener('input', () => {
                    const val = parseFloat(slider.value);
                    this.configs[this.selectedType][id] = val;
                    valueSpan.textContent = this.formatValue(val);

                    // For count changes, update visibility via alpha
                    if (id === 'particleCount') {
                        this.updateParticleVisibility();
                    } else {
                        this.applyConfig();
                    }
                });

                // Recreate blob on count slider release (for accurate particle count)
                if (id === 'particleCount') {
                    slider.addEventListener('change', () => {
                        this.createBlob();
                    });
                }
            }
        });
    }

    updateParticleVisibility() {
        const mainCount = this.configs.main.particleCount;
        const vitalityCount = this.configs.vitality.particleCount;
        const mainSize = this.configs.main.particleSize;
        const vitalitySize = this.configs.vitality.particleSize;

        // Update main particle visibility using size (no alpha attribute)
        if (this.blob.particleMesh) {
            const sizes = this.blob.particleMesh.geometry.attributes.size;
            if (sizes) {
                for (let i = 0; i < sizes.count; i++) {
                    // Visible particles get normal size, hidden get 0
                    sizes.array[i] = i < mainCount ? mainSize * (0.8 + Math.random() * 0.4) : 0;
                }
                sizes.needsUpdate = true;
            }
        }

        // Update vitality particle visibility using alpha (has alpha attribute)
        if (this.blob.vitalityMesh) {
            const alphas = this.blob.vitalityMesh.geometry.attributes.alpha;
            if (alphas) {
                for (let i = 0; i < alphas.count; i++) {
                    alphas.array[i] = i < vitalityCount ? 1.0 : 0.0;
                }
                alphas.needsUpdate = true;
            }
            // Also update the internal count used by update loop
            this.blob.vitalityParticleCount = Math.min(vitalityCount, this.blob.maxVitalityParticles);
        }
    }

    formatValue(val) {
        if (Number.isInteger(val)) return val.toString();
        if (Math.abs(val) < 0.1) return val.toFixed(3);
        return val.toFixed(2);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const delta = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (this.blob) {
            this.updateAllParticles(delta);
        }

        this.controls.update();
        this.updateInfoDisplay();
        this.renderer.render(this.scene, this.camera);
    }

    updateAllParticles(delta) {
        this.blob.time += delta;
        const clampedDelta = Math.min(delta, 0.05);

        // Update main particles
        this.updateMainParticles(clampedDelta);

        // Update vitality particles with custom physics
        this.updateVitalityParticles(clampedDelta);

        // Update armor particles
        this.updateArmorParticles(clampedDelta);

        // Update shader time uniforms
        this.blob.bubbleMesh.material.uniforms.uTime.value = this.blob.time;
        this.blob.particleMesh.material.uniforms.uTime.value = this.blob.time;

        // Update bubble physics
        this.blob.updatePhysics(clampedDelta);
    }

    updateMainParticles(delta) {
        this.blob.buildSpatialGrid();

        const tuning = this.blob.tuning || {};
        const interactionRadius = this.blob.radius * (tuning.interactionRadiusMult || 0.5);
        const repulsionDist = tuning.repulsionDist || 0.08;
        const repulsionForce = tuning.repulsionForce || 3;
        const boundaryStartPct = tuning.boundaryStart || 0.75;
        const boundaryForceMult = tuning.boundaryForce || 5;
        const friction = tuning.friction || 0.97;

        // Only update visible particles
        const visibleCount = this.configs.main.particleCount;

        for (let i = 0; i < visibleCount; i++) {
            const i3 = i * 3;
            const px = this.blob.positions[i3];
            const py = this.blob.positions[i3 + 1];
            const pz = this.blob.positions[i3 + 2];
            const typeA = this.blob.particleTypes[i];

            let fx = 0, fy = 0, fz = 0;
            const neighbors = this.blob.getNeighbors(px, py, pz);

            for (const j of neighbors) {
                if (i === j) continue;

                const j3 = j * 3;
                const dx = this.blob.positions[j3] - px;
                const dy = this.blob.positions[j3 + 1] - py;
                const dz = this.blob.positions[j3 + 2] - pz;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < 0.001 || dist > interactionRadius) continue;

                const typeB = this.blob.particleTypes[j];
                const attraction = this.blob.attractions[typeA][typeB];
                const nx = dx / dist, ny = dy / dist, nz = dz / dist;

                if (dist < repulsionDist) {
                    const repel = (repulsionDist - dist) / repulsionDist * repulsionForce;
                    fx -= nx * repel;
                    fy -= ny * repel;
                    fz -= nz * repel;
                } else {
                    const forceMag = attraction * (1 - dist / interactionRadius);
                    fx += nx * forceMag;
                    fy += ny * forceMag;
                    fz += nz * forceMag;
                }
            }

            // Boundary force
            const distFromCenter = Math.sqrt(px * px + py * py + pz * pz);
            const boundaryStart = this.blob.radius * boundaryStartPct;

            if (distFromCenter > boundaryStart) {
                const pushBack = (distFromCenter - boundaryStart) / (this.blob.radius - boundaryStart);
                const boundaryForce = pushBack * pushBack * boundaryForceMult;
                fx -= (px / distFromCenter) * boundaryForce;
                fy -= (py / distFromCenter) * boundaryForce;
                fz -= (pz / distFromCenter) * boundaryForce;
            }

            // Apply forces
            const forceMult = this.blob.speed * delta * 2;
            this.blob.velocities[i3] += fx * forceMult;
            this.blob.velocities[i3 + 1] += fy * forceMult;
            this.blob.velocities[i3 + 2] += fz * forceMult;

            // Friction
            this.blob.velocities[i3] *= friction;
            this.blob.velocities[i3 + 1] *= friction;
            this.blob.velocities[i3 + 2] *= friction;

            // Update position
            this.blob.positions[i3] += this.blob.velocities[i3] * delta * 60;
            this.blob.positions[i3 + 1] += this.blob.velocities[i3 + 1] * delta * 60;
            this.blob.positions[i3 + 2] += this.blob.velocities[i3 + 2] * delta * 60;
        }

        this.blob.particleMesh.geometry.attributes.position.needsUpdate = true;
    }

    updateVitalityParticles(delta) {
        if (!this.blob.vitalityMesh || !this.blob.vitalityPositions || !this.vitalityVelocities) return;

        const config = this.configs.vitality;
        const coreRadius = config.coreRadius * this.blob.radius;
        const speed = config.speed;
        const friction = config.friction;
        const interactionRadius = config.interactionRadius * this.blob.radius;
        const repulsionDist = config.repulsionDist * this.blob.radius;
        const repulsionForce = config.repulsionForce;
        const boundaryStartPct = config.boundaryStart;
        const boundaryForceMult = config.boundaryForce;
        const attractSame = config.attractSame;

        // Use config count, clamped to max available
        const particleCount = Math.min(config.particleCount, this.blob.maxVitalityParticles || 50);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            let px = this.blob.vitalityPositions[i3];
            let py = this.blob.vitalityPositions[i3 + 1];
            let pz = this.blob.vitalityPositions[i3 + 2];

            let fx = 0, fy = 0, fz = 0;

            // Particle-particle interaction
            for (let j = 0; j < particleCount; j++) {
                if (i === j) continue;

                const j3 = j * 3;
                const dx = this.blob.vitalityPositions[j3] - px;
                const dy = this.blob.vitalityPositions[j3 + 1] - py;
                const dz = this.blob.vitalityPositions[j3 + 2] - pz;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < 0.001 || dist > interactionRadius) continue;

                const nx = dx / dist, ny = dy / dist, nz = dz / dist;

                if (dist < repulsionDist) {
                    const repel = (repulsionDist - dist) / repulsionDist * repulsionForce;
                    fx -= nx * repel;
                    fy -= ny * repel;
                    fz -= nz * repel;
                } else {
                    const forceMag = attractSame * (1 - dist / interactionRadius);
                    fx += nx * forceMag;
                    fy += ny * forceMag;
                    fz += nz * forceMag;
                }
            }

            // Boundary force to keep within core
            const distFromCenter = Math.sqrt(px * px + py * py + pz * pz);
            const boundaryStart = coreRadius * boundaryStartPct;

            if (distFromCenter > boundaryStart && distFromCenter > 0.001) {
                const pushBack = (distFromCenter - boundaryStart) / (coreRadius - boundaryStart + 0.001);
                const boundaryForce = Math.min(pushBack * pushBack * boundaryForceMult, 20);
                fx -= (px / distFromCenter) * boundaryForce;
                fy -= (py / distFromCenter) * boundaryForce;
                fz -= (pz / distFromCenter) * boundaryForce;
            }

            // Random drift
            fx += (Math.random() - 0.5) * 0.5;
            fy += (Math.random() - 0.5) * 0.5;
            fz += (Math.random() - 0.5) * 0.5;

            // Apply forces
            const forceMult = speed * delta * 2;
            this.vitalityVelocities[i3] += fx * forceMult;
            this.vitalityVelocities[i3 + 1] += fy * forceMult;
            this.vitalityVelocities[i3 + 2] += fz * forceMult;

            // Friction
            this.vitalityVelocities[i3] *= friction;
            this.vitalityVelocities[i3 + 1] *= friction;
            this.vitalityVelocities[i3 + 2] *= friction;

            // Update position
            px += this.vitalityVelocities[i3] * delta * 60;
            py += this.vitalityVelocities[i3 + 1] * delta * 60;
            pz += this.vitalityVelocities[i3 + 2] * delta * 60;

            // Hard clamp to core radius
            const newDist = Math.sqrt(px * px + py * py + pz * pz);
            if (newDist > coreRadius) {
                const scale = coreRadius * 0.95 / newDist;
                px *= scale;
                py *= scale;
                pz *= scale;
                // Bounce velocity
                this.vitalityVelocities[i3] *= -0.3;
                this.vitalityVelocities[i3 + 1] *= -0.3;
                this.vitalityVelocities[i3 + 2] *= -0.3;
            }

            this.blob.vitalityPositions[i3] = px;
            this.blob.vitalityPositions[i3 + 1] = py;
            this.blob.vitalityPositions[i3 + 2] = pz;
        }

        this.blob.vitalityMesh.geometry.attributes.position.needsUpdate = true;
        this.blob.vitalityMesh.material.uniforms.uTime.value = this.blob.time;
    }

    updateArmorParticles(delta) {
        if (!this.blob.armorMesh || this.blob.disableArmor) return;

        // Use blob's built-in armor update but with our parameters applied
        this.blob.armorOrbitRadius = this.configs.armor.coreRadius * this.blob.radius;
        this.blob.armorOrbitSpeed = this.configs.armor.orbitSpeed || 0.4;

        this.blob.updateArmor(delta);
    }

    updateInfoDisplay() {
        const el = document.getElementById('particle-info');
        if (!el || !this.blob) return;

        // Use config counts (visible particles)
        const mainCount = this.configs.main.particleCount;
        const vitalityCount = this.configs.vitality.particleCount;
        const armorCount = this.configs.armor.particleCount;

        // Calculate average velocities for visible particles only
        let mainVel = 0;
        for (let i = 0; i < mainCount; i++) {
            const i3 = i * 3;
            const vx = this.blob.velocities[i3];
            const vy = this.blob.velocities[i3 + 1];
            const vz = this.blob.velocities[i3 + 2];
            mainVel += Math.sqrt(vx * vx + vy * vy + vz * vz);
        }
        mainVel /= mainCount || 1;

        let vitalityVel = 0;
        if (this.vitalityVelocities) {
            const count = Math.min(vitalityCount, this.blob.maxVitalityParticles || 50);
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const vx = this.vitalityVelocities[i3];
                const vy = this.vitalityVelocities[i3 + 1];
                const vz = this.vitalityVelocities[i3 + 2];
                vitalityVel += Math.sqrt(vx * vx + vy * vy + vz * vz);
            }
            vitalityVel /= count || 1;
        }

        const essenceCount = this.configs.essence.particleCount;
        const typeColors = { main: '#aaccff', vitality: '#ffaaaa', essence: '#ccccff', armor: '#aaffaa' };

        el.innerHTML = `
<b>Selected:</b> <span style="color:${typeColors[this.selectedType]}">${this.selectedType}</span>
<b>Main:</b> ${mainCount} | <b>Vitality:</b> ${vitalityCount}
<b>Essence:</b> ${essenceCount} | <b>Armor:</b> ${armorCount}
        `;
    }

    getConfigs() {
        return JSON.parse(JSON.stringify(this.configs));
    }

    resetConfig() {
        this.configs = {
            main: { ...DEFAULT_CONFIGS.main },
            vitality: { ...DEFAULT_CONFIGS.vitality },
            essence: { ...DEFAULT_CONFIGS.essence },
            armor: { ...DEFAULT_CONFIGS.armor }
        };

        this.updateSlidersForType();
        this.applyConfig();
    }
}

// Initialize
const test = new ParticleConfigTest();

// Global functions for buttons
window.resetParticleConfig = () => test.resetConfig();

window.copyParticleConfig = () => {
    const configs = test.getConfigs();
    const code = `// Particle Configs - Generated from Particle Configurator
export const PARTICLE_CONFIGS = ${JSON.stringify(configs, null, 4)};`;

    navigator.clipboard.writeText(code).then(() => {
        alert('All particle configs copied to clipboard!');
    });
};

window.applyToGame = () => {
    alert('To apply to game, copy the config and update particle-life-creature.js');
};
