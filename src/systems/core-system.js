// core-system.js - 4 particle cores that replace XP/leveling
// Cores: Vitality (health), Shell (armor), Spark (offense), Essence (fuel)
// Each core has capacity, regen rate, and levels up implicitly through use

const CORE_TYPES = {
    VITALITY: 'vitality',
    SHELL: 'shell',
    SPARK: 'spark',
    ESSENCE: 'essence',
};

// Base stats for each core at level 1
const CORE_DEFAULTS = {
    [CORE_TYPES.VITALITY]: { capacity: 30, regenRate: 1.0, color: 0xff3333 },
    [CORE_TYPES.SHELL]:    { capacity: 5,  regenRate: 0.3, color: 0x999999 },
    [CORE_TYPES.SPARK]:    { capacity: 8,  regenRate: 0.4, color: 0xffaa00 },
    [CORE_TYPES.ESSENCE]:  { capacity: 8,  regenRate: 0.4, color: 0x4488ff },
};

// Level-up bonuses (cumulative multipliers at each level)
const LEVEL_BONUSES = [
    { capacityMult: 1.0,  regenMult: 1.0  },  // Level 1 (base)
    { capacityMult: 1.2,  regenMult: 1.15 },  // Level 2
    { capacityMult: 1.45, regenMult: 1.3  },  // Level 3
    { capacityMult: 1.75, regenMult: 1.5  },  // Level 4
    { capacityMult: 2.1,  regenMult: 1.75 },  // Level 5
];

const MAX_LEVEL = 5;

// XP thresholds per level (implicit, player doesn't see numbers)
const XP_THRESHOLDS = [0, 50, 120, 220, 360];

class CoreState {
    constructor(type, defaults, unlocked = true) {
        this.type = type;
        this.baseCapacity = defaults.capacity;
        this.baseRegenRate = defaults.regenRate;
        this.color = defaults.color;
        this.level = 1;
        this.xp = 0;
        this.unlocked = unlocked;

        // Upgrades from found cores (additive to base)
        this.bonusCapacity = 0;
        this.bonusRegenRate = 0;
    }

    /** Current effective capacity (base + bonuses, scaled by level) */
    getCapacity() {
        if (!this.unlocked) return 0;
        const bonus = LEVEL_BONUSES[this.level - 1];
        return Math.floor((this.baseCapacity + this.bonusCapacity) * bonus.capacityMult);
    }

    /** Current effective regen rate */
    getRegenRate() {
        if (!this.unlocked) return 0;
        const bonus = LEVEL_BONUSES[this.level - 1];
        return (this.baseRegenRate + this.bonusRegenRate) * bonus.regenMult;
    }

    /** Glow intensity for visuals (0.2 at level 1, 1.0 at level 5) */
    getGlowIntensity() {
        if (!this.unlocked) return 0;
        return 0.2 + (this.level - 1) * 0.2;
    }
}

class CoreSystem {
    constructor() {
        this.cores = {
            [CORE_TYPES.VITALITY]: new CoreState(CORE_TYPES.VITALITY, CORE_DEFAULTS[CORE_TYPES.VITALITY], true),
            [CORE_TYPES.SHELL]:    new CoreState(CORE_TYPES.SHELL, CORE_DEFAULTS[CORE_TYPES.SHELL], true),
            [CORE_TYPES.SPARK]:    new CoreState(CORE_TYPES.SPARK, CORE_DEFAULTS[CORE_TYPES.SPARK], false), // Locked at start
            [CORE_TYPES.ESSENCE]:  new CoreState(CORE_TYPES.ESSENCE, CORE_DEFAULTS[CORE_TYPES.ESSENCE], true),
        };

        this._setupEventListeners();
    }

