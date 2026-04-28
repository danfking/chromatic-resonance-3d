// item-system.js - Equipment manager, inventory, world drops, stat application
// Integrates matrix mutations (Layer 1), formations (Layer 2), and symbiotes (Layer 3)

import * as THREE from 'three';
import { ItemGenerator } from './item-generator.js';
import { FormationController } from './formation-system.js';
import { ParticleLifeCreature, ELEMENT_TYPES } from '../creatures/particle-life-creature.js';
import {
    RARITY, RARITY_INFO, EQUIPMENT_SLOTS, SLOT_KEYS, ELEMENT_NAMES,
    ELEMENT_COLORS, ELEMENT_COUNT, MAX_INVENTORY, PICKUP_RADIUS,
    DESPAWN_TIME, DROP_RATE_NORMAL, DROP_RATE_BOSS, VEHICLE_DROP_COLOR
} from './item-data.js';

export class ItemSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.generator = new ItemGenerator();

        // Player references (set via setPlayerController)
        this.playerController = null;
        this.playerCreature = null;

        // Equipment: 6 slots -> item or null
        this.equipped = {};
        for (const slot of SLOT_KEYS) {
            this.equipped[slot] = null;
        }

        // Inventory: unequipped items
        this.inventory = [];

        // Vehicle component inventory (separate from blob equipment)
        this.vehicleInventory = [];

        // Vehicle equipped components: socketId -> item
        this.vehicleEquipped = {};

        // Matrix mutation state
        this.baseAttractions = null; // Clone of creature's original matrix
        this.activeMatrixOverlay = null; // 2D array summing all equipped matrixMods

        // Formation state: slot -> FormationController
        this.activeFormations = {};

        // Symbiote state
        this.symbiotes = []; // { item, creature, orbitAngle, orbitRadius, orbitSpeed, bobPhase }

        // World item drops
        this.worldItems = []; // { item, mesh, glowMesh, position, time, age, collecting, collectTimer }

        // Stat aggregates
        this.currentStats = {
            damage: 0,
            health: 0,
            speed: 0,
            colorEfficiency: 0,
            regenRate: 0,
            armorBonus: 0
        };

        // Shared resources
        this.worldItemGeometry = null;
        this.sharedGlowGeometry = new THREE.SphereGeometry(0.3, 8, 6);

        // Notification queue
        this.notifications = [];

        this.setupEventListeners();
    }

    /**
     * Connect to player controller and creature
     */
    setPlayerController(controller) {
        this.playerController = controller;

        // Access the player creature (body blob)
        if (controller.bodyBlob) {
            this.playerCreature = controller.bodyBlob;
        } else if (controller.getBodyBlob) {
            this.playerCreature = controller.getBodyBlob();
        }

        // Save base attraction matrix (clone it)
        if (this.playerCreature && this.playerCreature.attractions) {
            this.saveBaseAttractions();
        }
    }

    /**
     * Save original attraction matrix before any modifications
     */
    saveBaseAttractions() {
        const matrix = this.playerCreature.attractions;
        this.baseAttractions = matrix.map(row => [...row]);

        // Initialize overlay to zeros
        const types = matrix.length;
        this.activeMatrixOverlay = Array(types).fill(null).map(() => Array(types).fill(0));
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================

    setupEventListeners() {
        // Listen for enemy deaths to roll item drops
        window.addEventListener('enemy-died', (e) => {
            const { position, type } = e.detail;
            this.rollItemDrop(type, position);
        });
    }

    // =============================================
    // ITEM DROPS
    // =============================================

    /**
     * Roll for an item drop when an enemy dies
     */
    rollItemDrop(enemyType, position) {
        const isBoss = enemyType && enemyType.isBoss;
        const dropRate = isBoss ? DROP_RATE_BOSS : DROP_RATE_NORMAL;

        if (Math.random() > dropRate) return;

        // Get player level from progression system (default 1)
        const level = this.getPlayerLevel();
        const luckBonus = isBoss ? 0.5 : 0;

        // In vehicle-combat mode, 50% chance to drop a vehicle component
        // Boss kills always drop Rare+ vehicle components
        const isVehicleCombat = new URLSearchParams(window.location.search).get('mode') === 'vehicle-combat';
        if (isVehicleCombat && (isBoss || Math.random() < 0.5)) {
            const vehicleItem = this.generator.generateVehicleComponent({
                level,
                luckBonus,
                guaranteeRarePlus: !!isBoss,
            });
            this.spawnWorldItem(vehicleItem, position);
            // Boss also drops a normal item
            if (!isBoss) return;
        }

        const item = this.generator.generateRandom(level, luckBonus, isBoss);
        this.spawnWorldItem(item, position);
    }

    /**
     * Get player level (reads from progression system event or defaults)
     */
    getPlayerLevel() {
        // Try to read from DOM (progression system updates this)
        const levelEl = document.getElementById('player-level');
        if (levelEl) {
            const lvl = parseInt(levelEl.textContent);
            if (!isNaN(lvl)) return lvl;
        }
        return 1;
    }

    /**
     * Spawn a world item as a particle cluster
     */
    spawnWorldItem(item, position) {
        const rarityInfo = RARITY_INFO[item.rarity];
        const elementColor = item.isVehicleComponent ? VEHICLE_DROP_COLOR : (ELEMENT_COLORS[item.element] || 0xffffff);

        // Particle count based on rarity: 10-42
        const particleCount = 10 + item.rarity * 8;

        // Create particle positions
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const rarityColor = new THREE.Color(rarityInfo.colorHex);
        const elemColor = new THREE.Color(elementColor);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            // Random positions in a small sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.random() * 0.3;

            positions[i3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = r * Math.cos(phi);

            // Blend rarity color with element color
            const blend = Math.random();
            const c = rarityColor.clone().lerp(elemColor, blend);
            colors[i3] = c.r;
            colors[i3 + 1] = c.g;
            colors[i3 + 2] = c.b;

            sizes[i] = 0.08 + Math.random() * 0.06;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: window.devicePixelRatio }
            },
            vertexShader: `
                attribute vec3 color;
                attribute float size;
                uniform float uPixelRatio;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3 vColor;
                void main() {
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center) * 2.0;
                    if (dist > 0.8) discard;
                    float alpha = 1.0 - smoothstep(0.4, 0.8, dist);
                    float pulse = 0.8 + 0.2 * sin(uTime * 4.0);
                    vec3 finalColor = vColor * (1.0 + (1.0 - dist) * 0.5) * pulse;
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const mesh = new THREE.Points(geometry, material);
        mesh.position.copy(position);
        mesh.position.y += 0.5; // Float above ground
        this.scene.add(mesh);

        // Glow sphere
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: rarityInfo.colorHex,
            transparent: true,
            opacity: 0.15 + item.rarity * 0.05,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowMesh = new THREE.Mesh(this.sharedGlowGeometry, glowMaterial);
        glowMesh.position.copy(mesh.position);
        this.scene.add(glowMesh);

        this.worldItems.push({
            item,
            mesh,
            glowMesh,
            material,
            glowMaterial,
            position: mesh.position.clone(),
            time: 0,
            age: 0
        });
    }

    /**
     * Update world item animations (bob, rotate, shader time, pickup animation)
     */
    updateWorldItems(delta) {
        const COLLECT_DURATION = 0.35; // seconds for pickup animation

        for (let i = this.worldItems.length - 1; i >= 0; i--) {
            const wi = this.worldItems[i];
            wi.time += delta;
            wi.age += delta;

            // Pickup animation: lerp toward player and shrink
            if (wi.collecting) {
                wi.collectTimer += delta;
                const t = Math.min(wi.collectTimer / COLLECT_DURATION, 1);
                const ease = t * t * (3 - 2 * t); // smoothstep

                if (this.playerController) {
                    const playerPos = this.playerController.getPosition();
                    // Lerp position from origin toward player
                    wi.mesh.position.lerpVectors(wi.collectOrigin, playerPos, ease);
                    wi.glowMesh.position.copy(wi.mesh.position);

                    // Shrink as it approaches
                    const scale = 1 - ease;
                    wi.mesh.scale.setScalar(scale);
                    wi.glowMesh.scale.setScalar(scale);

                    // Spin faster during collection
                    wi.mesh.rotation.y += delta * 12;

                    // Fade glow
                    wi.glowMaterial.opacity = (0.15 + wi.item.rarity * 0.05) * scale;
                }

                if (t >= 1) {
                    this.collectItem(wi, i);
                    continue;
                }
                // Skip normal animation during collection
                continue;
            }

            // Despawn after DESPAWN_TIME
            if (wi.age > DESPAWN_TIME) {
                this.removeWorldItem(i);
                continue;
            }

            // Bob animation
            const bob = Math.sin(wi.time * 2.5) * 0.15;
            wi.mesh.position.y = wi.position.y + bob;
            wi.glowMesh.position.y = wi.position.y + bob;

            // Rotate particles
            wi.mesh.rotation.y += delta * 1.5;

            // Pulse glow
            const pulse = 0.8 + 0.2 * Math.sin(wi.time * 3);
            wi.glowMesh.scale.setScalar(pulse);

            // Update shader time
            wi.material.uniforms.uTime.value = wi.time;

            // Fade out in last 5 seconds
            if (wi.age > DESPAWN_TIME - 5) {
                const fadeT = (DESPAWN_TIME - wi.age) / 5;
                wi.glowMaterial.opacity = (0.15 + wi.item.rarity * 0.05) * fadeT;
            }
        }
    }

    /**
     * Check if player is near any world items and begin collecting them
     */
    checkPickups(playerPosition) {
        for (let i = this.worldItems.length - 1; i >= 0; i--) {
            const wi = this.worldItems[i];
            const dist = playerPosition.distanceTo(wi.position);

            if (dist < PICKUP_RADIUS && !wi.collecting) {
                wi.collecting = true;
                wi.collectTimer = 0;
                wi.collectOrigin = wi.mesh.position.clone();
            }
        }
    }

    /**
     * Collect a world item — auto-equip to empty slot if possible
     */
    collectItem(worldItem, index) {
        const item = worldItem.item;

        if (item.isVehicleComponent) {
            // Vehicle components go to vehicle inventory
            if (this.vehicleInventory.length < MAX_INVENTORY) {
                this.vehicleInventory.push(item);
                this.showNotification(item);
                window.dispatchEvent(new CustomEvent('vehicle-component-collected', {
                    detail: { item }
                }));
            } else {
                this.showNotification(null, 'Vehicle inventory full!');
            }
        } else {
            // Try auto-equip to empty matching slot
            const slot = item.slot;
            if (slot && EQUIPMENT_SLOTS[slot] && !this.equipped[slot]) {
                // Add to inventory first (equip() removes from inventory)
                this.inventory.push(item);
                this.equip(item, slot);
                this.showNotification(item);
                window.dispatchEvent(new CustomEvent('item-collected', {
                    detail: { item, autoEquipped: true }
                }));
            } else if (this.inventory.length < MAX_INVENTORY) {
                // Slot occupied or unknown — add to inventory
                this.inventory.push(item);
                this.showNotification(item);
                window.dispatchEvent(new CustomEvent('item-collected', {
                    detail: { item, autoEquipped: false }
                }));
            } else {
                this.showNotification(null, 'Inventory full!');
            }
        }

        this.removeWorldItem(index);
    }

    /**
     * Remove world item from scene and list
     */
    removeWorldItem(index) {
        const wi = this.worldItems[index];
        this.scene.remove(wi.mesh);
        this.scene.remove(wi.glowMesh);
        wi.mesh.geometry.dispose();
        wi.material.dispose();
        wi.glowMaterial.dispose();
        this.worldItems.splice(index, 1);
    }

    // =============================================
    // EQUIPMENT
    // =============================================

    /**
     * Equip an item from inventory to a slot
     */
    equip(item, slot) {
        if (!EQUIPMENT_SLOTS[slot]) return false;
        if (item.slot !== slot) return false;

        // If slot already has item, unequip it first
        if (this.equipped[slot]) {
            this.unequip(slot);
        }

        // Remove from inventory
        const invIdx = this.inventory.indexOf(item);
        if (invIdx >= 0) {
            this.inventory.splice(invIdx, 1);
        }

        this.equipped[slot] = item;

        // Apply effects
        this.recalculateMatrixOverlay();
        this.recalculateStats();

        // Activate formation if applicable
        if (item.formation) {
            this.activateFormation(slot, item);
        }

        // Spawn symbiote if legendary
        if (item.symbiote) {
            this.spawnSymbiote(item, slot);
        }

        window.dispatchEvent(new CustomEvent('equipment-changed', {
            detail: { slot, item, action: 'equip' }
        }));

        return true;
    }

    /**
     * Unequip an item from a slot, returning it to inventory
     */
    unequip(slot) {
        const item = this.equipped[slot];
        if (!item) return null;

        // Deactivate formation
        if (this.activeFormations[slot]) {
            this.deactivateFormation(slot);
        }

        // Despawn symbiote
        if (item.symbiote) {
            this.despawnSymbiote(item);
        }

        this.equipped[slot] = null;

        // Return to inventory if space
        if (this.inventory.length < MAX_INVENTORY) {
            this.inventory.push(item);
        }

        // Recalculate
        this.recalculateMatrixOverlay();
        this.recalculateStats();

        window.dispatchEvent(new CustomEvent('equipment-changed', {
            detail: { slot, item, action: 'unequip' }
        }));

        return item;
    }

    // =============================================
    // LAYER 1: MATRIX MUTATIONS
    // =============================================

    /**
     * Recalculate the matrix overlay from all equipped items
     */
    recalculateMatrixOverlay() {
        if (!this.baseAttractions || !this.activeMatrixOverlay) return;

        const types = this.baseAttractions.length;

        // Reset overlay to zeros
        for (let i = 0; i < types; i++) {
            for (let j = 0; j < types; j++) {
                this.activeMatrixOverlay[i][j] = 0;
            }
        }

        // Sum all equipped item matrixMods
        for (const slot of SLOT_KEYS) {
            const item = this.equipped[slot];
            if (!item || !item.matrixMods) continue;

            for (const mod of item.matrixMods) {
                // Map element types to creature particle type indices
                const typeA = this.elementToParticleType(mod.typeA);
                const typeB = this.elementToParticleType(mod.typeB);
                if (typeA >= 0 && typeA < types && typeB >= 0 && typeB < types) {
                    this.activeMatrixOverlay[typeA][typeB] += mod.delta;
                }
            }
        }

        this.applyMatrixToCreature();
    }

    /**
     * Map an element type to the creature's particle type index
     */
    elementToParticleType(elementType) {
        if (!this.playerCreature || !this.playerCreature.elements) return -1;

        for (let i = 0; i < this.playerCreature.elements.length; i++) {
            if (this.playerCreature.elements[i] === elementType) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Apply base + overlay matrix to creature
     */
    applyMatrixToCreature() {
        if (!this.playerCreature || !this.baseAttractions) return;

        const types = this.baseAttractions.length;
        for (let i = 0; i < types; i++) {
            for (let j = 0; j < types; j++) {
                const value = this.baseAttractions[i][j] + this.activeMatrixOverlay[i][j];
                this.playerCreature.attractions[i][j] = Math.max(-1, Math.min(1, value));
            }
        }
    }

    // =============================================
    // LAYER 2: FORMATIONS
    // =============================================

    /**
     * Create and activate a formation controller for an equipped item
     */
    activateFormation(slot, item) {
        if (!this.playerCreature || !item.formation) return;

        const controller = new FormationController(this.playerCreature, item.formation);
        this.activeFormations[slot] = controller;

        // Register with creature
        if (this.playerCreature.addFormation) {
            this.playerCreature.addFormation(controller);
        }
    }

    /**
     * Deactivate and dispose a formation controller
     */
    deactivateFormation(slot) {
        const controller = this.activeFormations[slot];
        if (!controller) return;

        // Unregister from creature
        if (this.playerCreature && this.playerCreature.removeFormation) {
            this.playerCreature.removeFormation(controller);
        }

        controller.dispose();
        delete this.activeFormations[slot];
    }

    /**
     * Update formation orientations to match player yaw
     */
    updateFormations(delta) {
        if (!this.playerController) return;

        const yaw = this.playerController.getYaw ? this.playerController.getYaw() : 0;

        for (const slot of SLOT_KEYS) {
            const controller = this.activeFormations[slot];
            if (controller) {
                controller.setOrientation(yaw);
            }
        }
    }

    // =============================================
    // LAYER 3: SYMBIOTE COMPANIONS
    // =============================================

    /**
     * Slot-to-attachment mapping: each slot gets a unique positioning behavior
     * crown: perched on top, gentle bob
     * core: partially merged at center, breathes in sync
     * mantle: wraps upper-back, follows yaw
     * tendril: extends outward from front, weapon-like
     * satellite: orbits independently
     * root: hugs bottom, ground tendrils
     */
    static SYMBIOTE_ATTACHMENTS = {
        weapon:     { type: 'tendril',   offsetY: 0,     offsetForward: 0.5,  offsetSide: 0,    orbitSpeed: 0,   bobAmp: 0.03, bobSpeed: 3 },
        guard:      { type: 'satellite', offsetY: 0.1,   offsetForward: 0,    offsetSide: 0,    orbitSpeed: 1.8, bobAmp: 0.08, bobSpeed: 2 },
        core:       { type: 'core',      offsetY: 0,     offsetForward: 0,    offsetSide: 0,    orbitSpeed: 0,   bobAmp: 0.02, bobSpeed: 4 },
        mantle:     { type: 'crown',     offsetY: 0.45,  offsetForward: -0.1, offsetSide: 0,    orbitSpeed: 0,   bobAmp: 0.05, bobSpeed: 2.5 },
        resonance1: { type: 'root',      offsetY: -0.35, offsetForward: 0,    offsetSide: 0.15, orbitSpeed: 0,   bobAmp: 0.02, bobSpeed: 1.5 },
        resonance2: { type: 'satellite', offsetY: 0.15,  offsetForward: 0,    offsetSide: 0,    orbitSpeed: 2.2, bobAmp: 0.06, bobSpeed: 2.5 }
    };

    /**
     * Spawn a symbiote companion creature for a legendary item
     * @param {object} item - The legendary item
     * @param {string} slot - Equipment slot key
     */
    spawnSymbiote(item, slot) {
        if (!item.symbiote || !this.playerCreature) return;

        // Limit to 2 symbiotes
        if (this.symbiotes.length >= 2) return;

        const sym = item.symbiote;
        const attachment = ItemSystem.SYMBIOTE_ATTACHMENTS[slot] || ItemSystem.SYMBIOTE_ATTACHMENTS.guard;

        // Adjust creature preset based on attachment type
        const isCoreType = attachment.type === 'core';
        const particleSize = isCoreType ? 0.05 : 0.06;
        const bubbleOpacity = isCoreType ? 0.08 : 0.12;
        const creatureSpeed = isCoreType ? 0.1 : 0.15;

        // Create a small ParticleLifeCreature
        const creature = new ParticleLifeCreature('player', {
            particles: sym.particleCount,
            radius: sym.radius,
            types: sym.elements.length,
            colors: sym.colors,
            bubbleColor: sym.colors[0],
            bubbleOpacity,
            elements: sym.elements,
            particleSize,
            speed: creatureSpeed,
            disableArmor: true,
            disableVitality: true,
            disableEssence: true
        });

        // Add to scene near player
        this.scene.add(creature.group);

        const orbitAngle = this.symbiotes.length * Math.PI; // Offset by 180 degrees
        const bobPhase = Math.random() * Math.PI * 2;

        // Particle exchange state
        const exchangeTimer = 2 + Math.random() * 3; // seconds between exchanges

        this.symbiotes.push({
            item,
            slot,
            creature,
            attachment,
            orbitAngle,
            bobPhase,
            time: 0,
            exchangeTimer,
            exchangeCooldown: exchangeTimer,
            exchangeParticles: [] // active exchange particles
        });
    }

    /**
     * Remove a symbiote companion
     */
    despawnSymbiote(item) {
        const idx = this.symbiotes.findIndex(s => s.item === item);
        if (idx === -1) return;

        const sym = this.symbiotes[idx];

        // Clean up exchange particles
        for (const ep of sym.exchangeParticles) {
            this.scene.remove(ep.mesh);
            ep.mesh.geometry.dispose();
            ep.mesh.material.dispose();
        }

        this.scene.remove(sym.creature.group);
        sym.creature.dispose();
        this.symbiotes.splice(idx, 1);
    }

    /**
     * Update symbiote positioning, physics, and particle exchange
     */
    updateSymbiotes(delta) {
        if (!this.playerController || this.symbiotes.length === 0) return;

        const playerPos = this.playerController.getPosition();
        const yaw = this.playerController.getYaw ? this.playerController.getYaw() : 0;
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);

        for (const sym of this.symbiotes) {
            sym.time += delta;
            const att = sym.attachment;

            let x, y, z;

            if (att.orbitSpeed > 0) {
                // Satellite type: orbit around player
                sym.orbitAngle += att.orbitSpeed * delta;
                const orbitR = 0.6 + sym.creature.radius;
                x = playerPos.x + Math.cos(sym.orbitAngle) * orbitR;
                z = playerPos.z + Math.sin(sym.orbitAngle) * orbitR;
                const bob = Math.sin(sym.time * att.bobSpeed + sym.bobPhase) * att.bobAmp;
                y = playerPos.y + att.offsetY + bob;
            } else {
                // Attached type: position relative to player with yaw rotation
                const localForward = att.offsetForward;
                const localSide = att.offsetSide;

                // Rotate offset by player yaw
                const worldOffsetX = localSide * cosYaw + localForward * sinYaw;
                const worldOffsetZ = -localSide * sinYaw + localForward * cosYaw;

                x = playerPos.x + worldOffsetX;
                z = playerPos.z + worldOffsetZ;
                const bob = Math.sin(sym.time * att.bobSpeed + sym.bobPhase) * att.bobAmp;
                y = playerPos.y + att.offsetY + bob;
            }

            sym.creature.group.position.set(x, y, z);

            // Update creature physics
            sym.creature.update(delta);

            // Particle exchange animation
            this.updateParticleExchange(sym, delta, playerPos);
        }
    }

    /**
     * Spawn and update particle exchange particles between host and symbiote
     * Creates a visual "flow" of color between the two creatures
     */
    updateParticleExchange(sym, delta, playerPos) {
        // Countdown to next exchange
        sym.exchangeCooldown -= delta;

        if (sym.exchangeCooldown <= 0) {
            sym.exchangeCooldown = sym.exchangeTimer;

            // Spawn 2-4 exchange particles
            const count = 2 + Math.floor(Math.random() * 3);
            const symPos = sym.creature.group.position;
            const goingToHost = Math.random() > 0.5;

            for (let i = 0; i < count; i++) {
                const startPos = goingToHost
                    ? new THREE.Vector3(symPos.x, symPos.y, symPos.z)
                    : new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
                const endPos = goingToHost
                    ? new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z)
                    : new THREE.Vector3(symPos.x, symPos.y, symPos.z);

                // Small glowing sphere for the exchange particle
                const color = sym.creature.colors[Math.floor(Math.random() * sym.creature.colors.length)];
                const geom = new THREE.SphereGeometry(0.03, 4, 3);
                const mat = new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.8,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(startPos);

                // Add slight random offset to start position
                mesh.position.x += (Math.random() - 0.5) * 0.1;
                mesh.position.y += (Math.random() - 0.5) * 0.1;
                mesh.position.z += (Math.random() - 0.5) * 0.1;

                this.scene.add(mesh);

                sym.exchangeParticles.push({
                    mesh,
                    startPos: mesh.position.clone(),
                    endPos,
                    progress: i * -0.1, // Stagger start times
                    duration: 0.4 + Math.random() * 0.3,
                    arcHeight: 0.1 + Math.random() * 0.15
                });
            }
        }

        // Update active exchange particles
        for (let i = sym.exchangeParticles.length - 1; i >= 0; i--) {
            const ep = sym.exchangeParticles[i];
            ep.progress += delta / ep.duration;

            if (ep.progress >= 1) {
                // Remove finished particle
                this.scene.remove(ep.mesh);
                ep.mesh.geometry.dispose();
                ep.mesh.material.dispose();
                sym.exchangeParticles.splice(i, 1);
                continue;
            }

            if (ep.progress < 0) continue; // Staggered, not started yet

            const t = ep.progress;
            // Smooth ease-in-out
            const st = t * t * (3 - 2 * t);

            // Arc interpolation between start and end
            ep.mesh.position.lerpVectors(ep.startPos, ep.endPos, st);
            // Add arc height (parabolic)
            ep.mesh.position.y += ep.arcHeight * 4 * t * (1 - t);

            // Fade out near end
            ep.mesh.material.opacity = 0.8 * (1 - t * t);
        }
    }

    // =============================================
    // STATS
    // =============================================

    /**
     * Recalculate aggregated stats from all equipped items
     */
    recalculateStats() {
        const stats = {
            damage: 0,
            health: 0,
            speed: 0,
            colorEfficiency: 0,
            regenRate: 0,
            armorBonus: 0
        };

        for (const slot of SLOT_KEYS) {
            const item = this.equipped[slot];
            if (!item || !item.stats) continue;

            stats.damage += item.stats.damage || 0;
            stats.health += item.stats.health || 0;
            stats.speed += item.stats.speed || 0;
            stats.colorEfficiency += item.stats.colorEfficiency || 0;
            stats.regenRate += item.stats.regenRate || 0;
            stats.armorBonus += item.stats.armorBonus || 0;
        }

        this.currentStats = stats;

        // Dispatch event for other systems to react
        window.dispatchEvent(new CustomEvent('equipment-stats-changed', {
            detail: { stats: { ...stats } }
        }));
    }

    /**
     * Get current aggregated stats
     */
    getStats() {
        return { ...this.currentStats };
    }

    // =============================================
    // NOTIFICATIONS
    // =============================================

    showNotification(item, message) {
        const notif = document.createElement('div');
        notif.className = 'item-notification';

        if (item) {
            const rarityInfo = RARITY_INFO[item.rarity];
            const elemName = ELEMENT_NAMES[item.element] || 'Unknown';
            const typeLabel = item.isVehicleComponent
                ? `<span style="color:#dd8833">[Vehicle]</span> `
                : '';
            notif.innerHTML = `
                ${typeLabel}<span style="color:${rarityInfo.color}">[${rarityInfo.name}]</span>
                <span>${item.name}</span>
                <span style="color:#888">(${elemName})</span>
            `;
        } else {
            notif.textContent = message;
        }

        notif.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 16px;
            background: rgba(26, 26, 46, 0.95);
            border: 1px solid rgba(212, 165, 116, 0.3);
            border-radius: 6px;
            color: #f5f0e6;
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 14px;
            z-index: 150;
            white-space: nowrap;
            animation: itemNotifFade 2.5s ease-out forwards;
        `;

        // Add animation keyframes if not already added
        if (!document.getElementById('item-notif-style')) {
            const style = document.createElement('style');
            style.id = 'item-notif-style';
            style.textContent = `
                @keyframes itemNotifFade {
                    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    75% { opacity: 1; }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2500);
    }

    // =============================================
    // UPDATE LOOP
    // =============================================

    /**
     * Main update called from game loop
     */
    update(delta) {
        this.updateWorldItems(delta);
        this.updateFormations(delta);
        this.updateSymbiotes(delta);
    }

    // =============================================
    // PUBLIC API
    // =============================================

    getEquipped() {
        return { ...this.equipped };
    }

    getInventory() {
        return [...this.inventory];
    }

    getEquippedItem(slot) {
        return this.equipped[slot];
    }

    getVehicleInventory() {
        return [...this.vehicleInventory];
    }

    getVehicleEquipped() {
        return { ...this.vehicleEquipped };
    }

    getVehicleEquippedItem(socketId) {
        return this.vehicleEquipped[socketId] || null;
    }

    /**
     * Equip a vehicle component to a socket
     */
    equipVehicleComponent(item, socketId) {
        if (!item.isVehicleComponent) return false;

        // If socket already has an item, unequip it first
        if (this.vehicleEquipped[socketId]) {
            this.unequipVehicleComponent(socketId);
        }

        // Remove from vehicle inventory
        const idx = this.vehicleInventory.indexOf(item);
        if (idx >= 0) {
            this.vehicleInventory.splice(idx, 1);
        }

        this.vehicleEquipped[socketId] = item;

        window.dispatchEvent(new CustomEvent('vehicle-equipment-changed', {
            detail: { socketId, item, action: 'equip' }
        }));
        return true;
    }

    /**
     * Unequip a vehicle component from a socket, returning it to vehicle inventory
     */
    unequipVehicleComponent(socketId) {
        const item = this.vehicleEquipped[socketId];
        if (!item) return null;

        this.vehicleEquipped[socketId] = null;

        if (this.vehicleInventory.length < MAX_INVENTORY) {
            this.vehicleInventory.push(item);
        }

        window.dispatchEvent(new CustomEvent('vehicle-equipment-changed', {
            detail: { socketId, item, action: 'unequip' }
        }));
        return item;
    }

    /**
     * Get aggregate stats from all equipped vehicle components
     */
    getVehicleAggregateStats() {
        const stats = { mass: 0, speedBonus: 0, tractionBonus: 0, damageBonus: 0, armorBonus: 0, fireRate: 0, healRate: 0, boostForce: 0, pickupRadius: 0 };
        for (const socketId of Object.keys(this.vehicleEquipped)) {
            const item = this.vehicleEquipped[socketId];
            if (!item || !item.stats) continue;
            for (const key of Object.keys(stats)) {
                stats[key] += item.stats[key] || 0;
            }
        }
        return stats;
    }

    /**
     * Remove an item from inventory (for dropping/selling)
     */
    removeFromInventory(item) {
        const idx = this.inventory.indexOf(item);
        if (idx >= 0) {
            this.inventory.splice(idx, 1);
            return true;
        }
        return false;
    }

    /**
     * Dispose all resources
     */
    dispose() {
        // Remove world items
        for (let i = this.worldItems.length - 1; i >= 0; i--) {
            this.removeWorldItem(i);
        }

        // Dispose symbiotes and their exchange particles
        for (const sym of this.symbiotes) {
            if (sym.exchangeParticles) {
                for (const ep of sym.exchangeParticles) {
                    this.scene.remove(ep.mesh);
                    ep.mesh.geometry.dispose();
                    ep.mesh.material.dispose();
                }
            }
            this.scene.remove(sym.creature.group);
            sym.creature.dispose();
        }
        this.symbiotes = [];

        // Dispose formations
        for (const slot of SLOT_KEYS) {
            if (this.activeFormations[slot]) {
                this.deactivateFormation(slot);
            }
        }

        // Restore base attractions
        if (this.playerCreature && this.baseAttractions) {
            const types = this.baseAttractions.length;
            for (let i = 0; i < types; i++) {
                for (let j = 0; j < types; j++) {
                    this.playerCreature.attractions[i][j] = this.baseAttractions[i][j];
                }
            }
        }

        this.sharedGlowGeometry.dispose();
    }
}
