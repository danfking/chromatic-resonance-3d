// wand-crystal.js - Floating wand crystal for blob creatures
// A crystallized focusing tool that orbits the creature and channels essence into spells

import * as THREE from 'three';

// Wand tier definitions
export const WAND_TIERS = {
    starter: {
        name: 'Splinter of First Light',
        description: 'A fragment of crystallized dawn, barely holding together.',
        tier: 0,
        efficiency: 0.7,          // 30% mana wasted
        castTime: 0.8,            // Slow channel time
        modifierSlots: 1,
        lockedSlots: 1,           // Second slot locked
        canCombineElements: false,
        baseDamage: 10,
        // Visual properties
        color: 0xaabbcc,
        emissive: 0x334455,
        size: 0.12,
        stability: 0.3,           // Low stability = more wobble
        particleLeakage: 0.3      // 30% particles leak during cast
    },

    apprentice: {
        name: 'Ember Rod',
        description: 'A properly shaped crystal with stable focus.',
        tier: 1,
        efficiency: 0.8,
        castTime: 0.6,
        modifierSlots: 1,
        lockedSlots: 0,
        canCombineElements: false,
        baseDamage: 15,
        color: 0xccddee,
        emissive: 0x556677,
        size: 0.15,
        stability: 0.6,
        particleLeakage: 0.15
    },

    journeyman: {
        name: 'Dual Prism',
        description: 'A polished gem that can blend two elements.',
        tier: 2,
        efficiency: 0.85,
        castTime: 0.5,
        modifierSlots: 2,
        lockedSlots: 0,
        canCombineElements: true,
        maxElements: 2,
        baseDamage: 20,
        color: 0xddeeff,
        emissive: 0x778899,
        size: 0.18,
        stability: 0.8,
        particleLeakage: 0.08
    },

    master: {
        name: 'Chromatic Focus',
        description: 'An ornate wand that channels all elements with precision.',
        tier: 3,
        efficiency: 0.9,
        castTime: 0.4,
        modifierSlots: 2,
        lockedSlots: 0,
        canCombineElements: true,
        maxElements: 4,
        baseDamage: 28,
        color: 0xeeffff,
        emissive: 0x99aacc,
        size: 0.2,
        stability: 0.9,
        particleLeakage: 0.03
    },

    legendary: {
        name: 'The First Brush',
        description: 'A living crystal that pulses with inner light.',
        tier: 4,
        efficiency: 0.95,
        castTime: 0.3,
        modifierSlots: 3,
        lockedSlots: 0,
        canCombineElements: true,
        maxElements: 6,
        baseDamage: 35,
        color: 0xffffff,
        emissive: 0xccddff,
        size: 0.22,
        stability: 1.0,
        particleLeakage: 0
    }
};

// Wand modifier definitions
export const WAND_MODIFIERS = {
    burningCore: {
        name: 'Burning Core',
        description: '+Burn DOT to any spell',
        rarity: 'common',
        effect: { type: 'burn', damage: 3, duration: 1.5 }
    },
    frostShard: {
        name: 'Frost Shard',
        description: '+Slow effect',
        rarity: 'common',
        effect: { type: 'slow', amount: 0.25, duration: 1.0 }
    },
    seekingEye: {
        name: 'Seeking Eye',
        description: 'Mild homing',
        rarity: 'uncommon',
        effect: { type: 'homing', strength: 2.0 }
    },
    splinter: {
        name: 'Splinter',
        description: 'Spell splits on impact',
        rarity: 'uncommon',
        effect: { type: 'split', count: 3 }
    },
    amplifier: {
        name: 'Amplifier',
        description: '+20% damage, +10% cost',
        rarity: 'rare',
        effect: { type: 'amplify', damageBonus: 0.2, costIncrease: 0.1 }
    },
    leechCrystal: {
        name: 'Leech Crystal',
        description: '5% spell damage as healing',
        rarity: 'rare',
        effect: { type: 'leech', healPercent: 0.05 }
    },
    voidFragment: {
        name: 'Void Fragment',
        description: 'Chance to drain enemy essence',
        rarity: 'epic',
        effect: { type: 'drain', chance: 0.15, amount: 5 }
    },
    prismaticLens: {
        name: 'Prismatic Lens',
        description: 'Random element added to spell',
        rarity: 'epic',
        effect: { type: 'randomElement' }
    }
};

