// main.js - Entry point for Chromatic Resonance 3D PoC

import * as THREE from 'three';
import { SceneManager } from './core/scene-manager.js';
import { BlobPlayerController } from './character/blob-player-controller.js';
import { JeepController } from './character/jeep-controller.js';
import { NPRPipeline } from './rendering/npr-pipeline.js';
import { ColorInventory, ColorOrbManager } from './systems/color-inventory.js';
import { AbilitySystem } from './systems/abilities.js';
import { EnemyManager } from './systems/enemies.js';
import { PlayerHealth } from './systems/player-health.js';
import { ArenaLevel } from './world/arena-level.js';
import { OutdoorLevel } from './world/outdoor-level.js';
import { ELEMENT_TYPES } from './creatures/particle-life-creature.js';
import { Minimap } from './ui/minimap.js';
import { AudioSystem } from './systems/audio.js';
import { MusicSystem } from './systems/music.js';
import { ProgressionSystem } from './systems/progression.js';
import { FloatingTextManager } from './ui/floating-text.js';
import { PauseMenu } from './ui/pause-menu.js';
import { GameStateUI } from './ui/game-state.js';
import { TutorialOverlay } from './ui/tutorial.js';
import { ComboSystem } from './systems/combo.js';
import { BossUI } from './ui/boss-ui.js';
import { PowerupSystem } from './systems/powerups.js';
import { modelManager } from './systems/model-manager.js';
import { verifyAllEnemies, logVerificationResults } from './systems/scale-verifier.js';
import { CorruptionSystem } from './systems/corruption.js';
import { ItemSystem } from './systems/item-system.js';
import { StyleLab } from './rendering/style-lab.js';
import { NPCSystem } from './systems/npc-system.js';
import { NPCDialogueUI } from './ui/npc-dialogue-ui.js';
import { RunManager, RUN_STATES } from './systems/run-manager.js';
import { CoreSystem, CORE_TYPES } from './systems/core-system.js';
import { VehicleBuilder, VEHICLE_SLOTS } from './systems/vehicle-builder.js';
import { AugmentSystem, AUGMENT_TARGETS } from './systems/augment-system.js';
import { MainMenu } from './ui/main-menu.js';
import { RunHUD } from './ui/run-hud.js';
import { VehicleAugmentUI } from './ui/vehicle-augment-ui.js';
import { ZoneManager, ZONE_CONFIGS } from './world/zone-manager.js';
import { ShopUI } from './ui/shop-ui.js';
import { HintSystem } from './ui/hint-system.js';

// Vehicle Combat mode imports
import { VehicleDriverController, DRIVER_STATE } from './character/vehicle-driver-controller.js';
import { VehicleMesh } from './vehicle/vehicle-mesh.js';
import { VehiclePhysics4x4 } from './vehicle/vehicle-physics-4x4.js';
import { VehicleWeaponSystem } from './vehicle/vehicle-weapons.js';
import { VehicleDamageSystem } from './vehicle/vehicle-damage.js';
import { VehicleAudio } from './vehicle/vehicle-audio.js';
import { VehicleHUD } from './ui/vehicle-hud.js';
import { VehicleComponentUI } from './ui/vehicle-component-ui.js';
import { ChunkManager } from './world/open-world/chunk-manager.js';
import { GrassSystem } from './world/open-world/grass-system.js';
import { VegetationSystem } from './world/open-world/vegetation-system.js';
import { WaterSystem } from './world/open-world/water-system.js';
import { AtmosphereSystem } from './world/open-world/atmosphere-system.js';

// URL params for debug/testing (RunManager drives zone loading in normal flow)
const URL_PARAMS = new URLSearchParams(window.location.search);

// ?debug=true — enables debug mode on load
const DEBUG_ON_START = URL_PARAMS.get('debug') === 'true';

// ?zone=0|1|2 — jump directly to a specific zone (skips menu)
const DEBUG_ZONE = (() => {
    const z = parseInt(URL_PARAMS.get('zone'));
    return (z >= 0 && z <= 2) ? z : null;
})();

// Test mode - disable enemies and tutorial for easier Playwright testing
// Enable via URL parameter: ?test=true
const TEST_MODE = URL_PARAMS.get('test') === 'true';

class Game {
    constructor() {
        this.sceneManager = null;
        this.controller = null;
        this.nprPipeline = null;
        // this.colorExtractor = null; // Removed - colors from enemy drops only
        this.colorInventory = null;
        this.colorOrbManager = null;
        this.abilitySystem = null;
        this.enemyManager = null;
        this.playerHealth = null;
        this.testLevel = null;
        this.minimap = null;
        this.audioSystem = null;
        this.musicSystem = null;
        this.progressionSystem = null;
        this.floatingTextManager = null;
        this.pauseMenu = null;
        this.gameStateUI = null;
        this.tutorial = null;
        this.comboSystem = null;
        this.bossUI = null;
        this.powerupSystem = null;
        this.wandUI = null;
        this.corruptionSystem = null;
        this.itemSystem = null;
        this.equipmentUI = null;
        this.styleLab = null;
        this.npcSystem = null;
        this.npcDialogueUI = null;
        this.runManager = null;
        this.coreSystem = null;
        this.vehicleBuilder = null;
        this.augmentSystem = null;
        this.mainMenu = null;
        this.runHUD = null;
        this.vehicleAugmentUI = null;
        this.zoneManager = null;
        this.shopUI = null;
        this.hintSystem = null;

        // Zone intro camera pan state
        this._cameraPan = null; // { startPos, endPos, startLook, endLook, duration, elapsed }

        // Vehicle Combat mode systems
        this.vehicleCombat = null; // { mesh, physics, weapons, damage, driver, chunkManager, grass, vegetation, water, atmosphere }

        this.clock = new THREE.Clock();
        this.frameCount = 0;
        this.lastFpsUpdate = 0;

        // Pause state for Tab menu
        this.isPaused = false;

        // Debug mode state
        this.debugMode = {
            enabled: false,
            wireframe: false,
            freezeEnemies: false,
            disableNPR: false
        };
        this.debugUI = null;
    }

