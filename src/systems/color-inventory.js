// color-inventory.js - Color charge pool system with UI
// Refactored from integer counts to float charge pools with regeneration

import * as THREE from 'three';

// Chromatic color definitions with charge pool properties
// New system: Ivory is primary mana (fast regen), other colors from enemy drops only
// When depleted, colors have slow trickle regen to minCharge so player is never stuck
const COLOR_CHARGES = {
    ivory: {
        current: 50,
        max: 100,
        regenRate: 5,         // Fast passive regen - primary resource
        minRegen: 0,          // No minimum threshold needed
        minCharge: 0,         // No minimum charge
        displayColor: 0xeeeedd,
        name: 'Ivory',
        desc: 'Pure mana - always regenerates'
    },
    crimson: {
        current: 0,
        max: 100,
        regenRate: 0,         // No passive regen - from enemy drops
        minRegen: 0.5,        // Trickle regen when below minCharge
        minCharge: 10,        // Trickle up to 10 so player isn't stuck
        displayColor: 0xc44444,
        name: 'Crimson',
        desc: 'Burn effect - from enemy drops'
    },
    azure: {
        current: 0,
        max: 100,
        regenRate: 0,         // No passive regen - from enemy drops
        minRegen: 0.5,        // Trickle regen when below minCharge
        minCharge: 10,        // Trickle up to 10 so player isn't stuck
        displayColor: 0x4477aa,
        name: 'Azure',
        desc: 'Slow effect - from enemy drops'
    },
    verdant: {
        current: 0,
        max: 100,
        regenRate: 0,         // No passive regen - from enemy drops
        minRegen: 0.5,        // Trickle regen when below minCharge
        minCharge: 10,        // Trickle up to 10 so player isn't stuck
        displayColor: 0x44aa66,
        name: 'Verdant',
        desc: 'Lifesteal effect - from enemy drops'
    },
    golden: {
        current: 0,
        max: 80,
        regenRate: 0,         // No passive regen - from enemy drops
        minRegen: 0.3,        // Slower trickle for rare color
        minCharge: 10,        // Trickle up to 10 so player isn't stuck
        displayColor: 0xddaa44,
        name: 'Golden',
        desc: 'Pierce effect - from enemy drops'
    },
    violet: {
        current: 0,
        max: 60,
        regenRate: 0,         // No passive regen - from enemy drops
        minRegen: 0.2,        // Slowest trickle for rarest color
        minCharge: 10,        // Trickle up to 10 so player isn't stuck
        displayColor: 0x8855aa,
        name: 'Violet',
        desc: 'Homing effect - from enemy drops'
    }
};

export class ColorInventory {
    constructor() {
        // Deep clone the color charges config
        this.charges = {};
        for (const [color, data] of Object.entries(COLOR_CHARGES)) {
            this.charges[color] = { ...data };
        }

        this.uiElement = null;
        this.lastUpdate = performance.now();

        // Regeneration state
        this.regenEnabled = true;
        this.regenMultiplier = 1.0;

        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.updateUI();
    }

