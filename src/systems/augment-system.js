// augment-system.js - Noita-style augment system for vehicle components
// Augments modify projectile behavior, defense, and movement.
// Applied to vehicle components via VehicleBuilder's augment slots.

// Augment target types (maps to vehicle slots)
const AUGMENT_TARGETS = {
    WEAPON: 'weapon',
    CHASSIS: 'chassis',
    ENGINE: 'engine',
};

// All augment definitions
const AUGMENT_CATALOG = {
    // === WEAPON AUGMENTS (6 for alpha) ===
    scatter: {
        id: 'scatter',
        name: 'Scatter',
        target: AUGMENT_TARGETS.WEAPON,
        tier: 1,
        description: 'Projectiles split into 3 on fire',
        effect: { splitCount: 3, spreadAngle: 15 },
        icon: 'scatter',
    },
    burn: {
        id: 'burn',
        name: 'Burn',
        target: AUGMENT_TARGETS.WEAPON,
        tier: 1,
        description: 'Projectiles ignite targets on hit',
        effect: { burnDamage: 5, burnDuration: 1.0 },
        icon: 'burn',
    },
    pierce: {
        id: 'pierce',
        name: 'Pierce',
        target: AUGMENT_TARGETS.WEAPON,
        tier: 2,
        description: 'Projectiles pass through 1 target',
        effect: { pierceCount: 1 },
        icon: 'pierce',
    },
    homing: {
        id: 'homing',
        name: 'Homing',
        target: AUGMENT_TARGETS.WEAPON,
        tier: 3,
        description: 'Slight tracking toward nearest enemy',
        effect: { homingStrength: 0.3, homingRange: 12 },
        icon: 'homing',
    },
    chainLightning: {
        id: 'chainLightning',
        name: 'Chain Lightning',
        target: AUGMENT_TARGETS.WEAPON,
        tier: 2,
        description: 'Hit arcs to nearby enemies',
        effect: { chainCount: 2, chainRange: 6, chainDamageMult: 0.6 },
        icon: 'chain',
    },
    acidPool: {
        id: 'acidPool',
        name: 'Acid Pool',
        target: AUGMENT_TARGETS.WEAPON,
        tier: 2,
        description: 'Impact leaves damage-over-time puddle',
        effect: { poolDamage: 3, poolDuration: 3.0, poolRadius: 1.5 },
        icon: 'acid',
    },

    // === CHASSIS / DEFENSIVE AUGMENTS (3 for alpha) ===
    thorns: {
        id: 'thorns',
        name: 'Thorns',
        target: AUGMENT_TARGETS.CHASSIS,
        tier: 1,
        description: 'Melee attackers take damage',
        effect: { thornsDamage: 8 },
        icon: 'thorns',
    },
    regenBoost: {
        id: 'regenBoost',
        name: 'Regen Boost',
        target: AUGMENT_TARGETS.CHASSIS,
        tier: 2,
        description: 'Shell particles regenerate faster',
        effect: { shellRegenMult: 1.5 },
        icon: 'regen',
    },
    reflect: {
        id: 'reflect',
        name: 'Reflect',
        target: AUGMENT_TARGETS.CHASSIS,
        tier: 3,
        description: 'Small chance to bounce projectiles back',
        effect: { reflectChance: 0.15 },
        icon: 'reflect',
    },

    // === ENGINE AUGMENTS (3 for alpha) ===
    nitroBurst: {
        id: 'nitroBurst',
        name: 'Nitro Burst',
        target: AUGMENT_TARGETS.ENGINE,
        tier: 1,
        description: 'Short speed boost on cooldown',
        effect: { nitroSpeedMult: 2.0, nitroDuration: 1.5, nitroCooldown: 8.0 },
        icon: 'nitro',
    },
    ramPlate: {
        id: 'ramPlate',
        name: 'Ram Plate',
        target: AUGMENT_TARGETS.ENGINE,
        tier: 2,
        description: 'Collision damage to enemies',
        effect: { ramDamage: 20, ramSpeedThreshold: 5 },
        icon: 'ram',
    },
    efficiency: {
        id: 'efficiency',
        name: 'Efficiency',
        target: AUGMENT_TARGETS.ENGINE,
        tier: 1,
        description: 'Reduced essence drain',
        effect: { essenceDrainMult: 0.6 },
        icon: 'efficiency',
    },
};

