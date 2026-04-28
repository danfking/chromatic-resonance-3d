// vehicle-components.js - Component definitions, slot system, and attachment point distribution

import * as THREE from 'three';

// Component categories and slot allocations (legacy blob-based slots)
export const COMPONENT_CATEGORIES = {
    PROPULSION: { slotCount: 4, startSlot: 0, sockets: ['wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr'] },
    WEAPON:     { slotCount: 3, startSlot: 4, sockets: ['roof-center', 'bed-left', 'bed-right'] },
    UTILITY:    { slotCount: 3, startSlot: 7, sockets: ['hitch-rear', 'rack-roof', 'bed-left', 'bed-right'] },
    DEFENSE:    { slotCount: 2, startSlot: 10, sockets: ['bumper-front', 'bumper-rear'] },
    ARMOR:      { sockets: ['side-left', 'side-right', 'bumper-front', 'bumper-rear'] },
    ENGINE:     { sockets: ['engine'] },
};

export const TOTAL_SLOTS = 12;

// Test component registry for prototyping
export const TEST_COMPONENTS = {
    wheel_basic: {
        id: 'wheel_basic',
        name: 'Basic Wheel',
        category: 'PROPULSION',
        effects: { maxSpeed: 1 },
        meshFactory: () => {
            const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12);
            const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.z = Math.PI / 2;
            return mesh;
        },
        ballStrength: 0.3,
    },
    wheel_turbo: {
        id: 'wheel_turbo',
        name: 'Turbo Wheel',
        category: 'PROPULSION',
        effects: { maxSpeed: 2 },
        meshFactory: () => {
            const geo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff8800 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.z = Math.PI / 2;
            return mesh;
        },
        ballStrength: 0.35,
    },
    spike_small: {
        id: 'spike_small',
        name: 'Small Spike',
        category: 'WEAPON',
        effects: { damageAura: 5 },
        meshFactory: () => {
            const geo = new THREE.ConeGeometry(0.06, 0.25, 6);
            const mat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
            return new THREE.Mesh(geo, mat);
        },
        ballStrength: 0.25,
    },
    cannon_basic: {
        id: 'cannon_basic',
        name: 'Basic Cannon',
        category: 'WEAPON',
        effects: { projectile: true },
        meshFactory: () => {
            const geo = new THREE.BoxGeometry(0.1, 0.1, 0.25);
            const mat = new THREE.MeshStandardMaterial({ color: 0x444444 });
            return new THREE.Mesh(geo, mat);
        },
        ballStrength: 0.3,
    },
    shield_plate: {
        id: 'shield_plate',
        name: 'Shield Plate',
        category: 'DEFENSE',
        effects: { armor: 20 },
        meshFactory: () => {
            const geo = new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff, side: THREE.DoubleSide });
            return new THREE.Mesh(geo, mat);
        },
        ballStrength: 0.35,
    },
    booster_jump: {
        id: 'booster_jump',
        name: 'Jump Booster',
        category: 'UTILITY',
        effects: { jumpForce: 3 },
        meshFactory: () => {
            const geo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
            const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
            return new THREE.Mesh(geo, mat);
        },
        ballStrength: 0.25,
    },
    scanner: {
        id: 'scanner',
        name: 'Scanner',
        category: 'UTILITY',
        effects: { revealRange: 10 },
        meshFactory: () => {
            const geo = new THREE.SphereGeometry(0.08, 8, 8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x44cc44, emissive: 0x226622 });
            return new THREE.Mesh(geo, mat);
        },
        ballStrength: 0.2,
    },
};

export class VehicleComponentSystem {
    constructor() {
        // 12 slots: each is { component, mesh, attachPoint } or null
        this.slots = new Array(TOTAL_SLOTS).fill(null);
        this.attachmentPoints = this.generateAttachmentPoints(TOTAL_SLOTS);
    }

