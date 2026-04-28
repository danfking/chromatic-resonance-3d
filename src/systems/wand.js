// wand.js - Color-based wand system with toggle and blend mechanics
// Replaces the Noita-style slot system with color toggles and blended projectiles

/**
 * Color effect definitions - each color adds a unique effect to projectiles
 */
export const COLOR_EFFECTS = {
    ivory: {
        name: 'Pure',
        description: 'No modification - pure mana',
        effect: null,
        hex: 0xeeeedd
    },
    crimson: {
        name: 'Burn',
        description: 'Deals 5 damage over 1 second',
        effect: 'burn',
        burnDamage: 5,
        burnDuration: 1000,
        hex: 0xc44444
    },
    azure: {
        name: 'Slow',
        description: '30% slow for 1.5 seconds',
        effect: 'slow',
        slowAmount: 0.3,
        slowDuration: 1500,
        hex: 0x4477aa
    },
    verdant: {
        name: 'Lifesteal',
        description: 'Heal 10% of damage dealt',
        effect: 'lifesteal',
        healPercent: 0.1,
        hex: 0x44aa66
    },
    golden: {
        name: 'Pierce',
        description: 'Pass through 1 enemy',
        effect: 'pierce',
        pierceCount: 1,
        hex: 0xddaa44
    },
    violet: {
        name: 'Homing',
        description: 'Light tracking toward enemies',
        effect: 'homing',
        trackingStrength: 3,
        hex: 0x8855aa
    }
};

/**
 * Color combination bonuses when multiple colors are combined
 */
export const COLOR_COMBOS = {
    'crimson+azure': {
        name: 'Steam Burst',
        description: 'Creates blinding steam cloud',
        bonusDamage: 1.2,
        effect: 'steam'
    },
    'crimson+verdant': {
        name: 'Wildfire',
        description: 'Spreading fire damage',
        bonusDamage: 1.3,
        effect: 'wildfire'
    },
    'azure+verdant': {
        name: 'Healing Rain',
        description: 'Creates healing zone on impact',
        bonusDamage: 1.1,
        effect: 'healingRain'
    },
    'golden+violet': {
        name: 'Prismatic Ray',
        description: 'Multi-bounce beam',
        bonusDamage: 1.4,
        effect: 'prismatic'
    },
    'crimson+golden': {
        name: 'Inferno',
        description: 'Massive fire explosion',
        bonusDamage: 1.35,
        effect: 'inferno'
    },
    'azure+violet': {
        name: 'Void Freeze',
        description: 'Freezes enemies in time',
        bonusDamage: 1.25,
        effect: 'voidFreeze'
    },
    'crimson+violet': {
        name: 'Chaos Bolt',
        description: 'Unpredictable damage',
        bonusDamage: 1.5,
        effect: 'chaos'
    },
    'azure+golden': {
        name: 'Flash Freeze',
        description: 'Instant area slow',
        bonusDamage: 1.2,
        effect: 'flashFreeze'
    },
    'verdant+golden': {
        name: 'Solar Bloom',
        description: 'Heals and damages in area',
        bonusDamage: 1.25,
        effect: 'solarBloom'
    },
    'verdant+violet': {
        name: 'Life Drain',
        description: 'Strong lifesteal effect',
        bonusDamage: 1.3,
        effect: 'lifeDrain'
    }
};

/**
 * ColorWand - Main wand class with color toggle system
 */
export class ColorWand {
    constructor() {
        // Enabled colors - ivory is always enabled and cannot be disabled
        this.enabledColors = new Set(['ivory']);

        // Wand mode: 'single' cycles through colors, 'multi' fires all at once
        this.mode = 'single';

        // Current color index for single mode cycling
        this.currentColorIndex = 0;

        // Casting stats
        this.castDelay = 300;       // ms between casts
        this.lastCastTime = 0;
        this.baseDamage = 15;
        this.baseCost = 10;         // Ivory cost per shot
        this.colorCost = 8;         // Additional color cost per non-ivory color

        // Projectile stats
        this.projectileSpeed = 25;
        this.projectileLifetime = 2000;
    }

