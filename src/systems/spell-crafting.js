// spell-crafting.js - Noita-style spell crafting system
// Defines spell types, modifiers, and color combinations

import * as THREE from 'three';

// Base spell types (projectiles)
export const SPELL_TYPES = {
    // Crimson - Raw power
    bolt: {
        id: 'bolt',
        name: 'Crimson Bolt',
        type: 'projectile',
        colors: ['crimson'],
        cost: 15,
        damage: 20,
        speed: 25,
        lifetime: 2000,
        description: 'Fast bolt of destructive energy',
        icon: 'bolt'
    },

    // Azure - Piercing
    orb: {
        id: 'orb',
        name: 'Azure Orb',
        type: 'projectile',
        colors: ['azure'],
        cost: 20,
        damage: 15,
        speed: 12,
        lifetime: 3000,
        piercing: true,
        description: 'Slow orb that pierces enemies',
        icon: 'orb'
    },

    // Verdant - High damage
    lance: {
        id: 'lance',
        name: 'Verdant Lance',
        type: 'projectile',
        colors: ['verdant'],
        cost: 25,
        damage: 30,
        speed: 35,
        lifetime: 1500,
        description: 'Fast lance with high damage',
        icon: 'lance'
    },

    // Golden - Instant hit
    beam: {
        id: 'beam',
        name: 'Golden Beam',
        type: 'projectile',
        colors: ['golden'],
        cost: 30,
        damage: 25,
        speed: 100,
        lifetime: 500,
        hitscan: true,
        description: 'Instant beam of radiant light',
        icon: 'beam'
    },

    // Violet - Area effect
    rift: {
        id: 'rift',
        name: 'Violet Rift',
        type: 'projectile',
        colors: ['violet'],
        cost: 40,
        damage: 35,
        speed: 8,
        lifetime: 4000,
        aoe: true,
        aoeRadius: 3,
        description: 'Slow rift that explodes on impact',
        icon: 'rift'
    }
};

// Modifier spells (apply to next projectile)
export const MODIFIER_TYPES = {
    // Golden - Multishot
    split: {
        id: 'split',
        name: 'Split',
        type: 'modifier',
        colors: ['golden'],
        cost: 10,
        effect: 'multishot',
        count: 3,
        spreadAngle: 15,
        description: 'Split into 3 projectiles',
        icon: 'split'
    },

    // Violet - Tracking
    homing: {
        id: 'homing',
        name: 'Homing',
        type: 'modifier',
        colors: ['violet'],
        cost: 15,
        effect: 'tracking',
        trackingStrength: 5,
        description: 'Projectile seeks enemies',
        icon: 'homing'
    },

    // Crimson - Explosion
    explode: {
        id: 'explode',
        name: 'Explosive',
        type: 'modifier',
        colors: ['crimson'],
        cost: 20,
        effect: 'aoe_on_hit',
        radius: 3,
        splashDamage: 0.5, // 50% of base damage
        description: 'Explodes on impact',
        icon: 'explode'
    },

    // Azure - Slow
    frost: {
        id: 'frost',
        name: 'Frost',
        type: 'modifier',
        colors: ['azure'],
        cost: 12,
        effect: 'slow',
        slowAmount: 0.5, // 50% speed reduction
        duration: 2000,
        description: 'Slows enemies on hit',
        icon: 'frost'
    },

    // Verdant - Lifesteal
    lifesteal: {
        id: 'lifesteal',
        name: 'Lifesteal',
        type: 'modifier',
        colors: ['verdant'],
        cost: 18,
        effect: 'heal_on_hit',
        healAmount: 5,
        description: 'Heal on successful hit',
        icon: 'lifesteal'
    },

    // Ivory - Damage boost
    empower: {
        id: 'empower',
        name: 'Empower',
        type: 'modifier',
        colors: ['ivory'],
        cost: 15,
        effect: 'damage_boost',
        damageMultiplier: 1.5,
        description: 'Increases damage by 50%',
        icon: 'empower'
    }
};

