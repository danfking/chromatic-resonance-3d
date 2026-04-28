// zone-manager.js - Zone configuration, generation, and transition management
// Drives zone loading for the roguelike run flow (3 zones for alpha)

import * as THREE from 'three';
import { OutdoorLevel } from './outdoor-level.js';

// Zone configurations — each defines level type, theme, enemies, loot, difficulty
const ZONE_CONFIGS = [
    // Zone 0: Chillagoe Research Site — limestone karst, abandoned CSIRO cave lab
    {
        name: 'Chillagoe Research Site',
        shortName: 'Research Site',
        levelType: 'outdoor',
        zoneTheme: 'facility',
        enemies: ['securityGuard'],
        boss: 'commander',
        guaranteedPickups: ['sparkCore', 'starterVehicleParts'],
        difficultyScale: 1.0,
        description: 'Limestone spires, abandoned smelter chimneys, red dust, cave entrances.',
        music: 'industrial',
    },
    // Zone 1: Herberton Scrapyard — volcanic tablelands, ghost mining town
    {
        name: 'Herberton Scrapyard',
        shortName: 'Scrapyard',
        levelType: 'outdoor',
        zoneTheme: 'scrapyard',
        enemies: ['militia', 'dog', 'truckDriver'],
        boss: 'commander',
        guaranteedPickups: [],
        difficultyScale: 1.3,
        description: 'Corrugated iron sheds, rusted mining equipment, old rail lines, volcanic rock.',
        music: 'desert',
    },
    // Zone 2: Innisfail — cyclone-damaged Art Deco town, cane fields, tropical coast
    {
        name: 'Innisfail',
        shortName: 'Coastal Town',
        levelType: 'outdoor',
        zoneTheme: 'town',
        enemies: ['police', 'riotShield', 'sniper'],
        boss: 'commander',
        guaranteedPickups: [],
        difficultyScale: 1.6,
        description: 'Art Deco streetscapes, cane field corridors, mangrove coast, ADF barricades.',
        music: 'tension',
    },
];

/**
 * ZoneManager - Creates and manages zone levels for the roguelike run
 * Listens to RunManager events to load/unload zones automatically
 */
export class ZoneManager {
    /**
     * @param {THREE.Scene} scene - Three.js scene
     * @param {object} options - Configuration options
     * @param {number} [options.seed] - Run seed for deterministic generation
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.seed = options.seed || 0;
        this.currentLevel = null;
        this.currentZoneIndex = -1;
        this.exitPortal = null;
        this.entryPortal = null;

        // Callback for when zone is ready (set by caller)
        this.onZoneReady = null;

        // Boss gate — portal starts locked, unlocks on boss kill
        this.portalActive = false;

        // Listen for boss-killed to activate exit portal
        window.addEventListener('boss-killed', () => {
            this.portalActive = true;
            this._activatePortal();
            console.log('[ZoneManager] Boss killed — exit portal activated');
        });
    }

    /**
     * Get configuration for a zone index
     * @param {number} index - Zone index (0-2 for alpha)
     * @returns {object} Zone configuration
     */
    getZoneConfig(index) {
        if (index < 0 || index >= ZONE_CONFIGS.length) {
            console.warn(`[ZoneManager] Invalid zone index ${index}, clamping to 0-${ZONE_CONFIGS.length - 1}`);
            index = Math.max(0, Math.min(ZONE_CONFIGS.length - 1, index));
        }
        return ZONE_CONFIGS[index];
    }

    /**
     * Get zone count
     */
    getZoneCount() {
        return ZONE_CONFIGS.length;
    }

