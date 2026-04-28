// enemies.js - Enemy spawning and AI system with TABS-style wobbler humanoids

import * as THREE from 'three';
import { createWobblerHumanoid, HUMAN_TYPES, createWobblerWalkAnimation, createWobblerIdleAnimation, createWobblerDogAnimation } from '../creatures/human-wobbler.js';
import { RagdollPhysics } from '../creatures/ragdoll-physics.js';

// ─── Enemy Projectile System ───────────────────────────────────────────────────
const ENEMY_PROJECTILE_POOL_SIZE = 30;
const ENEMY_PROJECTILE_RADIUS = 0.15;
const ENEMY_PROJECTILE_MAX_LIFETIME = 3.0; // seconds
const ENEMY_PROJECTILE_HIT_RADIUS = 0.5;

// Ranged attack config per wobbler type (null = melee only)
const RANGED_ATTACK_CONFIG = {
    civilian: null,
    police:   { cooldown: 2.0, damage: 10, speed: 18, range: 15, color: 0xff6633, spread: 0 },
    soldier:  { cooldown: 1.5, damage: 15, speed: 22, range: 20, color: 0xff4422, spread: 0 },
    sniper:   { cooldown: 3.0, damage: 30, speed: 30, range: 40, color: 0xffdd00, spread: 0 },
    riotShield: null,
    commander: { cooldown: 2.0, damage: 20, speed: 20, range: 25, color: 0x9933ff, spread: 3 },
    securityGuard: null,  // Melee baton
    militia:  { cooldown: 1.8, damage: 12, speed: 20, range: 18, color: 0xff5533, spread: 0 },
    dog: null,            // Melee bite
    truckDriver: { cooldown: 2.2, damage: 10, speed: 18, range: 15, color: 0xff6633, spread: 0 },
};

// Map enemy type keys to human wobbler types
const ENEMY_TO_HUMAN_MAP = {
    // Legacy mappings (kept for backwards compat)
    shade: 'civilian',
    crimsonWraith: 'soldier',
    azurePhantom: 'police',
    verdantSlime: 'riotShield',
    chromaticGuardian: 'commander',
    voidHarbinger: 'sniper',
    // Zone boss
    commander: 'commander',
    // Zone-specific types (1:1 mapping)
    securityGuard: 'securityGuard',
    militia: 'militia',
    dog: 'dog',
    truckDriver: 'truckDriver',
    police: 'police',
    riotShield: 'riotShield',
    sniper: 'sniper',
};

// Wave lore text - narrative for wave progression
const WAVE_LORE = {
    1: "A tear opens... echoes of the Faded Orchard bleed through.",
    2: "More hostiles converge on the facility perimeter.",
    3: "The Twilight Promenade collapses into view.",
    4: "ADF reinforcements are incoming. The perimeter tightens.",
    5: "The Chromatic Guardian defends what remains.",
    6: "Beyond the veil, forgotten galleries stir.",
    7: "Crimson Wing's fury spills across the boundary.",
    8: "The colors cry out - can you hear them?",
    9: "The last defensive line. Push through or dissolve.",
    10: "The Commander deploys with full military hardware."
};

// Enemy behavior patterns
const ENEMY_BEHAVIORS = {
    shade: {
        pattern: 'stalker',
        preferRear: true,        // Tries to attack from behind
        retreatThreshold: 0.3,   // Retreats when health below 30%
        circleDistance: 3,       // Circles at this distance
        attackRushSpeed: 1.5     // Speed multiplier when attacking
    },
    verdantSlime: {
        pattern: 'guardian',
        triggerOnExtraction: true,  // Aggros when player extracts color
        territoryRadius: 5,         // Stays within territory
        bodyBlock: true,            // Tries to block player movement
        slowOnHit: 0.3              // Slows player on hit
    },
    crimsonWraith: {
        pattern: 'berserker',
        dashOnLowHealth: true,      // Dashes at player when low health
        lowHealthThreshold: 0.4,    // When to trigger berserker mode
        berserkerSpeedMult: 2.0,    // Speed multiplier in berserker
        berserkerDamageMult: 1.5    // Damage multiplier in berserker
    },
    azurePhantom: {
        pattern: 'skirmisher',
        retreatAfterAttack: true,   // Backs off after attacking
        retreatDistance: 5,         // How far to retreat
        teleportChance: 0.1,        // Chance to teleport on hit
        phaseThrough: true          // Can move through obstacles briefly
    },
    chromaticGuardian: {
        pattern: 'boss',
        phaseShift: true,           // Changes behavior at health thresholds
        phases: [
            { threshold: 1.0, behavior: 'defensive', speed: 0.8 },
            { threshold: 0.66, behavior: 'balanced', speed: 1.0 },
            { threshold: 0.33, behavior: 'aggressive', speed: 1.3 }
        ],
        summonMobs: true,           // Can summon smaller enemies
        aoeAttack: true             // Has area attack
    },
    voidHarbinger: {
        pattern: 'boss',
        corruptionAura: true,       // Increases corruption nearby
        corruptionRadius: 8,
        corruptionRate: 0.01,       // Per second
        phaseShift: true,
        phases: [
            { threshold: 1.0, behavior: 'patient', speed: 0.7 },
            { threshold: 0.5, behavior: 'hunting', speed: 1.2 },
            { threshold: 0.25, behavior: 'desperate', speed: 1.5 }
        ],
        voidZones: true             // Creates damaging zones
    },
    // Zone boss behavior
    commander: {
        pattern: 'boss',
        phaseShift: true,
        phases: [
            { threshold: 1.0, behavior: 'defensive', speed: 0.8 },
            { threshold: 0.66, behavior: 'balanced', speed: 1.0 },
            { threshold: 0.33, behavior: 'aggressive', speed: 1.3 }
        ],
        summonMobs: true,
        aoeAttack: true,
    },
    // Zone-specific enemy behaviors
    securityGuard: {
        pattern: 'roaming',
        detectionRadius: 12,
        leashDistance: 25,
        waypointCount: 3,
        waypointRadius: 8,
    },
    militia: {
        pattern: 'roaming',
        detectionRadius: 18,
        leashDistance: 30,
        waypointCount: 2,
        waypointRadius: 10,
    },
    dog: {
        pattern: 'roaming',
        detectionRadius: 15,
        leashDistance: 35,           // Dogs chase further
        waypointCount: 3,
        waypointRadius: 12,
    },
    truckDriver: {
        pattern: 'roaming',
        detectionRadius: 18,
        leashDistance: 30,
        waypointCount: 2,
        waypointRadius: 10,
    },
    police: {
        pattern: 'roaming',
        detectionRadius: 15,
        leashDistance: 28,
        waypointCount: 3,
        waypointRadius: 10,
    },
    riotShield: {
        pattern: 'roaming',
        detectionRadius: 12,
        leashDistance: 20,
        waypointCount: 2,
        waypointRadius: 6,
    },
    sniper: {
        pattern: 'roaming',
        detectionRadius: 40,
        leashDistance: 35,
        waypointCount: 2,
        waypointRadius: 10,
    },
};