// Augment combination bonuses (when 2+ specific augments are equipped)
const AUGMENT_COMBOS = [
    {
        name: 'Inferno Shotgun',
        requires: ['scatter', 'burn'],
        bonus: { burnDamage: 3, description: 'Scatter + Burn = ignites a crowd' },
    },
    {
        name: 'Lightning Rod',
        requires: ['pierce', 'chainLightning'],
        bonus: { chainCount: 1, description: 'Pierce + Chain = chains through a line' },
    },
    {
        name: 'Acid Seeker',
        requires: ['homing', 'acidPool'],
        bonus: { poolRadius: 0.5, description: 'Homing + Acid = seeking acid bombs' },
    },
    {
        name: 'Armored Striker',
        requires: ['thorns', 'ramPlate'],
        bonus: { thornsDamage: 5, description: 'Thorns + Ram = melee counter-attacker' },
    },
    {
        name: 'Perpetual Motion',
        requires: ['regenBoost', 'efficiency'],
        bonus: { shellRegenMult: 0.25, description: 'Regen + Efficiency = self-sustaining' },
    },
];

class AugmentSystem {
    constructor() {
        // Applied augments per vehicle slot: { weapon: ['scatter', 'burn'], chassis: [], engine: [] }
        this.applied = {
            [AUGMENT_TARGETS.WEAPON]: [],
            [AUGMENT_TARGETS.CHASSIS]: [],
            [AUGMENT_TARGETS.ENGINE]: [],
        };

        // Active combo bonuses
        this.activeCombos = [];

        // Augment inventory (found but not yet applied)
        this.inventory = [];

        // Bonus augment slots from fragments
        this.bonusSlots = 0;

        this._setupEventListeners();
    }

    /**
     * Apply an augment to a vehicle component slot.
     * @param {string} targetSlot - AUGMENT_TARGETS value ('weapon', 'chassis', 'engine')
     * @param {string} augmentId - Key from AUGMENT_CATALOG
     * @param {number} maxSlots - Max augment slots on this component
     * @returns {boolean} Whether the augment was successfully applied
     */
    applyAugment(targetSlot, augmentId, maxSlots = 1) {
        const augment = AUGMENT_CATALOG[augmentId];
        if (!augment) {
            console.warn(`[AugmentSystem] Unknown augment: ${augmentId}`);
            return false;
        }
        if (augment.target !== targetSlot) {
            console.warn(`[AugmentSystem] ${augmentId} cannot be applied to ${targetSlot}`);
            return false;
        }

        const effectiveMaxSlots = maxSlots + this.bonusSlots;
        if (this.applied[targetSlot].length >= effectiveMaxSlots) {
            console.warn(`[AugmentSystem] ${targetSlot} has no free augment slots`);
            return false;
        }

        // Check for duplicate
        if (this.applied[targetSlot].includes(augmentId)) {
            console.warn(`[AugmentSystem] ${augmentId} already applied to ${targetSlot}`);
            return false;
        }

        this.applied[targetSlot].push(augmentId);

        // Remove from inventory if present
        const invIdx = this.inventory.indexOf(augmentId);
        if (invIdx >= 0) {
            this.inventory.splice(invIdx, 1);
        }

        this._detectCombos();

        console.log(`[AugmentSystem] Applied ${augment.name} to ${targetSlot}`);

        window.dispatchEvent(new CustomEvent('augment-applied', {
            detail: { augmentId, targetSlot, augment, activeCombos: this.activeCombos }
        }));

        return true;
    }

    /**
     * Remove an augment from a vehicle component slot.
     * @param {string} targetSlot
     * @param {number} slotIndex - Index within the slot's augment list
     * @returns {string|null} Removed augment ID
     */
    removeAugment(targetSlot, slotIndex) {
        const list = this.applied[targetSlot];
        if (!list || slotIndex < 0 || slotIndex >= list.length) return null;

        const augmentId = list.splice(slotIndex, 1)[0];
        this.inventory.push(augmentId);

        this._detectCombos();

        console.log(`[AugmentSystem] Removed ${AUGMENT_CATALOG[augmentId]?.name} from ${targetSlot}`);

        window.dispatchEvent(new CustomEvent('augment-removed', {
            detail: { augmentId, targetSlot }
        }));

        return augmentId;
    }