    createUI() {
        // Create color inventory panel with charge bars
        const panel = document.createElement('div');
        panel.id = 'color-inventory';
        panel.innerHTML = `
            <div class="inventory-title">Chromatic Essence</div>
            <div class="color-slots">
                ${Object.entries(this.charges).map(([type, info]) => `
                    <div class="color-slot" data-color="${type}" title="${info.desc}">
                        <div class="color-orb" style="background: #${info.displayColor.toString(16).padStart(6, '0')}"></div>
                        <div class="charge-bar-container">
                            <div class="charge-bar-bg"></div>
                            <div class="charge-bar-fill" style="background: #${info.displayColor.toString(16).padStart(6, '0')}"></div>
                            <span class="charge-text">0/${info.max}</span>
                        </div>
                        <span class="color-name">${info.name}</span>
                    </div>
                `).join('')}
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #color-inventory {
                position: fixed;
                top: 60px;
                right: 10px;
                background: rgba(26, 26, 46, 0.9);
                border: 1px solid rgba(212, 165, 116, 0.3);
                border-radius: 8px;
                padding: 12px;
                color: #f5f0e6;
                font-family: 'Segoe UI', system-ui, sans-serif;
                z-index: 100;
                min-width: 180px;
            }

            .inventory-title {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #d4a574;
                margin-bottom: 10px;
                text-align: center;
                border-bottom: 1px solid rgba(212, 165, 116, 0.2);
                padding-bottom: 6px;
            }

            .color-slots {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .color-slot {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 6px;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .color-slot:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .color-slot.pulse {
                animation: slotPulse 0.4s ease-out;
            }

            @keyframes slotPulse {
                0% { background: rgba(255, 255, 255, 0.3); }
                100% { background: transparent; }
            }

            .color-orb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                box-shadow: 0 0 6px currentColor, inset 0 -2px 4px rgba(0,0,0,0.3);
                flex-shrink: 0;
            }

            .charge-bar-container {
                position: relative;
                flex: 1;
                height: 12px;
                min-width: 80px;
            }

            .charge-bar-bg {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                border-radius: 3px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .charge-bar-fill {
                position: absolute;
                top: 1px;
                left: 1px;
                bottom: 1px;
                width: 0%;
                border-radius: 2px;
                transition: width 0.15s ease-out;
                box-shadow: 0 0 4px currentColor;
            }

            .charge-text {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-weight: bold;
                color: #f5f0e6;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
            }

            .color-name {
                font-size: 10px;
                opacity: 0.7;
                min-width: 45px;
            }

            .color-slot.empty .color-orb {
                opacity: 0.3;
            }

            .color-slot.empty .charge-bar-fill {
                opacity: 0.3;
            }

            .color-slot.empty .color-name {
                opacity: 0.4;
            }

            .color-slot.regenerating .charge-bar-fill {
                animation: regenPulse 1s ease-in-out infinite;
            }

            @keyframes regenPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .color-slot.full .charge-bar-fill {
                box-shadow: 0 0 8px currentColor, 0 0 12px currentColor;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);
        this.uiElement = panel;
    }

    setupEventListeners() {
        // Listen for color extraction events
        window.addEventListener('color-extracted', (e) => {
            const { type, name, hex, position } = e.detail;
            this.extract(type, 25); // Burst extraction

            // Dispatch orb spawn event for 3D effect
            window.dispatchEvent(new CustomEvent('spawn-color-orb', {
                detail: { type, hex, position }
            }));
        });

        // Listen for enemy deaths - drop their colors using new colorDrops array
        window.addEventListener('enemy-died', (e) => {
            const { position, type, colorDrop, colorDrops } = e.detail;

            // New system: use colorDrops array if available
            if (colorDrops && colorDrops.length > 0) {
                let totalDropped = 0;
                const droppedColors = [];

                for (const drop of colorDrops) {
                    this.extract(drop.color, drop.amount);
                    totalDropped += drop.amount;
                    droppedColors.push(drop.color);

                    // Spawn orb effect for each color
                    const colorInfo = this.charges[drop.color];
                    window.dispatchEvent(new CustomEvent('spawn-color-orb', {
                        detail: {
                            type: drop.color,
                            hex: colorInfo?.displayColor,
                            position: position.clone().add(new THREE.Vector3(
                                (Math.random() - 0.5) * 0.5,
                                Math.random() * 0.3,
                                (Math.random() - 0.5) * 0.5
                            ))
                        }
                    }));
                }

                // Show consolidated loot notification for multi-drops
                if (droppedColors.length > 1) {
                    this.showMultiLootNotification(colorDrops);
                } else {
                    this.showLootNotification(colorDrops[0].color, colorDrops[0].amount);
                }
            }
            // Legacy fallback: use single colorDrop
            else if (colorDrop) {
                const dropAmount = type.xpValue >= 20 ? 30 : type.xpValue >= 15 ? 20 : 10;
                this.extract(colorDrop, dropAmount);

                const colorInfo = this.charges[colorDrop];
                window.dispatchEvent(new CustomEvent('spawn-color-orb', {
                    detail: {
                        type: colorDrop,
                        hex: colorInfo?.displayColor,
                        position: position
                    }
                }));

                this.showLootNotification(colorDrop, dropAmount);
            }
        });
    }

    showLootNotification(colorType, amount) {
        if (!this.lootNotification) {
            this.lootNotification = document.createElement('div');
            this.lootNotification.style.cssText = `
                position: fixed;
                top: 25%;
                left: 50%;
                transform: translateX(-50%);
                padding: 6px 12px;
                background: rgba(26, 26, 46, 0.9);
                border: 1px solid rgba(212, 165, 116, 0.5);
                border-radius: 4px;
                font-size: 14px;
                color: #f5f0e6;
                z-index: 150;
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
            `;
            document.body.appendChild(this.lootNotification);
        }

        const colorInfo = this.charges[colorType];
        const colorName = colorInfo?.name || colorType;
        this.lootNotification.innerHTML = `+${amount} <span style="color: #${colorInfo?.displayColor.toString(16).padStart(6, '0') || 'ffffff'}">${colorName}</span> charge`;
        this.lootNotification.style.opacity = '1';

        if (this.lootTimeout) clearTimeout(this.lootTimeout);
        this.lootTimeout = setTimeout(() => {
            this.lootNotification.style.opacity = '0';
        }, 1500);
    }

    showMultiLootNotification(colorDrops) {
        if (!this.lootNotification) {
            this.lootNotification = document.createElement('div');
            this.lootNotification.style.cssText = `
                position: fixed;
                top: 25%;
                left: 50%;
                transform: translateX(-50%);
                padding: 6px 12px;
                background: rgba(26, 26, 46, 0.9);
                border: 1px solid rgba(212, 165, 116, 0.5);
                border-radius: 4px;
                font-size: 14px;
                color: #f5f0e6;
                z-index: 150;
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
            `;
            document.body.appendChild(this.lootNotification);
        }

        // Build multi-color loot string
        const parts = colorDrops.map(drop => {
            const colorInfo = this.charges[drop.color];
            const hex = colorInfo?.displayColor.toString(16).padStart(6, '0') || 'ffffff';
            return `<span style="color: #${hex}">+${drop.amount} ${colorInfo?.name || drop.color}</span>`;
        });

        this.lootNotification.innerHTML = parts.join(' ');
        this.lootNotification.style.opacity = '1';

        if (this.lootTimeout) clearTimeout(this.lootTimeout);
        this.lootTimeout = setTimeout(() => {
            this.lootNotification.style.opacity = '0';
        }, 2500); // Longer display for multi-drops
    }

    /**
     * Update charge regeneration - call from game loop
     * New system: Ivory has fast passive regen, other colors only trickle regen to minCharge
     * @param {number} delta - Time since last update in seconds
     */
    update(delta) {
        if (!this.regenEnabled) return;

        for (const [color, data] of Object.entries(this.charges)) {
            if (data.current < data.max) {
                // Check for normal regen rate (only ivory has this)
                if (data.regenRate > 0) {
                    const regenAmount = data.regenRate * this.regenMultiplier * delta;
                    data.current = Math.min(data.max, data.current + regenAmount);
                }
                // Check for trickle regen when below minCharge (other colors)
                else if (data.minRegen > 0 && data.minCharge > 0 && data.current < data.minCharge) {
                    const trickleAmount = data.minRegen * this.regenMultiplier * delta;
                    data.current = Math.min(data.minCharge, data.current + trickleAmount);
                }
            }
        }

        this.updateUI();
    }

    /**
     * Extract color from environment - burst charge
     * @param {string} color - Color type
     * @param {number} amount - Amount to add (default 25)
     */
    extract(color, amount = 25) {
        if (!this.charges[color]) return false;

        const previous = this.charges[color].current;
        this.charges[color].current = Math.min(
            this.charges[color].max,
            this.charges[color].current + amount
        );

        if (this.charges[color].current !== previous) {
            this.updateUI();
            this.pulseSlot(color);
            return true;
        }
        return false;
    }

    /**
     * Consume charge for ability use
     * @param {string} color - Color type
     * @param {number} amount - Amount to consume
     * @returns {boolean} Whether consume succeeded
     */
    consume(color, amount) {
        if (!this.charges[color]) return false;
        if (this.charges[color].current < amount) return false;

        this.charges[color].current -= amount;
        this.updateUI();
        return true;
    }

    /**
     * Check if there's enough charge (without consuming)
     * @param {string} color - Color type
     * @param {number} amount - Amount to check
     * @returns {boolean} Whether there's enough charge
     */
    hasCharge(color, amount) {
        if (!this.charges[color]) return false;
        return this.charges[color].current >= amount;
    }

    /**
     * Legacy compatibility: add color (maps to extract)
     */
    addColor(type, amount = 1) {
        // Convert old integer amounts to charge amounts (1 color = 10 charge)
        return this.extract(type, amount * 10);
    }

    /**
     * Legacy compatibility: remove color (maps to consume)
     */
    removeColor(type, amount = 1) {
        // Convert old integer amounts to charge amounts (1 color = 10 charge)
        return this.consume(type, amount * 10);
    }

    /**
     * Get current charge for a color
     * @param {string} color - Color type
     * @returns {number} Current charge (0 if invalid color)
     */
    getCharge(color) {
        return this.charges[color]?.current || 0;
    }

    /**
     * Get max charge for a color
     * @param {string} color - Color type
     * @returns {number} Max charge (100 if invalid color)
     */
    getMaxCharge(color) {
        return this.charges[color]?.max || 100;
    }

    /**
     * Legacy compatibility: get color count
     */
    getColor(type) {
        // Return as integer count for backward compatibility
        return Math.floor(this.getCharge(type) / 10);
    }

    /**
     * Get charge percentage for a color
     * @param {string} color - Color type
     * @returns {number} Charge percentage (0-1)
     */
    getChargePercent(color) {
        if (!this.charges[color]) return 0;
        return this.charges[color].current / this.charges[color].max;
    }

    /**
     * Get total charge across all colors
     * @returns {number} Total charge
     */
    getTotalCharge() {
        return Object.values(this.charges).reduce((sum, data) => sum + data.current, 0);
    }

    /**
     * Legacy compatibility
     */
    getTotalColors() {
        return Math.floor(this.getTotalCharge() / 10);
    }

    /**
     * Set regeneration multiplier
     * @param {number} multiplier - Regen rate multiplier
     */
    setRegenMultiplier(multiplier) {
        this.regenMultiplier = multiplier;
    }

    /**
     * Enable/disable regeneration
     * @param {boolean} enabled - Whether regen is enabled
     */
    setRegenEnabled(enabled) {
        this.regenEnabled = enabled;
    }

    updateUI() {
        if (!this.uiElement) return;

        Object.entries(this.charges).forEach(([type, data]) => {
            const slot = this.uiElement.querySelector(`[data-color="${type}"]`);
            if (slot) {
                const fillEl = slot.querySelector('.charge-bar-fill');
                const textEl = slot.querySelector('.charge-text');

                if (fillEl) {
                    const percent = (data.current / data.max) * 100;
                    fillEl.style.width = `${percent}%`;
                }

                if (textEl) {
                    textEl.textContent = `${Math.floor(data.current)}/${data.max}`;
                }

                // Update slot states
                slot.classList.toggle('empty', data.current === 0);
                slot.classList.toggle('full', data.current >= data.max);
                slot.classList.toggle('regenerating', data.current > 0 && data.current < data.max);
            }
        });
    }

    pulseSlot(type) {
        const slot = this.uiElement?.querySelector(`[data-color="${type}"]`);
        if (slot) {
            slot.classList.remove('pulse');
            void slot.offsetWidth; // Force reflow
            slot.classList.add('pulse');
        }
    }

    /**
     * Get all charge data (for wand cost calculation)
     * @returns {Object} Charge data by color
     */
    getAllCharges() {
        const result = {};
        for (const [color, data] of Object.entries(this.charges)) {
            result[color] = {
                current: data.current,
                max: data.max,
                percent: data.current / data.max
            };
        }
        return result;
    }
}

// Color orb effect manager (3D floating orbs)
export class ColorOrbManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.orbs = [];

        // Pre-create shared geometry (performance optimization)
        this.sharedGeometry = new THREE.SphereGeometry(0.15, 8, 8);

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('spawn-color-orb', (e) => {
            const { type, hex, position } = e.detail;
            this.spawnOrb(position, hex || 0xffffff);
        });
    }

    spawnOrb(position, colorHex) {
        // Use shared geometry, only create material
        const material = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.9
        });

        const orb = new THREE.Mesh(this.sharedGeometry, material);
        orb.position.copy(position);

        this.scene.add(orb);

        // Animate orb floating up and toward camera, then fade
        const orbData = {
            mesh: orb,
            startPos: position.clone(),
            startTime: performance.now(),
            duration: 800,
            phase: 'rise' // 'rise' -> 'collect' -> 'done'
        };

        this.orbs.push(orbData);
    }

    update() {
        const now = performance.now();
        const toRemove = [];

        this.orbs.forEach((orb, index) => {
            const elapsed = now - orb.startTime;
            const progress = Math.min(elapsed / orb.duration, 1);

            if (orb.phase === 'rise') {
                // Float upward with slight wobble
                const eased = 1 - Math.pow(1 - progress, 3);
                orb.mesh.position.y = orb.startPos.y + eased * 2;
                orb.mesh.position.x = orb.startPos.x + Math.sin(elapsed * 0.01) * 0.2;
                orb.mesh.position.z = orb.startPos.z + Math.cos(elapsed * 0.01) * 0.2;

                // Pulse scale
                const pulse = 1 + Math.sin(elapsed * 0.02) * 0.1;
                orb.mesh.scale.setScalar(pulse);

                if (progress >= 1) {
                    orb.phase = 'collect';
                    orb.startTime = now;
                    orb.duration = 400;
                    orb.riseEndPos = orb.mesh.position.clone();
                }
            } else if (orb.phase === 'collect') {
                // Zoom toward camera and fade
                const eased = progress * progress;

                // Move toward camera
                const targetPos = this.camera.position.clone();
                targetPos.y -= 0.5;
                orb.mesh.position.lerpVectors(orb.riseEndPos, targetPos, eased);

                // Shrink and fade
                orb.mesh.scale.setScalar(1 - eased * 0.8);
                orb.mesh.material.opacity = 1 - eased;

                if (progress >= 1) {
                    orb.phase = 'done';
                    toRemove.push(index);
                }
            }
        });

        // Remove completed orbs
        toRemove.reverse().forEach(index => {
            const orb = this.orbs[index];
            this.scene.remove(orb.mesh);
            orb.mesh.geometry.dispose();
            orb.mesh.material.dispose();
            this.orbs.splice(index, 1);
        });
    }
}