    /**
     * Generate evenly-distributed points on unit sphere using Fibonacci spiral
     * Returns array of normalized Vector3 positions
     * @param {number} count
     * @returns {THREE.Vector3[]}
     */
    generateAttachmentPoints(count) {
        const points = [];
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        for (let i = 0; i < count; i++) {
            // y goes from ~1 to ~-1 (spread over sphere)
            const y = 1 - (2 * i) / (count - 1);
            const radius = Math.sqrt(1 - y * y);
            const theta = goldenAngle * i;

            points.push(new THREE.Vector3(
                Math.cos(theta) * radius,
                y,
                Math.sin(theta) * radius
            ).normalize());
        }

        return points;
    }

    /**
     * Get attachment point position on sphere surface
     * @param {number} slotIndex
     * @param {number} surfaceRadius - Radius of the blob surface
     * @returns {THREE.Vector3} World-space offset from blob center
     */
    getSlotWorldOffset(slotIndex, surfaceRadius = 0.5) {
        if (slotIndex < 0 || slotIndex >= TOTAL_SLOTS) return new THREE.Vector3();
        return this.attachmentPoints[slotIndex].clone().multiplyScalar(surfaceRadius);
    }

    /**
     * Get attachment point in MarchingCubes 0-1 space
     * @param {number} slotIndex
     * @param {THREE.Vector3} blobCenter - Usually (0.5, 0.5, 0.5)
     * @param {number} mcRadius - Radius in MC space (e.g. 0.2)
     * @returns {THREE.Vector3}
     */
    getSlotMCPosition(slotIndex, blobCenter, mcRadius = 0.2) {
        if (slotIndex < 0 || slotIndex >= TOTAL_SLOTS) return blobCenter.clone();
        return blobCenter.clone().add(
            this.attachmentPoints[slotIndex].clone().multiplyScalar(mcRadius)
        );
    }

    /**
     * Attach a component to a slot
     * @param {string} componentId - Key in TEST_COMPONENTS
     * @param {number} slotIndex
     * @returns {boolean} success
     */
    addComponent(componentId, slotIndex) {
        const def = TEST_COMPONENTS[componentId];
        if (!def) return false;
        if (slotIndex < 0 || slotIndex >= TOTAL_SLOTS) return false;

        // Remove existing component in this slot
        if (this.slots[slotIndex]) {
            this.removeComponent(slotIndex);
        }

        const mesh = def.meshFactory();
        mesh.userData.componentId = componentId;

        this.slots[slotIndex] = {
            component: def,
            mesh,
            slotIndex,
        };

        return true;
    }

    /**
     * Remove component from a slot
     * @param {number} slotIndex
     * @returns {object|null} removed component definition
     */
    removeComponent(slotIndex) {
        const slot = this.slots[slotIndex];
        if (!slot) return null;

        if (slot.mesh.parent) {
            slot.mesh.parent.remove(slot.mesh);
        }
        if (slot.mesh.geometry) slot.mesh.geometry.dispose();
        if (slot.mesh.material) {
            if (Array.isArray(slot.mesh.material)) {
                slot.mesh.material.forEach(m => m.dispose());
            } else {
                slot.mesh.material.dispose();
            }
        }

        const removed = slot.component;
        this.slots[slotIndex] = null;
        return removed;
    }

