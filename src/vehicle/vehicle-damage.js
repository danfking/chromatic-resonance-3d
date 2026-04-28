// vehicle-damage.js - GTA-style vehicle damage state machine + visual effects
// States: PRISTINE → SCRATCHED → DENTED → DAMAGED → CRITICAL → BURNING → DESTROYED

import * as THREE from 'three';

export const DAMAGE_STATES = {
    PRISTINE:  { minHP: 0.80, engineMult: 1.0,  steerMult: 1.0  },
    SCRATCHED: { minHP: 0.60, engineMult: 1.0,  steerMult: 1.0  },
    DENTED:    { minHP: 0.40, engineMult: 0.90, steerMult: 0.95 },
    DAMAGED:   { minHP: 0.20, engineMult: 0.70, steerMult: 0.85 },
    CRITICAL:  { minHP: 0.10, engineMult: 0.40, steerMult: 0.70 },
    BURNING:   { minHP: 0.00, engineMult: 0.20, steerMult: 0.50 },
    DESTROYED: { minHP: -1,   engineMult: 0.00, steerMult: 0.00 },
};

const DEFORM_RADIUS = 0.5;        // vertex displacement radius
const MAX_DEFORM_DEPTH = 0.15;    // max inward push
const SMOKE_PARTICLE_COUNT = 40;
const FIRE_PARTICLE_COUNT = 60;
const EXPLOSION_PARTICLE_COUNT = 100;
const DEBRIS_SCATTER_FORCE = 8;
const BURN_DAMAGE_RATE = 5;        // HP/sec lost while burning

/**
 * Smoke/fire particle system
 */
class DamageParticles {
    constructor(scene, count, type) {
        this.scene = scene;
        this.type = type; // 'smoke', 'fire', 'explosion'
        this.count = count;

        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const velocities = new Float32Array(count * 3);

        this.velocities = velocities;
        this.lifetimes = new Float32Array(count);
        this.maxLifetimes = new Float32Array(count);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: type === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        this.points = new THREE.Points(geo, mat);
        this.points.visible = false;
        this.points.frustumCulled = false;
        scene.add(this.points);

        this.active = false;
        this.origin = new THREE.Vector3();
    }