// Color combination special effects
export const COLOR_COMBOS = {
    'crimson+azure': {
        name: 'Steam Burst',
        effect: 'blind_aoe',
        damage: 25,
        radius: 4,
        duration: 1500,
        description: 'Creates blinding steam cloud',
        visual: 'steam'
    },
    'crimson+verdant': {
        name: 'Wildfire',
        effect: 'dot_spread',
        damage: 8,
        ticks: 5,
        tickInterval: 400,
        spreadRadius: 2,
        description: 'Spreading fire damage over time',
        visual: 'fire'
    },
    'azure+verdant': {
        name: 'Healing Rain',
        effect: 'aoe_heal',
        heal: 20,
        radius: 5,
        duration: 2000,
        description: 'Creates healing zone',
        visual: 'rain'
    },
    'golden+violet': {
        name: 'Prismatic Ray',
        effect: 'rainbow_beam',
        damage: 40,
        bounces: 3,
        description: 'Bouncing beam of pure light',
        visual: 'rainbow'
    },
    'crimson+golden': {
        name: 'Inferno',
        effect: 'fire_aoe',
        damage: 35,
        radius: 4,
        burnDuration: 2000,
        description: 'Massive fire explosion',
        visual: 'inferno'
    },
    'azure+violet': {
        name: 'Void Freeze',
        effect: 'stasis',
        duration: 3000,
        radius: 3,
        description: 'Freezes enemies in time',
        visual: 'void'
    },
    'verdant+golden': {
        name: 'Solar Bloom',
        effect: 'heal_burst',
        heal: 30,
        damageToEnemies: 20,
        radius: 4,
        description: 'Heals allies, damages foes',
        visual: 'bloom'
    },
    'verdant+violet': {
        name: 'Life Drain',
        effect: 'drain',
        damage: 25,
        healPercent: 0.5,
        description: 'Drain life from enemies',
        visual: 'drain'
    },
    'crimson+violet': {
        name: 'Chaos Bolt',
        effect: 'random_damage',
        minDamage: 10,
        maxDamage: 60,
        description: 'Unpredictable damage',
        visual: 'chaos'
    },
    'azure+golden': {
        name: 'Flash Freeze',
        effect: 'instant_slow',
        slowAmount: 0.8,
        duration: 2500,
        description: 'Instantly slows all nearby',
        visual: 'flash'
    }
};

/**
 * Get all available spells (projectiles + modifiers)
 */
export function getAllSpells() {
    return {
        ...SPELL_TYPES,
        ...MODIFIER_TYPES
    };
}

/**
 * Get spell by ID
 * @param {string} id - Spell ID
 * @returns {Object|null} Spell definition
 */
export function getSpell(id) {
    return SPELL_TYPES[id] || MODIFIER_TYPES[id] || null;
}

/**
 * Check if a spell is a modifier
 * @param {string} id - Spell ID
 * @returns {boolean}
 */
export function isModifier(id) {
    return MODIFIER_TYPES.hasOwnProperty(id);
}

/**
 * Check if a spell is a projectile
 * @param {string} id - Spell ID
 * @returns {boolean}
 */
export function isProjectile(id) {
    return SPELL_TYPES.hasOwnProperty(id);
}

/**
 * Check for color combination effects
 * @param {string[]} colors - Array of color types
 * @returns {Object|null} Combo effect or null
 */
export function checkColorCombo(colors) {
    if (colors.length < 2) return null;

    // Sort colors to normalize the key
    const sortedColors = [...colors].sort();

    // Check all pairs
    for (let i = 0; i < sortedColors.length - 1; i++) {
        for (let j = i + 1; j < sortedColors.length; j++) {
            const key = `${sortedColors[i]}+${sortedColors[j]}`;
            if (COLOR_COMBOS[key]) {
                return { ...COLOR_COMBOS[key], colors: [sortedColors[i], sortedColors[j]] };
            }
        }
    }

    return null;
}

/**
 * Calculate total cost for a spell with modifiers
 * @param {Object} spell - Base spell
 * @param {Object[]} modifiers - Array of modifier spells
 * @returns {Object} Cost per color
 */
export function calculateSpellCost(spell, modifiers = []) {
    const costs = {};

    // Add base spell cost
    for (const color of spell.colors) {
        costs[color] = (costs[color] || 0) + spell.cost;
    }

    // Add modifier costs
    for (const mod of modifiers) {
        for (const color of mod.colors) {
            costs[color] = (costs[color] || 0) + mod.cost;
        }
    }

    return costs;
}

