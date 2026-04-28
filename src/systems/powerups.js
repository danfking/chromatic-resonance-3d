// powerups.js - Power-up spawning and effects

import * as THREE from 'three';

const POWERUP_TYPES = {
    damage: {
        name: 'Crimson Fury',
        description: '+50% Damage',
        color: 0xff4444,
        duration: 10000,
        effect: 'damage',
        multiplier: 1.5
    },
    speed: {
        name: 'Azure Swiftness',
        description: '+30% Speed',
        color: 0x4488ff,
        duration: 12000,
        effect: 'speed',
        multiplier: 1.3
    },
    shield: {
        name: 'Golden Ward',
        description: 'Damage Shield',
        color: 0xffdd44,
        duration: 8000,
        effect: 'shield',
        absorb: 50
    },
    regeneration: {
        name: 'Verdant Bloom',
        description: 'Health Regen',
        color: 0x44ff66,
        duration: 15000,
        effect: 'regen',
        healPerSecond: 5
    }
};

export class PowerupSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.powerups = [];
        this.activeEffects = new Map();

        this.spawnTimer = 0;
        this.spawnInterval = 20000; // Spawn every 20 seconds
        this.playerPosition = new THREE.Vector3();

        // Shared geometry for performance
        this.powerupGeometry = new THREE.OctahedronGeometry(0.4, 0);

        this.init();
    }

    init() {
        this.createUI();
        this.startUpdateLoop();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'powerup-effects';

        const style = document.createElement('style');
        style.textContent = `
            #powerup-effects {
                position: fixed;
                left: 10px;
                top: 200px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                z-index: 100;
                pointer-events: none;
            }

            .powerup-active {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: rgba(26, 26, 46, 0.9);
                border-radius: 6px;
                border-left: 3px solid #d4a574;
                animation: powerupSlideIn 0.3s ease-out;
            }

            @keyframes powerupSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .powerup-icon {
                width: 24px;
                height: 24px;
                border-radius: 4px;
            }

            .powerup-info {
                display: flex;
                flex-direction: column;
            }

            .powerup-name {
                font-size: 13px;
                font-weight: bold;
                color: #f5f0e6;
                font-family: 'Georgia', serif;
            }

            .powerup-timer {
                font-size: 11px;
                color: #888;
                font-family: monospace;
            }

            .powerup-pickup-text {
                position: fixed;
                top: 25%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 150;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s;
            }

            .powerup-pickup-text.visible {
                opacity: 1;
            }

            .powerup-pickup-name {
                font-size: 28px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                text-shadow: 0 0 20px currentColor, 2px 2px 0 rgba(0,0,0,0.5);
            }

            .powerup-pickup-desc {
                font-size: 16px;
                color: #ccc;
                margin-top: 5px;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);
        this.effectsContainer = container;

        // Create pickup text element
        const pickupText = document.createElement('div');
        pickupText.className = 'powerup-pickup-text';
        pickupText.innerHTML = `
            <div class="powerup-pickup-name">Power Name</div>
            <div class="powerup-pickup-desc">Description</div>
        `;
        document.body.appendChild(pickupText);
        this.pickupText = pickupText;
    }

    setPlayerPosition(position) {
        this.playerPosition.copy(position);
    }

    startUpdateLoop() {
        let lastTime = performance.now();

        const update = () => {
            const now = performance.now();
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            this.update(delta);
            requestAnimationFrame(update);
        };
        update();
    }

    update(delta) {
        // Spawn timer
        this.spawnTimer += delta * 1000;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnPowerup();
            this.spawnTimer = 0;
        }

        // Update powerup animations
        const time = performance.now() / 1000;
        this.powerups.forEach(powerup => {
            // Bobbing
            powerup.mesh.position.y = 1 + Math.sin(time * 2 + powerup.phase) * 0.2;
            // Rotation
            powerup.mesh.rotation.y += delta * 2;

            // Check pickup
            const dist = this.playerPosition.distanceTo(powerup.mesh.position);
            if (dist < 1.5) {
                this.collectPowerup(powerup);
            }
        });

        // Update active effects
        this.activeEffects.forEach((effect, type) => {
            effect.remaining -= delta * 1000;
            if (effect.remaining <= 0) {
                this.removeEffect(type);
            } else {
                this.updateEffectUI(type, effect);

                // Regen effect
                if (effect.type.effect === 'regen') {
                    effect.healAccum += effect.type.healPerSecond * delta;
                    if (effect.healAccum >= 1) {
                        const healAmount = Math.floor(effect.healAccum);
                        effect.healAccum -= healAmount;
                        window.dispatchEvent(new CustomEvent('player-heal', {
                            detail: { amount: healAmount }
                        }));
                    }
                }
            }
        });
    }

    spawnPowerup() {
        // Random position near player
        const angle = Math.random() * Math.PI * 2;
        const distance = 8 + Math.random() * 8;
        const x = this.playerPosition.x + Math.cos(angle) * distance;
        const z = this.playerPosition.z + Math.sin(angle) * distance;

        // Clamp to level bounds
        const clampedX = THREE.MathUtils.clamp(x, -16, 16);
        const clampedZ = THREE.MathUtils.clamp(z, -16, 16);

        // Random type
        const types = Object.keys(POWERUP_TYPES);
        const typeKey = types[Math.floor(Math.random() * types.length)];
        const type = POWERUP_TYPES[typeKey];

        // Create mesh
        const material = new THREE.MeshStandardMaterial({
            color: type.color,
            emissive: type.color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.7
        });

        const mesh = new THREE.Mesh(this.powerupGeometry, material);
        mesh.position.set(clampedX, 1, clampedZ);

        // Add glow
        const glowGeometry = new THREE.SphereGeometry(0.6, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: type.color,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        mesh.add(glow);

        this.scene.add(mesh);

        const powerup = {
            mesh,
            type,
            typeKey,
            phase: Math.random() * Math.PI * 2,
            lifetime: 30000 // Despawn after 30 seconds
        };

        this.powerups.push(powerup);

        // Auto-despawn
        setTimeout(() => {
            if (this.powerups.includes(powerup)) {
                this.removePowerup(powerup);
            }
        }, powerup.lifetime);
    }

    collectPowerup(powerup) {
        // Apply effect
        this.applyEffect(powerup.typeKey, powerup.type);

        // Show pickup text
        this.showPickupText(powerup.type);

        // Play sound
        window.dispatchEvent(new CustomEvent('powerup-collected', {
            detail: { type: powerup.typeKey }
        }));

        // Remove from world
        this.removePowerup(powerup);
    }

    removePowerup(powerup) {
        const index = this.powerups.indexOf(powerup);
        if (index !== -1) {
            this.scene.remove(powerup.mesh);
            powerup.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.powerups.splice(index, 1);
        }
    }

    applyEffect(typeKey, type) {
        // If already active, refresh duration
        if (this.activeEffects.has(typeKey)) {
            const existing = this.activeEffects.get(typeKey);
            existing.remaining = type.duration;
            return;
        }

        const effect = {
            type,
            remaining: type.duration,
            healAccum: 0,
            element: this.createEffectElement(typeKey, type)
        };

        this.activeEffects.set(typeKey, effect);
        this.effectsContainer.appendChild(effect.element);

        // Dispatch effect event
        window.dispatchEvent(new CustomEvent('powerup-active', {
            detail: { effect: type.effect, multiplier: type.multiplier, absorb: type.absorb }
        }));
    }

    createEffectElement(typeKey, type) {
        const el = document.createElement('div');
        el.className = 'powerup-active';
        el.id = `powerup-${typeKey}`;
        el.style.borderLeftColor = `#${type.color.toString(16).padStart(6, '0')}`;
        el.innerHTML = `
            <div class="powerup-icon" style="background: #${type.color.toString(16).padStart(6, '0')}"></div>
            <div class="powerup-info">
                <div class="powerup-name">${type.name}</div>
                <div class="powerup-timer">${(type.duration / 1000).toFixed(0)}s</div>
            </div>
        `;
        return el;
    }

    updateEffectUI(typeKey, effect) {
        const el = effect.element;
        if (el) {
            const timer = el.querySelector('.powerup-timer');
            if (timer) {
                timer.textContent = `${Math.ceil(effect.remaining / 1000)}s`;
            }
        }
    }

    removeEffect(typeKey) {
        const effect = this.activeEffects.get(typeKey);
        if (effect) {
            if (effect.element && effect.element.parentNode) {
                effect.element.remove();
            }
            this.activeEffects.delete(typeKey);

            // Dispatch effect ended
            window.dispatchEvent(new CustomEvent('powerup-ended', {
                detail: { effect: effect.type.effect }
            }));
        }
    }

    showPickupText(type) {
        const nameEl = this.pickupText.querySelector('.powerup-pickup-name');
        const descEl = this.pickupText.querySelector('.powerup-pickup-desc');

        nameEl.textContent = type.name;
        nameEl.style.color = `#${type.color.toString(16).padStart(6, '0')}`;
        descEl.textContent = type.description;

        this.pickupText.classList.add('visible');

        setTimeout(() => {
            this.pickupText.classList.remove('visible');
        }, 2000);
    }

    // Check if damage boost is active
    getDamageMultiplier() {
        const effect = this.activeEffects.get('damage');
        return effect ? effect.type.multiplier : 1.0;
    }

    // Check if speed boost is active
    getSpeedMultiplier() {
        const effect = this.activeEffects.get('speed');
        return effect ? effect.type.multiplier : 1.0;
    }

    // Check shield absorb
    getShieldAbsorb() {
        const effect = this.activeEffects.get('shield');
        return effect ? effect.type.absorb : 0;
    }
}