    /**
     * Generate and load a zone
     * @param {number} index - Zone index (0-2)
     * @param {number} seed - Run seed for deterministic generation
     * @returns {Promise<object>} Zone data { level, config, spawns, bounds, playerSpawn }
     */
    async generateZone(index, seed, heightSource = null) {
        // Clean up previous zone if any
        if (this.currentLevel) {
            this.disposeCurrentZone();
        }

        this.seed = seed;
        this.currentZoneIndex = index;
        this.portalActive = false; // Reset portal lock for new zone
        const config = this.getZoneConfig(index);

        console.log(`[ZoneManager] Generating Zone ${index}: ${config.name} (seed: ${seed})`);

        // Zone seed derived from run seed + zone index for unique but reproducible layouts
        const zoneSeed = seed + index * 7919;

        // All zones use OutdoorLevel with zone-specific environmental objects
        const level = new OutdoorLevel(this.scene, {
            approach: 'assets',
            seed: zoneSeed,
            element: 0,
            zoneTheme: config.zoneTheme || null,
            heightSource: heightSource || null,
        });
        await level.build();

        this.currentLevel = level;

        // Get spawn data
        const playerSpawn = level.getPlayerSpawnPosition
            ? level.getPlayerSpawnPosition()
            : new THREE.Vector3(0, 1, 0);

        const bounds = level.getBounds();

        const enemySpawns = level.getEnemySpawns
            ? level.getEnemySpawns()
            : [];

        // Create exit portal
        this._createExitPortal(level, config);

        // Create entry visual at player spawn
        this._createEntryPortal(playerSpawn);

        // Place guaranteed pickups
        if (config.guaranteedPickups.length > 0) {
            this._placeGuaranteedPickups(config, level);
        }

        const zoneData = {
            level,
            config,
            spawns: enemySpawns,
            bounds,
            playerSpawn,
            exitPortalPosition: this.exitPortal ? this.exitPortal.position.clone() : null,
        };

        console.log(`[ZoneManager] Zone ${index} ready: ${config.name}, ${enemySpawns.length} enemy spawns, exit portal placed`);

        // Dispatch zone-ready event
        window.dispatchEvent(new CustomEvent('zone-ready', {
            detail: {
                zoneIndex: index,
                config,
                playerSpawn,
                bounds,
                exitPortalPosition: zoneData.exitPortalPosition,
            }
        }));

        return zoneData;
    }

    /**
     * Check if player has reached the exit portal
     * @param {THREE.Vector3} playerPosition - Current player position
     * @returns {boolean} True if player is at exit portal
     */
    checkExitPortal(playerPosition) {
        if (!this.exitPortal) return false;
        if (!this.portalActive) return false; // Boss must be killed first

        const distance = playerPosition.distanceTo(this.exitPortal.position);
        return distance < 3.0; // 3 unit activation radius
    }

    /**
     * Get current level
     */
    getCurrentLevel() {
        return this.currentLevel;
    }

    /**
     * Get current zone index
     */
    getCurrentZoneIndex() {
        return this.currentZoneIndex;
    }

    /**
     * Dispose current zone and clean up
     */
    disposeCurrentZone() {
        if (this.currentLevel) {
            if (this.currentLevel.dispose) {
                this.currentLevel.dispose();
            }
            this.currentLevel = null;
        }

        if (this.exitPortal) {
            this.exitPortal.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            this.scene.remove(this.exitPortal);
            this.exitPortal = null;
        }

        if (this.entryPortal) {
            this.entryPortal.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            this.scene.remove(this.entryPortal);
            this.entryPortal = null;
        }

        this.currentZoneIndex = -1;
        this.portalActive = false;
        console.log('[ZoneManager] Zone disposed');
    }

    /**
     * Update per-frame (portal animation, exit check)
     * @param {number} delta - Frame time in seconds
     * @param {number} elapsed - Total elapsed time
     */
    update(delta, elapsed) {
        // Animate exit portal (pulse/rotate)
        if (this.exitPortal) {
            const ring = this.exitPortal.userData.ring;
            if (ring) {
                ring.rotation.z = elapsed * 0.5;
                if (this.portalActive) {
                    ring.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 2) * 0.3;
                }
            }
            const glow = this.exitPortal.userData.glow;
            if (glow && this.portalActive) {
                glow.material.opacity = 0.3 + Math.sin(elapsed * 3) * 0.15;
            }
        }

        // Animate entry portal fade-out (fades after 2 seconds)
        if (this.entryPortal && this.entryPortal.userData.spawnTime) {
            const age = elapsed - this.entryPortal.userData.spawnTime;
            if (age > 2.0) {
                const fadeProgress = Math.min(1, (age - 2.0) / 1.5);
                this.entryPortal.traverse(obj => {
                    if (obj.material && obj.material.opacity !== undefined) {
                        obj.material.opacity = Math.max(0, 1 - fadeProgress);
                    }
                });
                if (fadeProgress >= 1) {
                    this.scene.remove(this.entryPortal);
                    this.entryPortal = null;
                }
            }
        }