    start(origin) {
        this.origin.copy(origin);
        this.active = true;
        this.points.visible = true;

        const posAttr = this.points.geometry.attributes.position;
        const colorAttr = this.points.geometry.attributes.color;

        for (let i = 0; i < this.count; i++) {
            // Initial position at origin with small random offset
            posAttr.setXYZ(i, origin.x + (Math.random() - 0.5) * 0.3,
                origin.y + Math.random() * 0.3,
                origin.z + (Math.random() - 0.5) * 0.3);

            // Velocity: upward drift for smoke, random burst for explosion
            if (this.type === 'explosion') {
                this.velocities[i * 3] = (Math.random() - 0.5) * DEBRIS_SCATTER_FORCE;
                this.velocities[i * 3 + 1] = Math.random() * DEBRIS_SCATTER_FORCE * 0.5;
                this.velocities[i * 3 + 2] = (Math.random() - 0.5) * DEBRIS_SCATTER_FORCE;
            } else {
                this.velocities[i * 3] = (Math.random() - 0.5) * 0.5;
                this.velocities[i * 3 + 1] = 1.0 + Math.random() * 1.5;
                this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
            }

            // Color
            if (this.type === 'smoke') {
                const g = 0.3 + Math.random() * 0.2;
                colorAttr.setXYZ(i, g, g, g);
            } else if (this.type === 'fire') {
                colorAttr.setXYZ(i, 1.0, 0.4 + Math.random() * 0.4, Math.random() * 0.1);
            } else {
                colorAttr.setXYZ(i, 1.0, 0.6 + Math.random() * 0.3, Math.random() * 0.2);
            }

            this.lifetimes[i] = 0;
            this.maxLifetimes[i] = this.type === 'explosion' ? 1.0 + Math.random() : 2.0 + Math.random() * 2;
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
    }

    update(dt, origin) {
        if (!this.active) return;

        this.origin.copy(origin);
        const posAttr = this.points.geometry.attributes.position;
        let allDead = true;

        for (let i = 0; i < this.count; i++) {
            this.lifetimes[i] += dt;
            if (this.lifetimes[i] > this.maxLifetimes[i]) {
                // Respawn (for continuous effects) or kill (for explosion)
                if (this.type === 'explosion') continue;
                this.lifetimes[i] = 0;
                posAttr.setXYZ(i, origin.x + (Math.random() - 0.5) * 0.3,
                    origin.y + Math.random() * 0.2,
                    origin.z + (Math.random() - 0.5) * 0.3);
            }
            allDead = false;

            // Apply velocity + gravity
            const px = posAttr.getX(i) + this.velocities[i * 3] * dt;
            const py = posAttr.getY(i) + this.velocities[i * 3 + 1] * dt;
            const pz = posAttr.getZ(i) + this.velocities[i * 3 + 2] * dt;

            posAttr.setXYZ(i, px, py, pz);

            // Gravity for explosion particles
            if (this.type === 'explosion') {
                this.velocities[i * 3 + 1] -= 9.8 * dt;
            }

            // Wind drift for smoke
            if (this.type === 'smoke') {
                this.velocities[i * 3] += (Math.random() - 0.5) * 0.5 * dt;
            }
        }

        posAttr.needsUpdate = true;

        if (this.type === 'explosion' && allDead) {
            this.stop();
        }
    }

    stop() {
        this.active = false;
        this.points.visible = false;
    }

    dispose() {
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}

/**
 * Vehicle damage system
 */
export class VehicleDamageSystem {
    constructor(scene) {
        this.scene = scene;

        // Health
        this.maxHP = 1000;
        this.currentHP = 1000;
        this.state = 'PRISTINE';

        // Particle effects
        this.smokeParticles = new DamageParticles(scene, SMOKE_PARTICLE_COUNT, 'smoke');
        this.fireParticles = new DamageParticles(scene, FIRE_PARTICLE_COUNT, 'fire');
        this.explosionParticles = new DamageParticles(scene, EXPLOSION_PARTICLE_COUNT, 'explosion');

        // References
        this.vehicleMesh = null;
        this.physics = null;

        // Detached debris
        this.debris = [];

        // Augment system reference (set externally)
        this.augmentSystem = null;

        // Callbacks
        this.onDestroyed = null;
        this.onStateChanged = null;

        // Damage flash
        this._flashTimer = 0;

        // Burning damage
        this._burnTimer = 0;
    }

    /**
     * Wire to vehicle mesh and physics
     */
    setVehicle(vehicleMesh, physics) {
        this.vehicleMesh = vehicleMesh;
        this.physics = physics;
    }

    /**
     * Apply damage from a source
     * @param {number} amount - damage to apply
     * @param {THREE.Vector3} impactPoint - world-space impact location (optional)
     * @param {THREE.Vector3} impactNormal - impact direction (optional)
     */
    applyDamage(amount, impactPoint, impactNormal) {
        if (this.state === 'DESTROYED') return;

        // Defense augment effects
        const defenseEffects = this.augmentSystem?.getDefenseEffects();
        if (defenseEffects) {
            // Reflect chance: bounce projectile damage back
            if (defenseEffects.reflectChance && Math.random() < defenseEffects.reflectChance) {
                window.dispatchEvent(new CustomEvent('damage-reflected', {
                    detail: { damage: amount, position: impactPoint }
                }));
                return; // Damage negated by reflect
            }
            // Thorns: dispatch damage back to attacker
            if (defenseEffects.thornsDamage) {
                window.dispatchEvent(new CustomEvent('thorns-damage', {
                    detail: { damage: defenseEffects.thornsDamage, position: impactPoint }
                }));
            }
        }

        this.currentHP = Math.max(0, this.currentHP - amount);
        this._flashTimer = 0.1;

        // Determine new state
        const hpPercent = this.currentHP / this.maxHP;
        let newState = 'PRISTINE';
        for (const [name, def] of Object.entries(DAMAGE_STATES)) {
            if (hpPercent >= def.minHP) {
                newState = name;
                break;
            }
        }

        if (newState !== this.state) {
            this._transitionState(newState, impactPoint);
        }

        // Deform panel at impact point
        if (impactPoint && this.vehicleMesh && hpPercent < 0.6) {
            this._deformAtPoint(impactPoint, impactNormal, amount / this.maxHP);
        }
    }

    /**
     * Apply collision damage (from vehicle speed)
     */
    applyCollisionDamage(speed) {
        const threshold = 5; // min speed for damage
        if (speed > threshold) {
            const damage = (speed - threshold) * 15;
            this.applyDamage(damage);
        }
    }

    _transitionState(newState, impactPoint) {
        const oldState = this.state;
        this.state = newState;

        // Update physics multipliers
        if (this.physics) {
            const stateDef = DAMAGE_STATES[newState];
            this.physics.engineMultiplier = stateDef.engineMult;
            this.physics.steeringMultiplier = stateDef.steerMult;
        }

        // Visual transitions
        const hoodOrigin = this.vehicleMesh ?
            new THREE.Vector3(0, 1.0, 1.0).applyMatrix4(this.vehicleMesh.matrixWorld) :
            new THREE.Vector3();

        switch (newState) {
            case 'SCRATCHED':
                this._increaseRoughness(0.1);
                break;

            case 'DENTED':
                this._increaseRoughness(0.2);
                break;

            case 'DAMAGED':
                this._detachDoors();
                this.smokeParticles.start(hoodOrigin);
                break;

            case 'CRITICAL':
                this._openHood();
                this.smokeParticles.stop();
                // Black smoke + start of fire
                this.smokeParticles.start(hoodOrigin);
                this.fireParticles.start(hoodOrigin);
                break;

            case 'BURNING':
                // Emissive orange glow
                this._setEmissive(0xff4400, 0.3);
                break;

            case 'DESTROYED':
                this._explode(impactPoint);
                break;
        }

        if (this.onStateChanged) this.onStateChanged(newState, oldState);
    }

    _increaseRoughness(amount) {
        if (!this.vehicleMesh) return;
        this.vehicleMesh.traverse(child => {
            if (child.isMesh && child.material && child.material.roughness !== undefined) {
                child.material.roughness = Math.min(1.0, child.material.roughness + amount);
            }
        });
    }

    _setEmissive(color, intensity) {
        if (!this.vehicleMesh) return;
        this.vehicleMesh.traverse(child => {
            if (child.isMesh && child.material && child.material.emissive) {
                child.material.emissive.set(color);
                child.material.emissiveIntensity = intensity;
            }
        });
    }

    _detachDoors() {
        if (!this.vehicleMesh) return;
        // Try to detach named door groups
        for (const name of ['doorLeft', 'doorRight']) {
            const door = this.vehicleMesh[name];
            if (door && door.parent) {
                const worldPos = new THREE.Vector3();
                door.getWorldPosition(worldPos);
                door.parent.remove(door);
                this.scene.add(door);
                door.position.copy(worldPos);

                // Add as debris with physics
                this.debris.push({
                    mesh: door,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 3,
                        2 + Math.random() * 2,
                        (Math.random() - 0.5) * 3
                    ),
                    angularVelocity: new THREE.Vector3(
                        Math.random() * 5,
                        Math.random() * 5,
                        Math.random() * 5
                    ),
                    lifetime: 0,
                });
            }
        }
    }

    _openHood() {
        if (!this.vehicleMesh) return;
        const hood = this.vehicleMesh.hoodGroup;
        if (hood) {
            // Rotate hood open (pivot at rear edge)
            hood.rotation.x = -0.7; // ~40° open
        }
    }

    _deformAtPoint(impactPoint, impactNormal, intensity) {
        if (!this.vehicleMesh) return;

        // Find nearby meshes and displace vertices
        this.vehicleMesh.traverse(child => {
            if (!child.isMesh || !child.geometry) return;
            if (child.userData.bodyPart === 'wheel') return; // Don't deform wheels

            const posAttr = child.geometry.attributes.position;
            if (!posAttr) return;

            const worldMatrix = child.matrixWorld;
            const inverseMatrix = worldMatrix.clone().invert();
            const localImpact = impactPoint.clone().applyMatrix4(inverseMatrix);
            const deformDir = impactNormal ? impactNormal.clone().transformDirection(inverseMatrix).normalize() :
                new THREE.Vector3(0, -1, 0);

            let modified = false;
            for (let i = 0; i < posAttr.count; i++) {
                const vx = posAttr.getX(i);
                const vy = posAttr.getY(i);
                const vz = posAttr.getZ(i);

                const dx = vx - localImpact.x;
                const dy = vy - localImpact.y;
                const dz = vz - localImpact.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < DEFORM_RADIUS) {
                    const factor = (1 - dist / DEFORM_RADIUS) * intensity * MAX_DEFORM_DEPTH;
                    posAttr.setXYZ(i,
                        vx + deformDir.x * factor,
                        vy + deformDir.y * factor,
                        vz + deformDir.z * factor
                    );
                    modified = true;
                }
            }

            if (modified) {
                posAttr.needsUpdate = true;
                child.geometry.computeVertexNormals();
            }
        });
    }