    // --- Loading overlay control ---
    _setLoading(visible, statusText) {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;
        const statusEl = document.getElementById('loading-status');
        if (statusEl && statusText) statusEl.textContent = statusText;
        if (visible) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    async init() {
        this._setLoading(true, 'Initializing...');
        console.log('Initializing Chromatic Resonance 3D...');
        if (TEST_MODE) {
            console.log('TEST MODE: Enemies and tutorial disabled');
        }

        // Initialize RunManager (game state machine)
        this.runManager = new RunManager();

        // Initialize Main Menu (title screen, death/victory overlays)
        this.mainMenu = new MainMenu(this.runManager);

        // Initialize Run HUD (minimal in-game display: gold, zone indicator, vitality warning)
        this.runHUD = new RunHUD();

        // Initialize Shop UI (between-zone shop for core upgrades, healing)
        this.shopUI = new ShopUI(this.runManager);

        // Wire start-run event: MainMenu dispatches this, RunManager starts a new run
        window.addEventListener('start-run', () => {
            this.runManager.startNewRun();
        });

        // Wire player death to RunManager
        window.addEventListener('player-died', () => {
            if (this.runManager.getState() === RUN_STATES.PLAYING) {
                this.runManager.die();
            }
        });

        // Wire shop continue to RunManager
        window.addEventListener('shop-continue', () => {
            this.runManager.continueFromShop();
        });

        // All zones are outdoor levels with vehicle combat
        this.levelType = 'outdoor';
        this.vehicleCombatMode = true;

        console.log(`[Main] Level type: outdoor, vehicle: true`);

        // Create container
        const container = document.getElementById('app');

        // Initialize scene
        this.sceneManager = new SceneManager(container);
        await this.sceneManager.init();

        // Check for GLTF models
        await modelManager.checkAvailability();

        // Initialize ZoneManager (drives level creation for each zone in the run)
        this.zoneManager = new ZoneManager(this.sceneManager.scene);

        // Wire run-state-changed to zone loading
        window.addEventListener('run-state-changed', async (e) => {
            const { to, zoneIndex, seed } = e.detail;

            if (to === RUN_STATES.ZONE_INTRO) {
                // Show loading overlay during zone generation
                const zoneConfig = this.zoneManager?.getZoneConfig(zoneIndex);
                const zoneName = zoneConfig?.name || `Zone ${zoneIndex + 1}`;
                this._setLoading(true, `Zone ${zoneIndex + 1}: Entering ${zoneName}...`);

                // Set zone-specific music theme
                if (zoneConfig?.music && this.musicSystem) {
                    this.musicSystem.setZoneTheme(zoneConfig.music);
                }

                // Generate the zone level
                console.log(`[Main] ZONE_INTRO: generating zone ${zoneIndex}...`);
                try {
                    // Dispose previous level (including initial boot level) to avoid overlapping terrain
                    if (this.testLevel && this.testLevel.dispose) {
                        this.testLevel.dispose();
                    }
                    const zoneData = await this.zoneManager.generateZone(
                        zoneIndex, seed, this.vehicleCombat?.chunkManager
                    );
                    this.testLevel = zoneData.level;

                    // All zones are outdoor
                    this.levelType = 'outdoor';
                    this.vehicleCombatMode = true;

                    // Re-wire controller to ChunkManager terrain for terrain following
                    // ChunkManager is the visible terrain; outdoor-level is zone objects only
                    const heightSource = this.vehicleCombat?.chunkManager || this.testLevel;
                    if (this.controller?.setLevel) {
                        this.controller.setLevel(heightSource);
                    }

                    // Reposition player at zone spawn — use ChunkManager height
                    if (this.controller && zoneData.playerSpawn) {
                        const spawnY = heightSource.getHeightAt?.(
                            zoneData.playerSpawn.x, zoneData.playerSpawn.z
                        ) ?? zoneData.playerSpawn.y;
                        this.controller.setPosition(
                            zoneData.playerSpawn.x,
                            spawnY + 1.3,
                            zoneData.playerSpawn.z
                        );
                    }

                    // Update bounds
                    if (this.controller && zoneData.bounds) {
                        this.controller.setBounds(
                            zoneData.bounds.minX, zoneData.bounds.maxX,
                            zoneData.bounds.minZ, zoneData.bounds.maxZ
                        );
                    }

                    // Set up enemies for this zone
                    if (this.enemyManager) {
                        this.enemyManager.clearEnemies?.();
                        // Wire enemy manager to ChunkManager terrain
                        if (this.enemyManager.setLevel) {
                            this.enemyManager.setLevel(heightSource);
                        }
                        if (zoneData.bounds) {
                            this.enemyManager.setSpawnBounds(
                                zoneData.bounds.minX, zoneData.bounds.maxX,
                                zoneData.bounds.minZ, zoneData.bounds.maxZ
                            );
                        }
                        if (zoneData.spawns?.length > 0) {
                            this.enemyManager.setSpawnPoints(zoneData.spawns);
                        }
                        // Set zone-based enemy types
                        if (this.enemyManager.setZoneEnemies) {
                            this.enemyManager.setZoneEnemies(zoneData.config.enemies, zoneData.config.difficultyScale);
                        }
                    }

                    // Spawn NPCs for this zone (Keeper provides onboarding guidance)
                    if (this.npcSystem) {
                        this.npcSystem.dispose();
                        const npcSpawn = zoneData.playerSpawn || new THREE.Vector3(100, 1, 100);
                        this.npcSystem.spawnForLevel(this.levelType, zoneData.bounds, npcSpawn);
                    }

                    // Brief camera pan: elevated view sweeping down to player
                    if (this.controller && zoneData.playerSpawn) {
                        const spawn = zoneData.playerSpawn;
                        const hs = this.vehicleCombat?.chunkManager || this.testLevel;
                        const spawnY = hs?.getHeightAt?.(spawn.x, spawn.z) ?? spawn.y;

                        // Start: elevated, slightly north, looking down the corridor
                        const startPos = new THREE.Vector3(spawn.x, spawnY + 12, spawn.z + 2);
                        const startLook = new THREE.Vector3(spawn.x, spawnY, spawn.z - 30);

                        // End: normal third-person camera position behind player
                        const endPos = new THREE.Vector3(spawn.x, spawnY + 6.3, spawn.z + 6);
                        const endLook = new THREE.Vector3(spawn.x, spawnY + 1.3, spawn.z);

                        this._cameraPan = {
                            startPos, endPos, startLook, endLook,
                            duration: 2.0, elapsed: 0,
                        };

                        // Position camera at start immediately
                        this.sceneManager.camera.position.copy(startPos);
                        this.sceneManager.camera.lookAt(startLook);
                    }

                    // Transition to PLAYING after intro delay
                    setTimeout(() => {
                        this._setLoading(false);
                        this._cameraPan = null; // End any remaining pan
                        this.runManager.enterZone(zoneIndex);
                    }, 2000);
                } catch (err) {
                    console.error(`[Main] Failed to generate zone ${zoneIndex}:`, err);
                    // Fallback: enter zone anyway to avoid stuck state
                    this.runManager.enterZone(zoneIndex);
                }
            }

            if (to === RUN_STATES.MENU) {
                // Dispose current zone on return to menu
                if (this.zoneManager) {
                    this.zoneManager.disposeCurrentZone();
                }
            }
        });

        // Create initial outdoor level for boot
        this.testLevel = new OutdoorLevel(this.sceneManager.scene, {
            approach: 'assets',
            seed: this.runManager.getSeed(),
            element: ELEMENT_TYPES.FIRE,
        });
        await this.testLevel.build();
        console.log(`Outdoor world loaded: assets approach`);

        // Get platform system for character controller
        const platformSystem = this.testLevel.getPlatformSystem();

        // Initialize vehicle combat mode (blob + jeep with enter/exit transitions)
        this.vehicleCombat = this._initVehicleCombat(platformSystem);
        this.controller = this.vehicleCombat.driver;

        // Wire controller to ChunkManager terrain for heightmap access
        // ChunkManager is the visible terrain (1024x1024); outdoor-level is zone
        // objects only. Using outdoor-level causes vehicle to spawn underground.
        const heightSource = this.vehicleCombat?.chunkManager || this.testLevel;

        // Hide outdoor-level terrain mesh — ChunkManager provides the visible terrain.
        // Both systems create terrain geometry at different heights, causing entities
        // to appear underground when walking on one while the other is visible.
        if (this.vehicleCombat?.chunkManager) {
            this._hideOutdoorLevelTerrain(this.testLevel);
        }

        // Set player spawn position — use ChunkManager height for correct visual placement
        if (this.testLevel.getPlayerSpawnPosition) {
            const spawnPos = this.testLevel.getPlayerSpawnPosition();
            const spawnY = heightSource.getHeightAt?.(spawnPos.x, spawnPos.z) ?? spawnPos.y;
            this.controller.setPosition(spawnPos.x, spawnY + 1.3, spawnPos.z);
            console.log(`Player spawned at: (${spawnPos.x.toFixed(1)}, ${(spawnY + 1.3).toFixed(1)}, ${spawnPos.z.toFixed(1)})`);

            const bounds = this.testLevel.getBounds();
            this.controller.setBounds(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
            console.log(`World bounds: X[${bounds.minX}, ${bounds.maxX}] Z[${bounds.minZ}, ${bounds.maxZ}]`);
        }
        if (this.controller?.setLevel) {
            this.controller.setLevel(heightSource);
        }

        // Wire enemy manager to ChunkManager terrain for terrain-aware spawning
        if (this.enemyManager?.setLevel) {
            this.enemyManager.setLevel(heightSource);
        }

        // Initialize NPR post-processing
        this.nprPipeline = new NPRPipeline(
            this.sceneManager.renderer,
            this.sceneManager.scene,
            this.sceneManager.camera
        );
        this.nprPipeline.init();

        // Wire NPR pipeline to outdoor level (applies BotW preset internally)
        if (this.levelType === 'outdoor' && this.testLevel.setNPRPipeline) {
            this.testLevel.setNPRPipeline(this.nprPipeline);
        }

        // Initialize Style Lab (debug mode visual comparison system)
        this.styleLab = new StyleLab({
            nprPipeline: this.nprPipeline,
            scene: this.sceneManager.scene,
            renderer: this.sceneManager.renderer,
        });
        // Wire builder and theme for texture regeneration
        if (this.testLevel?.builder) {
            this.styleLab.setBuilder(this.testLevel.builder);
        }
        if (this.testLevel?.getTheme?.()) {
            this.styleLab.setTheme(this.testLevel.getTheme());
        }

        // Apply default visual style (overrides outdoor-level's BotW preset)
        this.styleLab.enable();
        this.styleLab.switchStyle('botw');

        // Color extraction removed - colors now come from enemy drops only
        // this.colorExtractor = new ColorExtractor(...)

        // Initialize color inventory and orb effects
        this.colorInventory = new ColorInventory();
        this.colorOrbManager = new ColorOrbManager(
            this.sceneManager.scene,
            this.sceneManager.camera
        );

        // Initialize ability system
        this.abilitySystem = new AbilitySystem(
            this.sceneManager.scene,
            this.sceneManager.camera,
            this.colorInventory
        );

        // Initialize enemy manager (zone mode for roguelike run, suppress waves)
        this.enemyManager = new EnemyManager(
            this.sceneManager.scene,
            this.sceneManager.camera,
            { testMode: TEST_MODE, spawnMode: 'zone' }
        );
        this.enemyManager.setAbilitySystem(this.abilitySystem);

        // Configure enemy spawns
        if (this.testLevel.getEnemySpawns) {
            const bounds = this.testLevel.getBounds();
            this.enemyManager.setSpawnBounds(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
            const spawns = this.testLevel.getEnemySpawns();
            if (spawns.length > 0) {
                this.enemyManager.setSpawnPoints(spawns);
            }
        }

        // Link ability system to enemy manager for wand projectile collisions
        this.abilitySystem.setEnemyManager(this.enemyManager);

        // Initialize player health
        this.playerHealth = new PlayerHealth();

        // Wire enemy projectile damage to player health
        this.enemyManager.setPlayerHealth(this.playerHealth);

        // Wire vehicle combat damage targets for enemy projectiles
        if (this.vehicleCombat) {
            this.enemyManager.setVehicleDamage(this.vehicleCombat.damage);
            this.enemyManager.setVehicleDriverController(this.vehicleCombat.driver);
        }

        // Initialize minimap
        this.minimap = new Minimap(this.enemyManager);

        // Initialize audio system (listens for game events)
        this.audioSystem = new AudioSystem();

        // Music system created lazily once AudioContext is available (after first user interaction)
        this.musicSystem = null;
        this._musicElement = ELEMENT_TYPES.FIRE;

        // Initialize core system (replaces XP/leveling with implicit core progression)
        this.coreSystem = new CoreSystem();

        // Wire shop core upgrades to core system
        window.addEventListener('shop-core-upgrade', (e) => {
            const { core, bonus } = e.detail;
            this.coreSystem.absorbCore(core, bonus);
        });

        // Wire zone guaranteed pickups (e.g. Spark Core in Zone 0)
        window.addEventListener('zone-guaranteed-pickup', (e) => {
            const { type, position } = e.detail;
            if (type === 'sparkCore') {
                this._spawnPickupOrb(position, 0xffaa00, () => {
                    this.coreSystem?.unlockCore('spark');
                    this.audioSystem?.stopProximityHum();
                    window.dispatchEvent(new CustomEvent('notification', {
                        detail: { text: 'SPARK CORE ACQUIRED', color: '#ffaa00' }
                    }));
                }, 'sparkCore');
            } else if (type === 'starterVehicleParts') {
                this._spawnPickupOrb(position, 0x88ff88, () => {
                    this.vehicleBuilder?.buildStarterVehicle();
                    window.dispatchEvent(new CustomEvent('notification', {
                        detail: { text: 'VEHICLE PARTS FOUND', color: '#88ff88' }
                    }));
                });
            }
        });

        // Wire lore pickup events to a toast notification
        window.addEventListener('lore-discovered', (e) => {
            const { title, text } = e.detail;
            this._showLoreToast(title, text);
        });

        // Initialize vehicle builder (scrap-based vehicle construction)
        this.vehicleBuilder = new VehicleBuilder(this.sceneManager.scene);

        // Initialize augment system (Noita-style modifiers for vehicle components)
        this.augmentSystem = new AugmentSystem();

        // Wire augment system to vehicle subsystems
        if (this.vehicleCombat) {
            this.vehicleCombat.weapons.augmentSystem = this.augmentSystem;
            if (this.vehicleCombat.vehicleController?.physics) {
                this.vehicleCombat.vehicleController.physics.augmentSystem = this.augmentSystem;
            }
            this.vehicleCombat.damage.augmentSystem = this.augmentSystem;
        }

        // Initialize vehicle augment UI (vehicle workshop screen, I key)
        this.vehicleAugmentUI = new VehicleAugmentUI(this.vehicleBuilder, this.augmentSystem);

        // Wire vehicle/augment systems to shop
        if (this.shopUI) {
            this.shopUI.vehicleBuilder = this.vehicleBuilder;
            this.shopUI.augmentSystem = this.augmentSystem;
        }

        // Initialize legacy progression system (kept for compatibility, UI hidden)
        this.progressionSystem = new ProgressionSystem();
        // Hide old XP bar and level display — cores replace this
        const progressionUI = document.getElementById('progression-ui');
        if (progressionUI) progressionUI.style.display = 'none';

        // Initialize floating text for damage numbers
        this.floatingTextManager = new FloatingTextManager(
            this.sceneManager.scene,
            this.sceneManager.camera
        );

        // Initialize pause menu
        this.pauseMenu = new PauseMenu(this.audioSystem);

        // Initialize game state UI (game over, victory screens)
        this.gameStateUI = new GameStateUI();

        // Show tutorial for first-time players (skip in test mode)
        if (!TEST_MODE) {
            this.tutorial = new TutorialOverlay();
        }

        // Initialize combo system
        this.comboSystem = new ComboSystem();

        // Initialize boss UI
        this.bossUI = new BossUI();

        // Initialize powerup system
        this.powerupSystem = new PowerupSystem(
            this.sceneManager.scene,
            this.sceneManager.camera
        );

        // Legacy wand UI disabled — replaced by vehicle augment UI
        // this.wandUI = new WandUI(
        //     this.abilitySystem.getActiveWand(),
        //     this.colorInventory
        // );

        // Initialize corruption system (visual effect)
        this.corruptionSystem = new CorruptionSystem(this.sceneManager.scene);

        // Initialize item system (Living Arsenal)
        this.itemSystem = new ItemSystem(
            this.sceneManager.scene,
            this.sceneManager.camera
        );
        this.itemSystem.setPlayerController(this.controller);

        // Wire core system to blob controller (drives particle budget, speed scaling)
        if (this.controller.setCoreSystem) {
            this.controller.setCoreSystem(this.coreSystem);
        }

        // Legacy equipment UI disabled — replaced by vehicle augment UI
        // this.equipmentUI = new EquipmentUI(this.itemSystem);

        // Initialize vehicle component UI (only in vehicle combat mode)
        if (this.vehicleCombatMode && this.vehicleCombat) {
            this.vehicleCombat.componentUI = new VehicleComponentUI(this.itemSystem);

            // Update vehicle physics when components change
            window.addEventListener('vehicle-equipment-changed', () => {
                const stats = this.itemSystem.getVehicleAggregateStats();
                const physics = this.vehicleCombat.vehicleController?.physics;
                if (physics) {
                    // Apply component bonuses to physics
                    physics.componentSpeedBonus = stats.speedBonus || 0;
                    physics.componentTractionBonus = stats.tractionBonus || 0;
                    physics.componentMass = stats.mass || 0;
                }
            });
        }

        // Initialize NPC system (Keeper, Wanderer, Fragment blobs)
        // NPCs are spawned per-zone during zone transitions (see run-state-changed handler)
        if (!TEST_MODE) {
            this.npcSystem = new NPCSystem(this.sceneManager.scene, {
                element: ELEMENT_TYPES.FIRE
            });
            this.npcDialogueUI = new NPCDialogueUI();
        }

        // Initialize hint system (contextual onboarding toasts)
        if (!TEST_MODE) {
            this.hintSystem = new HintSystem();
        }

        // Set up blob health/essence syncing
        if (this.controller.syncHealth) {
            this.setupBlobSync();
        }

        // Set up input handlers
        this.setupInputHandlers();

        // If debug zone is set, skip menu and start a run directly
        // Note: ?zone=0 works perfectly. ?zone=1/2 still loads zone 0 first
        // (full zone progression requires playing through or future debug shortcut)
        if (DEBUG_ZONE !== null) {
            this.runManager.startNewRun();
            // The run-state-changed listener handles zone generation and enterZone()
        }
        // Normal flow: RunManager stays in MENU state, MainMenu shows on screen.
        // Player clicks "New Blob" -> start-run event -> runManager.startNewRun()
        //   -> ZONE_INTRO -> ZoneManager.generateZone() -> 2s delay -> enterZone() -> PLAYING

        // Enable debug mode if ?debug=true
        if (DEBUG_ON_START) {
            this.toggleDebugMode();
        }

        // Start game loop
        this.animate();

        // Hide loading overlay — menu or debug zone is now ready
        this._setLoading(false);

        console.log('Chromatic Resonance 3D initialized!');
    }

    /**
     * Set up health and essence syncing between systems and blob controller
     */
    setupBlobSync() {
        // Initial sync
        if (this.playerHealth && this.controller.syncHealth) {
            this.controller.syncHealth(
                this.playerHealth.getHealth(),
                this.playerHealth.getMaxHealth()
            );
        }

        // Sync on health changes
        window.addEventListener('player-damaged', (e) => {
            if (this.controller.syncHealth) {
                this.controller.syncHealth(
                    this.playerHealth.getHealth(),
                    this.playerHealth.getMaxHealth()
                );
            }
        });

        window.addEventListener('player-healed', (e) => {
            if (this.controller.syncHealth) {
                this.controller.syncHealth(
                    e.detail.newHealth,
                    this.playerHealth.getMaxHealth()
                );
            }
        });
    }

    setupInputHandlers() {
        // Legacy Tab key handler removed — WandUI/EquipmentUI replaced by vehicle augment UI (I key)

        // Pause state events from Tab menu
        window.addEventListener('game-paused', () => {
            this.isPaused = true;
        });

        window.addEventListener('game-resumed', () => {
            this.isPaused = false;
            // Re-acquire pointer lock after resuming from menu
            if (!document.pointerLockElement && this.sceneManager?.renderer?.domElement) {
                this.sceneManager.renderer.domElement.requestPointerLock();
            }
        });

        // Left click to fire wand (when pointer locked)
        window.addEventListener('mousedown', (e) => {
            if (!document.pointerLockElement) return;
            if (e.button === 0) { // Left click
                this.fireWand();
            }
        });

        // ESC handling - close spell menu if open, otherwise release pointer lock
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // If vehicle augment UI is open, close it
                if (this.vehicleAugmentUI && this.vehicleAugmentUI.isOpen) {
                    this.vehicleAugmentUI.close();
                    return;
                }
                // Otherwise release pointer lock
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
            }


            // I to toggle vehicle workshop panel
            if (e.key === 'i' || e.key === 'I') {
                if (this.vehicleAugmentUI && this.vehicleCombatMode) {
                    this.vehicleAugmentUI.toggle();
                }
            }

            // F3 to toggle debug mode
            if (e.key === 'F3') {
                e.preventDefault();
                this.toggleDebugMode();
            }

            // Debug mode sub-toggles (only when debug mode is enabled)
            if (this.debugMode.enabled) {
                if (e.key === '1') {
                    this.switchStyleLab('watercolor');
                } else if (e.key === '2') {
                    this.switchStyleLab('lowPoly');
                } else if (e.key === '3') {
                    this.switchStyleLab('borderlands');
                } else if (e.key === '4') {
                    this.switchStyleLab('botw');
                } else if (e.key === '5') {
                    this.switchStyleLab('sable');
                } else if (e.key === '6') {
                    this.switchStyleLab('hybrid');
                } else if (e.key === '7') {
                    this.toggleWireframe();
                } else if (e.key === '8') {
                    this.toggleFreezeEnemies();
                } else if (e.key === '9') {
                    this.toggleNPR();
                } else if (e.key === '0') {
                    this.spawnDebugEnemy();
                } else if (e.key.toLowerCase() === 'h') {
                    this.verifyEnemyHeights();
                }
            }
        });
    }