// Enemy type definitions with colorDrops arrays for the new wand system
// Each enemy drops colors based on their type - bosses drop multiple colors
const ENEMY_TYPES = {
    shade: {
        name: 'Color Shade',
        health: 30,
        damage: 5,
        speed: 2,
        color: 0x333344,
        size: 0.8,
        xpValue: 10,
        colorDrop: 'ivory',  // Legacy single drop
        colorDrops: [{ color: 'ivory', amount: 15 }]
    },
    crimsonWraith: {
        name: 'Crimson Wraith',
        health: 50,
        damage: 10,
        speed: 3,
        color: 0x882222,
        size: 1.0,
        xpValue: 25,
        colorDrop: 'crimson',  // Legacy single drop
        colorDrops: [{ color: 'crimson', amount: 25 }]
    },
    azurePhantom: {
        name: 'Azure Phantom',
        health: 40,
        damage: 8,
        speed: 4,
        color: 0x224488,
        size: 0.9,
        xpValue: 20,
        colorDrop: 'azure',  // Legacy single drop
        colorDrops: [{ color: 'azure', amount: 25 }]
    },
    verdantSlime: {
        name: 'Verdant Slime',
        health: 60,
        damage: 6,
        speed: 1.5,
        color: 0x228844,
        size: 1.2,
        xpValue: 15,
        colorDrop: 'verdant',  // Legacy single drop
        colorDrops: [{ color: 'verdant', amount: 25 }]
    },
    // Boss enemies - drop all/multiple colors
    chromaticGuardian: {
        name: 'Chromatic Guardian',
        health: 300,
        damage: 20,
        speed: 2,
        color: 0xdd8844,
        size: 2.0,
        xpValue: 150,
        colorDrop: 'golden',  // Legacy single drop
        colorDrops: [
            { color: 'crimson', amount: 30 },
            { color: 'azure', amount: 30 },
            { color: 'verdant', amount: 30 },
            { color: 'golden', amount: 20 },
            { color: 'violet', amount: 15 }
        ],
        isBoss: true
    },
    voidHarbinger: {
        name: 'Void Harbinger',
        health: 500,
        damage: 30,
        speed: 2.5,
        color: 0x6633aa,
        size: 2.5,
        xpValue: 300,
        colorDrop: 'violet',  // Legacy single drop
        colorDrops: [
            { color: 'violet', amount: 40 },
            { color: 'golden', amount: 30 },
            { color: 'ivory', amount: 50 }
        ],
        isBoss: true
    },
    // Zone-specific enemy types
    securityGuard: {
        name: 'Security Guard',
        health: 50,
        damage: 8,
        speed: 2.5,
        color: 0x2C3E50,
        size: 1.0,
        xpValue: 12,
        goldDrop: 3,
        zone: 0,
    },
    militia: {
        name: 'Militia',
        health: 80,
        damage: 15,
        speed: 2.8,
        color: 0x4B5320,
        size: 1.0,
        xpValue: 20,
        goldDrop: 5,
        zone: 1,
    },
    dog: {
        name: 'Guard Dog',
        health: 30,
        damage: 12,
        speed: 5.0,
        color: 0x8B6914,
        size: 0.55,
        xpValue: 10,
        goldDrop: 2,
        zone: 1,
    },
    truckDriver: {
        name: 'Truck Driver',
        health: 90,
        damage: 12,
        speed: 2.5,
        color: 0x696969,
        size: 1.1,
        xpValue: 18,
        goldDrop: 6,
        zone: 1,
    },
    police: {
        name: 'Police Officer',
        health: 100,
        damage: 14,
        speed: 3.0,
        color: 0x1A3A5C,
        size: 1.0,
        xpValue: 25,
        goldDrop: 7,
        zone: 2,
    },
    riotShield: {
        name: 'Riot Shield',
        health: 160,
        damage: 10,
        speed: 2.0,
        color: 0x2F4F4F,
        size: 1.15,
        xpValue: 30,
        goldDrop: 8,
        zone: 2,
    },
    sniper: {
        name: 'Sniper',
        health: 60,
        damage: 30,
        speed: 2.2,
        color: 0x556B2F,
        size: 0.95,
        xpValue: 35,
        goldDrop: 10,
        zone: 2,
    },
    // Zone boss — spawns after 80% of zone enemies killed
    commander: {
        name: 'Commander',
        health: 500,
        damage: 30,
        speed: 2.5,
        color: 0x8B0000,
        size: 1.25,
        xpValue: 100,
        goldDrop: 25,
        isBoss: true,
        colorDrops: [
            { color: 'golden', amount: 20 },
            { color: 'ivory', amount: 30 },
        ],
    },
};

// Zone enemy roster — which wobbler types spawn per zone
const ZONE_ENEMY_ROSTER = {
    0: {  // Zone 1: Facility Ruins
        normal: ['securityGuard'],
        weights: [1.0],
        count: [6, 10],       // min-max enemies
        boss: 'commander',
    },
    1: {  // Zone 2: Desert Scrapyard
        normal: ['militia', 'dog', 'truckDriver'],
        weights: [0.5, 0.3, 0.2],
        count: [8, 14],
        boss: 'commander',
    },
    2: {  // Zone 3: Rural Town
        normal: ['police', 'riotShield', 'sniper'],
        weights: [0.5, 0.3, 0.2],
        count: [10, 16],
        boss: 'commander',
    },
};

// ─── Enemy Projectile Pool ─────────────────────────────────────────────────────
class EnemyProjectile {
    constructor(scene) {
        const geo = new THREE.SphereGeometry(ENEMY_PROJECTILE_RADIUS, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.visible = false;
        scene.add(this.mesh);

        this.active = false;
        this.velocity = new THREE.Vector3();
        this.lifetime = 0;
        this.damage = 0;
    }

    fire(position, direction, speed, damage, color) {
        this.mesh.position.copy(position);
        this.velocity.copy(direction).multiplyScalar(speed);
        this.damage = damage;
        this.lifetime = 0;
        this.active = true;
        this.mesh.visible = true;
        this.mesh.material.color.set(color);
    }

    update(dt) {
        if (!this.active) return;
        this.mesh.position.addScaledVector(this.velocity, dt);
        this.lifetime += dt;
        if (this.lifetime > ENEMY_PROJECTILE_MAX_LIFETIME) {
            this.deactivate();
        }
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
    }

    dispose() {
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

class EnemyProjectilePool {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = [];
        for (let i = 0; i < ENEMY_PROJECTILE_POOL_SIZE; i++) {
            this.projectiles.push(new EnemyProjectile(scene));
        }
    }

    fire(position, direction, speed, damage, color) {
        // Find inactive projectile, or recycle oldest
        let proj = this.projectiles.find(p => !p.active);
        if (!proj) {
            // Recycle oldest (first in array)
            proj = this.projectiles[0];
            proj.deactivate();
        }
        proj.fire(position, direction, speed, damage, color);
        return proj;
    }

    update(dt) {
        for (const p of this.projectiles) {
            p.update(dt);
        }
    }

    /**
     * Check projectile-to-player/vehicle collisions
     * @param {THREE.Vector3} playerPos - Player world position
     * @param {function} onHit - Callback(damage) when a projectile hits
     */
    checkCollisions(playerPos, onHit) {
        for (const p of this.projectiles) {
            if (!p.active) continue;
            const dist = p.mesh.position.distanceTo(playerPos);
            if (dist < ENEMY_PROJECTILE_HIT_RADIUS) {
                onHit(p.damage);
                p.deactivate();
            }
        }
    }

    dispose() {
        for (const p of this.projectiles) {
            p.dispose();
        }
        this.projectiles = [];
    }
}

export class Enemy {
    constructor(scene, type, position) {
        this.scene = scene;
        this.typeKey = type;
        this.type = ENEMY_TYPES[type] || ENEMY_TYPES.shade;
        this.behavior = ENEMY_BEHAVIORS[type] || ENEMY_BEHAVIORS.shade;
        this.health = this.type.health;
        this.maxHealth = this.type.health;
        this.isDead = false;
        this.mesh = null;
        this.healthBar = null;

        // Attack cooldown
        this.attackCooldown = 0;
        this.attackInterval = 1500; // ms between attacks

        // Ranged attack cooldown
        this.rangedCooldown = 0;

        // Grace period - enemies can't attack immediately after spawning
        this.spawnGracePeriod = 3000; // 3 seconds before can attack
        this.timeSinceSpawn = 0;

        // Animation state
        this.animTime = Math.random() * Math.PI * 2; // Random phase offset

        // Behavior state
        this.behaviorState = 'idle';
        this.retreatTimer = 0;
        this.circleAngle = Math.random() * Math.PI * 2;
        this.currentPhase = 0;
        this.isBerserker = false;
        this.lastPlayerPosition = new THREE.Vector3();
        this.territoryCenter = position.clone();

        // Roaming behavior state
        this.roamingState = 'patrol';   // 'patrol', 'alert', 'chase', 'returning'
        this.waypoints = [];
        this.currentWaypointIndex = 0;
        this.spawnPosition = position.clone();

        // Wobbler character state
        this.wobblerParts = null;
        this.wobblerType = ENEMY_TO_HUMAN_MAP[type] || type;
        this.isDog = HUMAN_TYPES[this.wobblerType]?.isDog || false;
        this.ragdoll = null;
        this.ragdollTimer = 0;
        this.ragdollFadeTimer = 0;
        this.ragdollFading = false;

        this.createMesh(position);
        this.createHealthBar();

        // Generate patrol waypoints for roaming enemies
        if (this.behavior.pattern === 'roaming') {
            this._generateWaypoints();
        }
    }

    createMesh(position) {
        // All enemies are TABS-style wobbler humanoids
        const humanType = this.wobblerType;
        const humanConfig = HUMAN_TYPES[humanType];
        const wobblerScale = this.type.size;
        const { group, parts } = createWobblerHumanoid(humanType, wobblerScale);

        this.mesh = group;
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        this.wobblerParts = parts;

        // Override stats from HUMAN_TYPES when available
        if (humanConfig) {
            this.health = humanConfig.hp;
            this.maxHealth = humanConfig.hp;
        }

        // Create ragdoll instance (inactive until death)
        this.ragdoll = new RagdollPhysics(parts, group);
    }

    /**
     * Generate patrol waypoints around spawn position for roaming enemies
     */
    _generateWaypoints() {
        const count = this.behavior.waypointCount || 3;
        const radius = this.behavior.waypointRadius || 8;

        this.waypoints = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
            this.waypoints.push(new THREE.Vector3(
                this.spawnPosition.x + Math.cos(angle) * (radius * 0.5 + Math.random() * radius * 0.5),
                0,
                this.spawnPosition.z + Math.sin(angle) * (radius * 0.5 + Math.random() * radius * 0.5)
            ));
        }
        this.currentWaypointIndex = 0;
    }

    createHealthBar() {
        const group = new THREE.Group();

        // Background
        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222,
            side: THREE.DoubleSide
        });
        const bg = new THREE.Mesh(bgGeometry, bgMaterial);
        group.add(bg);