    _explode(impactPoint) {
        if (!this.vehicleMesh) return;

        // Stop continuous effects
        this.smokeParticles.stop();
        this.fireParticles.stop();

        // Explosion particles
        const center = impactPoint || this.vehicleMesh.position.clone();
        center.y += 0.5;
        this.explosionParticles.start(center);

        // Scatter all mesh children as debris
        const children = [];
        this.vehicleMesh.traverse(child => {
            if (child.isMesh) children.push(child);
        });

        for (const child of children) {
            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);

            // Reparent to scene
            const parent = child.parent;
            if (parent) parent.remove(child);
            this.scene.add(child);
            child.position.copy(worldPos);

            // Char the material
            if (child.material) {
                child.material = child.material.clone();
                child.material.color.multiplyScalar(0.3);
                child.material.roughness = 1.0;
            }

            this.debris.push({
                mesh: child,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * DEBRIS_SCATTER_FORCE,
                    Math.random() * DEBRIS_SCATTER_FORCE * 0.7,
                    (Math.random() - 0.5) * DEBRIS_SCATTER_FORCE
                ),
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8
                ),
                lifetime: 0,
            });
        }

        if (this.onDestroyed) this.onDestroyed();
    }

    /**
     * Update damage effects
     */
    update(dt) {
        // Flash timer
        if (this._flashTimer > 0) {
            this._flashTimer -= dt;
        }

        // Shell regen from defense augments
        const defenseEffects = this.augmentSystem?.getDefenseEffects();
        if (defenseEffects?.shellRegenMult && this.state !== 'DESTROYED') {
            const regenRate = 2 * defenseEffects.shellRegenMult; // base 2 HP/sec * mult
            this.currentHP = Math.min(this.maxHP, this.currentHP + regenRate * dt);
        }

        // Burning state: continuous damage
        if (this.state === 'BURNING') {
            this._burnTimer += dt;
            if (this._burnTimer >= 1.0) {
                this._burnTimer = 0;
                this.applyDamage(BURN_DAMAGE_RATE);
            }
        }

        // Update particles at vehicle position
        const origin = this.vehicleMesh ?
            this.vehicleMesh.position.clone().add(new THREE.Vector3(0, 0.8, 0.5)) :
            new THREE.Vector3();

        this.smokeParticles.update(dt, origin);
        this.fireParticles.update(dt, origin);
        this.explosionParticles.update(dt, origin);

        // Update debris physics
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.lifetime += dt;

            // Gravity
            d.velocity.y -= 9.8 * dt;

            // Position
            d.mesh.position.add(d.velocity.clone().multiplyScalar(dt));

            // Rotation
            d.mesh.rotation.x += d.angularVelocity.x * dt;
            d.mesh.rotation.y += d.angularVelocity.y * dt;
            d.mesh.rotation.z += d.angularVelocity.z * dt;

            // Ground collision (simple)
            if (d.mesh.position.y < 0) {
                d.mesh.position.y = 0;
                d.velocity.y *= -0.3; // bounce
                d.velocity.x *= 0.8;
                d.velocity.z *= 0.8;
                d.angularVelocity.multiplyScalar(0.7);
            }

            // Remove after 5 seconds
            if (d.lifetime > 5) {
                this.scene.remove(d.mesh);
                d.mesh.geometry?.dispose();
                d.mesh.material?.dispose();
                this.debris.splice(i, 1);
            }
        }
    }

    /**
     * Reset to pristine state
     */
    reset() {
        this.currentHP = this.maxHP;
        this.state = 'PRISTINE';
        this._burnTimer = 0;
        this._flashTimer = 0;
        this.smokeParticles.stop();
        this.fireParticles.stop();
        this.explosionParticles.stop();

        // Clear debris
        for (const d of this.debris) {
            this.scene.remove(d.mesh);
        }
        this.debris = [];

        if (this.physics) {
            this.physics.engineMultiplier = 1.0;
            this.physics.steeringMultiplier = 1.0;
        }
    }

    getHPPercent() {
        return this.currentHP / this.maxHP;
    }

    isDestroyed() {
        return this.state === 'DESTROYED';
    }

    dispose() {
        this.smokeParticles.dispose();
        this.fireParticles.dispose();
        this.explosionParticles.dispose();
        for (const d of this.debris) {
            this.scene.remove(d.mesh);
        }
        this.debris = [];
    }
}