        // Update current level
        if (this.currentLevel && this.currentLevel.update) {
            this.currentLevel.update(delta, elapsed);
        }
    }

    // --- Private methods ---

    /**
     * Create exit portal at the far edge of the level
     */
    _createExitPortal(level, config) {
        // Place at far edge of outdoor level
        const bounds = level.getBounds();
        const portalPosition = new THREE.Vector3(
            bounds.maxX - 10,
            0,
            bounds.maxZ - 10
        );

        // Build portal mesh
        const portal = new THREE.Group();
        portal.position.copy(portalPosition);

        // Tall archway pillars
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0x444466,
            roughness: 0.7,
            metalness: 0.3,
        });

        const leftPillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 5, 0.5),
            pillarMat
        );
        leftPillar.position.set(-1.5, 2.5, 0);
        leftPillar.castShadow = true;
        portal.add(leftPillar);

        const rightPillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 5, 0.5),
            pillarMat
        );
        rightPillar.position.set(1.5, 2.5, 0);
        rightPillar.castShadow = true;
        portal.add(rightPillar);

        // Arch top
        const archMat = new THREE.MeshStandardMaterial({
            color: 0x444466,
            roughness: 0.6,
            metalness: 0.4,
        });
        const arch = new THREE.Mesh(
            new THREE.BoxGeometry(3.5, 0.5, 0.5),
            archMat
        );
        arch.position.set(0, 5, 0);
        arch.castShadow = true;
        portal.add(arch);

        // Swirling ring inside — starts dim (boss must be killed to activate)
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            emissive: 0x444444,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.2, 0.08, 8, 24),
            ringMat
        );
        ring.position.set(0, 2.5, 0);
        portal.add(ring);
        portal.userData.ring = ring;

        // Inner glow plane — starts dim
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
        });
        const glow = new THREE.Mesh(
            new THREE.CircleGeometry(1.1, 16),
            glowMat
        );
        glow.position.set(0, 2.5, 0);
        portal.add(glow);
        portal.userData.glow = glow;

        // Point light — starts dim
        const light = new THREE.PointLight(0x444444, 0.2, 15, 2);
        light.position.set(0, 3, 0);
        portal.add(light);
        portal.userData.light = light;

        this.exitPortal = portal;
        this.scene.add(portal);

        console.log(`[ZoneManager] Exit portal at (${portalPosition.x.toFixed(1)}, ${portalPosition.z.toFixed(1)})`);
    }

    /**
     * Create entry portal visual at player spawn
     */
    _createEntryPortal(position) {
        const portal = new THREE.Group();
        portal.position.copy(position);

        // Subtle ground ring — reduced brightness so it doesn't wash out the scene
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x44ff88,
            emissive: 0x44ff88,
            emissiveIntensity: 0.12,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.0, 0.03, 8, 24),
            ringMat
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        portal.add(ring);

        // Thin vertical glow pillar — very faint
        const pillarMat = new THREE.MeshBasicMaterial({
            color: 0x44ff88,
            transparent: true,
            opacity: 0.05,
            blending: THREE.AdditiveBlending,
        });
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.5, 3, 8),
            pillarMat
        );
        pillar.position.y = 1.5;
        portal.add(pillar);

        portal.userData.spawnTime = performance.now() / 1000;

        this.entryPortal = portal;
        this.scene.add(portal);
    }

    /**
     * Activate the exit portal after boss is killed — switch from dim to bright/glowing
     */
    _activatePortal() {
        if (!this.exitPortal) return;

        const ring = this.exitPortal.userData.ring;
        if (ring && ring.material) {
            ring.material.color.setHex(0x00ccff);
            ring.material.emissive.setHex(0x00ccff);
            ring.material.emissiveIntensity = 0.5;
            ring.material.opacity = 0.8;
        }

        const glow = this.exitPortal.userData.glow;
        if (glow && glow.material) {
            glow.material.color.setHex(0x00ccff);
            glow.material.opacity = 0.3;
        }

        const light = this.exitPortal.userData.light;
        if (light) {
            light.color.setHex(0x00ccff);
            light.intensity = 1.0;
        }
    }

    /**
     * Place guaranteed pickups in the zone (e.g. Spark Core in Zone 0)
     * Zone 0 uses a northward breadcrumb trail instead of center stacking
     */
    _placeGuaranteedPickups(config, level) {
        const bounds = level.getBounds();
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;

        // Pickup position offsets for Zone 0 (northward trail from spawn)
        // North = -Z in world space. Spawn is at center (100, 100).
        const PICKUP_OFFSETS = {
            sparkCore:          { x: 0, z: -25 },  // 25u north of spawn
            starterVehicleParts: { x: 0, z: -45 },  // 45u north of spawn
        };

        for (const pickupType of config.guaranteedPickups) {
            const offset = PICKUP_OFFSETS[pickupType];
            const position = new THREE.Vector3(
                centerX + (offset ? offset.x : 0),
                0,
                centerZ + (offset ? offset.z : 0)
            );

            // Dispatch event for other systems to handle the actual pickup spawning
            window.dispatchEvent(new CustomEvent('zone-guaranteed-pickup', {
                detail: {
                    type: pickupType,
                    position,
                    zoneIndex: this.currentZoneIndex,
                }
            }));

            console.log(`[ZoneManager] Guaranteed pickup '${pickupType}' at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
        }
    }
}

export { ZONE_CONFIGS };