        // Health fill
        const fillGeometry = new THREE.PlaneGeometry(1, 0.08);
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aa44,
            side: THREE.DoubleSide
        });
        const fill = new THREE.Mesh(fillGeometry, fillMaterial);
        fill.position.z = 0.01;
        group.add(fill);

        // Position health bar above wobbler
        group.position.y = this.type.size * 1.8 + 0.3;
        this.mesh.add(group);

        this.healthBar = group;
        this.healthFill = fill;
    }

    update(delta, playerPosition, camera, currentWave = 1) {
        // Handle ragdoll update when dead
        if (this.isDead && this.ragdoll && this.ragdoll.isActive()) {
            this.ragdoll.update(delta);
            this.ragdollTimer += delta;

            // Start fading after 3 seconds
            if (this.ragdollTimer > 3.0 && !this.ragdollFading) {
                this.ragdollFading = true;
                this.ragdollFadeTimer = 0;
            }

            // Fade out over 2 seconds then cleanup
            if (this.ragdollFading) {
                this.ragdollFadeTimer += delta;
                const fadeProgress = Math.min(this.ragdollFadeTimer / 2.0, 1.0);
                const opacity = 1.0 - fadeProgress;

                // Fade all wobbler part materials
                if (this.wobblerParts) {
                    for (const partName of Object.keys(this.wobblerParts)) {
                        const part = this.wobblerParts[partName];
                        if (part && part.material) {
                            part.material.transparent = true;
                            part.material.opacity = opacity;
                        }
                    }
                }

                if (fadeProgress >= 1.0) {
                    this.cleanup();
                }
            }
            return;
        }

        if (this.isDead) return;

        // Track time since spawn for grace period
        this.timeSinceSpawn += delta * 1000;

        // Update animation time
        this.animTime += delta;

        // Store current wave for damage scaling
        this.currentWave = currentWave;

        // Decrement ranged cooldown
        if (this.rangedCooldown > 0) {
            this.rangedCooldown -= delta;
        }

        // Store player position for behavior calculations
        this.lastPlayerPosition.copy(playerPosition);

        // Calculate direction to player
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.mesh.position)
            .setY(0)
            .normalize();

        const distance = this.mesh.position.distanceTo(playerPosition);

        // Apply behavior pattern
        const moveData = this.applyBehavior(delta, direction, distance, playerPosition);

        // Store for EnemyManager to read (enemy projectile firing)
        this._lastMoveData = moveData;

        // Face movement direction or player
        if (moveData.faceDirection && moveData.faceDirection.lengthSq() > 0) {
            const targetRotation = Math.atan2(moveData.faceDirection.x, moveData.faceDirection.z);
            this.mesh.rotation.y = THREE.MathUtils.lerp(
                this.mesh.rotation.y,
                targetRotation,
                delta * 5
            );
        } else if (direction.lengthSq() > 0) {
            const targetRotation = Math.atan2(direction.x, direction.z);
            this.mesh.rotation.y = THREE.MathUtils.lerp(
                this.mesh.rotation.y,
                targetRotation,
                delta * 5
            );
        }

        // Apply movement from behavior
        const isMoving = moveData.move && moveData.moveDirection;
        if (isMoving) {
            const speed = this.type.speed * moveData.speedMult;
            this.mesh.position.addScaledVector(moveData.moveDirection, speed * delta);
        }

        // Attack player when in range
        // Grace period: enemies can't attack for first 3 seconds after spawning
        const canAttackAfterGrace = this.timeSinceSpawn >= this.spawnGracePeriod;
        this.attackCooldown -= delta * 1000;
        const attackRange = moveData.attackRange || 2.5;
        if (distance <= attackRange && this.attackCooldown <= 0 && moveData.canAttack !== false && canAttackAfterGrace) {
            this.attackPlayer(moveData.damageMult || 1);
            this.attackCooldown = this.attackInterval;

            // Retreat after attack for skirmishers
            if (this.behavior.retreatAfterAttack) {
                this.behaviorState = 'retreating';
                this.retreatTimer = 1.5;
            }
        }

        // Wobbler character animation
        if (this.wobblerParts) {
            if (this.isDog) {
                // Dog uses specialized trot animation
                if (isMoving) {
                    createWobblerDogAnimation(this.wobblerParts, this.animTime, this.type.speed);
                } else {
                    createWobblerIdleAnimation(this.wobblerParts, this.animTime);
                }
            } else if (isMoving) {
                const actualSpeed = this.type.speed * moveData.speedMult;
                createWobblerWalkAnimation(this.wobblerParts, this.animTime, actualSpeed);
            } else {
                createWobblerIdleAnimation(this.wobblerParts, this.animTime);
            }
        }

        // Health bar faces camera
        if (this.healthBar) {
            this.healthBar.lookAt(camera.position);
        }
        this.updateHealthBar();
    }

    applyBehavior(delta, directionToPlayer, distance, playerPosition) {
        const result = {
            move: true,
            moveDirection: directionToPlayer.clone(),
            speedMult: 1.0,
            faceDirection: null,
            canAttack: true,
            damageMult: 1.0,
            attackRange: 2.5
        };

        const healthPercent = this.health / this.maxHealth;

        // Update retreat timer
        if (this.retreatTimer > 0) {
            this.retreatTimer -= delta;
        }

        // Use wobbler behavior based on HUMAN_TYPES behavior field
        const humanConfig = HUMAN_TYPES[this.wobblerType];
        if (humanConfig) {
            this._applyWobblerBehavior(humanConfig.behavior, delta, directionToPlayer, distance, healthPercent, result);
        } else {
            // Fallback pattern-specific behavior
            switch (this.behavior.pattern) {
                case 'stalker':
                    result.move = this.applyBehaviorStalker(delta, directionToPlayer, distance, result);
                    break;

                case 'guardian':
                    result.move = this.applyBehaviorGuardian(delta, directionToPlayer, distance, result);
                    break;

                case 'berserker':
                    this.applyBehaviorBerserker(delta, directionToPlayer, distance, healthPercent, result);
                    break;

                case 'skirmisher':
                    this.applyBehaviorSkirmisher(delta, directionToPlayer, distance, result);
                    break;

                case 'boss':
                    this.applyBehaviorBoss(delta, directionToPlayer, distance, healthPercent, result);
                    break;

                case 'roaming':
                    this._applyRoamingBehavior(delta, directionToPlayer, distance, result);
                    break;

                default:
                    // Default: simple chase
                    if (distance <= 2) {
                        result.move = false;
                    }
            }
        }

        return result;
    }

    /**
     * Wobbler-specific AI behaviors matching HUMAN_TYPES behavior field
     */
    _applyWobblerBehavior(behavior, delta, directionToPlayer, distance, healthPercent, result) {
        switch (behavior) {
            case 'flee':
                // Civilians run away from player
                if (distance < 15) {
                    result.moveDirection = directionToPlayer.clone().negate();
                    result.speedMult = 1.3;
                    result.move = true;
                    result.canAttack = false;
                    result.faceDirection = result.moveDirection;
                } else {
                    result.move = false;
                }
                break;

            case 'pursue':
                // Police move toward player, stop at attack range
                if (distance > 8) {
                    result.move = true;
                    result.speedMult = 1.0;
                } else if (distance > 2.5) {
                    result.move = true;
                    result.speedMult = 0.5;
                } else {
                    result.move = false;
                }
                break;

            case 'tactical':
                // Soldiers zigzag toward player
                if (distance > 3) {
                    // Zigzag by adding perpendicular oscillation
                    const perpX = -directionToPlayer.z;
                    const perpZ = directionToPlayer.x;
                    const zigzag = Math.sin(this.animTime * 3) * 0.6;
                    result.moveDirection.set(
                        directionToPlayer.x + perpX * zigzag,
                        0,
                        directionToPlayer.z + perpZ * zigzag
                    ).normalize();
                    result.speedMult = 1.0;
                    result.move = true;
                } else {
                    result.move = false;
                }
                break;

            case 'block':
                // Riot shield: slow approach, shield faces player
                if (distance > 2) {
                    result.move = true;
                    result.speedMult = 0.4;
                    result.faceDirection = directionToPlayer;
                } else {
                    result.move = false;
                }
                break;

            case 'ranged':
                // Snipers maintain 20+ distance, reposition if player gets close
                if (distance < 15) {
                    result.moveDirection = directionToPlayer.clone().negate();
                    result.speedMult = 1.2;
                    result.move = true;
                    result.canAttack = false;
                } else if (distance < 20) {
                    result.move = false;
                    result.attackRange = 25;
                } else {
                    result.move = false;
                    result.attackRange = 30;
                }
                result.faceDirection = directionToPlayer;
                break;

            case 'boss':
                // Commander: use boss behavior with phase transitions
                this._applyCommanderBoss(delta, directionToPlayer, distance, healthPercent, result);
                break;

            default:
                // Simple chase or roaming
                if (this.behavior.pattern === 'roaming') {
                    this._applyRoamingBehavior(delta, directionToPlayer, distance, result);
                } else {
                    result.move = distance > 2;
                }
        }

        // ── Ranged attack ──
        // After movement decision, check if this enemy should fire a projectile
        const humanType = ENEMY_TO_HUMAN_MAP[this.typeKey] || 'civilian';
        const rangedConfig = RANGED_ATTACK_CONFIG[humanType];
        if (rangedConfig && this.rangedCooldown <= 0 && distance <= rangedConfig.range) {
            const canAttackAfterGrace = this.timeSinceSpawn >= this.spawnGracePeriod;
            if (canAttackAfterGrace) {
                // Signal to EnemyManager to fire projectile
                result.fireRanged = true;
                result.rangedConfig = rangedConfig;
                result.rangedDirection = directionToPlayer.clone();
                this.rangedCooldown = rangedConfig.cooldown;
            }
        }
    }

    /**
     * Commander boss behavior with phase shift logic
     */
    _applyCommanderBoss(delta, directionToPlayer, distance, healthPercent, result) {
        const phases = this.behavior.phases || [];

        // Determine phase from HP thresholds
        let newPhase = 0;
        for (let i = 0; i < phases.length; i++) {
            if (healthPercent <= phases[i].threshold) {
                newPhase = i;
            }
        }

        // Phase transition
        if (newPhase !== this.currentPhase) {
            this.currentPhase = newPhase;
            this._onCommanderPhaseChange(newPhase);
        }

        const phase = this.currentPhase;

        if (phase === 0) {
            // Phase 1 (100-66%): Ranged, moderate speed, stay at distance
            result.speedMult = 0.8;
            if (distance < 10) {
                // Back away to maintain range
                result.moveDirection = directionToPlayer.clone().negate();
                result.move = true;
                result.speedMult = 0.6;
            } else if (distance > 20) {
                result.move = true;
            } else {
                result.move = false;
            }
            result.faceDirection = directionToPlayer;
        } else if (phase === 1) {
            // Phase 2 (66-33%): Charge + melee, faster speed
            result.speedMult = 1.3;
            result.move = distance > 2.5;
            result.attackRange = 3.0;
            result.damageMult = 1.3;
        } else {
            // Phase 3 (33-0%): Rapid fire, erratic movement, spawn reinforcements
            result.speedMult = 1.0;

            // Erratic zigzag
            const perpX = -directionToPlayer.z;
            const perpZ = directionToPlayer.x;
            const zigzag = Math.sin(this.animTime * 5) * 0.8;
            result.moveDirection.set(
                directionToPlayer.x + perpX * zigzag,
                0,
                directionToPlayer.z + perpZ * zigzag
            ).normalize();
            result.move = distance > 5;
            result.faceDirection = directionToPlayer;

            // Halve ranged cooldown in phase 3 for rapid fire
            if (this.rangedCooldown > 0) {
                this.rangedCooldown -= delta * 0.5; // extra cooldown reduction
            }
        }
    }

    /**
     * Visual/event feedback on commander phase transition
     */
    _onCommanderPhaseChange(phaseIndex) {
        // Dispatch phase change event
        window.dispatchEvent(new CustomEvent('boss-phase-change', {
            detail: {
                boss: this.type.name,
                phase: phaseIndex + 1,
                behavior: phaseIndex === 0 ? 'ranged' : phaseIndex === 1 ? 'charge' : 'frenzy'
            }
        }));

        // Flash effect on wobbler parts
        if (this.wobblerParts) {
            for (const partName of Object.keys(this.wobblerParts)) {
                const part = this.wobblerParts[partName];
                if (part && part.material) {
                    const origColor = part.material.color.clone();
                    part.material.color.set(0xffffff);
                    setTimeout(() => {
                        if (part.material) part.material.color.copy(origColor);
                    }, 200);
                }
            }
        }

        // Speed change visual: scale pulse
        if (this.mesh) {
            const origScale = this.mesh.scale.x;
            this.mesh.scale.setScalar(1.3);
            setTimeout(() => {
                if (this.mesh) this.mesh.scale.setScalar(origScale);
            }, 300);
        }

        // Phase 3: signal to spawn reinforcements
        if (phaseIndex === 2) {
            window.dispatchEvent(new CustomEvent('boss-spawn-reinforcements', {
                detail: {
                    position: this.mesh ? this.mesh.position.clone() : new THREE.Vector3(),
                    count: 3
                }
            }));
        }
    }

    /**
     * Roaming behavior: patrol waypoints, alert on player detection, chase with leash
     */
    _applyRoamingBehavior(delta, directionToPlayer, distance, result) {
        const detectionRadius = this.behavior.detectionRadius || 15;
        const leashDistance = this.behavior.leashDistance || 30;
        const distFromSpawn = this.mesh.position.distanceTo(this.spawnPosition);

        switch (this.roamingState) {
            case 'patrol': {
                // Walk between waypoints
                if (this.waypoints.length === 0) {
                    result.move = false;
                    break;
                }

                const target = this.waypoints[this.currentWaypointIndex];
                const toTarget = new THREE.Vector3().subVectors(target, this.mesh.position).setY(0);
                const distToWP = toTarget.length();

                if (distToWP < 1.0) {
                    // Reached waypoint, go to next
                    this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
                    result.move = false;
                } else {
                    result.moveDirection = toTarget.normalize();
                    result.speedMult = 0.4; // Slow patrol speed
                    result.move = true;
                    result.faceDirection = result.moveDirection;
                }
                result.canAttack = false; // Don't attack while patrolling

                // Check for player detection
                if (distance <= detectionRadius) {
                    this.roamingState = 'alert';
                }
                break;
            }

            case 'alert': {
                // Brief pause before chasing (0.5s reaction time)
                if (!this._alertTimer) {
                    this._alertTimer = 0.5;
                }
                this._alertTimer -= delta;
                result.move = false;
                result.faceDirection = directionToPlayer;
                result.canAttack = false;

                if (this._alertTimer <= 0) {
                    this._alertTimer = null;
                    this.roamingState = 'chase';
                }

                // If player leaves detection range, go back to patrol
                if (distance > detectionRadius * 1.3) {
                    this._alertTimer = null;
                    this.roamingState = 'patrol';
                }
                break;
            }

            case 'chase': {
                // Pursue player
                result.move = distance > 2.0;
                result.speedMult = 1.2;
                result.moveDirection = directionToPlayer.clone();
                result.canAttack = true;

                // Leash check: if too far from spawn, give up
                if (distFromSpawn > leashDistance) {
                    this.roamingState = 'returning';
                }

                // If player far enough away, lose interest
                if (distance > leashDistance * 1.2) {
                    this.roamingState = 'returning';
                }
                break;
            }

            case 'returning': {
                // Walk back toward spawn position
                const toSpawn = new THREE.Vector3().subVectors(this.spawnPosition, this.mesh.position).setY(0);
                const distToSpawn = toSpawn.length();

                if (distToSpawn < 2.0) {
                    this.roamingState = 'patrol';
                    this.currentWaypointIndex = 0;
                    result.move = false;
                } else {
                    result.moveDirection = toSpawn.normalize();
                    result.speedMult = 0.8;
                    result.move = true;
                    result.faceDirection = result.moveDirection;
                }
                result.canAttack = false;

                // If player comes close again, re-engage
                if (distance < detectionRadius * 0.7) {
                    this.roamingState = 'chase';
                }
                break;
            }
        }
    }

    applyBehaviorStalker(delta, direction, distance, result) {
        // Stalkers circle and try to attack from behind
        if (distance > this.behavior.circleDistance + 1) {
            // Approach
            return true;
        } else if (distance > 2) {
            // Circle around player
            this.circleAngle += delta * 0.8;
            const circlePos = new THREE.Vector3(
                Math.cos(this.circleAngle) * this.behavior.circleDistance,
                0,
                Math.sin(this.circleAngle) * this.behavior.circleDistance
            ).add(this.lastPlayerPosition);

            result.moveDirection.subVectors(circlePos, this.mesh.position).setY(0).normalize();
            result.speedMult = 0.8;
            return true;
        } else {
            // Rush in for attack
            result.speedMult = this.behavior.attackRushSpeed;
            return true;
        }
    }

    applyBehaviorGuardian(delta, direction, distance, result) {
        // Guardians stay in territory and body block
        const distFromTerritory = this.mesh.position.distanceTo(this.territoryCenter);

        if (distFromTerritory > this.behavior.territoryRadius) {
            // Return to territory
            result.moveDirection.subVectors(this.territoryCenter, this.mesh.position).setY(0).normalize();
            return true;
        }

        if (distance > 3) {
            // Stay in territory, don't chase far
            if (distFromTerritory < this.behavior.territoryRadius * 0.5) {
                return true;
            }
            return false;
        }

        return distance > 2;
    }

    applyBehaviorBerserker(delta, direction, distance, healthPercent, result) {
        // Berserkers go into rage mode at low health
        if (healthPercent <= this.behavior.lowHealthThreshold && !this.isBerserker) {
            this.isBerserker = true;
        }

        if (this.isBerserker) {
            result.speedMult = this.behavior.berserkerSpeedMult;
            result.damageMult = this.behavior.berserkerDamageMult;
        }

        result.move = distance > 1.5;
    }

    applyBehaviorSkirmisher(delta, direction, distance, result) {
        // Skirmishers hit and run
        if (this.behaviorState === 'retreating' && this.retreatTimer > 0) {
            // Move away from player
            result.moveDirection.negate();
            result.speedMult = 1.3;
            result.canAttack = false;
            result.move = true;
        } else if (distance > this.behavior.retreatDistance) {
            // Approach
            this.behaviorState = 'approaching';
            result.move = true;
        } else if (distance > 2.5) {
            // In range, approach for attack
            this.behaviorState = 'attacking';
            result.speedMult = 1.2;
            result.move = true;
        } else {
            result.move = false;
        }
    }

    applyBehaviorBoss(delta, direction, distance, healthPercent, result) {
        // Bosses have multiple phases
        const phases = this.behavior.phases || [];
        let currentPhaseData = phases[0];

        for (let i = 0; i < phases.length; i++) {
            if (healthPercent <= phases[i].threshold) {
                currentPhaseData = phases[i];
                if (i !== this.currentPhase) {
                    this.currentPhase = i;
                    this.onPhaseChange(i, currentPhaseData);
                }
            }
        }

        if (currentPhaseData) {
            result.speedMult = currentPhaseData.speed;

            switch (currentPhaseData.behavior) {
                case 'defensive':
                    // Stay at range, occasional attacks
                    result.attackRange = 3.5;
                    result.move = distance > 4;
                    break;
                case 'balanced':
                    // Normal behavior
                    result.move = distance > 2.5;
                    break;
                case 'aggressive':
                case 'hunting':
                case 'desperate':
                    // Relentless pursuit
                    result.move = distance > 1.5;
                    result.damageMult = 1.3;
                    break;
                case 'patient':
                    // Slow but powerful
                    result.move = distance > 3;
                    result.damageMult = 1.5;
                    break;
            }
        } else {
            result.move = distance > 2;
        }

        // Corruption aura for Void Harbinger
        if (this.behavior.corruptionAura) {
            this.emitCorruption(delta);
        }
    }

    onPhaseChange(phaseIndex, phaseData) {
        // Visual feedback for phase change
        window.dispatchEvent(new CustomEvent('boss-phase-change', {
            detail: {
                boss: this.type.name,
                phase: phaseIndex + 1,
                behavior: phaseData.behavior
            }
        }));

        // Flash wobbler parts for phase transition
        if (this.wobblerParts) {
            for (const partName of Object.keys(this.wobblerParts)) {
                const part = this.wobblerParts[partName];
                if (part && part.material) {
                    const origColor = part.material.color.clone();
                    part.material.color.set(0xffffff);
                    setTimeout(() => {
                        if (part.material) part.material.color.copy(origColor);
                    }, 200);
                }
            }
        }
    }

    emitCorruption(delta) {
        // Emit corruption to the corruption system
        if (this.behavior.corruptionRate) {
            window.dispatchEvent(new CustomEvent('corruption-emit', {
                detail: {
                    position: this.mesh.position.clone(),
                    radius: this.behavior.corruptionRadius || 5,
                    amount: this.behavior.corruptionRate * delta
                }
            }));
        }
    }

    attackPlayer(damageMult = 1) {
        // Visual feedback - lunge animation
        const originalScale = this.mesh.scale.x;
        this.mesh.scale.setScalar(1.2);
        setTimeout(() => {
            if (this.mesh) this.mesh.scale.setScalar(originalScale);
        }, 100);

        // Calculate final damage with multiplier
        const finalDamage = Math.round(this.type.damage * damageMult);

        // Dispatch attack event
        window.dispatchEvent(new CustomEvent('enemy-attack', {
            detail: {
                damage: finalDamage,
                enemyType: this.type.name,
                isBerserker: this.isBerserker
            }
        }));
    }

    updateHealthBar() {
        if (!this.healthFill) return;
        const healthPercent = this.health / this.maxHealth;
        this.healthFill.scale.x = Math.max(0.01, healthPercent);
        this.healthFill.position.x = (healthPercent - 1) * 0.5;

        // Color based on health
        if (healthPercent > 0.5) {
            this.healthFill.material.color.setHex(0x44aa44);
        } else if (healthPercent > 0.25) {
            this.healthFill.material.color.setHex(0xaaaa44);
        } else {
            this.healthFill.material.color.setHex(0xaa4444);
        }
    }

    takeDamage(amount, knockbackDirection = null) {
        if (this.isDead) return;

        this.health -= amount;

        // Dispatch hit event for audio and floating text
        window.dispatchEvent(new CustomEvent('enemy-hit', {
            detail: {
                damage: amount,
                position: this.mesh.position.clone()
            }
        }));

        // Knockback
        if (knockbackDirection) {
            this.mesh.position.addScaledVector(knockbackDirection, 0.5);
        }

        // Flash wobbler parts white for hit feedback
        if (this.wobblerParts) {
            for (const partName of Object.keys(this.wobblerParts)) {
                const part = this.wobblerParts[partName];
                if (part && part.material && part.material.color) {
                    const origColor = part.material.color.clone();
                    part.material.emissive = part.material.emissive || new THREE.Color(0);
                    part.material.emissiveIntensity = 0.6;
                    setTimeout(() => {
                        if (part.material) {
                            part.material.emissiveIntensity = 0;
                        }
                    }, 100);
                }
            }
        }

        // Check death
        if (this.health <= 0) {
            this.die(knockbackDirection);
        }
    }

    die(impactVelocity = null) {
        this.isDead = true;

        // Dispatch death event with gold/XP
        window.dispatchEvent(new CustomEvent('enemy-died', {
            detail: {
                position: this.mesh.position.clone(),
                type: this.type,
                xpValue: this.type.xpValue,
                goldDrop: this.type.goldDrop || 0,
                colorDrop: this.type.colorDrop,
                colorDrops: this.type.colorDrops
            }
        }));

        // Hide health bar
        if (this.healthBar) {
            this.healthBar.visible = false;
        }

        // Activate ragdoll with impact velocity for satisfying flying
        if (this.ragdoll) {
            const ragdollVelocity = impactVelocity
                ? new THREE.Vector3(impactVelocity.x * 10, 5, impactVelocity.z * 10)
                : new THREE.Vector3((Math.random() - 0.5) * 5, 5, (Math.random() - 0.5) * 5);

            this.ragdoll.activate(ragdollVelocity, this.mesh.position);
            this.ragdollTimer = 0;
            this.ragdollFading = false;
        } else {
            // No ragdoll available, immediate cleanup
            setTimeout(() => this.cleanup(), 500);
        }
    }

    cleanup() {
        // Clean up wobbler character + ragdoll
        if (this.ragdoll) {
            this.ragdoll.dispose();
            this.ragdoll = null;
        }
        if (this.wobblerParts) {
            // Remove any parts that ragdoll moved to the scene
            for (const partName of Object.keys(this.wobblerParts)) {
                const part = this.wobblerParts[partName];
                if (part && part.parent) {
                    part.parent.remove(part);
                }
                if (part && part.material && part.material.dispose) {
                    part.material.dispose();
                }
            }
            this.wobblerParts = null;
        }
        // Remove the group shell (may be empty after ragdoll detach)
        if (this.mesh && this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.mesh = null;
    }

    getPosition() {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }
}