    createDebugUI() {
        if (this.debugUI) return;

        this.debugUI = document.createElement('div');
        this.debugUI.id = 'debug-ui';
        this.debugUI.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #0f0;
            font-family: monospace;
            font-size: 12px;
            z-index: 1000;
            border: 1px solid #0f0;
            min-width: 200px;
        `;
        this.debugUI.innerHTML = `
            <div style="color: #ff0; margin-bottom: 8px;">DEBUG MODE (F3 to hide)</div>
            <div style="color: #0ff; margin-bottom: 4px;">[1-4] Style Lab</div>
            <div id="debug-wireframe">[7] Wireframe: OFF</div>
            <div id="debug-freeze">[8] Freeze Enemies: OFF</div>
            <div id="debug-npr">[9] NPR Pipeline: ON</div>
            <div id="debug-spawn">[0] Spawn Test Enemy</div>
            <div id="debug-heights">[H] Verify Heights</div>
            <hr style="border-color: #333; margin: 8px 0;">
            <div id="debug-enemy-count">Enemies: 0</div>
            <div id="debug-height-status">Heights: Not checked</div>
        `;
        document.body.appendChild(this.debugUI);
    }

    updateDebugUI() {
        if (!this.debugUI) return;

        document.getElementById('debug-wireframe').textContent =
            `[7] Wireframe: ${this.debugMode.wireframe ? 'ON' : 'OFF'}`;
        document.getElementById('debug-freeze').textContent =
            `[8] Freeze Enemies: ${this.debugMode.freezeEnemies ? 'ON' : 'OFF'}`;
        document.getElementById('debug-npr').textContent =
            `[9] NPR Pipeline: ${this.debugMode.disableNPR ? 'OFF' : 'ON'}`;
        document.getElementById('debug-enemy-count').textContent =
            `Enemies: ${this.enemyManager ? this.enemyManager.getEnemyCount() : 0}`;
    }

    toggleDebugMode() {
        this.debugMode.enabled = !this.debugMode.enabled;

        if (this.debugMode.enabled) {
            this.createDebugUI();
            console.log('Debug mode enabled');
        } else {
            if (this.debugUI) {
                this.debugUI.remove();
                this.debugUI = null;
            }
            // Reset debug options when disabling
            if (this.debugMode.wireframe) this.toggleWireframe();
            if (this.debugMode.freezeEnemies) this.toggleFreezeEnemies();
            if (this.debugMode.disableNPR) this.toggleNPR();
            if (this.styleLab?.isEnabled) this.styleLab.disable();
            console.log('Debug mode disabled');
        }

        // Expose game instance for console debugging
        window.game = this.debugMode.enabled ? this : undefined;
    }

    toggleWireframe() {
        this.debugMode.wireframe = !this.debugMode.wireframe;

        // Apply wireframe to all meshes in scene
        this.sceneManager.scene.traverse((obj) => {
            if (obj.isMesh && obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => {
                        if (m.wireframe !== undefined) m.wireframe = this.debugMode.wireframe;
                    });
                } else if (obj.material.wireframe !== undefined) {
                    obj.material.wireframe = this.debugMode.wireframe;
                }
            }
        });

        this.updateDebugUI();
        console.log(`Wireframe: ${this.debugMode.wireframe ? 'ON' : 'OFF'}`);
    }

    toggleFreezeEnemies() {
        this.debugMode.freezeEnemies = !this.debugMode.freezeEnemies;

        // Store original update method if freezing
        if (this.enemyManager) {
            if (this.debugMode.freezeEnemies) {
                this.enemyManager._originalUpdate = this.enemyManager.update;
                this.enemyManager.update = () => {
                    // Only update enemy visuals, not movement
                    this.enemyManager.enemies.forEach(enemy => {
                        if (enemy.healthBar && this.sceneManager.camera) {
                            enemy.healthBar.lookAt(this.sceneManager.camera.position);
                        }
                    });
                };
            } else if (this.enemyManager._originalUpdate) {
                this.enemyManager.update = this.enemyManager._originalUpdate;
                delete this.enemyManager._originalUpdate;
            }
        }

        this.updateDebugUI();
        console.log(`Freeze enemies: ${this.debugMode.freezeEnemies ? 'ON' : 'OFF'}`);
    }

    toggleNPR() {
        this.debugMode.disableNPR = !this.debugMode.disableNPR;
        this.updateDebugUI();
        console.log(`NPR Pipeline: ${this.debugMode.disableNPR ? 'OFF' : 'ON'}`);
    }

    spawnDebugEnemy() {
        if (!this.enemyManager) return;

        // Spawn enemy in front of player for easy viewing
        const playerPos = this.controller ? this.controller.getPosition() : new THREE.Vector3();
        const playerYaw = this.controller ? this.controller.getYaw() : 0;

        // Spawn 5 units in front of player
        const spawnX = playerPos.x + Math.sin(playerYaw) * 5;
        const spawnZ = playerPos.z + Math.cos(playerYaw) * 5;

        // Cycle through enemy types
        const types = ['shade', 'crimsonWraith', 'azurePhantom', 'verdantSlime'];
        const typeIndex = this.enemyManager.enemies.length % types.length;
        const type = types[typeIndex];

        // Force spawn specific enemy type
        const oldSpawnEnemy = this.enemyManager.spawnEnemy.bind(this.enemyManager);
        this.enemyManager.playerPosition.set(spawnX, 0, spawnZ);
        this.enemyManager.spawnRadius = 0.1; // Spawn right at the position
        this.enemyManager.spawnEnemy(type);
        this.enemyManager.spawnRadius = 15; // Reset

        console.log(`Debug spawn: ${type} at (${spawnX.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    }

    verifyEnemyHeights() {
        if (!this.enemyManager) {
            console.log('No enemy manager available');
            return;
        }

        const enemies = this.enemyManager.enemies.filter(e => !e.isDead);
        if (enemies.length === 0) {
            console.log('No enemies to verify - spawn some with [0] first');
            if (this.debugUI) {
                document.getElementById('debug-height-status').textContent = 'Heights: No enemies';
                document.getElementById('debug-height-status').style.color = '#888';
            }
            return;
        }

        const verification = verifyAllEnemies(enemies);
        logVerificationResults(verification);

        // Update debug UI
        if (this.debugUI) {
            const statusEl = document.getElementById('debug-height-status');
            if (verification.failed === 0) {
                statusEl.textContent = `Heights: ALL PASS (${verification.passed}/${verification.passed + verification.skipped})`;
                statusEl.style.color = '#0f0';
            } else {
                statusEl.textContent = `Heights: ${verification.failed} FAIL, ${verification.passed} pass`;
                statusEl.style.color = '#f00';
            }
        }
    }

    /**
     * Switch Style Lab to specified style (enables Style Lab if not yet active)
     */
    switchStyleLab(styleName) {
        if (!this.styleLab) return;
        if (!this.styleLab.isEnabled) {
            this.styleLab.enable();
        }
        this.styleLab.switchStyle(styleName);
    }

    /**
     * Fire the wand - called on left click when pointer locked
     * When driving in vehicle combat mode, fires the spell launcher instead
     */
    fireWand() {
        // Vehicle combat: fire spell launcher while driving
        if (this.vehicleCombat && this.vehicleCombat.driver &&
            this.vehicleCombat.driver.isDriving() && this.vehicleCombat.weapons) {
            const aimDir = new THREE.Vector3();
            this.sceneManager.camera.getWorldDirection(aimDir);
            this.vehicleCombat.weapons.fireSpellLauncher(aimDir);
            return;
        }

        if (!this.abilitySystem || !this.colorInventory) return;

        const wand = this.abilitySystem.getActiveWand();
        const config = wand.fire(this.colorInventory);

        if (!config) {
            // Show message if can't fire
            if (!wand.canFire(this.colorInventory)) {
                this.abilitySystem.showMessage('Not enough charge!', 'warning');
            }
            return;
        }

        // Get camera direction for casting
        const cameraDir = new THREE.Vector3();
        this.sceneManager.camera.getWorldDirection(cameraDir);

        // Determine projectile origin
        let origin;
        if (this.controller.getWandPosition) {
            // Launch from wand blob position
            origin = this.controller.getWandPosition();
            // Trigger wand blob visual feedback
            this.controller.triggerWandCast();
        } else {
            // Legacy: launch from camera position
            origin = this.sceneManager.camera.position.clone().add(cameraDir.clone().multiplyScalar(1));
        }

        // Cast blended projectile
        this.abilitySystem.spellCaster.castBlended(config, origin, cameraDir, (enemy, spell) => {
            // Hit callback - healing is handled in spell-crafting.js
        });

        // Visual feedback
        const colorNames = config.colors.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('+');
        this.abilitySystem.showMessage(config.combo ? config.combo.name : colorNames, 'ability');

        // Audio event
        window.dispatchEvent(new CustomEvent('ability-used', {
            detail: { ability: 'wand-cast', colors: config.colors }
        }));
    }

    /**
     * Spawn a glowing pickup orb at a position
     * @param {THREE.Vector3} position - World position
     * @param {number} color - Hex color for the orb
     * @param {function} onCollect - Callback when player picks it up
     * @param {string} [tag] - Optional tag for identifying special orbs
     */
    _spawnPickupOrb(position, color, onCollect, tag) {
        const geo = new THREE.SphereGeometry(0.4, 12, 12);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
        });
        const orb = new THREE.Mesh(geo, mat);
        orb.position.copy(position);
        orb.position.y = 1.0;
        this.sceneManager.scene.add(orb);

        // Point light for glow effect
        const light = new THREE.PointLight(color, 1.0, 8, 2);
        orb.add(light);

        // Track for per-frame update
        const pickupData = { orb, onCollect, collected: false, baseY: orb.position.y, tag: tag || null };

        if (!this._pickupOrbs) this._pickupOrbs = [];
        this._pickupOrbs.push(pickupData);
    }