/**
 * WandCrystal - Visual floating wand for blob creatures
 */
export class WandCrystal {
    constructor(tierName = 'starter') {
        this.tier = WAND_TIERS[tierName] || WAND_TIERS.starter;
        this.tierName = tierName;

        // Equipped modifiers
        this.modifiers = [];

        // Casting state
        this.isCasting = false;
        this.castProgress = 0;
        this.castTarget = null;

        // Orbit properties
        this.orbitRadius = 1.2;       // Distance from creature center
        this.orbitSpeed = 0.8;        // Radians per second
        this.orbitAngle = 0;
        this.hoverOffset = 0;
        this.hoverSpeed = 2.5;

        // THREE.js objects
        this.group = new THREE.Group();
        this.crystalMesh = null;
        this.glowMesh = null;
        this.channelParticles = null;

        // Particle channeling system
        this.maxChannelParticles = 30;
        this.channelPositions = new Float32Array(this.maxChannelParticles * 3);
        this.channelProgress = new Float32Array(this.maxChannelParticles);
        this.channelAlphas = new Float32Array(this.maxChannelParticles);
        this.activeChannelParticles = 0;

        this.time = 0;

        this.createCrystal();
        this.createGlow();
        this.createChannelParticles();
    }

    createCrystal() {
        // Create asymmetric crystal geometry
        const tier = this.tier;

        // Main crystal body - octahedron stretched vertically
        const geometry = new THREE.OctahedronGeometry(tier.size, 0);

        // Stretch vertically for crystal shape
        const positions = geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] *= 1.8; // Stretch Y
            // Add slight asymmetry for lower tier wands
            if (tier.stability < 0.7) {
                positions[i] += (Math.random() - 0.5) * tier.size * (1 - tier.stability) * 0.3;
                positions[i + 2] += (Math.random() - 0.5) * tier.size * (1 - tier.stability) * 0.3;
            }
        }
        geometry.computeVertexNormals();

        // Crystal material with refraction-like effect
        const material = new THREE.MeshPhysicalMaterial({
            color: tier.color,
            emissive: tier.emissive,
            emissiveIntensity: 0.3,
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.3,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });

        this.crystalMesh = new THREE.Mesh(geometry, material);
        this.group.add(this.crystalMesh);
    }

    createGlow() {
        // Outer glow sphere
        const glowGeometry = new THREE.SphereGeometry(this.tier.size * 1.5, 16, 12);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(this.tier.emissive) },
                uIntensity: { value: 0.5 },
                uTime: { value: 0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vViewDir = normalize(cameraPosition - worldPos.xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uIntensity;
                uniform float uTime;

                varying vec3 vNormal;
                varying vec3 vViewDir;

                void main() {
                    float fresnel = pow(1.0 - abs(dot(vViewDir, vNormal)), 3.0);
                    float pulse = 0.8 + 0.2 * sin(uTime * 3.0);
                    float alpha = fresnel * uIntensity * pulse;
                    gl_FragColor = vec4(uColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide
        });

        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.group.add(this.glowMesh);
    }

    createChannelParticles() {
        // Initialize particle positions
        for (let i = 0; i < this.maxChannelParticles; i++) {
            this.channelPositions[i * 3] = 0;
            this.channelPositions[i * 3 + 1] = 0;
            this.channelPositions[i * 3 + 2] = 0;
            this.channelProgress[i] = 0;
            this.channelAlphas[i] = 0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.channelPositions, 3));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(this.channelAlphas, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(0xffffff) },
                uPixelRatio: { value: window.devicePixelRatio },
                uSize: { value: 0.08 }
            },
            vertexShader: `
                attribute float alpha;
                uniform float uPixelRatio;
                uniform float uSize;

                varying float vAlpha;

                void main() {
                    vAlpha = alpha;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = uSize * uPixelRatio * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;

                void main() {
                    if (vAlpha < 0.01) discard;

                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center) * 2.0;
                    float core = 1.0 - smoothstep(0.0, 0.3, dist);
                    float outer = 1.0 - smoothstep(0.3, 1.0, dist);

                    vec3 color = uColor * (1.0 + core);
                    float alpha = outer * vAlpha;

                    if (alpha < 0.01) discard;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.channelParticles = new THREE.Points(geometry, material);
        this.group.add(this.channelParticles);
    }

    /**
     * Equip a modifier to the wand
     */
    equipModifier(modifierId, slotIndex) {
        const modifier = WAND_MODIFIERS[modifierId];
        if (!modifier) return false;

        const totalSlots = this.tier.modifierSlots;
        const availableSlots = totalSlots - this.tier.lockedSlots;

        if (slotIndex >= availableSlots) {
            console.warn(`Slot ${slotIndex} is locked on this wand`);
            return false;
        }

        this.modifiers[slotIndex] = { id: modifierId, ...modifier };
        return true;
    }

    /**
     * Remove a modifier from a slot
     */
    removeModifier(slotIndex) {
        if (this.modifiers[slotIndex]) {
            const removed = this.modifiers[slotIndex];
            this.modifiers[slotIndex] = null;
            return removed;
        }
        return null;
    }

    /**
     * Get all active modifiers
     */
    getActiveModifiers() {
        return this.modifiers.filter(m => m !== null && m !== undefined);
    }

    /**
     * Calculate mana cost with efficiency
     */
    calculateCost(baseCost) {
        let cost = baseCost / this.tier.efficiency;

        // Apply modifier cost changes
        for (const mod of this.getActiveModifiers()) {
            if (mod.effect?.costIncrease) {
                cost *= (1 + mod.effect.costIncrease);
            }
        }

        return Math.ceil(cost);
    }

    /**
     * Calculate damage with modifiers
     */
    calculateDamage(baseDamage) {
        let damage = baseDamage || this.tier.baseDamage;

        // Apply modifier damage bonuses
        for (const mod of this.getActiveModifiers()) {
            if (mod.effect?.damageBonus) {
                damage *= (1 + mod.effect.damageBonus);
            }
        }

        return Math.round(damage);
    }

    /**
     * Start casting a spell
     * @param {THREE.Vector3} creaturePosition - Position of the creature
     * @param {THREE.Vector3} targetPosition - Where to fire
     */
    startCast(creaturePosition, targetPosition) {
        if (this.isCasting) return false;

        this.isCasting = true;
        this.castProgress = 0;
        this.castTarget = targetPosition ? targetPosition.clone() : null;
        this.castCreaturePos = creaturePosition ? creaturePosition.clone() : new THREE.Vector3();

        // Start spawning channel particles
        this.activeChannelParticles = 0;

        return true;
    }

    /**
     * Update casting progress
     * @param {number} delta - Time delta
     * @returns {Object|null} Spell config if cast completes, null otherwise
     */
    updateCast(delta) {
        if (!this.isCasting) return null;

        // Advance cast progress
        this.castProgress += delta / this.tier.castTime;

        // Spawn channel particles flowing from creature to wand
        if (this.activeChannelParticles < this.maxChannelParticles) {
            const spawnRate = this.maxChannelParticles / this.tier.castTime;
            const toSpawn = Math.min(
                Math.floor(spawnRate * delta) + 1,
                this.maxChannelParticles - this.activeChannelParticles
            );

            for (let i = 0; i < toSpawn; i++) {
                this.spawnChannelParticle();
            }
        }

        // Check for completion
        if (this.castProgress >= 1.0) {
            this.isCasting = false;

            // Build spell configuration
            const spell = {
                damage: this.calculateDamage(),
                effects: this.getActiveModifiers().map(m => m.effect),
                efficiency: this.tier.efficiency,
                wasted: 1 - this.tier.efficiency,
                tier: this.tierName,
                target: this.castTarget
            };

            return spell;
        }

        return null;
    }

    /**
     * Cancel current cast
     */
    cancelCast() {
        this.isCasting = false;
        this.castProgress = 0;

        // Fade out channel particles
        for (let i = 0; i < this.maxChannelParticles; i++) {
            this.channelAlphas[i] *= 0.5;
        }
    }

    spawnChannelParticle() {
        if (this.activeChannelParticles >= this.maxChannelParticles) return;

        const idx = this.activeChannelParticles;
        const idx3 = idx * 3;

        // Start at creature center (will be offset by creature position in update)
        this.channelPositions[idx3] = (Math.random() - 0.5) * 0.3;
        this.channelPositions[idx3 + 1] = (Math.random() - 0.5) * 0.3;
        this.channelPositions[idx3 + 2] = (Math.random() - 0.5) * 0.3;

        this.channelProgress[idx] = 0;
        this.channelAlphas[idx] = 1.0;

        this.activeChannelParticles++;
    }

    /**
     * Update wand position and animation
     * @param {number} delta - Time delta
     * @param {THREE.Vector3} creaturePosition - Position to orbit around
     */
    update(delta, creaturePosition) {
        this.time += delta;

        // Update orbit
        this.orbitAngle += this.orbitSpeed * delta;
        this.hoverOffset = Math.sin(this.time * this.hoverSpeed) * 0.1;

        // Calculate wand position
        const x = Math.cos(this.orbitAngle) * this.orbitRadius;
        const z = Math.sin(this.orbitAngle) * this.orbitRadius;
        const y = 0.3 + this.hoverOffset;

        if (creaturePosition) {
            this.group.position.set(
                creaturePosition.x + x,
                creaturePosition.y + y,
                creaturePosition.z + z
            );
        } else {
            this.group.position.set(x, y, z);
        }

        // Crystal wobble based on stability
        const wobbleAmount = (1 - this.tier.stability) * 0.1;
        this.crystalMesh.rotation.x = Math.sin(this.time * 3) * wobbleAmount;
        this.crystalMesh.rotation.z = Math.cos(this.time * 2.5) * wobbleAmount;

        // Point crystal slightly toward movement direction
        this.crystalMesh.rotation.y = -this.orbitAngle + Math.PI / 2;

        // Update glow
        this.glowMesh.material.uniforms.uTime.value = this.time;

        // Casting intensity boost
        if (this.isCasting) {
            this.glowMesh.material.uniforms.uIntensity.value = 0.5 + this.castProgress * 0.8;
            this.crystalMesh.material.emissiveIntensity = 0.3 + this.castProgress * 0.7;
        } else {
            this.glowMesh.material.uniforms.uIntensity.value = 0.5;
            this.crystalMesh.material.emissiveIntensity = 0.3;
        }

        // Update channel particles
        this.updateChannelParticles(delta, creaturePosition);
    }

    updateChannelParticles(delta, creaturePosition) {
        const wandPos = this.group.position;
        const creaturePos = creaturePosition || new THREE.Vector3();

        for (let i = 0; i < this.activeChannelParticles; i++) {
            const idx3 = i * 3;

            // Progress particle toward wand
            this.channelProgress[i] += delta * 2.5;

            // Lerp position from creature to wand
            const t = Math.min(this.channelProgress[i], 1.0);

            // Start position (near creature center with some offset)
            const startX = creaturePos.x + (Math.sin(i * 0.7) * 0.2);
            const startY = creaturePos.y + (Math.cos(i * 1.1) * 0.2);
            const startZ = creaturePos.z + (Math.sin(i * 0.9) * 0.2);

            // Curved path with spiral
            const spiralAngle = t * Math.PI * 2 + i * 0.5;
            const spiralRadius = (1 - t) * 0.15;

            this.channelPositions[idx3] = startX + (wandPos.x - startX) * t + Math.cos(spiralAngle) * spiralRadius;
            this.channelPositions[idx3 + 1] = startY + (wandPos.y - startY) * t + Math.sin(spiralAngle * 1.5) * spiralRadius;
            this.channelPositions[idx3 + 2] = startZ + (wandPos.z - startZ) * t + Math.sin(spiralAngle) * spiralRadius;

            // Fade based on progress
            if (t >= 1.0) {
                this.channelAlphas[i] *= 0.8; // Fade out at destination
            } else {
                this.channelAlphas[i] = 1.0 - t * 0.3; // Slight fade as it travels
            }

            // Add leakage for inefficient wands
            if (this.tier.particleLeakage > 0 && Math.random() < this.tier.particleLeakage * delta) {
                // Scatter particle off-course
                this.channelPositions[idx3] += (Math.random() - 0.5) * 0.3;
                this.channelPositions[idx3 + 1] += (Math.random() - 0.5) * 0.3;
                this.channelPositions[idx3 + 2] += (Math.random() - 0.5) * 0.3;
                this.channelAlphas[i] *= 0.7;
            }
        }

        // Compact dead particles
        let writeIdx = 0;
        for (let i = 0; i < this.activeChannelParticles; i++) {
            if (this.channelAlphas[i] > 0.05) {
                if (i !== writeIdx) {
                    const src3 = i * 3;
                    const dst3 = writeIdx * 3;
                    this.channelPositions[dst3] = this.channelPositions[src3];
                    this.channelPositions[dst3 + 1] = this.channelPositions[src3 + 1];
                    this.channelPositions[dst3 + 2] = this.channelPositions[src3 + 2];
                    this.channelProgress[writeIdx] = this.channelProgress[i];
                    this.channelAlphas[writeIdx] = this.channelAlphas[i];
                }
                writeIdx++;
            }
        }
        this.activeChannelParticles = writeIdx;

        // Update GPU buffers
        this.channelParticles.geometry.attributes.position.needsUpdate = true;
        this.channelParticles.geometry.attributes.alpha.needsUpdate = true;
    }

    /**
     * Upgrade to a new tier
     */
    setTier(tierName) {
        const newTier = WAND_TIERS[tierName];
        if (!newTier) {
            console.warn(`Unknown wand tier: ${tierName}`);
            return false;
        }

        this.tier = newTier;
        this.tierName = tierName;

        // Update crystal visual
        this.crystalMesh.material.color.set(newTier.color);
        this.crystalMesh.material.emissive.set(newTier.emissive);

        // Update glow
        this.glowMesh.material.uniforms.uColor.value.set(newTier.emissive);

        // Scale crystal
        const scale = newTier.size / WAND_TIERS.starter.size;
        this.crystalMesh.scale.setScalar(scale);
        this.glowMesh.scale.setScalar(scale);

        // Clear invalid modifier slots
        const availableSlots = newTier.modifierSlots - newTier.lockedSlots;
        this.modifiers = this.modifiers.slice(0, availableSlots);

        console.log(`Wand upgraded to ${newTier.name}`);
        return true;
    }

    /**
     * Get wand info for UI display
     */
    getInfo() {
        const tier = this.tier;
        const availableSlots = tier.modifierSlots - tier.lockedSlots;

        return {
            name: tier.name,
            description: tier.description,
            tier: this.tierName,
            tierLevel: tier.tier,
            efficiency: Math.round(tier.efficiency * 100),
            wastedMana: Math.round((1 - tier.efficiency) * 100),
            castTime: tier.castTime,
            baseDamage: tier.baseDamage,
            modifierSlots: tier.modifierSlots,
            availableSlots: availableSlots,
            lockedSlots: tier.lockedSlots,
            equippedModifiers: this.getActiveModifiers(),
            canCombineElements: tier.canCombineElements,
            maxElements: tier.maxElements || 1
        };
    }

    /**
     * Dispose of THREE.js resources
     */
    dispose() {
        this.crystalMesh.geometry.dispose();
        this.crystalMesh.material.dispose();
        this.glowMesh.geometry.dispose();
        this.glowMesh.material.dispose();
        this.channelParticles.geometry.dispose();
        this.channelParticles.material.dispose();
        this.group.clear();
    }
}