export class EnemyManager {
    constructor(scene, camera, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.testMode = options.testMode || false;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2000; // ms between spawns within wave
        this.spawnRadius = 15;
        this.playerPosition = new THREE.Vector3();

        // Spawn mode: 'wave' (legacy) or 'zone' (new roguelike)
        this.spawnMode = options.spawnMode || 'wave';
        this.currentZoneIndex = 0;

        // Wave system (wave mode)
        this.wave = 1;
        this.waveEnemiesTotal = 3; // Enemies per wave (increases)
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
        this.waveState = 'spawning'; // 'spawning', 'fighting', 'complete', 'break'
        this.waveBreakTimer = 0;
        this.waveBreakDuration = 3000; // ms between waves

        // Zone system (zone mode)
        this.zoneEnemiesSpawned = false;
        this.respawnTimers = [];   // { type, position, timer, interval }
        this.zonePopulated = false;

        // Boss tracking (zone mode)
        this.bossSpawned = false;
        this.bossKilled = false;
        this.bossEnemy = null;
        this.initialEnemyCount = 0;
        this.currentKillCount = 0;
        this.zoneBossType = 'commander';
        this.bossSpawnPosition = new THREE.Vector3(0, 0, 0);

        this.kills = 0;
        this.score = 0;
        this.abilitySystem = null; // Set via setAbilitySystem()

        // Enemy projectile pool (always enabled now — all enemies are wobblers)
        this.enemyProjectiles = new EnemyProjectilePool(scene);

        // External damage targets (set via setPlayerHealth / setVehicleDamage)
        this.playerHealth = null;
        this.vehicleDamage = null;
        this.vehicleDriverController = null;

        // Spawn bounds and preset spawn points
        this.spawnBounds = { minX: -18, maxX: 18, minZ: -18, maxZ: 18 };
        this.presetSpawnPoints = []; // Array of {position: Vector3, type: string}
        this.usePresetSpawns = false;
        this.spawnPointIndex = 0;

        this.setupEventListeners();
        if (!this.testMode && this.spawnMode === 'wave') {
            this.showWaveNotification();
        }
    }