    /**
     * Show a lore toast notification (auto-dismisses after 6s)
     * @param {string} title - Lore item title
     * @param {string} text - Lore text content
     */
    _showLoreToast(title, text) {
        if (!this._loreToast) {
            this._loreToast = document.createElement('div');
            this._loreToast.id = 'lore-toast';
            this._loreToast.style.cssText = `
                position: fixed;
                bottom: 15%;
                left: 50%;
                transform: translateX(-50%);
                max-width: 420px;
                padding: 16px 24px;
                background: rgba(20, 18, 12, 0.92);
                border: 1px solid #d4a574;
                border-radius: 6px;
                color: #f5f0e6;
                z-index: 200;
                opacity: 0;
                transition: opacity 0.4s;
                pointer-events: none;
                font-family: monospace;
            `;
            document.body.appendChild(this._loreToast);
        }

        this._loreToast.innerHTML =
            `<div style="color:#d4a574;font-weight:bold;font-size:14px;margin-bottom:6px;">${title}</div>` +
            `<div style="font-size:13px;line-height:1.5;font-style:italic;">"${text}"</div>`;
        this._loreToast.style.opacity = '1';

        clearTimeout(this._loreToastTimer);
        this._loreToastTimer = setTimeout(() => {
            this._loreToast.style.opacity = '0';
        }, 6000);
    }

