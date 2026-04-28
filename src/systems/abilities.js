// abilities.js - Color-based ability system with color wand integration
// Updated: Q-key and 1-5 hotkeys removed, left-click firing handled in main.js

import * as THREE from 'three';
import { ColorWand, WandManager } from './wand.js';
import { SpellCaster } from './spell-crafting.js';

// Ability definitions using chromatic colors
const ABILITIES = {
    // Crimson - Offensive power
    crimsonBolt: {
        name: 'Crimson Bolt',
        color: 'crimson',
        cost: 1,
        cooldown: 1000,
        description: 'Launch a bolt of destructive crimson energy',
        key: '1'
    },

    // Azure - Defensive/utility
    azureShield: {
        name: 'Azure Shield',
        color: 'azure',
        cost: 2,
        cooldown: 5000,
        description: 'Create a protective barrier of azure light',
        key: '2'
    },

    // Verdant - Healing/growth
    verdantHeal: {
        name: 'Verdant Restoration',
        color: 'verdant',
        cost: 2,
        cooldown: 3000,
        description: 'Restore vitality with verdant energy',
        key: '3'
    },

    // Golden - Buff/enhancement
    goldenRadiance: {
        name: 'Golden Radiance',
        color: 'golden',
        cost: 1,
        cooldown: 4000,
        description: 'Emanate golden light to reveal hidden things',
        key: '4'
    },

    // Violet - Special/arcane
    violetRift: {
        name: 'Violet Rift',
        color: 'violet',
        cost: 3,
        cooldown: 8000,
        description: 'Tear open a rift in reality',
        key: '5'
    }
};

export class AbilitySystem {
    constructor(scene, camera, colorInventory) {
        this.scene = scene;
        this.camera = camera;
        this.colorInventory = colorInventory;

        this.cooldowns = {};
        this.activeEffects = [];

        // Pre-create shared geometries (performance optimization)
        this.sharedProjectileGeometry = new THREE.SphereGeometry(0.2, 6, 6);
        this.sharedParticleGeometry = new THREE.SphereGeometry(0.05, 4, 4);

        // Wand system - Noita-style spell crafting
        this.wandManager = new WandManager();
        this.spellCaster = new SpellCaster(scene, camera);
        this.wandEnabled = true;

        // Reference to enemy manager (set externally)
        this.enemyManager = null;

        this.init();
    }

    init() {
        this.createUI();
        this.setupInputHandlers();
        this.setupWandDefaults();
    }

    setupWandDefaults() {
        // New ColorWand system - ivory is always enabled
        // Other colors toggled via Tab menu
        const wand = this.wandManager.getActiveWand();
        // Default: just ivory enabled (other colors from enemy drops)
        wand.setMode('single');
    }

    setEnemyManager(enemyManager) {
        this.enemyManager = enemyManager;
    }