/**
 * Apply modifiers to a spell, creating final stats
 * @param {Object} baseSpell - Base projectile spell
 * @param {Object[]} modifiers - Array of modifier spells
 * @returns {Object} Modified spell stats
 */
export function applyModifiers(baseSpell, modifiers = []) {
    // Start with a copy of base spell
    const result = {
        ...baseSpell,
        modifiers: [],
        colors: [...baseSpell.colors],
        totalCost: { ...calculateSpellCost(baseSpell) }
    };

    for (const mod of modifiers) {
        // Track applied modifiers
        result.modifiers.push(mod.id);

        // Add modifier colors to combined list
        for (const color of mod.colors) {
            if (!result.colors.includes(color)) {
                result.colors.push(color);
            }
        }

        // Apply modifier effects
        switch (mod.effect) {
            case 'multishot':
                result.multishot = mod.count;
                result.spreadAngle = mod.spreadAngle;
                break;

            case 'tracking':
                result.homing = true;
                result.trackingStrength = mod.trackingStrength;
                break;

            case 'aoe_on_hit':
                result.explodeOnHit = true;
                result.explosionRadius = mod.radius;
                result.splashDamage = result.damage * mod.splashDamage;
                break;

            case 'slow':
                result.appliesSlow = true;
                result.slowAmount = mod.slowAmount;
                result.slowDuration = mod.duration;
                break;

            case 'heal_on_hit':
                result.healsOnHit = true;
                result.healAmount = mod.healAmount;
                break;

            case 'damage_boost':
                result.damage *= mod.damageMultiplier;
                break;
        }

        // Add to total cost
        for (const color of mod.colors) {
            result.totalCost[color] = (result.totalCost[color] || 0) + mod.cost;
        }
    }

    // Check for color combo bonus
    const combo = checkColorCombo(result.colors);
    if (combo) {
        result.colorCombo = combo;
    }

    return result;
}

/**
 * SpellCaster class - handles spell execution
 */
export class SpellCaster {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.activeProjectiles = [];