    /**
     * Update pickup orbs (bobbing animation + proximity check)
     * Called from animate() loop
     */
    _updatePickupOrbs(delta, elapsed) {
        if (!this._pickupOrbs) return;
        const playerPos = this.controller?.getPosition();
        if (!playerPos) return;

        for (let i = this._pickupOrbs.length - 1; i >= 0; i--) {
            const p = this._pickupOrbs[i];
            if (p.collected) continue;

            // Bobbing animation
            p.orb.position.y = p.baseY + Math.sin(elapsed * 3) * 0.3;
            p.orb.rotation.y = elapsed * 1.5;

            // Spark core audio breadcrumb
            if (p.tag === 'sparkCore' && this.audioSystem) {
                this.audioSystem.playProximityHum(playerPos, p.orb.position);
            }

            // Proximity check
            const dist = p.orb.position.distanceTo(playerPos);
            if (dist < 2.0) {
                p.collected = true;
                p.onCollect();
                this.sceneManager.scene.remove(p.orb);
                p.orb.geometry.dispose();
                p.orb.material.dispose();
                this._pickupOrbs.splice(i, 1);
            }
        }
    }

    /**
     * Check scrap pile pickups in outdoor levels
     * Scrap piles have userData.type === 'scrap-pickup' and dispatch vehicle-part-found
     */
    _checkScrapPickups(playerPos) {
        if (!this.testLevel || !this.testLevel.group) return;

        const pickupRange = 2.5;
        this.testLevel.group.traverse((child) => {
            if (!child.userData || child.userData.type !== 'scrap-pickup') return;
            if (child.userData.collected) return;

            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            const dist = playerPos.distanceTo(worldPos);

            if (dist < pickupRange) {
                child.userData.collected = true;
                child.visible = false;

                const partId = child.userData.partId;
                window.dispatchEvent(new CustomEvent('vehicle-part-found', {
                    detail: { partId }
                }));
                window.dispatchEvent(new CustomEvent('notification', {
                    detail: { text: `SCRAP FOUND: ${partId}`, color: '#88ff88' }
                }));
            }
        });
    }

