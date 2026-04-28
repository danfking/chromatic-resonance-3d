// item-generator.js - Procedural item generation from templates

import { ELEMENT_TYPES } from '../creatures/particle-life-creature.js';
import {
    RARITY, RARITY_INFO, EQUIPMENT_SLOTS, SLOT_KEYS,
    ELEMENT_COUNT, STAT_SCALING, SLOT_STAT_WEIGHTS,
    generateName, getNextItemId,
    VEHICLE_COMPONENT_TYPES, VEHICLE_STAT_SCALING, VEHICLE_TYPE_STAT_WEIGHTS,
    generateVehicleComponentName
} from './item-data.js';

export class ItemGenerator {
    constructor() {
        this.elementKeys = Object.values(ELEMENT_TYPES);
    }

    /**
     * Generate a specific item
     * @param {number} level - Player level (1+)
     * @param {number} rarity - RARITY enum value
     * @param {string} slot - Equipment slot key
     * @param {number} [element] - ELEMENT_TYPES value, random if omitted
     * @returns {object} Item object
     */
    generate(level, rarity, slot, element) {
        if (element === undefined) {
            element = this.elementKeys[Math.floor(Math.random() * this.elementKeys.length)];
        }

        const id = getNextItemId();
        const name = generateName(element, slot, rarity);
        const matrixMods = this.generateMatrixMods(element, rarity, level);
        const formation = this.generateFormation(slot, rarity, element);
        const symbiote = rarity === RARITY.LEGENDARY ? this.generateSymbiote(element) : null;
        const stats = this.generateStats(level, rarity, slot);

        return {
            id,
            name,
            slot,
            rarity,
            element,
            level,
            matrixMods,
            formation,
            symbiote,
            stats
        };
    }

    /**
     * Generate a random item with weighted rarity
     * @param {number} level - Player level
     * @param {number} [luckBonus=0] - Shifts rarity weights toward rare+
     * @param {boolean} [guaranteeRarePlus=false] - Minimum rare for boss drops
     * @returns {object} Item object
     */
    generateRandom(level, luckBonus = 0, guaranteeRarePlus = false) {
        const rarity = this.rollRarity(luckBonus, guaranteeRarePlus);
        const slot = SLOT_KEYS[Math.floor(Math.random() * SLOT_KEYS.length)];
        return this.generate(level, rarity, slot);
    }

    /**
     * Roll rarity with weighted random
     */
    rollRarity(luckBonus = 0, guaranteeRarePlus = false) {
        const minRarity = guaranteeRarePlus ? RARITY.RARE : RARITY.COMMON;

        // Build weighted pool
        let totalWeight = 0;
        const weights = [];
        for (let r = minRarity; r <= RARITY.LEGENDARY; r++) {
            let w = RARITY_INFO[r].dropWeight;
            // Luck bonus increases higher rarity weights
            if (r >= RARITY.RARE) w *= (1 + luckBonus * 0.5);
            if (r >= RARITY.EPIC) w *= (1 + luckBonus * 0.3);
            weights.push({ rarity: r, weight: w });
            totalWeight += w;
        }

        let roll = Math.random() * totalWeight;
        for (const entry of weights) {
            roll -= entry.weight;
            if (roll <= 0) return entry.rarity;
        }
        return minRarity;
    }

    /**
     * Generate matrix modifications for the item
     * Primary element gets a same-type attraction boost, plus secondary random perturbations
     */
    generateMatrixMods(element, rarity, level) {
        const mods = [];

        // Primary boost: same-type attraction increase (+0.2 to +0.5 by rarity)
        const primaryDelta = 0.2 + rarity * 0.075;
        mods.push({
            typeA: element,
            typeB: element,
            delta: primaryDelta
        });

        // Secondary perturbations: 1-3 random mods based on rarity
        const secondaryCount = Math.min(1 + Math.floor(rarity / 2), 3);
        for (let i = 0; i < secondaryCount; i++) {
            const typeA = this.elementKeys[Math.floor(Math.random() * ELEMENT_COUNT)];
            const typeB = this.elementKeys[Math.floor(Math.random() * ELEMENT_COUNT)];
            // Smaller perturbations, can be positive or negative
            const delta = (Math.random() - 0.3) * 0.3 * (1 + rarity * 0.2);
            mods.push({ typeA, typeB, delta });
        }

        return mods;
    }