    /**
     * Add an augment to inventory (found/purchased, not yet applied).
     * @param {string} augmentId
     */
    addToInventory(augmentId) {
        if (!AUGMENT_CATALOG[augmentId]) return;
        this.inventory.push(augmentId);

        console.log(`[AugmentSystem] +${AUGMENT_CATALOG[augmentId].name} added to inventory`);

        window.dispatchEvent(new CustomEvent('augment-found', {
            detail: { augmentId, augment: AUGMENT_CATALOG[augmentId] }
        }));
    }

    /**
     * Get the aggregate effect for a target slot (merged effects of all applied augments).
     * @param {string} targetSlot
     * @returns {object} Merged effect object
     */
    getSlotEffects(targetSlot) {
        const effects = {};
        for (const augmentId of (this.applied[targetSlot] || [])) {
            const augment = AUGMENT_CATALOG[augmentId];
            if (!augment) continue;
            for (const [key, value] of Object.entries(augment.effect)) {
                if (typeof value === 'number') {
                    effects[key] = (effects[key] || 0) + value;
                } else {
                    effects[key] = value;
                }
            }
        }

        // Apply combo bonuses
        for (const combo of this.activeCombos) {
            for (const [key, value] of Object.entries(combo.bonus)) {
                if (key === 'description') continue;
                if (typeof value === 'number') {
                    effects[key] = (effects[key] || 0) + value;
                } else {
                    effects[key] = value;
                }
            }
        }

        return effects;
    }

    /**
     * Get weapon effects specifically (convenience wrapper).
     */
    getWeaponEffects() {
        return this.getSlotEffects(AUGMENT_TARGETS.WEAPON);
    }

    /**
     * Get defense effects specifically.
     */
    getDefenseEffects() {
        return this.getSlotEffects(AUGMENT_TARGETS.CHASSIS);
    }

    /**
     * Get engine effects specifically.
     */
    getEngineEffects() {
        return this.getSlotEffects(AUGMENT_TARGETS.ENGINE);
    }

    /**
     * Get all applied augments for a slot.
     * @param {string} targetSlot
     * @returns {Array<object>} Array of augment definitions
     */
    getApplied(targetSlot) {
        return (this.applied[targetSlot] || []).map(id => ({ id, ...AUGMENT_CATALOG[id] }));
    }

    /**
     * Get augment inventory (found but not applied).
     * @returns {Array<object>}
     */
    getInventory() {
        return this.inventory.map(id => ({ id, ...AUGMENT_CATALOG[id] }));
    }

    /**
     * Get active combo bonuses.
     * @returns {Array<object>}
     */
    getActiveCombos() {
        return [...this.activeCombos];
    }

    /**
     * Reset all augments (new run).
     */
    reset() {
        for (const slot of Object.values(AUGMENT_TARGETS)) {
            this.applied[slot] = [];
        }
        this.inventory = [];
        this.activeCombos = [];
        this.bonusSlots = 0;
    }

    // --- Private ---

    _detectCombos() {
        // Collect all applied augment IDs across all slots
        const allApplied = new Set();
        for (const slot of Object.values(AUGMENT_TARGETS)) {
            for (const id of this.applied[slot]) {
                allApplied.add(id);
            }
        }

        // Check each combo
        this.activeCombos = [];
        for (const combo of AUGMENT_COMBOS) {
            const hasAll = combo.requires.every(id => allApplied.has(id));
            if (hasAll) {
                this.activeCombos.push(combo);
                console.log(`[AugmentSystem] Combo active: ${combo.name} — ${combo.bonus.description}`);
            }
        }
    }

    _setupEventListeners() {
        // Reset on new run
        window.addEventListener('run-reset', () => {
            this.reset();
        });

        // Bonus augment slots from core fragments
        window.addEventListener('fragment-augment-bonus', (e) => {
            this.bonusSlots += e.detail.bonusSlots || 0;
            console.log(`[AugmentSystem] +${e.detail.bonusSlots} bonus augment slots from fragments`);
        });
    }
}

export { AugmentSystem, AUGMENT_CATALOG, AUGMENT_TARGETS, AUGMENT_COMBOS };