    /**
     * Get all currently attached components with their world positions
     * @param {THREE.Vector3} vehicleWorldPos - Vehicle world position
     * @param {number} surfaceRadius - Blob surface radius in world units
     * @returns {Array<{component, mesh, worldPos}>}
     */
    getActiveComponents(vehicleWorldPos = _zeroVec, surfaceRadius = 0.5) {
        const active = [];
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            const slot = this.slots[i];
            if (!slot) continue;

            const worldPos = vehicleWorldPos.clone().add(
                this.attachmentPoints[i].clone().multiplyScalar(surfaceRadius)
            );

            active.push({
                component: slot.component,
                mesh: slot.mesh,
                slotIndex: i,
                worldPos,
            });
        }
        return active;
    }

    /**
     * Compute aggregate effects from all equipped components
     * @returns {{ maxSpeed: number, jumpForce: number, armor: number, damageAura: number, revealRange: number }}
     */
    getAggregateEffects() {
        const effects = { maxSpeed: 0, jumpForce: 0, armor: 0, damageAura: 0, revealRange: 0 };

        for (const slot of this.slots) {
            if (!slot) continue;
            const e = slot.component.effects;
            if (e.maxSpeed) effects.maxSpeed += e.maxSpeed;
            if (e.jumpForce) effects.jumpForce += e.jumpForce;
            if (e.armor) effects.armor += e.armor;
            if (e.damageAura) effects.damageAura += e.damageAura;
            if (e.revealRange) effects.revealRange += e.revealRange;
        }

        return effects;
    }

    /**
     * Serialize equipped components to compact JSON
     * @returns {{ slots: Array<{id: string, slot: number}> }}
     */
    serialize() {
        const equipped = [];
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            if (this.slots[i]) {
                equipped.push({ id: this.slots[i].component.id, slot: i });
            }
        }
        return { slots: equipped };
    }

    /**
     * Load from serialized format
     * @param {{ slots: Array<{id: string, slot: number}> }} data
     */
    deserialize(data) {
        // Clear all
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            this.removeComponent(i);
        }
        if (data && data.slots) {
            for (const entry of data.slots) {
                this.addComponent(entry.id, entry.slot);
            }
        }
    }

    dispose() {
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            this.removeComponent(i);
        }
    }
}

const _zeroVec = new THREE.Vector3();

// --- Enhanced component definitions for socket-based vehicle mesh ---

import { VEHICLE_SOCKETS } from './vehicle-mesh.js';

export const COMPONENT_DEFS = {
    'basic-turret':   { category: 'WEAPON',     mass: 50,  rarity: 'common',   damage: 10, fireRate: 1.0 },
    'spell-launcher': { category: 'WEAPON',     mass: 30,  rarity: 'common',   damage: 15, fireRate: 0.5 },
    'steel-plate':    { category: 'ARMOR',      mass: 100, rarity: 'common',   damageReduction: 0.15 },
    'crystal-shield': { category: 'ARMOR',      mass: 60,  rarity: 'uncommon', damageReduction: 0.25 },
    'spike-armor':    { category: 'ARMOR',      mass: 80,  rarity: 'uncommon', damageReduction: 0.10, contactDamage: 20 },
    'turbo-engine':   { category: 'ENGINE',     mass: 120, rarity: 'rare',     speedBonus: 1.3, accelBonus: 1.2 },
    'offroad-tires':  { category: 'PROPULSION', mass: 20,  rarity: 'common',   tractionBonus: 1.3 },
    'nitro-boost':    { category: 'UTILITY',    mass: 40,  rarity: 'rare',     boostForce: 5000, boostDuration: 2.0 },
    'scrap-magnet':   { category: 'UTILITY',    mass: 15,  rarity: 'uncommon', pickupRadius: 2.0 },
    'repair-drone':   { category: 'UTILITY',    mass: 25,  rarity: 'rare',     healRate: 5 },
};

/**
 * Calculate total component mass and center of gravity shift from equipped components.
 * @param {Map<string, object>} equippedComponents - Map of socketId -> componentDef
 * @returns {{ totalMass: number, cgX: number, cgZ: number }}
 */
export function calculateComponentMassCG(equippedComponents) {
    let totalMass = 0;
    let weightedX = 0;
    let weightedZ = 0;

    for (const [socketId, componentDef] of equippedComponents) {
        const socketInfo = VEHICLE_SOCKETS[socketId];
        if (!socketInfo || !socketInfo.pos) continue;

        const mass = componentDef.mass || 0;
        totalMass += mass;
        weightedX += socketInfo.pos[0] * mass;
        weightedZ += socketInfo.pos[2] * mass;
    }

    return {
        totalMass,
        cgX: totalMass > 0 ? weightedX / totalMass : 0,
        cgZ: totalMass > 0 ? weightedZ / totalMass : 0,
    };
}
