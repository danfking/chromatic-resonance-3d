// vehicle-weapons.js - Vehicle-mounted weapon systems (turret + spell launcher)
// Mounts on vehicle sockets, integrates with EnemyManager and ColorInventory

import * as THREE from 'three';

const TURRET_FIRE_RATE = 1.0;    // shots per second
const TURRET_RANGE = 30;         // units
const TURRET_DAMAGE = 10;
const TURRET_PROJECTILE_SPEED = 25;
const TURRET_ESSENCE_COST = 5;
const TURRET_TRACK_SPEED = 3.0;  // rad/s rotation toward target

const SPELL_DAMAGE_MULT = 1.3;
const SPELL_SIZE_MULT = 1.5;

// Projectile pool
const MAX_PROJECTILES = 30;

class Projectile {
    constructor() {
        const geo = new THREE.SphereGeometry(0.08, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.visible = false;

        this.active = false;
        this.velocity = new THREE.Vector3();
        this.lifetime = 0;
        this.maxLifetime = 2.0;
        this.damage = 0;
        this.source = null; // 'turret' or 'spell'
    }

    fire(position, direction, speed, damage, color, source) {
        this.mesh.position.copy(position);
        this.velocity.copy(direction).multiplyScalar(speed);
        this.damage = damage;
        this.source = source;
        this.lifetime = 0;
        this.active = true;
        this.mesh.visible = true;
        this.mesh.material.color.set(color);
    }

    update(dt) {
        if (!this.active) return;
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
        this.lifetime += dt;
        if (this.lifetime > this.maxLifetime) {
            this.deactivate();
        }
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
    }
}

/**
 * Turret weapon - auto-aims at nearest enemy
 */
class Turret {
    constructor(scene, elementColor) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'turret';

