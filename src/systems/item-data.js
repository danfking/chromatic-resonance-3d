// item-data.js - Constants, schemas, and name generation tables for the Living Arsenal system

import { ELEMENT_TYPES } from '../creatures/particle-life-creature.js';

// Rarity levels
export const RARITY = {
    COMMON: 0,
    UNCOMMON: 1,
    RARE: 2,
    EPIC: 3,
    LEGENDARY: 4
};

// Rarity display info
export const RARITY_INFO = {
    [RARITY.COMMON]: {
        name: 'Common',
        color: '#888888',
        colorHex: 0x888888,
        stability: 0,
        formationParticles: 0,
        dropWeight: 60
    },
    [RARITY.UNCOMMON]: {
        name: 'Uncommon',
        color: '#44cc44',
        colorHex: 0x44cc44,
        stability: 0.3,
        formationParticles: 15,
        dropWeight: 25
    },
    [RARITY.RARE]: {
        name: 'Rare',
        color: '#4488ff',
        colorHex: 0x4488ff,
        stability: 0.55,
        formationParticles: 30,
        dropWeight: 10
    },
    [RARITY.EPIC]: {
        name: 'Epic',
        color: '#bb44ff',
        colorHex: 0xbb44ff,
        stability: 0.75,
        formationParticles: 50,
        dropWeight: 4
    },
    [RARITY.LEGENDARY]: {
        name: 'Legendary',
        color: '#ffaa22',
        colorHex: 0xffaa22,
        stability: 0.95,
        formationParticles: 70,
        dropWeight: 1
    }
};

// Equipment slot definitions
export const EQUIPMENT_SLOTS = {
    weapon: { name: 'Weapon', formationType: 'line' },
    guard: { name: 'Guard', formationType: 'disc' },
    core: { name: 'Core', formationType: null },
    mantle: { name: 'Mantle', formationType: 'shell' },
    resonance1: { name: 'Resonance I', formationType: 'ring' },
    resonance2: { name: 'Resonance II', formationType: 'ring' }
};

export const SLOT_KEYS = Object.keys(EQUIPMENT_SLOTS);

// Map ELEMENT_TYPES indices to display names
export const ELEMENT_NAMES = {
    [ELEMENT_TYPES.FIRE]: 'Fire',
    [ELEMENT_TYPES.WATER]: 'Water',
    [ELEMENT_TYPES.EARTH]: 'Earth',
    [ELEMENT_TYPES.AIR]: 'Air',
    [ELEMENT_TYPES.SHADOW]: 'Shadow',
    [ELEMENT_TYPES.LIGHT]: 'Light'
};

// Element colors for UI and world drops
export const ELEMENT_COLORS = {
    [ELEMENT_TYPES.FIRE]: 0xff4444,
    [ELEMENT_TYPES.WATER]: 0x4488ee,
    [ELEMENT_TYPES.EARTH]: 0x44aa44,
    [ELEMENT_TYPES.AIR]: 0xaaddff,
    [ELEMENT_TYPES.SHADOW]: 0x8855aa,
    [ELEMENT_TYPES.LIGHT]: 0xffdd44
};

export const ELEMENT_COUNT = Object.keys(ELEMENT_TYPES).length;

// Name generation tables
const PREFIXES = {
    [ELEMENT_TYPES.FIRE]: ['Blazing', 'Smoldering', 'Infernal', 'Scorching', 'Molten'],
    [ELEMENT_TYPES.WATER]: ['Tidal', 'Frozen', 'Abyssal', 'Rippling', 'Glacial'],
    [ELEMENT_TYPES.EARTH]: ['Stonebound', 'Rooted', 'Ironclad', 'Crystal', 'Fossilized'],
    [ELEMENT_TYPES.AIR]: ['Gale', 'Whispering', 'Cyclonic', 'Drifting', 'Zephyr'],
    [ELEMENT_TYPES.SHADOW]: ['Void', 'Eclipse', 'Umbral', 'Phantom', 'Dusk'],
    [ELEMENT_TYPES.LIGHT]: ['Radiant', 'Solar', 'Prismatic', 'Dawn', 'Luminous']
};