        // Shared geometries for performance
        this.geometries = {
            bolt: new THREE.SphereGeometry(0.2, 8, 8),
            orb: new THREE.SphereGeometry(0.35, 12, 12),
            lance: new THREE.ConeGeometry(0.15, 0.8, 6),
            beam: new THREE.CylinderGeometry(0.05, 0.05, 2, 8),
            rift: new THREE.TorusGeometry(0.3, 0.1, 8, 16)
        };
    }

    /**
     * Cast a spell with applied modifiers
     * @param {Object} spell - Modified spell from applyModifiers
     * @param {THREE.Vector3} origin - Cast origin
     * @param {THREE.Vector3} direction - Cast direction
     * @param {Function} onHit - Callback when projectile hits
     */
    cast(spell, origin, direction, onHit) {
        // Handle multishot
        const projectileCount = spell.multishot || 1;
        const spreadAngle = spell.spreadAngle || 0;

        for (let i = 0; i < projectileCount; i++) {
            // Calculate spread direction
            let shotDir = direction.clone();

            if (projectileCount > 1) {
                const angleOffset = (i - (projectileCount - 1) / 2) * (spreadAngle * Math.PI / 180);
                const rotationAxis = new THREE.Vector3(0, 1, 0);
                shotDir.applyAxisAngle(rotationAxis, angleOffset);
            }

            this.createProjectile(spell, origin.clone(), shotDir, onHit);
        }
    }

    createProjectile(spell, origin, direction, onHit) {
        // Get color for visual
        const primaryColor = spell.colors[0];
        const colorMap = {
            crimson: 0xc44444,
            azure: 0x4477aa,
            verdant: 0x44aa66,
            golden: 0xddaa44,
            violet: 0x8855aa,
            ivory: 0xeeeedd
        };
        const color = colorMap[primaryColor] || 0xffffff;

        // Create mesh
        const geometry = this.geometries[spell.icon] || this.geometries.bolt;
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9
        });

        const projectile = new THREE.Mesh(geometry, material);
        projectile.position.copy(origin);

        // Orient lance/beam along direction
        if (spell.icon === 'lance' || spell.icon === 'beam') {
            projectile.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                direction
            );
        }

        // Add glow effect
        const glowMaterial = new THREE.SpriteMaterial({
            color,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.set(1, 1, 1);
        projectile.add(glow);

        this.scene.add(projectile);

        // Create projectile data
        const projectileData = {
            mesh: projectile,
            spell,
            direction: direction.clone(),
            speed: spell.speed,
            startTime: performance.now(),
            lifetime: spell.lifetime,
            hitEnemies: new Set(),
            piercing: spell.piercing || false,
            homing: spell.homing || false,
            trackingStrength: spell.trackingStrength || 0,
            onHit,
            hasExploded: false
        };

        this.activeProjectiles.push(projectileData);
    }

    /**
     * Update all active projectiles
     * @param {number} delta - Time delta in seconds
     * @param {Array} enemies - Array of enemies for collision/homing
     */
    update(delta, enemies = []) {
        const now = performance.now();
        const toRemove = [];

        for (let i = 0; i < this.activeProjectiles.length; i++) {
            const proj = this.activeProjectiles[i];
            const elapsed = now - proj.startTime;

            // Check lifetime
            if (elapsed > proj.lifetime) {
                toRemove.push(i);
                continue;
            }

            // Homing behavior
            if (proj.homing && enemies.length > 0) {
                const nearestEnemy = this.findNearestEnemy(proj.mesh.position, enemies);
                if (nearestEnemy) {
                    const toEnemy = new THREE.Vector3()
                        .subVectors(nearestEnemy.getPosition(), proj.mesh.position)
                        .normalize();

                    proj.direction.lerp(toEnemy, proj.trackingStrength * delta);
                    proj.direction.normalize();
                }
            }

            // Move projectile
            proj.mesh.position.addScaledVector(proj.direction, proj.speed * delta);

            // Rotate rift
            if (proj.spell.icon === 'rift') {
                proj.mesh.rotation.x += delta * 3;
                proj.mesh.rotation.y += delta * 2;
            }

            // Check collisions
            for (const enemy of enemies) {
                if (enemy.isDead) continue;
                if (proj.hitEnemies.has(enemy)) continue;

                const dist = enemy.getPosition().distanceTo(proj.mesh.position);
                const hitRadius = proj.spell.aoe ? proj.spell.aoeRadius : 1.0;

                if (dist <= hitRadius) {
                    // Hit!
                    this.handleHit(proj, enemy);

                    if (!proj.piercing) {
                        toRemove.push(i);
                        break;
                    }
                }
            }
        }

        // Remove finished projectiles
        toRemove.reverse().forEach(index => {
            const proj = this.activeProjectiles[index];
            this.cleanupProjectile(proj);
            this.activeProjectiles.splice(index, 1);
        });
    }

    handleHit(proj, enemy) {
        proj.hitEnemies.add(enemy);

        // Calculate damage
        let damage = proj.spell.damage;

        // Apply color combo bonus
        if (proj.spell.colorCombo) {
            damage *= 1.25; // 25% bonus damage for combos
        }

        // Deal damage
        enemy.takeDamage(damage, proj.direction);

        // Apply modifiers
        if (proj.spell.appliesSlow) {
            // Dispatch slow event
            window.dispatchEvent(new CustomEvent('enemy-slowed', {
                detail: {
                    enemy,
                    slowAmount: proj.spell.slowAmount,
                    duration: proj.spell.slowDuration
                }
            }));
        }

        if (proj.spell.healsOnHit) {
            window.dispatchEvent(new CustomEvent('player-heal', {
                detail: { amount: proj.spell.healAmount }
            }));
        }

        if (proj.spell.explodeOnHit && !proj.hasExploded) {
            proj.hasExploded = true;
            this.createExplosion(
                proj.mesh.position,
                proj.spell.explosionRadius,
                proj.spell.splashDamage,
                proj.spell.colors[0]
            );
        }

        // Callback
        if (proj.onHit) {
            proj.onHit(enemy, proj.spell);
        }
    }

    createExplosion(position, radius, damage, colorType) {
        // Visual effect
        const colorMap = {
            crimson: 0xc44444,
            azure: 0x4477aa,
            verdant: 0x44aa66,
            golden: 0xddaa44,
            violet: 0x8855aa
        };
        const color = colorMap[colorType] || 0xffffff;

        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.6,
            wireframe: true
        });

        const explosion = new THREE.Mesh(geometry, material);
        explosion.position.copy(position);
        this.scene.add(explosion);

        // Animate and remove
        const startTime = performance.now();
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / 300;

            if (progress >= 1) {
                this.scene.remove(explosion);
                geometry.dispose();
                material.dispose();
                return;
            }

            explosion.scale.setScalar(1 + progress * 0.5);
            material.opacity = 0.6 * (1 - progress);
            requestAnimationFrame(animate);
        };
        animate();

        // Dispatch AOE damage event
        window.dispatchEvent(new CustomEvent('aoe-damage', {
            detail: {
                position: position.clone(),
                radius,
                damage
            }
        }));
    }

    findNearestEnemy(position, enemies) {
        let nearest = null;
        let nearestDist = Infinity;

        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const dist = enemy.getPosition().distanceTo(position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    cleanupProjectile(proj) {
        this.scene.remove(proj.mesh);
        proj.mesh.geometry?.dispose();
        proj.mesh.material?.dispose();
    }

    /**
     * Get active projectiles for collision detection
     */
    getProjectiles() {
        return this.activeProjectiles.map(p => ({
            position: p.mesh.position,
            damage: p.spell?.damage || p.config?.damage || 15,
            radius: p.spell?.aoe ? p.spell.aoeRadius : 1.0,
            direction: p.direction,
            hitEnemies: p.hitEnemies,
            markHit: () => { p.lifetime = 0; } // Mark for removal
        }));
    }

    /**
     * Cast a blended projectile from the new ColorWand system
     * @param {Object} config - Projectile config from ColorWand.fire()
     * @param {THREE.Vector3} origin - Cast origin
     * @param {THREE.Vector3} direction - Cast direction
     * @param {Function} onHit - Optional callback
     */
    castBlended(config, origin, direction, onHit = null) {
        this.createBlendedProjectile(config, origin.clone(), direction.clone(), onHit);
    }

    /**
     * Create a blended projectile with visual rings for each color
     * @param {Object} config - Projectile config from ColorWand
     * @param {THREE.Vector3} origin - Start position
     * @param {THREE.Vector3} direction - Direction
     * @param {Function} onHit - Hit callback
     */
    createBlendedProjectile(config, origin, direction, onHit) {
        // Create main projectile group
        const projectileGroup = new THREE.Group();
        projectileGroup.position.copy(origin);

        // Core orb with blended color
        const coreGeometry = new THREE.SphereGeometry(0.25, 12, 12);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: config.blendedColor,
            transparent: true,
            opacity: 0.9
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        projectileGroup.add(core);

        // Note: Glow sprite removed - textureless sprites render as white boxes
        // The core orb + colored rings provide sufficient visual feedback

        // Create colored rings orbiting the core (one per non-ivory color)
        const rings = [];
        const ringColors = config.colors.filter(c => c !== 'ivory');

        // Color hex map
        const colorHexMap = {
            crimson: 0xc44444,
            azure: 0x4477aa,
            verdant: 0x44aa66,
            golden: 0xddaa44,
            violet: 0x8855aa,
            ivory: 0xeeeedd
        };

        ringColors.forEach((color, index) => {
            const ringGeometry = new THREE.TorusGeometry(0.35, 0.03, 8, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: colorHexMap[color] || 0xffffff,
                transparent: true,
                opacity: 0.8
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);

            // Offset each ring at different angle
            ring.rotation.x = Math.PI / 2 + (index * Math.PI / ringColors.length);
            ring.rotation.y = (index * Math.PI * 2) / ringColors.length;

            projectileGroup.add(ring);
            rings.push({ mesh: ring, color, offset: index });
        });

        this.scene.add(projectileGroup);

        // Projectile data
        const projectileData = {
            mesh: projectileGroup,
            core,
            rings,
            config,
            direction: direction.clone(),
            speed: config.speed || 25,
            startTime: performance.now(),
            lifetime: config.lifetime || 2000,
            hitEnemies: new Set(),
            piercing: config.effects.some(e => e.type === 'pierce'),
            pierceCount: config.effects.find(e => e.type === 'pierce')?.pierceCount || 0,
            homing: config.effects.some(e => e.type === 'homing'),
            trackingStrength: config.effects.find(e => e.type === 'homing')?.trackingStrength || 3,
            onHit,
            hasExploded: false
        };

        this.activeProjectiles.push(projectileData);
    }

    /**
     * Update all active projectiles (enhanced for blended projectiles)
     * @param {number} delta - Time delta in seconds
     * @param {Array} enemies - Array of enemies for collision/homing
     */
    update(delta, enemies = []) {
        const now = performance.now();
        const toRemove = [];

        for (let i = 0; i < this.activeProjectiles.length; i++) {
            const proj = this.activeProjectiles[i];
            const elapsed = now - proj.startTime;

            // Check lifetime
            if (elapsed > proj.lifetime) {
                toRemove.push(i);
                continue;
            }

            // Homing behavior
            if (proj.homing && enemies.length > 0) {
                const nearestEnemy = this.findNearestEnemy(proj.mesh.position, enemies);
                if (nearestEnemy) {
                    const toEnemy = new THREE.Vector3()
                        .subVectors(nearestEnemy.getPosition(), proj.mesh.position)
                        .normalize();

                    proj.direction.lerp(toEnemy, proj.trackingStrength * delta);
                    proj.direction.normalize();
                }
            }

            // Move projectile
            proj.mesh.position.addScaledVector(proj.direction, proj.speed * delta);

            // Rotate rings for blended projectiles
            if (proj.rings && proj.rings.length > 0) {
                const rotSpeed = 3;
                proj.rings.forEach((ring, idx) => {
                    ring.mesh.rotation.z += rotSpeed * delta * (idx % 2 === 0 ? 1 : -1);
                    ring.mesh.rotation.x += rotSpeed * delta * 0.5;
                });
            }

            // Legacy rift rotation
            if (proj.spell?.icon === 'rift') {
                proj.mesh.rotation.x += delta * 3;
                proj.mesh.rotation.y += delta * 2;
            }

            // Check collisions
            for (const enemy of enemies) {
                if (enemy.isDead) continue;
                if (proj.hitEnemies.has(enemy)) continue;

                const dist = enemy.getPosition().distanceTo(proj.mesh.position);
                const hitRadius = proj.config?.aoeRadius || proj.spell?.aoeRadius || 1.0;

                if (dist <= hitRadius) {
                    // Hit!
                    this.handleBlendedHit(proj, enemy);

                    // Check piercing
                    if (proj.piercing && proj.pierceCount > 0) {
                        proj.pierceCount--;
                    } else if (!proj.piercing) {
                        toRemove.push(i);
                        break;
                    }
                }
            }
        }

        // Remove finished projectiles
        toRemove.reverse().forEach(index => {
            const proj = this.activeProjectiles[index];
            this.cleanupProjectile(proj);
            this.activeProjectiles.splice(index, 1);
        });
    }

    /**
     * Handle hit from blended projectile
     * @param {Object} proj - Projectile data
     * @param {Object} enemy - Enemy hit
     */
    handleBlendedHit(proj, enemy) {
        proj.hitEnemies.add(enemy);

        // Get config (supports both old spell and new config format)
        const config = proj.config || proj.spell;
        if (!config) return;

        // Calculate damage
        let damage = config.damage || 15;

        // Apply combo bonus if present
        if (config.combo) {
            damage *= config.combo.bonusDamage || 1;
        }

        // Deal damage
        enemy.takeDamage(damage, proj.direction);

        // Apply color effects
        if (config.effects) {
            for (const effect of config.effects) {
                switch (effect.type) {
                    case 'burn':
                        // Dispatch burn event
                        window.dispatchEvent(new CustomEvent('enemy-burn', {
                            detail: {
                                enemy,
                                damage: effect.burnDamage || 5,
                                duration: effect.burnDuration || 1000
                            }
                        }));
                        break;

                    case 'slow':
                        window.dispatchEvent(new CustomEvent('enemy-slowed', {
                            detail: {
                                enemy,
                                slowAmount: effect.slowAmount || 0.3,
                                duration: effect.slowDuration || 1500
                            }
                        }));
                        break;

                    case 'lifesteal':
                        const healAmount = Math.round(damage * (effect.healPercent || 0.1));
                        window.dispatchEvent(new CustomEvent('player-heal', {
                            detail: { amount: healAmount }
                        }));
                        break;
                }
            }
        }

        // Legacy spell effects support
        if (proj.spell) {
            this.handleHit(proj, enemy);
            return;
        }

        // Callback
        if (proj.onHit) {
            proj.onHit(enemy, config);
        }
    }
}