    /**
     * Wire level reference for terrain-aware spawning and movement
     */
    setLevel(level) {
        this._level = level;
    }

    setAbilitySystem(abilitySystem) {
        this.abilitySystem = abilitySystem;
    }

    /**
     * Wire player health for enemy projectile damage (on foot)
     */
    setPlayerHealth(playerHealth) {
        this.playerHealth = playerHealth;
    }

    /**
     * Wire vehicle damage for enemy projectile damage (driving)
     */
    setVehicleDamage(vehicleDamage) {
        this.vehicleDamage = vehicleDamage;
    }

    /**
     * Wire vehicle driver controller for state checks (driving vs on foot)
     */
    setVehicleDriverController(driverController) {
        this.vehicleDriverController = driverController;
    }

    /**
     * Set spawn bounds for enemy spawning
     */
    setSpawnBounds(minX, maxX, minZ, maxZ) {
        this.spawnBounds = { minX, maxX, minZ, maxZ };
    }

    /**
     * Set preset spawn points for enemy spawning
     * @param {Array<{position: THREE.Vector3, type: string}>} spawnPoints
     */
    setSpawnPoints(spawnPoints) {
        this.presetSpawnPoints = spawnPoints;
        this.usePresetSpawns = spawnPoints.length > 0;
        this.spawnPointIndex = 0;
        console.log(`EnemyManager: ${spawnPoints.length} spawn points configured`);
    }