const ROOTS = {
    weapon: ['Fang', 'Spike', 'Lash', 'Barb', 'Talon'],
    guard: ['Aegis', 'Ward', 'Bulwark', 'Shell', 'Barrier'],
    core: ['Heart', 'Nexus', 'Core', 'Seed', 'Pulse'],
    mantle: ['Shroud', 'Cloak', 'Veil', 'Mantle', 'Aura'],
    resonance1: ['Echo', 'Chime', 'Tone', 'Hum', 'Resonance'],
    resonance2: ['Echo', 'Chime', 'Tone', 'Hum', 'Resonance']
};

const SUFFIXES = {
    [RARITY.COMMON]: ['', '', '', '', ''],
    [RARITY.UNCOMMON]: [' of Vigor', ' of Flux', ' of Might', '', ''],
    [RARITY.RARE]: [' of Storms', ' of Ruin', ' of the Depths', ' of Fury', ' of Tides'],
    [RARITY.EPIC]: [' of Annihilation', ' of the Void', ' of Eternity', ' of Cataclysm', ' of the Abyss'],
    [RARITY.LEGENDARY]: [' of the Colossus', ' of the Cosmos', ' of the Primordial', ' of Creation', ' of Apocalypse']
};

/**
 * Generate a procedural name for an item
 */
