// vehicle-builder.js - Vehicle construction from scavenged parts
// Players BUILD vehicles by absorbing scrap, not by finding pre-built ones.
// 4 slots: chassis, wheels, engine, weapon
// Particle connection: Spark->weapon, Shell->chassis armor, Essence->engine

import * as THREE from 'three';

// Vehicle part slot types
const VEHICLE_SLOTS = {
    CHASSIS: 'chassis',
    WHEELS: 'wheels',
    ENGINE: 'engine',
    WEAPON: 'weapon',
};

// Part definitions — each has base stats and a visual factory
const PART_CATALOG = {
    // === CHASSIS ===
    labCart: {
        slot: VEHICLE_SLOTS.CHASSIS,
        name: 'Lab Cart',
        tier: 0,
        stats: { armorCapacity: 3, weight: 20, size: 'small' },
        augmentSlots: 1,
    },
    sedanFrame: {
        slot: VEHICLE_SLOTS.CHASSIS,
        name: 'Sedan Frame',
        tier: 1,
        stats: { armorCapacity: 8, weight: 60, size: 'medium' },
        augmentSlots: 2,
    },
    truckCab: {
        slot: VEHICLE_SLOTS.CHASSIS,
        name: 'Truck Cab',
        tier: 2,
        stats: { armorCapacity: 15, weight: 100, size: 'large' },
        augmentSlots: 3,
    },

    // === WHEELS ===
    cartWheels: {
        slot: VEHICLE_SLOTS.WHEELS,
        name: 'Cart Wheels',
        tier: 0,
        stats: { speedBonus: 0, traction: 0.5, terrainHandling: 0.3 },
        augmentSlots: 0,
    },
    bikeWheels: {
        slot: VEHICLE_SLOTS.WHEELS,
        name: 'Bicycle Wheels',
        tier: 1,
        stats: { speedBonus: 2, traction: 0.7, terrainHandling: 0.5 },
        augmentSlots: 1,
    },
    monsterTires: {
        slot: VEHICLE_SLOTS.WHEELS,
        name: 'Monster Truck Tires',
        tier: 2,
        stats: { speedBonus: 4, traction: 1.0, terrainHandling: 0.9 },
        augmentSlots: 1,
    },

    // === ENGINES ===
    lawnmowerMotor: {
        slot: VEHICLE_SLOTS.ENGINE,
        name: 'Lawnmower Motor',
        tier: 0,
        stats: { topSpeed: 8, acceleration: 10, essenceDrain: 0.3 },
        augmentSlots: 1,
    },
    v4Engine: {
        slot: VEHICLE_SLOTS.ENGINE,
        name: 'V4 Engine',
        tier: 1,
        stats: { topSpeed: 14, acceleration: 18, essenceDrain: 0.6 },
        augmentSlots: 2,
    },
    turbine: {
        slot: VEHICLE_SLOTS.ENGINE,
        name: 'Salvaged Turbine',
        tier: 2,
        stats: { topSpeed: 22, acceleration: 25, essenceDrain: 1.0 },
        augmentSlots: 2,
    },

    // === WEAPONS ===
    pipeGun: {
        slot: VEHICLE_SLOTS.WEAPON,
        name: 'Pipe Gun',
        tier: 0,
        stats: { damage: 5, fireRate: 1.5, range: 12, projectileSpeed: 15 },
        augmentSlots: 1,
    },
    mountedTurret: {
        slot: VEHICLE_SLOTS.WEAPON,
        name: 'Mounted Turret',
        tier: 1,
        stats: { damage: 10, fireRate: 3.0, range: 18, projectileSpeed: 22 },
        augmentSlots: 2,
    },
    missileRack: {
        slot: VEHICLE_SLOTS.WEAPON,
        name: 'Missile Rack',
        tier: 2,
        stats: { damage: 25, fireRate: 0.5, range: 30, projectileSpeed: 12 },
        augmentSlots: 3,
    },
};

class VehicleBuilder {
    constructor(scene) {
        this.scene = scene;
        this.slots = {
            [VEHICLE_SLOTS.CHASSIS]: null,
            [VEHICLE_SLOTS.WHEELS]: null,
            [VEHICLE_SLOTS.ENGINE]: null,
            [VEHICLE_SLOTS.WEAPON]: null,
        };

        // Augments applied to each slot
        this.augments = {
            [VEHICLE_SLOTS.CHASSIS]: [],
            [VEHICLE_SLOTS.WHEELS]: [],
            [VEHICLE_SLOTS.ENGINE]: [],
            [VEHICLE_SLOTS.WEAPON]: [],
        };

        // Inventory of found-but-not-equipped parts (partId strings)
        this.partInventory = [];

        // Computed aggregate stats
        this.computedStats = {};

        // Vehicle mesh group (assembled from parts)
        this.vehicleGroup = new THREE.Group();
        this.vehicleGroup.name = 'player-vehicle';

        // Whether the vehicle is functional (needs at least chassis + wheels + engine)
        this.functional = false;

        this._setupEventListeners();
    }