    /**
     * Set spawn mode: 'wave' (legacy) or 'zone' (roguelike)
     * @param {string} mode
     */
    setSpawnMode(mode) {
        this.spawnMode = mode;
        console.log(`EnemyManager: spawn mode set to '${mode}'`);
    }

    setupEventListeners() {
        // Listen for enemy deaths
        window.addEventListener('enemy-died', (e) => {
            this.kills++;
            this.score += e.detail.xpValue || 10;

            if (this.spawnMode === 'wave') {
                this.waveEnemiesKilled++;
                // Check wave completion
                if (this.waveEnemiesKilled >= this.waveEnemiesTotal && this.waveState === 'fighting') {
                    this.completeWave();
                }
            } else if (this.spawnMode === 'zone') {
                // Track zone kill count for boss spawn trigger
                this.currentKillCount++;

                // Check if the boss just died
                if (this.bossSpawned && this.bossEnemy && this.bossEnemy.isDead) {
                    this.bossKilled = true;
                    window.dispatchEvent(new CustomEvent('boss-killed', {
                        detail: {
                            type: this.zoneBossType,
                            zoneIndex: this.currentZoneIndex,
                        }
                    }));
                    console.log(`[EnemyManager] Boss killed in zone ${this.currentZoneIndex}`);
                }
            }
        });

        // Commander phase 3: spawn reinforcements
        window.addEventListener('boss-spawn-reinforcements', (e) => {
            const { position, count } = e.detail;
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i;
                const spawnPos = new THREE.Vector3(
                    position.x + Math.cos(angle) * 5,
                    0,
                    position.z + Math.sin(angle) * 5
                );
                // Use zone-appropriate reinforcement type
                const reinforcementType = this._getReinforcementType();
                const enemy = new Enemy(this.scene, reinforcementType, spawnPos);
                this.enemies.push(enemy);
                if (this.spawnMode === 'wave') {
                    this.waveEnemiesTotal++;
                }
            }
        });

        // Listen for zone changes from RunManager
        window.addEventListener('run-state-changed', (e) => {
            const { from, to, zoneIndex } = e.detail;

            if (to === 'PLAYING' && this.spawnMode === 'zone') {
                // New zone entered — populate with enemies
                this.currentZoneIndex = zoneIndex;
                this._clearAllEnemies();
                this._populateZone(zoneIndex);
            }

            if (to === 'SHOP' || to === 'DEAD' || to === 'MENU') {
                // Zone exited — clear enemies and boss state
                this._clearAllEnemies();
                this.zonePopulated = false;
                this.bossSpawned = false;
                this.bossKilled = false;
                this.bossEnemy = null;
                this.currentKillCount = 0;
            }
        });