    /**
     * Reset all cores to starting state (for new run).
     * Applies fragment bonuses from meta-progression.
     * @param {object} fragments - { vitality, shell, spark, essence } counts
     */
    resetForNewRun(fragments = {}) {
        for (const type of Object.values(CORE_TYPES)) {
            const core = this.cores[type];
            core.level = 1;
            core.xp = 0;
            core.bonusCapacity = 0;
            core.bonusRegenRate = 0;
            core.unlocked = type !== CORE_TYPES.SPARK; // Spark locked by default
        }

        // Apply fragment bonuses
        if (fragments.vitality >= 3) {
            this.cores[CORE_TYPES.VITALITY].bonusCapacity += 2;
        }
        if (fragments.spark >= 3) {
            this.cores[CORE_TYPES.SPARK].level = 2;
        }

        // 5 fragments of any type: +1 augment slot
        const totalFragments = (fragments.vitality || 0) + (fragments.shell || 0) +
                               (fragments.spark || 0) + (fragments.essence || 0);
        if (totalFragments >= 5) {
            window.dispatchEvent(new CustomEvent('fragment-augment-bonus', {
                detail: { bonusSlots: 1 }
            }));
        }

        console.log('[CoreSystem] Reset for new run. Fragment bonuses applied.' +
            (totalFragments > 0 ? ` (${totalFragments} fragments)` : ''));
    }

    /**
     * Unlock a core (e.g., finding the Spark Core in Zone 1).
     * @param {string} type - Core type from CORE_TYPES
     */
    unlockCore(type) {
        const core = this.cores[type];
        if (!core) return;
        if (core.unlocked) return;

        core.unlocked = true;
        console.log(`[CoreSystem] ${type} core unlocked!`);

        window.dispatchEvent(new CustomEvent('core-unlocked', {
            detail: { type, capacity: core.getCapacity(), regenRate: core.getRegenRate() }
        }));
    }

    /**
     * Upgrade a core (found a better version or a shop upgrade).
     * @param {string} type - Core type
     * @param {object} upgrade - { capacity?, regenRate? } bonuses
     */
    absorbCore(type, upgrade = {}) {
        const core = this.cores[type];
        if (!core) return;

        if (upgrade.capacity) {
            core.bonusCapacity += upgrade.capacity;
        }
        if (upgrade.regenRate) {
            core.bonusRegenRate += upgrade.regenRate;
        }

        // Unlock if not already
        if (!core.unlocked) {
            this.unlockCore(type);
        }

        console.log(`[CoreSystem] ${type} core absorbed. Capacity: ${core.getCapacity()}, Regen: ${core.getRegenRate().toFixed(2)}`);

        window.dispatchEvent(new CustomEvent('core-upgraded', {
            detail: { type, capacity: core.getCapacity(), regenRate: core.getRegenRate() }
        }));
    }

    /**
     * Add XP to a core (implicit — happens through gameplay actions).
     * @param {string} type - Core type
     * @param {number} amount - XP to add
     */
    addXP(type, amount) {
        const core = this.cores[type];
        if (!core || !core.unlocked || core.level >= MAX_LEVEL) return;

        core.xp += amount;

        // Check for level-up
        const threshold = XP_THRESHOLDS[core.level]; // XP needed for NEXT level
        if (threshold && core.xp >= threshold) {
            core.xp -= threshold;
            this._levelUp(core);
        }
    }

    /**
     * Get the particle budget for a core type (max particles allowed).
     * @param {string} type - Core type
     * @returns {number} Max particle count
     */
    getParticleBudget(type) {
        const core = this.cores[type];
        return core ? core.getCapacity() : 0;
    }

    /**
     * Get the regen rate for a core type.
     * @param {string} type - Core type
     * @returns {number} Particles regenerated per second
     */
    getRegenRate(type) {
        const core = this.cores[type];
        return core ? core.getRegenRate() : 0;
    }

    /**
     * Check if a core is unlocked.
     * @param {string} type - Core type
     * @returns {boolean}
     */
    isUnlocked(type) {
        const core = this.cores[type];
        return core ? core.unlocked : false;
    }

    /**
     * Get core level (1-5).
     * @param {string} type - Core type
     * @returns {number}
     */
    getLevel(type) {
        const core = this.cores[type];
        return core ? core.level : 0;
    }