    /**
     * Hide the outdoor-level terrain mesh so it doesn't overlap with ChunkManager.
     * OutdoorLevel creates a 129x129 heightmap terrain mesh at different heights
     * than ChunkManager — keeping both visible causes entities to appear underground.
     * Zone objects (facility spires, scrapyard junk, etc.) are kept visible.
     */
    _hideOutdoorLevelTerrain(level) {
        if (!level?.group) return;
        level.group.traverse(obj => {
            if (obj.isMesh && obj.userData?.type === 'terrain' && obj.userData.chunkX === undefined) {
                obj.visible = false;
            }
        });
    }

    /**
     * Initialize Vehicle Combat mode systems
     */
    _initVehicleCombat(platformSystem) {
        const scene = this.sceneManager.scene;
        const camera = this.sceneManager.camera;
        const domElement = this.sceneManager.renderer.domElement;

        // 1. Create blob player controller (for on-foot)
        const blobController = new BlobPlayerController(camera, domElement, scene, platformSystem);

        // 2. Create vehicle mesh
        const vehicleMesh = new VehicleMesh();
        scene.add(vehicleMesh);

        // 3. Create jeep controller (for driving)
        const vehicleController = new JeepController(camera, domElement, scene, platformSystem);

        // 4. Create vehicle driver controller (manages transitions)
        const driver = new VehicleDriverController(
            camera, domElement, scene,
            blobController, vehicleController, vehicleMesh
        );

        // 5. Create weapon system
        const weapons = new VehicleWeaponSystem(scene);
        weapons.setupDefaultLoadout(vehicleMesh);

        // 6. Create damage system
        const damage = new VehicleDamageSystem(scene);
        damage.setVehicle(vehicleMesh, vehicleController.physics || null);
        damage.onDestroyed = () => driver.onVehicleDestroyed();
        driver.damageSystem = damage;

        // 6b. Create vehicle audio system and wire damage to controller
        const vehicleAudio = new VehicleAudio();
        vehicleController.vehicleAudio = vehicleAudio;
        vehicleController.damageSystem = damage;
        weapons.vehicleAudio = vehicleAudio;

        // 7. Position vehicle in world (inside flat spawn clearing, directly ahead of player)
        // Camera starts facing -Z, so vehicle at lower Z is "in front" of player
        // NOTE: Actual Y position is corrected below after ChunkManager loads
        const spawnCenter = 100;
        const vehX = spawnCenter;
        const vehZ = spawnCenter - 6;
        const vehicleY = this.testLevel?.getHeightAt?.(vehX, vehZ) ?? 0;
        vehicleMesh.position.set(vehX, vehicleY, vehZ);
        vehicleController.setPosition(vehX, vehicleY, vehZ);

        // 8. Create open world systems (only for outdoor level)
        let chunkManager = null, grass = null, vegetation = null, water = null, atmosphere = null;
        if (this.levelType === 'outdoor') {
            const seed = parseInt(new URLSearchParams(window.location.search).get('seed') || '42');

            chunkManager = new ChunkManager(scene, seed);
            chunkManager.loadAroundPosition(spawnCenter, spawnCenter);

            grass = new GrassSystem();
            vegetation = new VegetationSystem();
            water = new WaterSystem(scene, seed, chunkManager.getWorldSize());
            atmosphere = new AtmosphereSystem(scene, seed, chunkManager.getWorldSize());

            // Load grass/vegetation for initial chunks
            chunkManager.forEachChunk(chunk => {
                grass.addChunk(chunk, scene);
                vegetation.addChunk(chunk, scene);
            });

            // Reposition vehicle at ChunkManager terrain height (not outdoor-level)
            const correctVehicleY = chunkManager.getHeightAt(vehX, vehZ);
            vehicleMesh.position.y = correctVehicleY;
            vehicleController.setPosition(vehX, correctVehicleY, vehZ);
        }

        // 9. Create vehicle HUD
        const vehicleCombatResult = {
            driver,
            blobController,
            vehicleController,
            vehicleMesh,
            weapons,
            damage,
            vehicleAudio,
            chunkManager,
            grass,
            vegetation,
            water,
            atmosphere,
            hud: null,
            componentUI: null,
        };
        const hud = new VehicleHUD(vehicleCombatResult);
        vehicleCombatResult.hud = hud;

        // Wire state change notifications to HUD and audio
        driver.onStateChanged = (newState) => {
            hud.onStateChanged(newState);
            if (newState === DRIVER_STATE.DRIVING) {
                vehicleAudio.startEngine();
            } else if (newState === DRIVER_STATE.ON_FOOT || newState === DRIVER_STATE.DESTROYED) {
                vehicleAudio.stopEngine();
            }
        };

        console.log('Vehicle Combat mode initialized');

        return vehicleCombatResult;
    }