export function generateName(element, slot, rarity) {
    const prefixes = PREFIXES[element] || PREFIXES[ELEMENT_TYPES.FIRE];
    const roots = ROOTS[slot] || ROOTS.weapon;
    const suffixes = SUFFIXES[rarity] || SUFFIXES[RARITY.COMMON];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const root = roots[Math.floor(Math.random() * roots.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    return `${prefix} ${root}${suffix}`;
}

// Stat scaling per rarity and level
export const STAT_SCALING = {
    damageBase: [5, 8, 12, 18, 28],
    healthBase: [10, 20, 35, 55, 80],
    speedBase: [0, 0.3, 0.6, 1.0, 1.5],
    colorEfficiencyBase: [0, 0.05, 0.1, 0.18, 0.3],
    regenRateBase: [0, 0.5, 1.0, 2.0, 3.5],
    armorBonusBase: [0, 5, 10, 18, 30]
};

// Slot stat weights - which slots favor which stats
export const SLOT_STAT_WEIGHTS = {
    weapon: { damage: 1.5, health: 0.3, speed: 0.5, colorEfficiency: 0.8, regenRate: 0, armorBonus: 0 },
    guard: { damage: 0, health: 0.8, speed: 0, colorEfficiency: 0.3, regenRate: 0.5, armorBonus: 1.5 },
    core: { damage: 0.5, health: 1.5, speed: 0, colorEfficiency: 0.5, regenRate: 1.0, armorBonus: 0.5 },
    mantle: { damage: 0.3, health: 0.5, speed: 0.8, colorEfficiency: 0.3, regenRate: 0.5, armorBonus: 1.0 },
    resonance1: { damage: 0.8, health: 0.3, speed: 0.3, colorEfficiency: 1.5, regenRate: 0.3, armorBonus: 0 },
    resonance2: { damage: 0.8, health: 0.3, speed: 0.3, colorEfficiency: 1.5, regenRate: 0.3, armorBonus: 0 }
};

// =============================================
// VEHICLE COMPONENT DEFINITIONS
// =============================================

// Vehicle component types (matches vehicle-components.js categories)
export const VEHICLE_COMPONENT_TYPES = {
    PROPULSION: 'propulsion',
    ENGINE: 'engine',
    ARMOR: 'armor',
    WEAPON: 'weapon',
    UTILITY: 'utility',
};

// Vehicle socket layout for the customization UI
export const VEHICLE_SOCKET_LAYOUT = {
    'weapon-1':  { name: 'Weapon Mount 1', type: 'weapon',     row: 0, col: 0 },
    'weapon-2':  { name: 'Weapon Mount 2', type: 'weapon',     row: 0, col: 1 },
    'weapon-3':  { name: 'Weapon Mount 3', type: 'weapon',     row: 0, col: 2 },
    'weapon-4':  { name: 'Weapon Mount 4', type: 'weapon',     row: 0, col: 3 },
    'wheel-fl':  { name: 'Front Left Wheel',  type: 'propulsion', row: 1, col: 0 },
    'wheel-fr':  { name: 'Front Right Wheel', type: 'propulsion', row: 1, col: 1 },
    'wheel-rl':  { name: 'Rear Left Wheel',   type: 'propulsion', row: 1, col: 2 },
    'wheel-rr':  { name: 'Rear Right Wheel',  type: 'propulsion', row: 1, col: 3 },
    'engine':    { name: 'Engine',       type: 'engine',     row: 2, col: 0 },
    'utility-1': { name: 'Utility Slot 1', type: 'utility',   row: 2, col: 2 },
    'utility-2': { name: 'Utility Slot 2', type: 'utility',   row: 2, col: 3 },
};

export const VEHICLE_SOCKET_KEYS = Object.keys(VEHICLE_SOCKET_LAYOUT);

// Vehicle component name generation
const VEHICLE_ROOTS = {
    propulsion: ['Treads', 'Wheels', 'Tracks', 'Rollers', 'Runners'],
    engine: ['Engine', 'Powerplant', 'Reactor', 'Dynamo', 'Drive'],
    armor: ['Plate', 'Hull', 'Carapace', 'Shield', 'Bulwark'],
    weapon: ['Cannon', 'Turret', 'Launcher', 'Blaster', 'Railgun'],
    utility: ['Module', 'Array', 'Beacon', 'Drone', 'Emitter'],
};

// Vehicle component stat scaling per rarity [Common, Uncommon, Rare, Epic, Legendary]
export const VEHICLE_STAT_SCALING = {
    massBase:      [60, 50, 40, 30, 20],         // lower mass at higher rarity (lighter = better)
    speedBonus:    [0, 0.05, 0.12, 0.20, 0.35],
    tractionBonus: [0, 0.05, 0.10, 0.18, 0.30],
    damageBonus:   [5, 10, 18, 28, 45],
    armorBonus:    [5, 12, 22, 35, 55],
    fireRate:      [0, 0.1, 0.2, 0.35, 0.5],
    healRate:      [0, 1, 3, 5, 10],
    boostForce:    [0, 1000, 2500, 4000, 6000],
    pickupRadius:  [0, 0.5, 1.0, 1.5, 2.5],
};

// Which stats each component type favors
export const VEHICLE_TYPE_STAT_WEIGHTS = {
    propulsion: { speedBonus: 1.2, tractionBonus: 1.5, damageBonus: 0,   armorBonus: 0.2, fireRate: 0,   healRate: 0,   boostForce: 0,   pickupRadius: 0 },
    engine:     { speedBonus: 1.5, tractionBonus: 0.3, damageBonus: 0,   armorBonus: 0,   fireRate: 0.3, healRate: 0,   boostForce: 0.5, pickupRadius: 0 },
    armor:      { speedBonus: 0,   tractionBonus: 0,   damageBonus: 0,   armorBonus: 1.5, fireRate: 0,   healRate: 0.3, boostForce: 0,   pickupRadius: 0 },
    weapon:     { speedBonus: 0,   tractionBonus: 0,   damageBonus: 1.5, armorBonus: 0,   fireRate: 1.2, healRate: 0,   boostForce: 0,   pickupRadius: 0 },
    utility:    { speedBonus: 0.3, tractionBonus: 0,   damageBonus: 0,   armorBonus: 0,   fireRate: 0,   healRate: 1.0, boostForce: 1.0, pickupRadius: 1.5 },
};

// Vehicle component drop color (orange/metallic)
export const VEHICLE_DROP_COLOR = 0xdd8833;

/**
 * Generate a procedural name for a vehicle component
 */
export function generateVehicleComponentName(element, componentType, rarity) {
    const prefixes = PREFIXES[element] || PREFIXES[ELEMENT_TYPES.FIRE];
    const roots = VEHICLE_ROOTS[componentType] || VEHICLE_ROOTS.weapon;
    const suffixes = SUFFIXES[rarity] || SUFFIXES[RARITY.COMMON];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const root = roots[Math.floor(Math.random() * roots.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    return `${prefix} ${root}${suffix}`;
}

// Maximum inventory size
export const MAX_INVENTORY = 20;

// World item pickup radius
export const PICKUP_RADIUS = 1.5;

// World item despawn time (seconds)
export const DESPAWN_TIME = 60;

// Drop rates
export const DROP_RATE_NORMAL = 0.15;
export const DROP_RATE_BOSS = 1.0;

// Item ID counter
let nextItemId = 1;
export function getNextItemId() {
    return nextItemId++;
}