    /**
     * Get glow intensity for visual rendering (0-1).
     * @param {string} type - Core type
     * @returns {number}
     */
    getGlowIntensity(type) {
        const core = this.cores[type];
        return core ? core.getGlowIntensity() : 0;
    }

    /**
     * Get core color.
     * @param {string} type - Core type
     * @returns {number} Hex color
     */
    getColor(type) {
        const core = this.cores[type];
        return core ? core.color : 0xffffff;
    }

    /**
     * Get all core states (for UI/debug).
     * @returns {object} Map of type -> { level, capacity, regenRate, unlocked, glowIntensity }
     */
    getAllCoreStates() {
        const result = {};
        for (const [type, core] of Object.entries(this.cores)) {
            result[type] = {
                level: core.level,
                capacity: core.getCapacity(),
                regenRate: core.getRegenRate(),
                unlocked: core.unlocked,
                glowIntensity: core.getGlowIntensity(),
                xp: core.xp,
                color: core.color,
            };
        }
        return result;
    }

    // --- Private ---

    _levelUp(core) {
        if (core.level >= MAX_LEVEL) return;

        core.level++;

        console.log(`[CoreSystem] ${core.type} core leveled up to ${core.level}! ` +
            `Capacity: ${core.getCapacity()}, Regen: ${core.getRegenRate().toFixed(2)}`);

        window.dispatchEvent(new CustomEvent('core-leveled', {
            detail: {
                type: core.type,
                newLevel: core.level,
                capacity: core.getCapacity(),
                regenRate: core.getRegenRate(),
                glowIntensity: core.getGlowIntensity(),
            }
        }));
    }

    _setupEventListeners() {
        // Reset cores when a new run starts
        window.addEventListener('run-reset', (e) => {
            const fragments = e.detail?.fragments || {};
            this.resetForNewRun(fragments);
        });

        // Implicit XP from gameplay:
        // Kill enemies -> Spark XP
        window.addEventListener('enemy-died', () => {
            this.addXP(CORE_TYPES.SPARK, 5);
        });

        // Take damage and survive -> Vitality XP
        window.addEventListener('player-damaged', () => {
            this.addXP(CORE_TYPES.VITALITY, 3);
        });

        // Shell particles absorb hits -> Shell XP (dispatched by damage system)
        window.addEventListener('shell-absorbed', () => {
            this.addXP(CORE_TYPES.SHELL, 4);
        });

        // Power vehicle/abilities -> Essence XP
        window.addEventListener('ability-used', () => {
            this.addXP(CORE_TYPES.ESSENCE, 2);
        });

        // Boss kills drop core fragments (meta-progression)
        window.addEventListener('enemy-died', (e) => {
            const enemyType = e.detail?.type;
            if (!enemyType?.isBoss) return;

            // Pick a random fragment type to drop
            const types = Object.values(CORE_TYPES);
            const fragType = types[Math.floor(Math.random() * types.length)];

            window.dispatchEvent(new CustomEvent('core-fragment-dropped', {
                detail: {
                    type: fragType,
                    position: e.detail.position,
                    count: 1,
                }
            }));
        });

        // Auto-collect dropped fragments (world pickup will be wired by world-dev later)
        window.addEventListener('core-fragment-dropped', (e) => {
            const { type, count } = e.detail;
            this._collectFragment(type, count || 1);
        });
    }

    /**
     * Collect a core fragment. Updates RunManager and dispatches pickup event.
     * @param {string} type - Fragment type from CORE_TYPES
     * @param {number} count - Number of fragments
     */
    _collectFragment(type, count = 1) {
        // Dispatch so RunManager can persist it
        window.dispatchEvent(new CustomEvent('core-fragment-collected', {
            detail: { type, count }
        }));

        console.log(`[CoreSystem] Collected ${count} ${type} fragment(s)`);
    }
}

export { CoreSystem, CORE_TYPES, CORE_DEFAULTS, MAX_LEVEL };