        // Turret base (box)
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.4 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), baseMat);
        this.group.add(base);

        // Rotating platform
        this.platform = new THREE.Group();
        this.platform.position.y = 0.1;
        this.group.add(this.platform);

        // Barrel
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.25;
        this.platform.add(barrel);

        // Element orb
        this.orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 8),
            new THREE.MeshBasicMaterial({ color: elementColor })
        );
        this.orb.position.y = 0.1;
        this.platform.add(this.orb);

        // Muzzle point (where projectiles spawn)
        this.muzzle = new THREE.Object3D();
        this.muzzle.position.z = 0.45;
        this.platform.add(this.muzzle);

        this.yaw = 0;
        this.fireCooldown = 0;
        this.targetEnemy = null;
        this.elementColor = elementColor;
    }

    update(dt, enemyManager, vehiclePosition) {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt);

        // Find nearest enemy
        this.targetEnemy = null;
        let minDist = TURRET_RANGE;

        if (enemyManager) {
            const enemies = enemyManager.getEnemies ? enemyManager.getEnemies() : [];
            for (const enemy of enemies) {
                if (enemy.isDead) continue;
                const d = enemy.getPosition().distanceTo(vehiclePosition);
                if (d < minDist) {
                    minDist = d;
                    this.targetEnemy = enemy;
                }
            }
        }

        // Track target
        if (this.targetEnemy) {
            const worldPos = new THREE.Vector3();
            this.muzzle.getWorldPosition(worldPos);
            const enemyPos = this.targetEnemy.mesh ?
                this.targetEnemy.mesh.position : this.targetEnemy.position;
            if (enemyPos) {
                const dx = enemyPos.x - vehiclePosition.x;
                const dz = enemyPos.z - vehiclePosition.z;
                const targetYaw = Math.atan2(dx, dz);

                // Smooth rotation toward target
                let deltaYaw = targetYaw - this.yaw;
                while (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI;
                while (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;

                const maxRot = TURRET_TRACK_SPEED * dt;
                this.yaw += Math.sign(deltaYaw) * Math.min(Math.abs(deltaYaw), maxRot);
                this.platform.rotation.y = this.yaw;
            }
        }

        return this.targetEnemy;
    }

    canFire() {
        return this.fireCooldown <= 0 && this.targetEnemy !== null;
    }

    fire() {
        this.fireCooldown = 1.0 / TURRET_FIRE_RATE;
        const worldPos = new THREE.Vector3();
        this.muzzle.getWorldPosition(worldPos);
        const direction = new THREE.Vector3(
            Math.sin(this.yaw), 0, Math.cos(this.yaw)
        ).normalize();
        return { position: worldPos, direction, damage: TURRET_DAMAGE };
    }

    setElementColor(color) {
        this.elementColor = color;
        this.orb.material.color.set(color);
    }

    dispose() {
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

/**
 * Spell launcher - manual aim, uses existing spell system
 */
class SpellLauncher {
    constructor(scene, elementColor) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'spell-launcher';

        // Launcher body
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6a4c93, roughness: 0.5, metalness: 0.3 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), bodyMat);
        this.group.add(body);

        // Crystal focus
        this.crystal = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.08, 0),
            new THREE.MeshBasicMaterial({ color: elementColor })
        );
        this.crystal.position.set(0, 0.15, 0.2);
        this.group.add(this.crystal);

        // Muzzle
        this.muzzle = new THREE.Object3D();
        this.muzzle.position.z = 0.3;
        this.group.add(this.muzzle);

        this.elementColor = elementColor;
        this.fireCooldown = 0;
    }

    update(dt) {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt);
        // Crystal slowly rotates
        this.crystal.rotation.y += dt * 2;
    }

    canFire() {
        return this.fireCooldown <= 0;
    }

    fire(aimDirection) {
        this.fireCooldown = 2.0; // slower than turret
        const worldPos = new THREE.Vector3();
        this.muzzle.getWorldPosition(worldPos);
        return {
            position: worldPos,
            direction: aimDirection.normalize(),
            damage: 15 * SPELL_DAMAGE_MULT,
        };
    }

    setElementColor(color) {
        this.elementColor = color;
        this.crystal.material.color.set(color);
    }

    dispose() {
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

/**
 * Vehicle weapon system - manages turrets, spell launchers, and projectiles
 */
export class VehicleWeaponSystem {
    constructor(scene) {
        this.scene = scene;
        this.turrets = [];
        this.spellLaunchers = [];

        // Projectile pool
        this.projectiles = [];
        for (let i = 0; i < MAX_PROJECTILES; i++) {
            const p = new Projectile();
            scene.add(p.mesh);
            this.projectiles.push(p);
        }

        // References set externally
        this.enemyManager = null;
        this.colorInventory = null;
        this.vehicleMesh = null;
        this.vehicleAudio = null;
        this.augmentSystem = null;
    }

    /**
     * Add a turret to the vehicle
     */
    addTurret(vehicleMesh, socketId, elementColor = 0xff6600) {
        const turret = new Turret(this.scene, elementColor);
        const socket = vehicleMesh.getSocket ? vehicleMesh.getSocket(socketId) : null;
        if (socket) {
            socket.add(turret.group);
        } else {
            // Fallback: add at a default position
            turret.group.position.set(0, 1.6, 0);
            vehicleMesh.add(turret.group);
        }
        this.turrets.push(turret);
        return turret;
    }

    /**
     * Add a spell launcher to the vehicle
     */
    addSpellLauncher(vehicleMesh, socketId, elementColor = 0x6a4c93) {
        const launcher = new SpellLauncher(this.scene, elementColor);
        const socket = vehicleMesh.getSocket ? vehicleMesh.getSocket(socketId) : null;
        if (socket) {
            socket.add(launcher.group);
        } else {
            launcher.group.position.set(0.8, 0.6, -0.5);
            vehicleMesh.add(launcher.group);
        }
        this.spellLaunchers.push(launcher);
        return launcher;
    }

    /**
     * Setup default loadout
     */
    setupDefaultLoadout(vehicleMesh, elementColor = 0xff6600) {
        this.vehicleMesh = vehicleMesh;
        // Starter vehicle: spell launcher only, no turret.
        // Turrets come from looted weapon components via the workshop.
        this.addSpellLauncher(vehicleMesh, 'bed-right', elementColor);
    }

    /**
     * Update all weapons and projectiles
     */
    update(dt, vehiclePosition, aimDirection) {
        // Update turrets
        for (const turret of this.turrets) {
            turret.update(dt, this.enemyManager, vehiclePosition);

            if (turret.canFire()) {
                // Check essence cost
                let canAfford = true;
                if (this.colorInventory && this.colorInventory.getCharge) {
                    canAfford = this.colorInventory.getCharge('ivory') >= TURRET_ESSENCE_COST;
                }
                if (canAfford) {
                    if (this.colorInventory && this.colorInventory.consume) {
                        this.colorInventory.consume('ivory', TURRET_ESSENCE_COST);
                    }
                    const shot = turret.fire();
                    const effects = this.augmentSystem?.getWeaponEffects() || {};
                    const projDamage = shot.damage;

                    if (effects.splitCount > 1) {
                        // Spread pattern: fire multiple projectiles
                        const spreadRad = (effects.spreadAngle || 15) * Math.PI / 180;
                        for (let s = 0; s < effects.splitCount; s++) {
                            const angle = (s - (effects.splitCount - 1) / 2) * spreadRad / effects.splitCount;
                            const dir = shot.direction.clone();
                            const cos = Math.cos(angle);
                            const sin = Math.sin(angle);
                            const rx = dir.x * cos - dir.z * sin;
                            const rz = dir.x * sin + dir.z * cos;
                            dir.set(rx, 0, rz).normalize();
                            const p = this._spawnProjectile(shot.position, dir,
                                TURRET_PROJECTILE_SPEED, projDamage, turret.elementColor, 'turret');
                            if (p) this._applyAugmentFlags(p, effects);
                        }
                    } else {
                        const p = this._spawnProjectile(shot.position, shot.direction,
                            TURRET_PROJECTILE_SPEED, projDamage, turret.elementColor, 'turret');
                        if (p) this._applyAugmentFlags(p, effects);
                    }
                    if (this.vehicleAudio) this.vehicleAudio.playTurretFire();
                }
            }
        }

        // Update spell launchers
        for (const launcher of this.spellLaunchers) {
            launcher.update(dt);
        }

        // Update projectiles
        for (const p of this.projectiles) {
            if (!p.active) continue;
            p.update(dt);

            // Check hits against enemies
            if (this.enemyManager) {
                const enemies = this.enemyManager.getEnemies ? this.enemyManager.getEnemies() : [];
                for (const enemy of enemies) {
                    if (enemy.isDead) continue;
                    const enemyPos = enemy.mesh ? enemy.mesh.position : enemy.position;
                    if (!enemyPos) continue;
                    const dist = p.mesh.position.distanceTo(enemyPos);
                    if (dist < 1.0) {
                        enemy.takeDamage(p.damage);
                        p.deactivate();
                        break;
                    }
                }
            }
        }
    }

    /**
     * Fire spell launcher (called on mouse click while driving)
     */
    fireSpellLauncher(aimDirection) {
        for (const launcher of this.spellLaunchers) {
            if (launcher.canFire()) {
                const shot = launcher.fire(aimDirection);
                this._spawnProjectile(shot.position, shot.direction,
                    TURRET_PROJECTILE_SPEED * 0.8, shot.damage,
                    launcher.elementColor, 'spell');
                if (this.vehicleAudio) this.vehicleAudio.playSpellFire();
                return true;
            }
        }
        return false;
    }

    _applyAugmentFlags(projectile, effects) {
        if (!projectile || !effects) return;
        if (effects.burnDamage) projectile.burnDamage = effects.burnDamage;
        if (effects.pierceCount) projectile.pierceCount = effects.pierceCount;
        if (effects.homingStrength) projectile.homingStrength = effects.homingStrength;
        if (effects.chainCount) projectile.chainCount = effects.chainCount;
        if (effects.poolDamage) projectile.poolDamage = effects.poolDamage;
    }

    _spawnProjectile(position, direction, speed, damage, color, source) {
        for (const p of this.projectiles) {
            if (!p.active) {
                p.fire(position, direction, speed, damage, color, source);
                return p;
            }
        }
        return null;
    }

    /**
     * Set element color on all weapons
     */
    setElementColor(color) {
        for (const t of this.turrets) t.setElementColor(color);
        for (const l of this.spellLaunchers) l.setElementColor(color);
    }

    dispose() {
        for (const t of this.turrets) t.dispose();
        for (const l of this.spellLaunchers) l.dispose();
        for (const p of this.projectiles) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        this.turrets = [];
        this.spellLaunchers = [];
        this.projectiles = [];
    }
}