    createUI() {
        const panel = document.createElement('div');
        panel.id = 'ability-bar';
        panel.innerHTML = `
            <div class="ability-slots">
                ${Object.entries(ABILITIES).map(([id, ability]) => `
                    <div class="ability-slot" data-ability="${id}" title="${ability.description}">
                        <div class="ability-icon" style="--ability-color: var(--${ability.color})"></div>
                        <span class="ability-key">${ability.key}</span>
                        <span class="ability-cost">${ability.cost}</span>
                        <div class="ability-cooldown"></div>
                    </div>
                `).join('')}
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            :root {
                --crimson: #c44444;
                --azure: #4477aa;
                --verdant: #44aa66;
                --golden: #ddaa44;
                --violet: #8855aa;
                --ivory: #eeeedd;
            }

            #ability-bar {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 100;
            }

            .ability-slots {
                display: flex;
                gap: 8px;
                background: rgba(26, 26, 46, 0.9);
                padding: 8px 12px;
                border-radius: 8px;
                border: 1px solid rgba(212, 165, 116, 0.3);
            }

            .ability-slot {
                position: relative;
                width: 50px;
                height: 50px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 6px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                transition: all 0.2s;
                overflow: hidden;
            }

            .ability-slot:hover {
                border-color: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
            }

            .ability-slot.on-cooldown {
                opacity: 0.5;
            }

            .ability-slot.insufficient {
                border-color: rgba(139, 58, 58, 0.5);
            }

            .ability-icon {
                position: absolute;
                inset: 4px;
                background: var(--ability-color);
                border-radius: 4px;
                opacity: 0.8;
            }

            .ability-key {
                position: absolute;
                bottom: 2px;
                right: 4px;
                font-size: 10px;
                font-weight: bold;
                color: rgba(255, 255, 255, 0.8);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
            }

            .ability-cost {
                position: absolute;
                top: 2px;
                left: 4px;
                font-size: 10px;
                font-weight: bold;
                color: #f5f0e6;
                background: rgba(0, 0, 0, 0.5);
                padding: 1px 4px;
                border-radius: 3px;
            }

            .ability-cooldown {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 0%;
                background: rgba(0, 0, 0, 0.7);
                transition: height 0.1s linear;
            }

            .ability-used {
                animation: abilityFlash 0.3s ease-out;
            }

            @keyframes abilityFlash {
                0% { filter: brightness(2); }
                100% { filter: brightness(1); }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);
        this.uiPanel = panel;
    }

    setupInputHandlers() {
        // Q-key and 1-5 hotkeys removed - left-click firing handled in main.js
        // Tab menu handled by WandUI

        // Click handlers for ability slots (legacy, click on UI panel)
        this.uiPanel?.querySelectorAll('.ability-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const abilityId = slot.dataset.ability;
                if (abilityId) this.useAbility(abilityId);
            });
        });
    }

    /**
     * Cast the active wand (now called from main.js on left-click)
     * Uses new ColorWand blended projectile system
     */
    castWand() {
        if (!this.wandEnabled) return;

        const wand = this.wandManager.getActiveWand();
        const config = wand.fire(this.colorInventory);

        if (!config) {
            // Not enough charge
            if (!wand.canFire(this.colorInventory)) {
                this.showMessage('Not enough charge!', 'warning');
            }
            return;
        }

        // Get camera direction for casting
        const cameraDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDir);
        const cameraPos = this.camera.position.clone();

        // Offset origin slightly forward
        const origin = cameraPos.clone().add(cameraDir.clone().multiplyScalar(1));

        // Cast blended projectile through SpellCaster
        this.spellCaster.castBlended(
            config,
            origin,
            cameraDir,
            (enemy, spell) => {
                // Hit callback - effects handled in spell-crafting.js
            }
        );

        // Visual feedback
        const colorNames = config.colors.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('+');
        this.showMessage(config.combo ? config.combo.name : colorNames, 'ability');

        // Audio event
        window.dispatchEvent(new CustomEvent('ability-used', {
            detail: { ability: 'wand-cast', colors: config.colors }
        }));
    }

    /**
     * Get the active wand for UI
     */
    getActiveWand() {
        return this.wandManager.getActiveWand();
    }

    /**
     * Get wand manager for advanced wand operations
     */
    getWandManager() {
        return this.wandManager;
    }

    useAbility(abilityId) {
        const ability = ABILITIES[abilityId];
        if (!ability) return false;

        // Check cooldown
        if (this.cooldowns[abilityId] && Date.now() < this.cooldowns[abilityId]) {
            this.showMessage('Ability on cooldown!', 'warning');
            return false;
        }

        // Check color cost
        const available = this.colorInventory.getColor(ability.color);
        if (available < ability.cost) {
            this.showMessage(`Not enough ${ability.color} essence!`, 'error');
            this.flashSlot(abilityId, 'insufficient');
            return false;
        }

        // Consume color
        this.colorInventory.removeColor(ability.color, ability.cost);

        // Set cooldown
        this.cooldowns[abilityId] = Date.now() + ability.cooldown;
        this.startCooldownDisplay(abilityId, ability.cooldown);

        // Execute ability effect
        this.executeAbility(abilityId, ability);

        // Dispatch event for audio
        window.dispatchEvent(new CustomEvent('ability-used', {
            detail: { ability: abilityId.replace(/([A-Z])/g, '-$1').toLowerCase() }
        }));

        // Visual feedback
        this.flashSlot(abilityId, 'used');
        this.showMessage(`${ability.name}!`, 'ability');

        return true;
    }

    executeAbility(abilityId, ability) {
        const cameraDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDir);
        const cameraPos = this.camera.position.clone();

        switch (abilityId) {
            case 'crimsonBolt':
                this.createProjectile(cameraPos, cameraDir, 0xc44444, 20);
                break;

            case 'azureShield':
                this.createShieldEffect(cameraPos, 0x4477aa);
                break;

            case 'verdantHeal':
                this.createHealEffect(cameraPos, 0x44aa66);
                break;

            case 'goldenRadiance':
                this.createRadianceEffect(cameraPos, 0xddaa44);
                break;

            case 'violetRift':
                this.createRiftEffect(cameraPos.add(cameraDir.multiplyScalar(3)), 0x8855aa);
                break;
        }
    }

    createProjectile(origin, direction, color, speed, damage = 15) {
        // Use shared geometry for performance
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9
        });

        const projectile = new THREE.Mesh(this.sharedProjectileGeometry, material);
        projectile.position.copy(origin);

        // Add glow
        const glowMaterial = new THREE.SpriteMaterial({
            color,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.set(1, 1, 1);
        projectile.add(glow);

        this.scene.add(projectile);

        // Animate projectile
        const startTime = performance.now();
        const lifetime = 2000;
        let hasHit = false;
        const hitEnemies = new Set(); // Track which enemies we've hit

        const effect = {
            mesh: projectile,
            isProjectile: true,
            position: projectile.position,
            damage: damage,
            radius: 1.0,
            direction: direction.clone(),
            hitEnemies: hitEnemies,
            markHit: () => { hasHit = true; },
            update: () => {
                if (hasHit) return true;

                const elapsed = performance.now() - startTime;
                if (elapsed > lifetime) return true; // Remove

                projectile.position.addScaledVector(direction, speed * 0.016);

                return false;
            }
        };

        this.activeEffects.push(effect);
    }

    createShieldEffect(position, color) {
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            wireframe: true
        });

        const shield = new THREE.Mesh(geometry, material);
        shield.position.copy(position);
        shield.position.y = 1;
        this.scene.add(shield);

        const startTime = performance.now();
        const duration = 3000;

        const effect = {
            mesh: shield,
            update: () => {
                const elapsed = performance.now() - startTime;
                const progress = elapsed / duration;

                if (progress > 1) return true;

                shield.rotation.y += 0.02;
                shield.rotation.x += 0.01;
                material.opacity = 0.3 * (1 - progress);

                return false;
            }
        };

        this.activeEffects.push(effect);
    }

    createHealEffect(position, color, healAmount = 25) {
        // Heal the player
        window.dispatchEvent(new CustomEvent('player-heal', {
            detail: { amount: healAmount }
        }));

        // Rising particles effect (reduced count for performance)
        const particleCount = 8;

        for (let i = 0; i < particleCount; i++) {
            // Use shared geometry for performance
            const material = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.8
            });

            const particle = new THREE.Mesh(this.sharedParticleGeometry, material);
            particle.position.copy(position);
            particle.position.x += (Math.random() - 0.5) * 2;
            particle.position.z += (Math.random() - 0.5) * 2;
            particle.position.y = Math.random();

            this.scene.add(particle);

            const startTime = performance.now() + i * 50;
            const duration = 1500;
            const startY = particle.position.y;

            const effect = {
                mesh: particle,
                update: () => {
                    const elapsed = performance.now() - startTime;
                    if (elapsed < 0) return false;
                    const progress = elapsed / duration;

                    if (progress > 1) return true;

                    particle.position.y = startY + progress * 3;
                    material.opacity = 0.8 * (1 - progress);

                    return false;
                }
            };

            this.activeEffects.push(effect);
        }
    }

    createRadianceEffect(position, color) {
        // Expanding ring of light
        const geometry = new THREE.RingGeometry(0.1, 0.3, 32);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(position);
        ring.position.y = 0.1;
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);

        const startTime = performance.now();
        const duration = 2000;

        const effect = {
            mesh: ring,
            update: () => {
                const elapsed = performance.now() - startTime;
                const progress = elapsed / duration;

                if (progress > 1) return true;

                const scale = 1 + progress * 15;
                ring.scale.set(scale, scale, 1);
                material.opacity = 0.8 * (1 - progress);

                return false;
            }
        };

        this.activeEffects.push(effect);
    }

    createRiftEffect(position, color) {
        // Swirling portal effect
        const geometry = new THREE.TorusGeometry(1, 0.1, 8, 32);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8
        });

        const rift = new THREE.Mesh(geometry, material);
        rift.position.copy(position);
        this.scene.add(rift);

        const startTime = performance.now();
        const duration = 4000;

        const effect = {
            mesh: rift,
            update: () => {
                const elapsed = performance.now() - startTime;
                const progress = elapsed / duration;

                if (progress > 1) return true;

                rift.rotation.x += 0.05;
                rift.rotation.y += 0.03;

                // Pulse scale
                const pulse = 1 + Math.sin(elapsed * 0.01) * 0.2;
                rift.scale.setScalar(pulse * (progress < 0.8 ? 1 : (1 - (progress - 0.8) * 5)));

                material.opacity = progress < 0.8 ? 0.8 : 0.8 * (1 - (progress - 0.8) * 5);

                return false;
            }
        };

        this.activeEffects.push(effect);
    }

    flashSlot(abilityId, type) {
        const slot = this.uiPanel?.querySelector(`[data-ability="${abilityId}"]`);
        if (slot) {
            slot.classList.add(type === 'used' ? 'ability-used' : type);
            setTimeout(() => slot.classList.remove(type === 'used' ? 'ability-used' : type), 300);
        }
    }

    startCooldownDisplay(abilityId, duration) {
        const slot = this.uiPanel?.querySelector(`[data-ability="${abilityId}"]`);
        const cooldownEl = slot?.querySelector('.ability-cooldown');
        if (!cooldownEl) return;

        slot.classList.add('on-cooldown');
        cooldownEl.style.height = '100%';

        const startTime = performance.now();
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const remaining = 1 - (elapsed / duration);

            if (remaining <= 0) {
                cooldownEl.style.height = '0%';
                slot.classList.remove('on-cooldown');
                return;
            }

            cooldownEl.style.height = `${remaining * 100}%`;
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    showMessage(text, type) {
        // Reuse a single message element
        if (!this.messageElement) {
            this.messageElement = document.createElement('div');
            this.messageElement.style.cssText = `
                position: fixed;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 8px 16px;
                background: rgba(26, 26, 46, 0.9);
                border-radius: 4px;
                font-size: 14px;
                z-index: 200;
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
            `;
            document.body.appendChild(this.messageElement);
        }

        // Update and show
        this.messageElement.textContent = text;
        this.messageElement.style.color = type === 'error' ? '#c44444' : type === 'warning' ? '#ddaa44' : '#f5f0e6';
        this.messageElement.style.opacity = '1';

        // Clear any existing timeout
        if (this.messageTimeout) clearTimeout(this.messageTimeout);

        // Hide after delay
        this.messageTimeout = setTimeout(() => {
            this.messageElement.style.opacity = '0';
        }, 800);
    }

    update(delta = 0.016) {
        // Update active effects (legacy abilities)
        this.activeEffects = this.activeEffects.filter(effect => {
            const shouldRemove = effect.update();
            if (shouldRemove && effect.mesh) {
                this.scene.remove(effect.mesh);
                effect.mesh.geometry?.dispose();
                effect.mesh.material?.dispose();
            }
            return !shouldRemove;
        });

        // Update spell caster (wand projectiles)
        if (this.spellCaster && this.enemyManager) {
            const enemies = this.enemyManager.enemies || [];
            this.spellCaster.update(delta, enemies);
        }

        // Update UI (insufficient color indicators for quick-cast abilities)
        Object.entries(ABILITIES).forEach(([id, ability]) => {
            const slot = this.uiPanel?.querySelector(`[data-ability="${id}"]`);
            if (slot) {
                // Use new charge system
                const hasEnough = this.colorInventory.hasCharge(ability.color, ability.cost * 10);
                slot.classList.toggle('insufficient', !hasEnough);
            }
        });
    }

    getProjectiles() {
        // Combine legacy projectiles with wand projectiles
        const legacyProjectiles = this.activeEffects.filter(e => e.isProjectile);
        const wandProjectiles = this.spellCaster ? this.spellCaster.getProjectiles() : [];
        return [...legacyProjectiles, ...wandProjectiles];
    }
}