    /**
     * Toggle a color on/off (cannot toggle ivory)
     * @param {string} color - Color to toggle
     * @returns {boolean} New enabled state
     */
    toggleColor(color) {
        if (color === 'ivory') return true; // Cannot disable ivory

        if (this.enabledColors.has(color)) {
            this.enabledColors.delete(color);
            return false;
        } else {
            this.enabledColors.add(color);
            return true;
        }
    }

    /**
     * Check if a color is enabled
     * @param {string} color - Color to check
     * @returns {boolean}
     */
    isColorEnabled(color) {
        return this.enabledColors.has(color);
    }

    /**
     * Get all enabled colors as array
     * @returns {string[]}
     */
    getEnabledColors() {
        return Array.from(this.enabledColors);
    }

    /**
     * Set wand mode
     * @param {string} mode - 'single' or 'multi'
     */
    setMode(mode) {
        if (mode === 'single' || mode === 'multi') {
            this.mode = mode;
            this.currentColorIndex = 0;
        }
    }

    /**
     * Get colors for next shot based on mode
     * @returns {string[]} Array of colors for this shot
     */
    getNextShotColors() {
        const enabled = this.getEnabledColors();

        if (this.mode === 'multi') {
            // Multi mode: fire all enabled colors blended together
            return enabled;
        }

        // Single mode: cycle through enabled colors
        if (enabled.length === 0) return ['ivory'];

        const color = enabled[this.currentColorIndex % enabled.length];
        this.currentColorIndex++;
        return [color];
    }

    /**
     * Calculate resource cost for a set of colors
     * @param {string[]} colors - Colors being used
     * @returns {Object} Cost per color { ivory: X, crimson: Y, ... }
     */
    calculateCost(colors) {
        const costs = {};

        // Ivory always costs base amount
        costs.ivory = this.baseCost;

        // Each additional color costs colorCost of that color
        for (const color of colors) {
            if (color !== 'ivory') {
                costs[color] = this.colorCost;
            }
        }

        return costs;
    }