        // Listen for run reset
        window.addEventListener('run-reset', () => {
            this._clearAllEnemies();
            this.kills = 0;
            this.score = 0;
            this.zonePopulated = false;
        });
    }

    /**
     * Get appropriate reinforcement enemy type for current zone
     */
    _getReinforcementType() {
        const roster = ZONE_ENEMY_ROSTER[this.currentZoneIndex];
        if (roster && roster.normal.length > 0) {
            return roster.normal[Math.floor(Math.random() * roster.normal.length)];
        }
        return 'securityGuard';
    }

    /**
     * Populate a zone with enemies at spawn points or random positions
     * @param {number} zoneIndex - 0-based zone index
     */
    _populateZone(zoneIndex) {
        const roster = ZONE_ENEMY_ROSTER[zoneIndex];
        if (!roster) {
            console.warn(`EnemyManager: No enemy roster for zone ${zoneIndex}`);
            return;
        }

        // Determine enemy count based on zone difficulty
        const [minCount, maxCount] = roster.count;
        const totalEnemies = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

        console.log(`EnemyManager: Populating zone ${zoneIndex} with ${totalEnemies} enemies`);

        // Reset boss tracking for this zone
        this.bossSpawned = false;
        this.bossKilled = false;
        this.bossEnemy = null;
        this.currentKillCount = 0;
        this.initialEnemyCount = totalEnemies;
        this.zoneBossType = roster.boss || 'commander';

        // Minimum distance from player — larger for Zone 0 (safe compound area)
        const MIN_SPAWN_DIST = zoneIndex === 0 ? 35 : 15;
        const playerPos = this.playerPosition || new THREE.Vector3(100, 0, 100);

        // Spawn enemies at spawn points or random positions
        for (let i = 0; i < totalEnemies; i++) {
            const type = this._pickZoneEnemy(roster);
            let position;

            if (this.usePresetSpawns && this.presetSpawnPoints.length > 0) {
                // Use preset spawn point — skip if too close to player
                const sp = this.presetSpawnPoints[i % this.presetSpawnPoints.length];
                position = sp.position.clone();
                const dx = position.x - playerPos.x;
                const dz = position.z - playerPos.z;
                if (Math.sqrt(dx * dx + dz * dz) < MIN_SPAWN_DIST) {
                    // Push spawn point away from player
                    const angle = Math.atan2(dz, dx);
                    position.x = playerPos.x + Math.cos(angle) * MIN_SPAWN_DIST;
                    position.z = playerPos.z + Math.sin(angle) * MIN_SPAWN_DIST;
                }
            } else {
                // Random position within bounds, at least MIN_SPAWN_DIST from player
                let attempts = 0;
                do {
                    position = new THREE.Vector3(
                        this.spawnBounds.minX + Math.random() * (this.spawnBounds.maxX - this.spawnBounds.minX),
                        0,
                        this.spawnBounds.minZ + Math.random() * (this.spawnBounds.maxZ - this.spawnBounds.minZ)
                    );
                    attempts++;
                } while (position.distanceTo(playerPos) < MIN_SPAWN_DIST && attempts < 10);
            }

            // Apply zone difficulty scaling
            const difficultyMult = 1.0 + zoneIndex * 0.3; // Zone 0=1.0x, Zone 1=1.3x, Zone 2=1.6x
            const enemy = new Enemy(this.scene, type, position);
            enemy.maxHealth = Math.floor(enemy.maxHealth * difficultyMult);
            enemy.health = enemy.maxHealth;
            this.enemies.push(enemy);

            // Set up respawn timer for this slot
            this.respawnTimers.push({
                type,
                position: position.clone(),
                timer: 0,
                interval: 30 + Math.random() * 30, // 30-60s respawn
                active: false,
            });
        }

        this.zonePopulated = true;
    }

    /**
     * Pick a random enemy type from zone roster using weights
     */
    _pickZoneEnemy(roster) {
        const rand = Math.random();
        let cumulative = 0;
        for (let i = 0; i < roster.normal.length; i++) {
            cumulative += roster.weights[i];
            if (rand <= cumulative) {
                return roster.normal[i];
            }
        }
        return roster.normal[roster.normal.length - 1];
    }

    /**
     * Check if boss should spawn based on kill progress in zone mode
     * Called from update() when in zone spawn mode
     */
    checkBossSpawn() {
        if (this.bossSpawned || this.spawnMode !== 'zone') return;
        if (this.initialEnemyCount === 0) return;

        if (this.currentKillCount >= this.initialEnemyCount * 0.8) {
            this.bossSpawned = true;
            const bossType = this.zoneBossType || 'commander';

            // Spawn boss at center of spawn bounds
            const cx = (this.spawnBounds.minX + this.spawnBounds.maxX) / 2;
            const cz = (this.spawnBounds.minZ + this.spawnBounds.maxZ) / 2;
            const bossPos = this.bossSpawnPosition.lengthSq() > 0
                ? this.bossSpawnPosition.clone()
                : new THREE.Vector3(cx, 0, cz);

            this._spawnBoss(bossType, bossPos);
            window.dispatchEvent(new CustomEvent('boss-spawned', {
                detail: { type: bossType, name: ENEMY_TYPES[bossType]?.name || bossType }
            }));
            console.log(`[EnemyManager] Boss '${bossType}' spawned after ${this.currentKillCount}/${this.initialEnemyCount} kills`);
        }
    }

    /**
     * Spawn a zone boss at a specific position
     * @param {string} type - Boss enemy type key
     * @param {THREE.Vector3} position - Spawn position
     */
    _spawnBoss(type, position) {
        // Fix boss Y to terrain height
        if (this._level?.getHeightAt) {
            const terrainY = this._level.getHeightAt(position.x, position.z);
            if (terrainY != null) position.y = terrainY + 0.5;
        }
        const difficultyMult = 1.0 + this.currentZoneIndex * 0.3;
        const enemy = new Enemy(this.scene, type, position);
        enemy.maxHealth = Math.floor(enemy.maxHealth * difficultyMult);
        enemy.health = enemy.maxHealth;
        this.enemies.push(enemy);
        this.bossEnemy = enemy;

        // Announce boss
        this.announceBoss(ENEMY_TYPES[type]?.name || type);
    }

    /**
     * Public: clear all enemies for zone transitions
     */
    clearEnemies() {
        this._clearAllEnemies();
    }

    /**
     * Set zone-specific enemy types and difficulty scale
     * @param {string[]} enemyTypes - Array of enemy type keys
     * @param {number} difficultyScale - Multiplier for health/damage
     */
    setZoneEnemies(enemyTypes, difficultyScale = 1.0) {
        this.zoneEnemyTypes = enemyTypes;
        this.zoneDifficultyScale = difficultyScale;
        console.log(`[EnemyManager] Zone enemies set: ${enemyTypes.join(', ')} @ ${difficultyScale}x difficulty`);
    }

    /**
     * Clear all enemies and respawn timers
     */
    _clearAllEnemies() {
        for (const enemy of this.enemies) {
            if (!enemy.isDead) {
                enemy.cleanup();
            }
        }
        this.enemies = [];
        this.respawnTimers = [];
    }

    showWaveNotification() {
        if (!this.waveNotification) {
            this.waveNotification = document.createElement('div');
            this.waveNotification.id = 'wave-notification';
            this.waveNotification.style.cssText = `
                position: fixed;
                top: 15%;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                background: rgba(26, 26, 46, 0.95);
                border: 2px solid #d4a574;
                border-radius: 8px;
                font-size: 24px;
                font-weight: bold;
                color: #d4a574;
                z-index: 160;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
                text-align: center;
                max-width: 400px;
            `;
            document.body.appendChild(this.waveNotification);
        }

        // Get lore text for this wave
        const loreText = WAVE_LORE[this.wave] || '';

        if (this.isBossWave) {
            this.waveNotification.innerHTML = `
                Wave ${this.wave}
                <br><span style="color: #ff4444; font-size: 16px;">⚠ BOSS WAVE ⚠</span>
                ${loreText ? `<br><span style="font-size: 13px; font-weight: normal; font-style: italic; color: #888; margin-top: 8px; display: block;">"${loreText}"</span>` : ''}
            `;
            this.waveNotification.style.borderColor = '#ff4444';
        } else {
            this.waveNotification.innerHTML = `
                Wave ${this.wave}
                ${loreText ? `<br><span style="font-size: 13px; font-weight: normal; font-style: italic; color: #888; margin-top: 8px; display: block;">"${loreText}"</span>` : ''}
            `;
            this.waveNotification.style.borderColor = '#d4a574';
        }
        this.waveNotification.style.opacity = '1';

        // Dispatch wave start event for corruption system
        window.dispatchEvent(new CustomEvent('wave-start', {
            detail: { wave: this.wave }
        }));

        // Longer display time to read lore
        const displayTime = loreText ? 3500 : 2000;

        setTimeout(() => {
            this.waveNotification.style.opacity = '0';
        }, displayTime);
    }

    completeWave() {
        this.waveState = 'complete';
        this.waveBreakTimer = 0;

        // Dispatch wave complete event for audio
        window.dispatchEvent(new CustomEvent('wave-complete', {
            detail: { wave: this.wave, score: this.score }
        }));

        // Show completion message
        if (this.waveNotification) {
            this.waveNotification.innerHTML = `Wave ${this.wave} Complete!<br><span style="font-size: 14px; color: #f5f0e6;">Score: ${this.score}</span>`;
            this.waveNotification.style.opacity = '1';
        }

        setTimeout(() => {
            this.waveState = 'break';
            if (this.waveNotification) {
                this.waveNotification.style.opacity = '0';
            }
        }, 2000);
    }

    startNextWave() {
        this.wave++;
        this.waveEnemiesTotal = 3 + this.wave * 2; // More enemies each wave
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
        this.waveState = 'spawning';
        this.spawnTimer = 0;

        // Boss waves at 5 and 10
        this.isBossWave = (this.wave === 5 || this.wave === 10);
        if (this.isBossWave) {
            // Spawn boss immediately + fewer normal enemies
            this.waveEnemiesTotal = this.wave === 5 ? 3 : 5;
            const bossType = this.wave === 5 ? 'chromaticGuardian' : 'voidHarbinger';
            setTimeout(() => this.spawnEnemy(bossType), 1000);
        }

        this.showWaveNotification();
    }

    setPlayerPosition(position) {
        this.playerPosition.copy(position);
    }

    update(delta) {
        if (this.spawnMode === 'wave') {
            // Wave state machine
            if (this.waveState === 'spawning') {
                this.spawnTimer += delta * 1000;

                if (this.spawnTimer >= this.spawnInterval && this.waveEnemiesSpawned < this.waveEnemiesTotal) {
                    this.spawnEnemy();
                    this.waveEnemiesSpawned++;
                    this.spawnTimer = 0;

                    // Switch to fighting when all spawned
                    if (this.waveEnemiesSpawned >= this.waveEnemiesTotal) {
                        this.waveState = 'fighting';
                    }
                }
            } else if (this.waveState === 'break') {
                this.waveBreakTimer += delta * 1000;
                if (this.waveBreakTimer >= this.waveBreakDuration) {
                    this.startNextWave();
                }
            }
        } else if (this.spawnMode === 'zone') {
            // Check if boss should spawn based on kill progress
            this.checkBossSpawn();

            // Zone respawn timers
            for (const timer of this.respawnTimers) {
                if (!timer.active) continue;

                timer.timer += delta;
                if (timer.timer >= timer.interval) {
                    // Respawn enemy at original position with correct terrain height
                    const respawnPos = timer.position.clone();
                    if (this._level?.getHeightAt) {
                        const terrainY = this._level.getHeightAt(respawnPos.x, respawnPos.z);
                        if (terrainY != null) respawnPos.y = terrainY + 0.5;
                    }
                    const enemy = new Enemy(this.scene, timer.type, respawnPos);
                    const difficultyMult = 1.0 + this.currentZoneIndex * 0.3;
                    enemy.maxHealth = Math.floor(enemy.maxHealth * difficultyMult);
                    enemy.health = enemy.maxHealth;
                    this.enemies.push(enemy);
                    timer.active = false;
                    timer.timer = 0;
                }
            }

            // Activate respawn timers for dead enemies
            const deadEnemyPositions = new Set();
            for (const enemy of this.enemies) {
                if (enemy.isDead && !enemy.mesh) {
                    deadEnemyPositions.add(enemy);
                }
            }
            // Mark corresponding respawn timers as active
            for (let i = 0; i < this.respawnTimers.length; i++) {
                if (!this.respawnTimers[i].active && this.enemies[i] && this.enemies[i].isDead && !this.enemies[i].mesh) {
                    this.respawnTimers[i].active = true;
                    this.respawnTimers[i].timer = 0;
                }
            }
        }

        // Update all enemies - pass current wave for damage scaling
        this.enemies.forEach(enemy => {
            enemy.update(delta, this.playerPosition, this.camera, this.wave);
            // Snap alive enemies to terrain height
            if (!enemy.isDead && enemy.mesh && this._level?.getHeightAt) {
                const terrainY = this._level.getHeightAt(enemy.mesh.position.x, enemy.mesh.position.z);
                if (terrainY != null) enemy.mesh.position.y = terrainY;
            }
        });

        // Fire enemy projectiles (wobbler mode)
        if (this.enemyProjectiles) {
            for (const enemy of this.enemies) {
                if (enemy.isDead) continue;
                if (!enemy._lastMoveData) continue;

                const moveData = enemy._lastMoveData;
                if (moveData.fireRanged && moveData.rangedConfig) {
                    const cfg = moveData.rangedConfig;
                    const origin = enemy.getPosition().clone();
                    origin.y += enemy.type.size * 0.8; // Fire from chest height

                    if (cfg.spread > 1) {
                        // Spread shot (commander): fire multiple projectiles
                        for (let s = 0; s < cfg.spread; s++) {
                            const spreadAngle = (s - (cfg.spread - 1) / 2) * 0.15;
                            const dir = moveData.rangedDirection.clone();
                            const cos = Math.cos(spreadAngle);
                            const sin = Math.sin(spreadAngle);
                            const rx = dir.x * cos - dir.z * sin;
                            const rz = dir.x * sin + dir.z * cos;
                            dir.set(rx, 0, rz).normalize();
                            this.enemyProjectiles.fire(origin, dir, cfg.speed, cfg.damage, cfg.color);
                        }
                    } else {
                        this.enemyProjectiles.fire(
                            origin, moveData.rangedDirection, cfg.speed, cfg.damage, cfg.color
                        );
                    }
                    moveData.fireRanged = false; // Consumed
                }
            }

            // Update projectile positions
            this.enemyProjectiles.update(delta);

            // Check projectile-to-player/vehicle collisions
            const isDriving = this.vehicleDriverController && this.vehicleDriverController.isDriving();
            this.enemyProjectiles.checkCollisions(this.playerPosition, (damage) => {
                if (isDriving && this.vehicleDamage) {
                    this.vehicleDamage.applyDamage(damage);
                } else if (this.playerHealth) {
                    this.playerHealth.takeDamage(damage);
                } else {
                    // Fallback: dispatch event for PlayerHealth to pick up
                    window.dispatchEvent(new CustomEvent('enemy-attack', {
                        detail: { damage, enemyType: 'projectile' }
                    }));
                }
            });
        }

        // Check projectile collisions (efficient direct check)
        if (this.abilitySystem) {
            const projectiles = this.abilitySystem.getProjectiles();
            for (const proj of projectiles) {
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    if (proj.hitEnemies.has(enemy)) continue; // Already hit this enemy

                    const dist = enemy.getPosition().distanceTo(proj.position);
                    if (dist <= proj.radius + 0.5) {
                        // Hit!
                        proj.hitEnemies.add(enemy);
                        enemy.takeDamage(proj.damage, proj.direction);
                        proj.markHit(); // Destroy projectile after hit
                        break;
                    }
                }
            }
        }

        // Remove dead enemies
        this.enemies = this.enemies.filter(enemy => !enemy.isDead || enemy.mesh);
    }

    spawnEnemy(forceType = null) {
        let clampedX, clampedZ, type;

        // Check if we should use preset spawn points
        if (this.usePresetSpawns && this.presetSpawnPoints.length > 0) {
            // Use next preset spawn point
            const spawnPoint = this.presetSpawnPoints[this.spawnPointIndex % this.presetSpawnPoints.length];
            this.spawnPointIndex++;

            clampedX = spawnPoint.position.x;
            clampedZ = spawnPoint.position.z;
            type = forceType || spawnPoint.type || null;
        } else {
            // Random position around player (legacy behavior)
            const angle = Math.random() * Math.PI * 2;
            const distance = this.spawnRadius * (0.7 + Math.random() * 0.3);
            const x = this.playerPosition.x + Math.cos(angle) * distance;
            const z = this.playerPosition.z + Math.sin(angle) * distance;

            // Clamp to level bounds (configurable)
            clampedX = THREE.MathUtils.clamp(x, this.spawnBounds.minX, this.spawnBounds.maxX);
            clampedZ = THREE.MathUtils.clamp(z, this.spawnBounds.minZ, this.spawnBounds.maxZ);
        }

        // Enemy type selection
        if (forceType) {
            type = forceType;
        } else if (!type) {
            // Random enemy type (exclude bosses)
            const normalTypes = Object.keys(ENEMY_TYPES).filter(t => !ENEMY_TYPES[t].isBoss);
            type = normalTypes[Math.floor(Math.random() * normalTypes.length)];
        }

        const spawnY = this._level?.getHeightAt?.(clampedX, clampedZ) ?? 0;
        const position = new THREE.Vector3(clampedX, spawnY + 0.5, clampedZ);
        const enemy = new Enemy(this.scene, type, position);
        this.enemies.push(enemy);

        // Boss announcement
        if (ENEMY_TYPES[type].isBoss) {
            this.announceBoss(ENEMY_TYPES[type].name);
        }

        console.log(`Spawned ${enemy.type.name} at ${clampedX.toFixed(1)}, ${clampedZ.toFixed(1)}`);
    }

    /**
     * Spawn a specific enemy at a specific position (for room-based activation)
     * Bypasses the wave system - room enemies are independent
     * @param {{x, y, z}} position - World position
     * @param {string} type - Enemy type ID
     * @param {object} options - Optional scaling { healthMult, damageMult }
     */
    spawnEnemyAt(position, type, options = {}) {
        const pos = new THREE.Vector3(position.x, position.y || 0, position.z);
        const enemy = new Enemy(this.scene, type, pos);

        // Apply difficulty scaling
        if (options.healthMult && enemy.maxHealth) {
            enemy.maxHealth = Math.floor(enemy.maxHealth * options.healthMult);
            enemy.health = enemy.maxHealth;
        }
        if (options.damageMult && enemy.damage) {
            enemy.damage = Math.floor(enemy.damage * options.damageMult);
        }

        this.enemies.push(enemy);
        return enemy;
    }

    announceBoss(bossName) {
        window.dispatchEvent(new CustomEvent('boss-spawned', {
            detail: { name: bossName }
        }));
    }

    checkAbilityHits(position, damage, radius, knockbackDir) {
        this.enemies.forEach(enemy => {
            if (enemy.isDead) return;

            const dist = enemy.getPosition().distanceTo(position);
            if (dist <= radius) {
                // Calculate knockback direction from hit position
                const knockback = knockbackDir || new THREE.Vector3()
                    .subVectors(enemy.getPosition(), position)
                    .setY(0)
                    .normalize();

                enemy.takeDamage(damage, knockback);
            }
        });
    }

    /**
     * Check vehicle collision with enemies (wobbler mode)
     * @param {THREE.Vector3} vehiclePosition - Current vehicle world position
     * @param {THREE.Vector3} vehicleVelocity - Current vehicle velocity
     * @param {number} vehicleRadius - Collision radius of the vehicle
     * @returns {Array<Enemy>} Array of enemies that were hit
     */
    checkVehicleImpact(vehiclePosition, vehicleVelocity, vehicleRadius) {
        const hitEnemies = [];
        const speed = vehicleVelocity.length();
        if (speed < 1) return hitEnemies; // ignore very slow contact

        for (const enemy of this.enemies) {
            if (enemy.isDead) continue;

            const enemyPos = enemy.getPosition();
            const dist = enemyPos.distanceTo(vehiclePosition);
            const hitRadius = vehicleRadius + (enemy.type.size * 0.5);

            if (dist <= hitRadius) {
                // Damage scales with vehicle speed
                const damage = Math.round(speed * 10);

                // Use vehicle velocity direction so ragdoll flies the way
                // the vehicle is traveling (satisfying physics feel)
                const impactDir = vehicleVelocity.clone().normalize();
                enemy.takeDamage(damage, impactDir);

                hitEnemies.push(enemy);
            }
        }

        return hitEnemies;
    }

    getEnemyCount() {
        return this.enemies.filter(e => !e.isDead).length;
    }

    getKills() {
        return this.kills;
    }

    getWave() {
        return this.wave;
    }

    getScore() {
        return this.score;
    }

    getWaveProgress() {
        return `${this.waveEnemiesKilled}/${this.waveEnemiesTotal}`;
    }

    /**
     * Get all alive enemies (used by turret targeting)
     * @returns {Array<Enemy>}
     */
    getEnemies() {
        return this.enemies.filter(e => !e.isDead);
    }

    // Get nearest enemy to a position
    getNearestEnemy(position, maxDistance = Infinity) {
        let nearest = null;
        let nearestDist = maxDistance;

        this.enemies.forEach(enemy => {
            if (enemy.isDead) return;
            const dist = enemy.getPosition().distanceTo(position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        });

        return nearest;
    }
}