    /**
     * Attach a part to a vehicle slot.
     * @param {string} slot - VEHICLE_SLOTS key
     * @param {string} partId - Key from PART_CATALOG
     * @returns {object|null} The previously equipped part (if swapping), or null
     */
    attachPart(slot, partId) {
        const partDef = PART_CATALOG[partId];
        if (!partDef) {
            console.warn(`[VehicleBuilder] Unknown part: ${partId}`);
            return null;
        }
        if (partDef.slot !== slot) {
            console.warn(`[VehicleBuilder] Part ${partId} doesn't fit slot ${slot}`);
            return null;
        }

        const previous = this.slots[slot];
        this.slots[slot] = partId;

        // Clear augments if swapping to a part with fewer slots
        const maxAugments = partDef.augmentSlots || 0;
        if (this.augments[slot].length > maxAugments) {
            this.augments[slot] = this.augments[slot].slice(0, maxAugments);
        }

        this._recomputeStats();
        this._rebuildMesh();

        console.log(`[VehicleBuilder] Attached ${partDef.name} to ${slot}` +
            (previous ? ` (replaced ${PART_CATALOG[previous]?.name})` : ''));

        window.dispatchEvent(new CustomEvent('vehicle-part-changed', {
            detail: { slot, partId, previousPartId: previous, stats: this.computedStats }
        }));

        return previous;
    }

    /**
     * Detach a part from a vehicle slot.
     * @param {string} slot - VEHICLE_SLOTS key
     * @returns {string|null} The removed part ID, or null if slot was empty
     */
    detachPart(slot) {
        const partId = this.slots[slot];
        if (!partId) return null;

        this.slots[slot] = null;
        this.augments[slot] = [];

        this._recomputeStats();
        this._rebuildMesh();

        console.log(`[VehicleBuilder] Detached ${PART_CATALOG[partId]?.name} from ${slot}`);

        window.dispatchEvent(new CustomEvent('vehicle-part-changed', {
            detail: { slot, partId: null, previousPartId: partId, stats: this.computedStats }
        }));

        return partId;
    }

    /**
     * Get the part in a specific slot.
     * @param {string} slot
     * @returns {object|null} Part definition or null
     */
    getPart(slot) {
        const partId = this.slots[slot];
        return partId ? { id: partId, ...PART_CATALOG[partId] } : null;
    }

    /**
     * Get all equipped parts.
     * @returns {object} { chassis, wheels, engine, weapon } with part defs or null
     */
    getAllParts() {
        const result = {};
        for (const slot of Object.values(VEHICLE_SLOTS)) {
            result[slot] = this.getPart(slot);
        }
        return result;
    }

    /**
     * Check if the vehicle is functional (has minimum required parts).
     * Needs at least: chassis + wheels + engine.
     */
    isFunctional() {
        return this.functional;
    }

    /**
     * Get computed vehicle stats (aggregate of all parts).
     */
    getStats() {
        return { ...this.computedStats };
    }

    /**
     * Get part inventory (found but not necessarily equipped).
     */
    getPartInventory() {
        return [...this.partInventory];
    }

    /**
     * Get the max augment slots for a given slot.
     */
    getAugmentSlotCount(slot) {
        const partId = this.slots[slot];
        if (!partId) return 0;
        return PART_CATALOG[partId]?.augmentSlots || 0;
    }

    /**
     * Get the vehicle mesh group (add to scene).
     */
    getMesh() {
        return this.vehicleGroup;
    }

    /**
     * Reset the builder (strip all parts).
     */
    reset() {
        for (const slot of Object.values(VEHICLE_SLOTS)) {
            this.slots[slot] = null;
            this.augments[slot] = [];
        }
        this._recomputeStats();
        this._rebuildMesh();
    }

    /**
     * Give the player a starter vehicle (lab cart + cart wheels + lawnmower motor).
     * Called when first vehicle parts are found in Zone 1.
     */
    buildStarterVehicle() {
        // Add starter parts to inventory
        for (const id of ['labCart', 'cartWheels', 'lawnmowerMotor']) {
            if (!this.partInventory.includes(id)) this.partInventory.push(id);
        }
        this.attachPart(VEHICLE_SLOTS.CHASSIS, 'labCart');
        this.attachPart(VEHICLE_SLOTS.WHEELS, 'cartWheels');
        this.attachPart(VEHICLE_SLOTS.ENGINE, 'lawnmowerMotor');
        // No weapon initially — pipe gun found separately
        console.log('[VehicleBuilder] Starter vehicle built: Lab Cart + Cart Wheels + Lawnmower Motor');
    }

    // --- Private ---

