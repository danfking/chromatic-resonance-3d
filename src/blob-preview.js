// blob-preview.js - Preview for Particle Life blob creatures

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ParticleLifeCreature, CREATURE_PRESETS, ARMOR_TIERS } from './creatures/particle-life-creature.js';
import { WandCrystal, WAND_TIERS, WAND_MODIFIERS } from './creatures/wand-crystal.js';

class BlobPreview {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        this.creature = null;
        this.currentPreset = 'shade';
        this.autoRotate = true;

        // Wand system
        this.wand = null;
        this.currentWandTier = 'starter';

        // FPS tracking
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.fps = 0;

        this.init();
    }

    init() {
        this.setupScene();
        this.setupLighting();
        this.setupUI();
        this.createCreature();
        this.updateElementInfo();
        this.animate();
        this.updateStatus('Ready - Select a creature type');
    }

    setupScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x080810);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(0, 1, 4);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const container = document.getElementById('canvas-container');
        container.appendChild(this.renderer.domElement);

        // Orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 10;
        this.controls.autoRotate = this.autoRotate;
        this.controls.autoRotateSpeed = 1.0;

        // Handle resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Add subtle starfield background
        this.createStarfield();
    }

    createStarfield() {
        const starCount = 500;
        const positions = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
            sizes[i] = Math.random() * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(0x6688aa) }
            },
            vertexShader: `
                attribute float size;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (100.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                void main() {
                    float dist = length(gl_PointCoord - 0.5) * 2.0;
                    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
                    gl_FragColor = vec4(uColor, alpha * 0.5);
                }
            `,
            transparent: true,
            depthWrite: false
        });

        const stars = new THREE.Points(geometry, material);
        this.scene.add(stars);
    }

    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambient);

        // Point light for glow effect
        const light1 = new THREE.PointLight(0x8888ff, 1, 10);
        light1.position.set(2, 2, 2);
        this.scene.add(light1);

        const light2 = new THREE.PointLight(0xff8888, 0.5, 10);
        light2.position.set(-2, -1, 2);
        this.scene.add(light2);
    }

    setupUI() {
        // Create creature buttons
        const container = document.getElementById('creature-buttons');
        container.innerHTML = '';

        Object.entries(CREATURE_PRESETS).forEach(([key, preset]) => {
            const btn = document.createElement('button');
            btn.className = 'creature-btn' + (key === this.currentPreset ? ' active' : '');
            btn.dataset.preset = key;

            // Color preview strip
            const colorPreview = document.createElement('div');
            colorPreview.className = 'color-preview';
            preset.colors.forEach(color => {
                const span = document.createElement('span');
                span.style.background = '#' + color.toString(16).padStart(6, '0');
                colorPreview.appendChild(span);
            });

            btn.appendChild(colorPreview);
            btn.appendChild(document.createTextNode(preset.name));

            btn.onclick = () => this.selectCreature(key);
            container.appendChild(btn);
        });

        // Sliders
        document.getElementById('particle-size').oninput = (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('size-val').textContent = value.toFixed(2);
            if (this.creature) {
                this.creature.setParticleSize(value);
            }
        };

        document.getElementById('speed').oninput = (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('speed-val').textContent = value.toFixed(2);
            if (this.creature) {
                this.creature.speed = value;
            }
        };

        document.getElementById('opacity').oninput = (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('opacity-val').textContent = value.toFixed(2);
            if (this.creature) {
                this.creature.bubbleMesh.material.uniforms.uOpacity.value = value;
            }
        };

        document.getElementById('wobble').oninput = (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('wobble-val').textContent = value.toFixed(3);
            if (this.creature) {
                this.creature.bubbleMesh.material.uniforms.uWobbleStrength.value = value;
            }
        };

        // Vitality slider
        document.getElementById('vitality-slider').oninput = (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('vitality-val').textContent = value;
            if (this.creature) {
                this.creature.setVitality(value);
                this.updateVitalityInfo();
            }
        };

        // Essence slider
        document.getElementById('essence-slider').oninput = (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('essence-val').textContent = value;
            if (this.creature) {
                this.creature.setEssence(value);
                this.updateEssenceInfo();
            }
        };
    }

    updateElementInfo() {
        const infoEl = document.getElementById('element-info');
        if (!this.creature || !this.creature.elements) {
            infoEl.textContent = 'No elemental data';
            return;
        }

        const elements = this.creature.getElementNames();
        const uniqueElements = [...new Set(elements)];

        // Build info text
        let html = `<strong>Composition:</strong> ${elements.join(' + ')}<br><br>`;
        html += `<strong>Type Relationships:</strong><br>`;

        // Show attraction matrix interpretation
        const matrix = this.creature.attractions;
        for (let i = 0; i < matrix.length; i++) {
            const relations = [];
            for (let j = 0; j < matrix[i].length; j++) {
                const val = matrix[i][j];
                if (i === j) {
                    relations.push(`self: ${val > 0 ? 'cohesive' : 'dispersing'}`);
                } else if (Math.abs(val) > 0.4) {
                    relations.push(`${elements[j]}: ${val > 0 ? '→attracts' : '←repels'}`);
                }
            }
            if (relations.length > 0) {
                html += `${elements[i]}: ${relations.join(', ')}<br>`;
            }
        }

        infoEl.innerHTML = html;
    }

    createCreature() {
        // Remove existing creature
        if (this.creature) {
            this.scene.remove(this.creature.group);
            this.creature.dispose();
        }

        // Remove existing wand
        if (this.wand) {
            this.scene.remove(this.wand.group);
            this.wand.dispose();
        }

        // Create new creature
        this.creature = new ParticleLifeCreature(this.currentPreset);
        this.scene.add(this.creature.group);

        // Create wand
        this.wand = new WandCrystal(this.currentWandTier);
        this.scene.add(this.wand.group);

        // Update UI to match preset values
        const preset = CREATURE_PRESETS[this.currentPreset];
        document.getElementById('speed').value = preset.speed || 0.1;
        document.getElementById('speed-val').textContent = (preset.speed || 0.1).toFixed(2);
        document.getElementById('opacity').value = preset.bubbleOpacity;
        document.getElementById('opacity-val').textContent = preset.bubbleOpacity.toFixed(2);

        // Apply default wobble value
        const wobbleVal = parseFloat(document.getElementById('wobble').value);
        this.creature.bubbleMesh.material.uniforms.uWobbleStrength.value = wobbleVal;

        // Reset armor to none and update display
        this.creature.setArmorTier('none');
        this.updateArmorInfo();

        // Reset armor button states
        document.querySelectorAll('#armor-buttons .creature-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.armor === 'none');
        });

        // Reset vitality to full and update display
        this.creature.setVitality(this.creature.maxVitality);
        this.updateVitalityInfo();
        document.getElementById('vitality-slider').value = this.creature.maxVitality;
        document.getElementById('vitality-val').textContent = this.creature.maxVitality;

        // Reset essence to full and update display
        this.creature.setEssence(this.creature.maxEssence);
        this.updateEssenceInfo();
        document.getElementById('essence-slider').value = this.creature.maxEssence;
        document.getElementById('essence-val').textContent = this.creature.maxEssence;

        // Update wand info
        this.updateWandInfo();
    }

    selectCreature(presetKey) {
        this.currentPreset = presetKey;

        // Update button states
        document.querySelectorAll('.creature-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetKey);
        });

        // Create new creature
        this.createCreature();

        const preset = CREATURE_PRESETS[presetKey];
        this.updateStatus(`${preset.name} - ${preset.particles} particles`);

        // Update particle size slider to match preset
        const particleSize = preset.particleSize || 0.08;
        document.getElementById('particle-size').value = particleSize;
        document.getElementById('size-val').textContent = particleSize.toFixed(2);

        // Update elemental info display
        this.updateElementInfo();
    }

    resetCamera() {
        this.camera.position.set(0, 1, 4);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    toggleRotation() {
        this.autoRotate = !this.autoRotate;
        this.controls.autoRotate = this.autoRotate;
        this.updateStatus(this.autoRotate ? 'Auto-rotate ON' : 'Auto-rotate OFF');
    }

    // Set armor tier
    setArmor(tierName) {
        if (!this.creature) return;

        this.creature.setArmorTier(tierName);

        // Update button states
        document.querySelectorAll('#armor-buttons .creature-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.armor === tierName);
        });

        this.updateArmorInfo();
        this.updateStatus(`Armor: ${ARMOR_TIERS[tierName].name}`);
    }

    // Test damage (removes armor particles, then vitality)
    testDamage() {
        if (!this.creature) return;

        const damage = 20; // Test damage amount
        const result = this.creature.takeDamage(damage);

        this.updateArmorInfo();
        this.updateVitalityInfo();

        // Update vitality slider to match
        document.getElementById('vitality-slider').value = this.creature.vitality;
        document.getElementById('vitality-val').textContent = Math.round(this.creature.vitality);

        if (result.died) {
            this.updateStatus(`DIED! Bubble popped!`);
        } else if (result.vitalityDamage > 0) {
            this.updateStatus(`Took ${result.vitalityDamage} HP damage! (${result.absorbed} absorbed)`);
        } else if (result.absorbed > 0) {
            this.updateStatus(`Armor absorbed ${result.absorbed} damage`);
        }
    }

    // Heal the creature
    healCreature(amount) {
        if (!this.creature) return;

        const healed = this.creature.heal(amount);
        this.updateVitalityInfo();

        // Update vitality slider to match
        document.getElementById('vitality-slider').value = this.creature.vitality;
        document.getElementById('vitality-val').textContent = Math.round(this.creature.vitality);

        this.updateStatus(`Healed ${healed} HP`);
    }

    // Update armor info display
    updateArmorInfo() {
        if (!this.creature) return;

        const info = this.creature.getArmorInfo();
        const infoEl = document.getElementById('armor-info');
        infoEl.innerHTML = `
            <strong>${info.tierName}</strong>: ${info.current} / ${this.creature.maxArmorParticles} particles
            <br>Internal visibility: ${Math.round(this.creature.internalVisibility * 100)}%
        `;
    }

    // Update vitality info display
    updateVitalityInfo() {
        if (!this.creature) return;

        const info = this.creature.getVitalityInfo();
        const infoEl = document.getElementById('vitality-info');
        const statusColor = info.isAlive ? '#ff6666' : '#666666';
        const statusIcon = info.isAlive ? '♥' : '✗';

        infoEl.innerHTML = `
            <span style="color: ${statusColor};">${statusIcon}</span>
            ${info.current} / ${info.max} HP (${info.particles} particles)
            ${!info.isAlive ? '<br><strong style="color: #ff4444;">DEAD</strong>' : ''}
        `;
    }

    // Update essence info display
    updateEssenceInfo() {
        if (!this.creature) return;

        const info = this.creature.getEssenceInfo();
        const infoEl = document.getElementById('essence-info');
        const brightness = 0.5 + info.percentage * 0.5;
        const starColor = `rgba(255, 255, 255, ${brightness})`;

        infoEl.innerHTML = `
            <span style="color: ${starColor};">✦</span>
            ${info.current} / ${info.max} MP (${info.particles} particles)
            <br><span style="color: #888; font-size: 10px;">Regen: ${info.regenRate}/sec</span>
        `;
    }

    // Spend essence (for testing mana usage)
    spendEssence(amount) {
        if (!this.creature) return;

        const success = this.creature.spendEssence(amount);
        this.updateEssenceInfo();

        // Update essence slider to match
        document.getElementById('essence-slider').value = this.creature.essence;
        document.getElementById('essence-val').textContent = Math.round(this.creature.essence);

        if (success) {
            this.updateStatus(`Spent ${amount} essence`);
        } else {
            this.updateStatus(`Not enough essence! (need ${amount}, have ${Math.round(this.creature.essence)})`);
        }
    }

    // Set wand tier
    setWandTier(tierName) {
        if (!this.wand) return;
        if (!WAND_TIERS[tierName]) return;

        this.currentWandTier = tierName;
        this.wand.setTier(tierName);

        // Update button states
        document.querySelectorAll('#wand-tier-buttons .creature-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tier === tierName);
        });

        this.updateWandInfo();
        this.updateStatus(`Wand: ${WAND_TIERS[tierName].name}`);
    }

    // Test cast wand
    testCast() {
        if (!this.wand || !this.creature) return;

        // Check if enough essence
        const baseCost = 15;
        const actualCost = this.wand.calculateCost(baseCost);

        if (!this.creature.hasEssence(actualCost)) {
            this.updateStatus(`Not enough essence to cast! (need ${actualCost})`);
            return;
        }

        // Spend essence
        this.creature.spendEssence(actualCost);
        this.updateEssenceInfo();

        // Update essence slider
        document.getElementById('essence-slider').value = this.creature.essence;
        document.getElementById('essence-val').textContent = Math.round(this.creature.essence);

        // Start casting
        const creaturePos = this.creature.group.position.clone();
        const targetPos = new THREE.Vector3(0, 0, 5); // Fire forward
        this.wand.startCast(creaturePos, targetPos);

        const wasted = Math.round((1 - this.wand.tier.efficiency) * actualCost);
        this.updateStatus(`Casting... (cost: ${actualCost}, wasted: ${wasted})`);
    }

    // Called when spell completes
    onSpellComplete(spell) {
        this.updateStatus(`Spell fired! Damage: ${spell.damage}, Efficiency: ${spell.efficiency * 100}%`);
    }

    // Update wand info display
    updateWandInfo() {
        if (!this.wand) return;

        const info = this.wand.getInfo();
        const infoEl = document.getElementById('wand-info');

        const tierColors = {
            starter: '#aabbcc',
            apprentice: '#ccddee',
            journeyman: '#ddeeff',
            master: '#eeffff',
            legendary: '#ffffff'
        };

        const tierColor = tierColors[this.currentWandTier] || '#ffffff';

        infoEl.innerHTML = `
            <strong style="color: ${tierColor};">◇ ${info.name}</strong><br>
            Efficiency: ${info.efficiency}% (${info.wastedMana}% wasted)<br>
            Cast time: ${info.castTime}s | Damage: ${info.baseDamage}<br>
            Slots: ${info.equippedModifiers.length}/${info.availableSlots} (${info.lockedSlots} locked)
            ${info.canCombineElements ? `<br>Can combine up to ${info.maxElements} elements` : ''}
        `;
    }

    // === PHYSICS TESTING METHODS ===

    testImpactFront() {
        if (!this.creature) return;
        this.creature.applyImpact(new THREE.Vector3(0, 0, 1), 0.5);
        this.updateStatus('Impact from front');
    }

    testImpactTop() {
        if (!this.creature) return;
        this.creature.applyImpact(new THREE.Vector3(0, 1, 0), 0.4);
        this.updateStatus('Impact from top (landing)');
    }

    testImpactSide() {
        if (!this.creature) return;
        this.creature.applyImpact(new THREE.Vector3(1, 0, 0), 0.5);
        this.updateStatus('Impact from side');
    }

    testHeavyImpact() {
        if (!this.creature) return;
        // Heavy impact from random direction
        const dir = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();
        this.creature.applyImpact(dir, 1.0);
        this.updateStatus('Heavy impact!');
    }

    updatePhysicsInfo() {
        if (!this.creature) return;

        const info = this.creature.getPhysicsInfo();
        const infoEl = document.getElementById('physics-info');

        const deformColor = info.deformation > 20 ? '#ff8866' : '#888';
        const wobbleColor = info.wobbleAmplitude > 10 ? '#88aaff' : '#888';

        infoEl.innerHTML = `
            <span style="color: ${deformColor};">Deform: ${info.deformation}%</span> |
            <span style="color: ${wobbleColor};">Wobble: ${info.wobbleAmplitude}%</span> |
            Stretch: ${info.stretchAmount}%
        `;
    }

    updateStatus(text) {
        document.getElementById('status').textContent = text;
    }

    updateStats() {
        this.frameCount++;
        const now = performance.now();

        if (now - this.lastFpsUpdate > 500) {
            this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            const particles = this.creature ? this.creature.particleCount : 0;
            document.getElementById('stats').innerHTML =
                `FPS: ${this.fps}<br>Particles: ${particles}`;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update creature
        if (this.creature) {
            this.creature.update(delta);
        }

        // Update wand (orbits around creature)
        if (this.wand) {
            const creaturePos = this.creature ? this.creature.group.position : new THREE.Vector3();
            this.wand.update(delta, creaturePos);

            // Check for cast completion
            const spell = this.wand.updateCast(delta);
            if (spell) {
                this.onSpellComplete(spell);
            }
        }

        // Update controls
        this.controls.update();

        // Render
        this.renderer.render(this.scene, this.camera);

        // Update stats
        this.updateStats();

        // Update physics info display (throttled)
        if (this.frameCount % 10 === 0) {
            this.updatePhysicsInfo();
        }
    }
}

// Create global instance
const blobPreview = new BlobPreview();
window.blobPreview = blobPreview;