    /**
     * Generate formation data for uncommon+ items
     * Returns null for common items or core slot (no formation type)
     */
    generateFormation(slot, rarity, element) {
        const slotInfo = EQUIPMENT_SLOTS[slot];
        if (!slotInfo.formationType || rarity < RARITY.UNCOMMON) return null;

        const rarityInfo = RARITY_INFO[rarity];
        const attractors = this.generateAttractors(slotInfo.formationType, rarity);

        return {
            type: slotInfo.formationType,
            attractors,
            particleCount: rarityInfo.formationParticles,
            stability: rarityInfo.stability,
            element
        };
    }

    /**
     * Generate attractor point arrays per formation type
     */
    generateAttractors(formationType, rarity) {
        const attractors = [];
        // Normalized radius -- FormationController will clamp to creature's actual radius
        const r = 0.15 + rarity * 0.08; // Keep small; clamped to creature bounds at runtime

        switch (formationType) {
            case 'line': {
                // Weapon: 4-8 attractors along forward Z-axis, within blob
                const count = 4 + Math.floor(rarity * 1.2);
                for (let i = 0; i < count; i++) {
                    const t = i / (count - 1);
                    attractors.push({
                        pos: { x: 0, y: 0, z: r * 0.3 + t * r * 0.7 },
                        strength: 1.0 - t * 0.4
                    });
                }
                break;
            }
            case 'disc': {
                // Guard: 8-16 attractors in flat disc at Z=0.4r
                const count = 8 + Math.floor(rarity * 2);
                const rings = 2;
                for (let ring = 0; ring < rings; ring++) {
                    const ringR = (ring + 1) / rings * r * 0.8;
                    const pointsInRing = Math.floor(count / rings);
                    for (let i = 0; i < pointsInRing; i++) {
                        const angle = (i / pointsInRing) * Math.PI * 2;
                        attractors.push({
                            pos: {
                                x: Math.cos(angle) * ringR,
                                y: Math.sin(angle) * ringR,
                                z: r * 0.4
                            },
                            strength: 0.8 + ring * 0.1
                        });
                    }
                }
                break;
            }
            case 'shell': {
                // Mantle: 12-20 attractors on upper hemisphere (Fibonacci spiral)
                const count = 12 + Math.floor(rarity * 2);
                const goldenAngle = Math.PI * (3 - Math.sqrt(5));
                for (let i = 0; i < count; i++) {
                    const t = i / count;
                    const inclination = Math.acos(1 - t); // Upper hemisphere only
                    const azimuth = goldenAngle * i;
                    attractors.push({
                        pos: {
                            x: Math.sin(inclination) * Math.cos(azimuth) * r,
                            y: Math.cos(inclination) * r * 0.8 + r * 0.2,
                            z: Math.sin(inclination) * Math.sin(azimuth) * r
                        },
                        strength: 0.7 + t * 0.3
                    });
                }
                break;
            }
            case 'ring': {
                // Resonance: 6-10 attractors in equatorial ring
                const count = 6 + Math.floor(rarity * 1);
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2;
                    attractors.push({
                        pos: {
                            x: Math.cos(angle) * r * 0.7,
                            y: 0,
                            z: Math.sin(angle) * r * 0.7
                        },
                        strength: 0.9
                    });
                }
                break;
            }
        }