    /**
     * Check if enough resources to fire
     * @param {Object} colorInventory - ColorInventory instance
     * @returns {boolean}
     */
    canFire(colorInventory) {
        const colors = this.mode === 'multi' ? this.getEnabledColors() : this.getNextShotColors();
        const costs = this.calculateCost(colors);

        // Reset index since getNextShotColors advanced it
        if (this.mode === 'single') this.currentColorIndex--;

        for (const [color, cost] of Object.entries(costs)) {
            if (!colorInventory.hasCharge(color, cost)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Fire the wand - returns projectile config or null
     * @param {Object} colorInventory - ColorInventory instance
     * @returns {Object|null} Projectile configuration
     */
    fire(colorInventory) {
        const now = performance.now();

        // Check cooldown
        if (now - this.lastCastTime < this.castDelay) {
            return null;
        }

        // Get colors for this shot
        let colors = this.getNextShotColors();

        // Filter to colors with available charge (graceful degradation)
        const availableColors = colors.filter(color => {
            const cost = color === 'ivory' ? this.baseCost : this.colorCost;
            return colorInventory.hasCharge(color, cost);
        });

        // Must have at least ivory to fire
        if (!availableColors.includes('ivory')) {
            if (!colorInventory.hasCharge('ivory', this.baseCost)) {
                // Reset cycle if failed completely
                if (this.mode === 'single') this.currentColorIndex--;
                return null;
            }
            // Add ivory if we have charge for it
            availableColors.unshift('ivory');
        }

        // Use available colors (may be subset of originally enabled colors)
        colors = availableColors;
        const costs = this.calculateCost(colors);

        // Consume resources
        for (const [color, cost] of Object.entries(costs)) {
            colorInventory.consume(color, cost);
        }

        this.lastCastTime = now;

        // Build projectile configuration
        return this.buildProjectileConfig(colors);
    }

    /**
     * Build projectile configuration from colors
     * @param {string[]} colors - Colors for this projectile
     * @returns {Object} Projectile config
     */
    buildProjectileConfig(colors) {
        const config = {
            colors: colors,
            blendedColor: this.blendColors(colors),
            damage: this.baseDamage,
            speed: this.projectileSpeed,
            lifetime: this.projectileLifetime,
            effects: [],
            combo: null
        };

        // Collect effects from each color
        for (const color of colors) {
            const colorEffect = COLOR_EFFECTS[color];
            if (colorEffect && colorEffect.effect) {
                config.effects.push({
                    type: colorEffect.effect,
                    ...colorEffect
                });
            }
        }

        // Check for color combos (only with 2+ non-ivory colors)
        const nonIvoryColors = colors.filter(c => c !== 'ivory');
        if (nonIvoryColors.length >= 2) {
            const combo = this.findCombo(nonIvoryColors);
            if (combo) {
                config.combo = combo;
                config.damage *= combo.bonusDamage;
            }
        }

        // Multi-color shots get slight damage bonus per color
        if (colors.length > 1) {
            config.damage *= 1 + (colors.length - 1) * 0.1;
        }

        return config;
    }

    /**
     * Find combo effect for a set of colors
     * @param {string[]} colors - Non-ivory colors
     * @returns {Object|null} Combo effect or null
     */
    findCombo(colors) {
        // Sort and check all pairs
        const sorted = [...colors].sort();
        for (let i = 0; i < sorted.length - 1; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                const key = `${sorted[i]}+${sorted[j]}`;
                if (COLOR_COMBOS[key]) {
                    return { ...COLOR_COMBOS[key], colors: [sorted[i], sorted[j]] };
                }
            }
        }
        return null;
    }

    /**
     * Blend multiple colors into single RGB
     * @param {string[]} colors - Colors to blend
     * @returns {number} Blended hex color
     */
    blendColors(colors) {
        if (colors.length === 0) return 0xeeeedd;
        if (colors.length === 1) return COLOR_EFFECTS[colors[0]]?.hex || 0xeeeedd;

        // Average RGB values
        let r = 0, g = 0, b = 0;
        for (const color of colors) {
            const hex = COLOR_EFFECTS[color]?.hex || 0xffffff;
            r += (hex >> 16) & 0xff;
            g += (hex >> 8) & 0xff;
            b += hex & 0xff;
        }

        r = Math.round(r / colors.length);
        g = Math.round(g / colors.length);
        b = Math.round(b / colors.length);

        return (r << 16) | (g << 8) | b;
    }

    /**
     * Get display info for UI
     * @returns {Object}
     */
    getDisplayInfo() {
        return {
            enabledColors: this.getEnabledColors(),
            mode: this.mode,
            castDelay: this.castDelay,
            baseDamage: this.baseDamage,
            baseCost: this.baseCost,
            colorCost: this.colorCost
        };
    }

    /**
     * Get available combos based on enabled colors
     * @returns {Object[]} Array of available combos
     */
    getAvailableCombos() {
        const enabled = this.getEnabledColors().filter(c => c !== 'ivory');
        const combos = [];

        for (const [key, combo] of Object.entries(COLOR_COMBOS)) {
            const [color1, color2] = key.split('+');
            if (enabled.includes(color1) && enabled.includes(color2)) {
                combos.push({ ...combo, key, colors: [color1, color2] });
            }
        }

        return combos;
    }
}

// Legacy exports for backwards compatibility
export class Wand extends ColorWand {
    constructor(options = {}) {
        super();
        // Map old options if provided
        if (options.castDelay) this.castDelay = options.castDelay;
    }
}

export class WandManager {
    constructor() {
        this.wands = [new ColorWand()];
        this.activeWandIndex = 0;
    }

    getActiveWand() {
        return this.wands[this.activeWandIndex];
    }

    nextWand() {
        this.activeWandIndex = (this.activeWandIndex + 1) % this.wands.length;
    }

    prevWand() {
        this.activeWandIndex = (this.activeWandIndex - 1 + this.wands.length) % this.wands.length;
    }
}

// Legacy preset stub for compatibility
export const WAND_PRESETS = {};