    _recomputeStats() {
        const stats = {
            topSpeed: 0,
            acceleration: 0,
            armorCapacity: 0,
            weight: 0,
            speedBonus: 0,
            traction: 0,
            terrainHandling: 0,
            essenceDrain: 0,
            damage: 0,
            fireRate: 0,
            range: 0,
            projectileSpeed: 0,
            totalAugmentSlots: 0,
        };

        for (const slot of Object.values(VEHICLE_SLOTS)) {
            const partId = this.slots[slot];
            if (!partId) continue;
            const part = PART_CATALOG[partId];
            if (!part) continue;

            stats.totalAugmentSlots += part.augmentSlots || 0;

            // Merge stats
            for (const [key, value] of Object.entries(part.stats)) {
                if (key in stats) {
                    stats[key] += value;
                } else {
                    stats[key] = value;
                }
            }
        }

        // Effective speed = (topSpeed + speedBonus) * (1 - weight/500)
        stats.effectiveSpeed = Math.max(2, (stats.topSpeed + stats.speedBonus) * (1 - stats.weight / 500));

        this.functional = !!(this.slots[VEHICLE_SLOTS.CHASSIS] &&
                             this.slots[VEHICLE_SLOTS.WHEELS] &&
                             this.slots[VEHICLE_SLOTS.ENGINE]);

        this.computedStats = stats;
    }

    _rebuildMesh() {
        // Clear existing children
        while (this.vehicleGroup.children.length > 0) {
            const child = this.vehicleGroup.children[0];
            this.vehicleGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }

        if (!this.slots[VEHICLE_SLOTS.CHASSIS]) return;

        // Build procedural mesh based on equipped parts
        const chassisPart = PART_CATALOG[this.slots[VEHICLE_SLOTS.CHASSIS]];
        const chassisSize = chassisPart?.stats?.size || 'small';

        // Chassis body
        const sizes = { small: [1.5, 0.4, 1.0], medium: [3.0, 0.6, 1.5], large: [4.0, 0.8, 2.0] };
        const [cx, cy, cz] = sizes[chassisSize] || sizes.small;

        const chassisGeo = new THREE.BoxGeometry(cx, cy, cz);
        const chassisMat = new THREE.MeshStandardMaterial({
            color: chassisSize === 'small' ? 0x8B7355 : (chassisSize === 'medium' ? 0x4477aa : 0x554433),
            roughness: chassisSize === 'small' ? 0.95 : 0.8,
            metalness: chassisSize === 'small' ? 0.1 : 0.3,
        });
        const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        chassisMesh.position.y = cy / 2 + 0.3;
        chassisMesh.userData.type = 'vehicle-part';
        this.vehicleGroup.add(chassisMesh);

        // Wheels
        if (this.slots[VEHICLE_SLOTS.WHEELS]) {
            const wheelRadius = chassisSize === 'large' ? 0.4 : (chassisSize === 'medium' ? 0.3 : 0.2);
            const wheelWidth = 0.15;
            const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

            const offsets = [
                [-cx / 2, wheelRadius, -cz / 2 + 0.1],
                [cx / 2, wheelRadius, -cz / 2 + 0.1],
                [-cx / 2, wheelRadius, cz / 2 - 0.1],
                [cx / 2, wheelRadius, cz / 2 - 0.1],
            ];

            for (const [wx, wy, wz] of offsets) {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(wx, wy, wz);
                wheel.userData.type = 'vehicle-part';
                this.vehicleGroup.add(wheel);
            }
        }

        // Engine (small block on front)
        if (this.slots[VEHICLE_SLOTS.ENGINE]) {
            const engineGeo = new THREE.BoxGeometry(cx * 0.4, cy * 0.6, cz * 0.3);
            const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
            const engineMesh = new THREE.Mesh(engineGeo, engineMat);
            engineMesh.position.set(0, cy + 0.3, -cz / 2 + cz * 0.15);
            engineMesh.userData.type = 'vehicle-part';
            this.vehicleGroup.add(engineMesh);
        }

        // Weapon mount (on top/back)
        if (this.slots[VEHICLE_SLOTS.WEAPON]) {
            const weaponGeo = new THREE.BoxGeometry(0.15, 0.15, 0.4);
            const weaponMat = new THREE.MeshStandardMaterial({ color: 0x884422, metalness: 0.4 });
            const weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);
            weaponMesh.position.set(0, cy + 0.5, 0);
            weaponMesh.userData.type = 'vehicle-part';
            this.vehicleGroup.add(weaponMesh);
        }
    }

    _setupEventListeners() {
        // Reset vehicle on new run
        window.addEventListener('run-reset', () => {
            this.reset();
            this.partInventory = [];
        });

        // Listen for absorb events to auto-attach found parts
        window.addEventListener('vehicle-part-found', (e) => {
            const { partId } = e.detail;
            const part = PART_CATALOG[partId];
            if (!part) return;

            // Track in inventory (avoid duplicates)
            if (!this.partInventory.includes(partId)) {
                this.partInventory.push(partId);
            }

            // Auto-attach if slot is empty, otherwise store for later
            if (!this.slots[part.slot]) {
                this.attachPart(part.slot, partId);
            } else {
                // Dispatch event for UI to handle swap decision
                window.dispatchEvent(new CustomEvent('vehicle-part-swap-offer', {
                    detail: {
                        slot: part.slot,
                        currentPartId: this.slots[part.slot],
                        newPartId: partId,
                    }
                }));
            }
        });
    }
}

export { VehicleBuilder, VEHICLE_SLOTS, PART_CATALOG };