        return attractors;
    }

    /**
     * Generate symbiote companion config for legendary items
     */
    generateSymbiote(element) {
        // Pick 2 elements for the symbiote: primary + one random
        const secondElement = this.elementKeys[Math.floor(Math.random() * ELEMENT_COUNT)];
        const elements = [element, secondElement];

        // Map elements to colors
        const colorMap = {
            [ELEMENT_TYPES.FIRE]: 0xff6644,
            [ELEMENT_TYPES.WATER]: 0x4488ee,
            [ELEMENT_TYPES.EARTH]: 0x66aa44,
            [ELEMENT_TYPES.AIR]: 0xaaddff,
            [ELEMENT_TYPES.SHADOW]: 0x8844cc,
            [ELEMENT_TYPES.LIGHT]: 0xffee44
        };

        const colors = elements.map(e => colorMap[e] || 0xffffff);
        const particleCount = 30 + Math.floor(Math.random() * 20);
        const radius = 0.15 + Math.random() * 0.1;

        return {
            elements,
            radius,
            particleCount,
            colors
        };
    }

    // =============================================
    // VEHICLE COMPONENT GENERATION
    // =============================================

    /**
     * Generate a vehicle component item
     * @param {object} options
     * @param {number} [options.level=1] - Player level
     * @param {number} [options.rarity] - Force rarity, otherwise random
     * @param {string} [options.componentType] - Force type (propulsion/engine/armor/weapon/utility)
     * @param {number} [options.element] - Force element
     * @param {boolean} [options.guaranteeRarePlus=false] - Minimum Rare quality
     * @param {number} [options.luckBonus=0] - Luck bonus for rarity roll
     * @returns {object} Vehicle component item
     */
    generateVehicleComponent(options = {}) {
        const level = options.level || 1;
        const rarity = options.rarity !== undefined
            ? options.rarity
            : this.rollRarity(options.luckBonus || 0, options.guaranteeRarePlus || false);

        const typeKeys = Object.values(VEHICLE_COMPONENT_TYPES);
        const componentType = options.componentType || typeKeys[Math.floor(Math.random() * typeKeys.length)];

        const element = options.element !== undefined
            ? options.element
            : this.elementKeys[Math.floor(Math.random() * this.elementKeys.length)];

        const id = getNextItemId();
        const name = generateVehicleComponentName(element, componentType, rarity);
        const stats = this.generateVehicleStats(level, rarity, componentType);

        return {
            id,
            name,
            slot: 'vehicle-component',
            componentType,
            rarity,
            element,
            level,
            stats,
            isVehicleComponent: true,
        };
    }

    /**
     * Generate vehicle component stats based on level, rarity, and component type
     */
    generateVehicleStats(level, rarity, componentType) {
        const weights = VEHICLE_TYPE_STAT_WEIGHTS[componentType] || VEHICLE_TYPE_STAT_WEIGHTS.weapon;
        const levelMult = 1 + (level - 1) * 0.1;
        const variance = () => 0.8 + Math.random() * 0.4;

        const stats = {
            mass: Math.round(VEHICLE_STAT_SCALING.massBase[rarity] * levelMult * variance()),
        };

        for (const [statKey, baseValues] of Object.entries(VEHICLE_STAT_SCALING)) {
            if (statKey === 'massBase') continue;
            const cleanKey = statKey; // speedBonus, tractionBonus, etc.
            const weight = weights[cleanKey] || 0;
            if (weight <= 0) continue;
            const base = baseValues[rarity];
            if (base <= 0) continue;
            const value = base * weight * levelMult * variance();
            // Round integers for damage/armor/boostForce, keep decimals for rates
            if (['damageBonus', 'armorBonus', 'boostForce'].includes(cleanKey)) {
                stats[cleanKey] = Math.round(value);
            } else {
                stats[cleanKey] = +value.toFixed(2);
            }
        }

        return stats;
    }

    /**
     * Generate stat bonuses based on level, rarity, and slot
     */
    generateStats(level, rarity, slot) {
        const weights = SLOT_STAT_WEIGHTS[slot] || SLOT_STAT_WEIGHTS.weapon;
        const levelMult = 1 + (level - 1) * 0.1;

        // Random variance factor (0.8 to 1.2)
        const variance = () => 0.8 + Math.random() * 0.4;

        const stats = {};

        if (weights.damage > 0) {
            stats.damage = Math.round(STAT_SCALING.damageBase[rarity] * weights.damage * levelMult * variance());
        } else {
            stats.damage = 0;
        }

        if (weights.health > 0) {
            stats.health = Math.round(STAT_SCALING.healthBase[rarity] * weights.health * levelMult * variance());
        } else {
            stats.health = 0;
        }

        if (weights.speed > 0) {
            stats.speed = +(STAT_SCALING.speedBase[rarity] * weights.speed * variance()).toFixed(2);
        } else {
            stats.speed = 0;
        }

        if (weights.colorEfficiency > 0) {
            stats.colorEfficiency = +(STAT_SCALING.colorEfficiencyBase[rarity] * weights.colorEfficiency * variance()).toFixed(3);
        } else {
            stats.colorEfficiency = 0;
        }

        if (weights.regenRate > 0) {
            stats.regenRate = +(STAT_SCALING.regenRateBase[rarity] * weights.regenRate * variance()).toFixed(2);
        } else {
            stats.regenRate = 0;
        }

        if (weights.armorBonus > 0) {
            stats.armorBonus = Math.round(STAT_SCALING.armorBonusBase[rarity] * weights.armorBonus * variance());
        } else {
            stats.armorBonus = 0;
        }

        return stats;
    }
}