    /**
     * Update Vehicle Combat mode systems
     */
    _updateVehicleCombat(delta, elapsed) {
        const vc = this.vehicleCombat;
        if (!vc) return;

        const cameraPos = this.sceneManager.camera.position;

        // Sync vehicleMesh position/rotation from vehicleController so they stay aligned
        // vehicleMesh is used for proximity checks (enter/exit) and visual display
        // vehicleController.character is the physics-driven group
        if (vc.vehicleController && vc.vehicleMesh) {
            const ctrlPos = vc.vehicleController.getPosition();
            vc.vehicleMesh.position.copy(ctrlPos);
            vc.vehicleMesh.rotation.copy(vc.vehicleController.character.rotation);
        }

        // Update chunk loading/unloading around camera
        if (vc.chunkManager) {
            vc.chunkManager.update(cameraPos.x, cameraPos.z);
        }

        // Update grass
        if (vc.grass) {
            vc.grass.update(elapsed, cameraPos);
        }

        // Update tree canopy sway
        if (vc.vegetation) {
            vc.vegetation.update(elapsed);
        }

        // Update water
        if (vc.water) {
            vc.water.update(delta);
        }

        // Update atmosphere
        if (vc.atmosphere) {
            vc.atmosphere.update(delta, cameraPos);
        }

        // Update weapons (only while driving)
        if (vc.weapons && vc.driver.isDriving()) {
            const vehiclePos = vc.vehicleController.getPosition();
            const aimDir = new THREE.Vector3(0, 0, 1); // forward for now
            vc.weapons.enemyManager = this.enemyManager;
            vc.weapons.colorInventory = this.colorInventory;
            vc.weapons.update(delta, vehiclePos, aimDir);
        }

        // Update vehicle audio
        if (vc.vehicleAudio && vc.driver.isDriving()) {
            const speed = vc.vehicleController.physics?.speed || 0;
            const throttle = vc.vehicleController.keys?.forward ? 1 :
                (vc.vehicleController.keys?.backward ? -0.5 : 0);
            vc.vehicleAudio.update(speed, throttle);
        }

        // Update damage system
        if (vc.damage) {
            vc.damage.update(delta);
        }

        // Check vehicle-enemy collisions (while driving)
        if (vc.driver.isDriving() && this.enemyManager && this.enemyManager.checkVehicleImpact) {
            const vehiclePos = vc.vehicleController.getPosition();
            const vehicleVel = new THREE.Vector3(
                vc.vehicleController.physics?.velocityX || 0,
                0,
                vc.vehicleController.physics?.velocityZ || 0
            );
            const speed = Math.abs(vc.vehicleController.physics?.speed || 0);
            if (speed > 2) {
                this.enemyManager.checkVehicleImpact(vehiclePos, vehicleVel, 2.0);
            }
        }

        // Update vehicle HUD (runs in all states for enter prompt)
        if (vc.hud) {
            vc.hud.update(delta);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Check if game is paused (from pause menu, Tab menu, player dead, or not in PLAYING state)
        const isPausedByMenu = this.pauseMenu && this.pauseMenu.isGamePaused();
        const isPausedByTab = this.isPaused;
        const isDead = this.playerHealth && this.playerHealth.isDead;
        const runState = this.runManager ? this.runManager.getState() : RUN_STATES.PLAYING;
        const isNotPlaying = runState !== RUN_STATES.PLAYING;
        const isPaused = isPausedByMenu || isPausedByTab || isDead || isNotPlaying;

        const rawDelta = this.clock.getDelta();
        const delta = isPaused ? 0 : rawDelta;
        const elapsed = this.clock.getElapsedTime();

        // Skip game updates if paused (but still render)
        if (!isPaused) {
            // Update character controller
            if (this.controller) {
                this.controller.update(delta);
            }

            // Color extractor removed - colors from enemy drops only
            // if (this.colorExtractor) { this.colorExtractor.update(); }

            // Update color orbs
            if (this.colorOrbManager) {
                this.colorOrbManager.update();
            }

            // Update test level (animated objects)
            if (this.testLevel) {
                this.testLevel.update(delta, elapsed);
            }

            // Update zone manager (portal animations)
            if (this.zoneManager) {
                this.zoneManager.update(delta, elapsed);

                // Check exit portal proximity while PLAYING
                if (this.runManager.getState() === RUN_STATES.PLAYING && this.controller) {
                    const playerPos = this.controller.getPosition();
                    if (this.zoneManager.checkExitPortal(playerPos)) {
                        console.log('[Main] Player reached exit portal!');
                        this.runManager.exitZone();
                    }

                    // Check lore pickup proximity
                    const currentLevel = this.zoneManager.getCurrentLevel();
                    if (currentLevel && currentLevel.checkLorePickups) {
                        currentLevel.checkLorePickups(playerPos);
                    }
                }
            }

            // Update Vehicle Combat systems
            if (this.vehicleCombat) {
                this._updateVehicleCombat(delta, elapsed);
            }

            // Update ability system (pass delta for projectile movement)
            if (this.abilitySystem) {
                this.abilitySystem.update(delta);
            }

            // Update color inventory (passive regeneration)
            if (this.colorInventory) {
                this.colorInventory.update(delta);

                // Sync ivory (mana) to wand blob essence
                if (this.controller.syncEssence) {
                    const ivory = this.colorInventory.getCharge('ivory');
                    const maxIvory = this.colorInventory.getMaxCharge('ivory');
                    this.controller.syncEssence(ivory, maxIvory);
                }
            }

            // Legacy wand UI update removed

            // Update corruption system
            if (this.corruptionSystem) {
                this.corruptionSystem.update(delta, elapsed);
            }

            // Update item system (world drops, formations, symbiotes)
            if (this.itemSystem) {
                this.itemSystem.update(delta);
            }

            // Lazily initialize and update music system
            if (!this.musicSystem && this.audioSystem?.initialized) {
                const ctx = this.audioSystem.getAudioContext();
                const master = this.audioSystem.getMasterGain();
                if (ctx && master) {
                    this.musicSystem = new MusicSystem(ctx, master);
                    this.musicSystem.setElement(this._musicElement);
                }
            }
            if (this.musicSystem) {
                this.musicSystem.update(delta);
            }

            // Update NPC system (blob behaviors, interaction checks)
            if (this.npcSystem && this.controller) {
                const playerPos = this.controller.getPosition();
                this.npcSystem.update(delta, playerPos);

                // Update NPC interaction prompt
                if (this.npcDialogueUI) {
                    this.npcDialogueUI.updatePrompt(this.npcSystem);
                }
            }

            // Update hint system proximity checks
            if (this.hintSystem && this.controller) {
                const playerPos = this.controller.getPosition();
                this.hintSystem.updateProximity(playerPos, {
                    npcSystem: this.npcSystem,
                    vehicleMesh: this.vehicleCombat?.vehicleMesh,
                });
            }
        }

        // Update enemies (skip if paused)
        if (!isPaused && this.enemyManager && this.controller) {
            const playerPos = this.controller.getPosition();
            this.enemyManager.setPlayerPosition(playerPos);
            // Skip enemy spawning/updates in test mode
            if (!TEST_MODE) {
                this.enemyManager.update(delta);
            }

            // Update minimap with player position and rotation
            if (this.minimap) {
                this.minimap.setPlayerPosition(playerPos.x, playerPos.z, this.controller.getYaw());
            }

            // Update powerup system with player position
            if (this.powerupSystem) {
                this.powerupSystem.setPlayerPosition(playerPos);
            }

            // Check item pickups
            if (this.itemSystem) {
                this.itemSystem.checkPickups(playerPos);
            }

            // Update pickup orbs (guaranteed zone pickups like Spark Core)
            this._updatePickupOrbs(delta, elapsed);

            // Check scrap pile pickups in outdoor levels
            this._checkScrapPickups(playerPos);
        }

        // Zone intro camera pan (runs outside isPaused check, uses rawDelta)
        if (this._cameraPan) {
            const pan = this._cameraPan;
            pan.elapsed += rawDelta;
            const t = Math.min(pan.elapsed / pan.duration, 1.0);
            // Smooth ease-out cubic
            const ease = 1 - Math.pow(1 - t, 3);

            this.sceneManager.camera.position.lerpVectors(pan.startPos, pan.endPos, ease);
            const look = new THREE.Vector3().lerpVectors(pan.startLook, pan.endLook, ease);
            this.sceneManager.camera.lookAt(look);

            if (t >= 1.0) {
                this._cameraPan = null;
            }
        }

        // Render with NPR pipeline (or raw if debug disabled)
        if (this.nprPipeline && !this.debugMode.disableNPR) {
            this.nprPipeline.render();
        } else if (this.sceneManager?.renderer) {
            this.sceneManager.renderer.render(
                this.sceneManager.scene,
                this.sceneManager.camera
            );
        }

        // Update debug UI if enabled
        if (this.debugMode.enabled) {
            this.updateDebugUI();
        }

        // Update debug info
        this.updateDebugInfo(elapsed);
    }

    updateDebugInfo(elapsed) {
        this.frameCount++;

        // Update FPS every 500ms
        if (elapsed - this.lastFpsUpdate > 0.5) {
            const fps = Math.round(this.frameCount / (elapsed - this.lastFpsUpdate));
            document.getElementById('fps').textContent = fps;
            this.frameCount = 0;
            this.lastFpsUpdate = elapsed;

            // Expose performance stats for testing
            const renderer = this.sceneManager?.renderer;
            window.perfStats = {
                fps,
                drawCalls: renderer?.info?.render?.calls || 0,
                triangles: renderer?.info?.render?.triangles || 0,
                activeChunks: this.vehicleCombat?.chunkManager?.activeChunkCount || 0,
                driverState: this.vehicleCombat?.driver?.state || 'N/A',
                vehicleHP: this.vehicleCombat?.damage?.getHPPercent() || 1,
            };
        }

        // Update wave/score info
        if (this.enemyManager) {
            document.getElementById('wave').textContent = this.enemyManager.getWave();
            document.getElementById('wave-progress').textContent = this.enemyManager.getWaveProgress();
            document.getElementById('score').textContent = this.enemyManager.getScore();
        }
    }
}

// Start the game
const game = new Game();
window._gameInstance = game; // Expose for debugging/testing
game.init().catch(console.error);
