// particle-life-creature.js - Blob creatures with Particle Life physics inside

import * as THREE from 'three';
import { BubblePhysics, createBubbleShaderCode, getDefaultBubbleUniforms } from './bubble-physics.js';

// Elemental types and their relationships (Pokemon-style)
// Positive = attracts, Negative = repels
export const ELEMENT_TYPES = {
    FIRE: 0,      // Red/Orange - aggressive, chaotic
    WATER: 1,     // Blue - flowing, calming
    EARTH: 2,     // Green/Brown - stable, grounded
    AIR: 3,       // White/Cyan - light, dispersing
    SHADOW: 4,    // Purple/Black - consuming, heavy
    LIGHT: 5      // Yellow/Gold - radiant, expansive
};

// Type effectiveness matrix: [attacker][defender] = relationship
// Positive = attracted to (wants to chase/consume)
// Negative = repelled by (fears/avoids)
// Based on: Fire>Earth>Air>Water>Fire, Shadow<>Light opposition
export const TYPE_RELATIONSHIPS = {
    // FIRE: burns earth, evaporates water, feeds on air, fears water
    [ELEMENT_TYPES.FIRE]: {
        [ELEMENT_TYPES.FIRE]: 0.3,      // Same type - mild attraction (pack behavior)
        [ELEMENT_TYPES.WATER]: -0.7,    // Repelled by water (extinguishes)
        [ELEMENT_TYPES.EARTH]: 0.6,     // Attracted to earth (burns it)
        [ELEMENT_TYPES.AIR]: 0.5,       // Attracted to air (feeds flames)
        [ELEMENT_TYPES.SHADOW]: -0.3,   // Slightly repelled by shadow
        [ELEMENT_TYPES.LIGHT]: 0.4      // Attracted to light (similar energy)
    },
    // WATER: erodes earth, extinguishes fire, carried by air
    [ELEMENT_TYPES.WATER]: {
        [ELEMENT_TYPES.FIRE]: 0.6,      // Attracted to fire (extinguishes)
        [ELEMENT_TYPES.WATER]: 0.5,     // Same type - flows together
        [ELEMENT_TYPES.EARTH]: 0.4,     // Attracted to earth (erodes)
        [ELEMENT_TYPES.AIR]: -0.3,      // Slightly repelled by air (evaporates)
        [ELEMENT_TYPES.SHADOW]: 0.2,    // Mild attraction to shadow (deep waters)
        [ELEMENT_TYPES.LIGHT]: -0.2     // Slightly repelled by light (reflects)
    },
    // EARTH: grounds air, absorbs water, smothers fire
    [ELEMENT_TYPES.EARTH]: {
        [ELEMENT_TYPES.FIRE]: -0.5,     // Repelled by fire (burned)
        [ELEMENT_TYPES.WATER]: -0.3,    // Slightly repelled (eroded)
        [ELEMENT_TYPES.EARTH]: 0.7,     // Strong same-type attraction (stable)
        [ELEMENT_TYPES.AIR]: 0.5,       // Attracted to air (grounds it)
        [ELEMENT_TYPES.SHADOW]: 0.3,    // Mild attraction (buried things)
        [ELEMENT_TYPES.LIGHT]: 0.2      // Mild attraction (growth)
    },
    // AIR: disperses fire, carries water, erodes earth
    [ELEMENT_TYPES.AIR]: {
        [ELEMENT_TYPES.FIRE]: 0.4,      // Attracted to fire (fans flames)
        [ELEMENT_TYPES.WATER]: 0.5,     // Attracted to water (carries mist)
        [ELEMENT_TYPES.EARTH]: -0.4,    // Repelled by earth (grounded)
        [ELEMENT_TYPES.AIR]: 0.2,       // Weak same-type (disperses)
        [ELEMENT_TYPES.SHADOW]: -0.5,   // Repelled by shadow (heavy)
        [ELEMENT_TYPES.LIGHT]: 0.6      // Attracted to light (carries it)
    },
    // SHADOW: consumes light, weighs down air, fears light
    [ELEMENT_TYPES.SHADOW]: {
        [ELEMENT_TYPES.FIRE]: 0.3,      // Mild attraction (consumes heat)
        [ELEMENT_TYPES.WATER]: 0.4,     // Attracted to water (deep darkness)
        [ELEMENT_TYPES.EARTH]: 0.5,     // Attracted to earth (underground)
        [ELEMENT_TYPES.AIR]: 0.4,       // Attracted to air (weighs it down)
        [ELEMENT_TYPES.SHADOW]: 0.6,    // Strong same-type (gathering darkness)
        [ELEMENT_TYPES.LIGHT]: -0.8     // Strongly repelled by light (opposite)
    },
    // LIGHT: dispels shadow, warms all, rises above
    [ELEMENT_TYPES.LIGHT]: {
        [ELEMENT_TYPES.FIRE]: 0.5,      // Attracted to fire (similar energy)
        [ELEMENT_TYPES.WATER]: 0.3,     // Mild attraction (reflects)
        [ELEMENT_TYPES.EARTH]: 0.2,     // Weak attraction (illuminates)
        [ELEMENT_TYPES.AIR]: 0.5,       // Attracted to air (travels through)
        [ELEMENT_TYPES.SHADOW]: 0.7,    // Strongly attracted to shadow (dispels it)
        [ELEMENT_TYPES.LIGHT]: 0.4      // Same type - moderate attraction
    }
};

// Generate attraction matrix from elemental composition
function generateElementalMatrix(elements) {
    const types = elements.length;
    const matrix = [];

    for (let i = 0; i < types; i++) {
        matrix[i] = [];
        for (let j = 0; j < types; j++) {
            const elemA = elements[i];
            const elemB = elements[j];
            matrix[i][j] = TYPE_RELATIONSHIPS[elemA][elemB];
        }
    }

    return matrix;
}

// Creature type presets using elemental relationships
export const CREATURE_PRESETS = {
    shade: {
        name: 'Shade',
        particles: 120,
        radius: 0.9,
        types: 2,
        colors: [0x8888bb, 0xaaaadd],
        bubbleColor: 0x6666aa,
        bubbleOpacity: 0.15,
        // Shadow + Air - ethereal, floaty
        elements: [ELEMENT_TYPES.SHADOW, ELEMENT_TYPES.AIR],
        particleSize: 0.18,
        speed: 0.1
    },

    crimsonWraith: {
        name: 'Crimson Wraith',
        particles: 180,
        radius: 1.0,
        types: 3,
        colors: [0xff4444, 0xff7744, 0xffaa44],
        bubbleColor: 0xcc4444,
        bubbleOpacity: 0.12,
        // Fire + Fire + Light - aggressive, chaotic
        elements: [ELEMENT_TYPES.FIRE, ELEMENT_TYPES.FIRE, ELEMENT_TYPES.LIGHT],
        particleSize: 0.16,
        speed: 0.15
    },

    verdantSlime: {
        name: 'Verdant Slime',
        particles: 200,
        radius: 1.1,
        types: 2,
        colors: [0x44cc44, 0x88ee88],
        bubbleColor: 0x44aa44,
        bubbleOpacity: 0.2,
        // Earth + Earth - stable, blobby
        elements: [ELEMENT_TYPES.EARTH, ELEMENT_TYPES.EARTH],
        particleSize: 0.2,
        speed: 0.08
    },

    azurePhantom: {
        name: 'Azure Phantom',
        particles: 150,
        radius: 0.95,
        types: 4,
        colors: [0x4488ee, 0x66aaff, 0x88ccff, 0xaaddff],
        bubbleColor: 0x4488cc,
        bubbleOpacity: 0.1,
        // Water + Water + Air + Light - fluid, flowing
        elements: [ELEMENT_TYPES.WATER, ELEMENT_TYPES.WATER, ELEMENT_TYPES.AIR, ELEMENT_TYPES.LIGHT],
        particleSize: 0.14,
        speed: 0.12
    },

    chromaticGuardian: {
        name: 'Chromatic Guardian',
        particles: 350,
        radius: 1.8,
        types: 5,
        colors: [0xff4444, 0xffaa44, 0xffff44, 0x44ff88, 0x4488ff],
        bubbleColor: 0xffaa44,
        bubbleOpacity: 0.08,
        // Fire + Earth + Light + Water + Air - balanced elemental
        elements: [ELEMENT_TYPES.FIRE, ELEMENT_TYPES.EARTH, ELEMENT_TYPES.LIGHT, ELEMENT_TYPES.WATER, ELEMENT_TYPES.AIR],
        particleSize: 0.18,
        speed: 0.1
    },

    voidHarbinger: {
        name: 'Void Harbinger',
        particles: 400,
        radius: 2.2,
        types: 3,
        colors: [0x220033, 0x440066, 0x8800cc],
        bubbleColor: 0x330044,
        bubbleOpacity: 0.25,
        // Shadow + Shadow + Shadow - consuming darkness
        elements: [ELEMENT_TYPES.SHADOW, ELEMENT_TYPES.SHADOW, ELEMENT_TYPES.SHADOW],
        particleSize: 0.16,
        speed: 0.06
    }
};

// NPC blob presets (non-hostile, interactable)
export const NPC_PRESETS = {
    keeper: {
        name: 'Keeper',
        particles: 160,
        radius: 1.2,
        types: 3,
        colors: [0xddaa44, 0xeebb66, 0xffdd88],
        bubbleColor: 0xccaa44,
        bubbleOpacity: 0.12,
        // Light + Earth - stable, nurturing
        elements: [ELEMENT_TYPES.LIGHT, ELEMENT_TYPES.EARTH, ELEMENT_TYPES.LIGHT],
        particleSize: 0.16,
        speed: 0.04
    },

    wanderer: {
        name: 'Wanderer',
        particles: 100,
        radius: 0.7,
        types: 4,
        colors: [0x44aadd, 0x66ccee, 0x88ddff, 0xaaeeff],
        bubbleColor: 0x44aacc,
        bubbleOpacity: 0.1,
        // Air + Water - flowing, changeable
        elements: [ELEMENT_TYPES.AIR, ELEMENT_TYPES.WATER, ELEMENT_TYPES.AIR, ELEMENT_TYPES.WATER],
        particleSize: 0.12,
        speed: 0.14
    },

    fragment: {
        name: 'Fragment',
        particles: 40,
        radius: 0.35,
        types: 2,
        colors: [0xccddff, 0xeeeeff],
        bubbleColor: 0xaabbdd,
        bubbleOpacity: 0.18,
        // Light - pure, but fragmented
        elements: [ELEMENT_TYPES.LIGHT, ELEMENT_TYPES.LIGHT],
        particleSize: 0.1,
        speed: 0.1
    }
};

// Armor tier definitions
export const ARMOR_TIERS = {
    none: { particles: 0, opacity: 0, internalVisibility: 1.0, name: 'None' },
    light: { particles: 30, opacity: 0.2, internalVisibility: 0.8, name: 'Light Shell' },
    medium: { particles: 60, opacity: 0.5, internalVisibility: 0.5, name: 'Medium Shell' },
    heavy: { particles: 100, opacity: 0.75, internalVisibility: 0.25, name: 'Heavy Shell' }
};

// Player-specific preset for body blob (no essence) - user tuned
export const PLAYER_PRESET = {
    name: 'Player',
    particles: 70,
    radius: 0.8,
    types: 3,
    colors: [0x6688aa, 0x88aacc, 0xaaccee],
    bubbleColor: 0x6688aa,
    bubbleOpacity: 0.15,
    elements: [ELEMENT_TYPES.WATER, ELEMENT_TYPES.LIGHT, ELEMENT_TYPES.AIR],
    particleSize: 0.18,
    speed: 0.06
};

// Wand blob preset (essence only, smaller)
export const WAND_PRESET = {
    name: 'Wand Companion',
    particles: 60,
    radius: 0.35,
    types: 2,
    colors: [0xffffff, 0xeeeeff],
    bubbleColor: 0xaabbff,
    bubbleOpacity: 0.2,
    elements: [ELEMENT_TYPES.LIGHT, ELEMENT_TYPES.LIGHT],
    particleSize: 0.08,
    speed: 0.15
};

// Wand tier scaling (halved sizes)
export const WAND_TIERS = {
    starter: { radius: 0.15, particles: 30 },
    apprentice: { radius: 0.175, particles: 40 },
    journeyman: { radius: 0.2, particles: 50 },
    master: { radius: 0.25, particles: 60 },
    legendary: { radius: 0.3, particles: 80 }
};

export class ParticleLifeCreature {
    constructor(preset = 'shade', options = {}) {
        // Handle special preset names
        let baseConfig;
        if (preset === 'player') {
            baseConfig = { ...PLAYER_PRESET };
        } else if (preset === 'wandCompanion') {
            baseConfig = { ...WAND_PRESET };
        } else if (NPC_PRESETS[preset]) {
            baseConfig = { ...NPC_PRESETS[preset] };
        } else {
            baseConfig = { ...CREATURE_PRESETS[preset] };
        }

        const config = { ...baseConfig, ...options };

        this.particleCount = config.particles;
        this.radius = config.radius;
        this.types = config.types;
        this.colors = config.colors.map(c => new THREE.Color(c));
        this.particleSize = config.particleSize || 0.08;
        this.speed = config.speed || 1.0;
        this.bubbleColor = new THREE.Color(config.bubbleColor);
        this.bubbleOpacity = config.bubbleOpacity;
        this.elements = config.elements || null;

        // Disable options for body/wand separation
        this.disableVitality = config.disableVitality || false;
        this.disableEssence = config.disableEssence || false;
        this.disableArmor = config.disableArmor || false;

        // Generate attraction matrix from elements (Pokemon-style type effectiveness)
        if (config.elements) {
            this.attractions = generateElementalMatrix(config.elements);
        } else if (config.attractions) {
            this.attractions = config.attractions;
        } else {
            // Default: mild same-type attraction
            this.attractions = Array(this.types).fill(null).map(() =>
                Array(this.types).fill(0.3)
            );
        }

        // Particle data arrays (internal particles)
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        this.particleTypes = new Uint8Array(this.particleCount);
        this.particleColors = new Float32Array(this.particleCount * 3);
        this.particleSizes = new Float32Array(this.particleCount);

        // Armor shell system
        this.maxArmorParticles = 150; // Maximum possible armor particles
        this.armorCount = 0;          // Current armor particle count
        this.armorTier = 'none';
        this.armorPositions = new Float32Array(this.maxArmorParticles * 3);
        this.armorVelocities = new Float32Array(this.maxArmorParticles * 3);
        this.armorSizes = new Float32Array(this.maxArmorParticles);
        this.armorAlphas = new Float32Array(this.maxArmorParticles); // Per-particle alpha
        this.armorOrbitRadius = this.radius * 1.2; // Orbits outside bubble (user tuned)
        this.armorOrbitSpeed = 0.4;
        this.armorColor = new THREE.Color(0x888899); // Grey-silver

        // Armor damage tracking
        this.armorDamageParticles = []; // Particles flying off from damage

        // Vitality (health) system - red particles at core
        this.maxVitality = 100;           // Max health points
        this.vitality = this.maxVitality; // Current health
        this.maxVitalityParticles = 50;   // Max visual particles
        this.vitalityParticleCount = this.maxVitalityParticles;
        this.vitalityPositions = new Float32Array(this.maxVitalityParticles * 3);
        this.vitalityVelocities = new Float32Array(this.maxVitalityParticles * 3);
        this.vitalitySizes = new Float32Array(this.maxVitalityParticles);
        this.vitalityAlphas = new Float32Array(this.maxVitalityParticles);
        this.vitalityColor = new THREE.Color(0xff3333); // Bright red
        this.vitalityCoreRadius = this.radius * 0.65;   // Clustered at center (user tuned)
        this.vitalityRegenRate = 1;       // HP per second (slow passive regen)
        this.isAlive = true;
        this.onDeath = null;              // Callback when creature dies

        // Essence (mana) system - white particles orbiting between core and shell
        this.maxEssence = 100;            // Max mana points
        this.essence = this.maxEssence;   // Current mana
        this.maxEssenceParticles = 40;    // Max visual particles
        this.essenceParticleCount = this.maxEssenceParticles;
        this.essencePositions = new Float32Array(this.maxEssenceParticles * 3);
        this.essenceVelocities = new Float32Array(this.maxEssenceParticles * 3);
        this.essenceSizes = new Float32Array(this.maxEssenceParticles);
        this.essenceAlphas = new Float32Array(this.maxEssenceParticles);
        this.essenceColor = new THREE.Color(0xffffff); // Pure white
        this.essenceInnerRadius = this.radius * 0.4;   // Inner orbit boundary
        this.essenceOuterRadius = this.radius * 0.7;   // Outer orbit boundary
        this.essenceRegenRate = 5;        // Mana per second (fast regen)
        this.essenceOrbitSpeed = 0.5;     // Base orbit speed

        // Spatial grid for O(n) performance
        this.gridSize = 0.2;
        this.grid = new Map();

        // THREE.js objects
        this.group = new THREE.Group();
        this.bubbleMesh = null;
        this.particleMesh = null;
        this.armorMesh = null;
        this.damageParticleMesh = null;
        this.vitalityMesh = null;
        this.essenceMesh = null;
        this.time = 0;

        // Formation controllers (Living Arsenal system)
        this.formationControllers = null;

        // Bubble physics system
        this.physics = new BubblePhysics();
        this.lastPosition = new THREE.Vector3();

        this.initParticles();
        this.createBubble();
        this.createParticleSystem();

        // Conditionally create systems based on disable flags
        if (!this.disableArmor) {
            this.createArmorSystem();
        }
        if (!this.disableVitality) {
            this.createVitalitySystem();
        }
        if (!this.disableEssence) {
            this.createEssenceSystem();
        }
    }

    initParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            // Random position inside sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.random() * this.radius * 0.7;

            this.positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            this.positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            this.positions[i * 3 + 2] = r * Math.cos(phi);

            // Random initial velocity
            this.velocities[i * 3] = (Math.random() - 0.5) * 0.1;
            this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
            this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

            // Assign type (color group)
            const type = Math.floor(Math.random() * this.types);
            this.particleTypes[i] = type;

            // Set color from type
            const color = this.colors[type];
            this.particleColors[i * 3] = color.r;
            this.particleColors[i * 3 + 1] = color.g;
            this.particleColors[i * 3 + 2] = color.b;

            // Slight size variation
            this.particleSizes[i] = this.particleSize * (0.8 + Math.random() * 0.4);
        }
    }

    createBubble() {
        const geometry = new THREE.SphereGeometry(this.radius, 32, 24);

        // Get shader code with deformation support
        const shaderCode = createBubbleShaderCode();

        const material = new THREE.ShaderMaterial({
            uniforms: getDefaultBubbleUniforms(this.bubbleColor, this.bubbleOpacity),
            vertexShader: shaderCode.vertexShader,
            fragmentShader: shaderCode.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.bubbleMesh = new THREE.Mesh(geometry, material);
        this.group.add(this.bubbleMesh);
    }

    createParticleSystem() {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(this.particleSizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: window.devicePixelRatio },
                uSoftness: { value: 0.3 },  // 0 = sharp, 1 = very blurry
                uGlow: { value: 0.8 }       // Core glow intensity
            },
            vertexShader: `
                attribute vec3 color;
                attribute float size;

                uniform float uPixelRatio;

                varying vec3 vColor;
                varying float vSize;

                void main() {
                    vColor = color;
                    vSize = size;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uSoftness;
                uniform float uGlow;

                varying vec3 vColor;
                varying float vSize;

                void main() {
                    // Distance from center of point (0 at center, 1 at edge)
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center) * 2.0;

                    // Sharp circle cutoff - discard pixels outside radius
                    float radius = 0.8;  // Slightly smaller than full point
                    if (dist > radius) discard;

                    // Softness controls edge blur (0 = hard edge, 1 = full gradient)
                    float edgeWidth = uSoftness * radius;
                    float edgeStart = radius - edgeWidth;
                    float alpha = 1.0 - smoothstep(edgeStart, radius, dist);

                    // Core glow (uGlow controls brightness boost at center)
                    float coreSize = 0.3;
                    float core = 1.0 - smoothstep(0.0, coreSize, dist);
                    vec3 finalColor = vColor * (1.0 + core * uGlow);

                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleMesh = new THREE.Points(geometry, material);
        this.particleMaterial = material;  // Store reference for tuning
        this.group.add(this.particleMesh);
    }

    createArmorSystem() {
        // Initialize armor particle positions (distributed on sphere shell)
        for (let i = 0; i < this.maxArmorParticles; i++) {
            // Distribute evenly on sphere using fibonacci spiral
            const phi = Math.acos(1 - 2 * (i + 0.5) / this.maxArmorParticles);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            this.armorPositions[i * 3] = this.armorOrbitRadius * Math.sin(phi) * Math.cos(theta);
            this.armorPositions[i * 3 + 1] = this.armorOrbitRadius * Math.sin(phi) * Math.sin(theta);
            this.armorPositions[i * 3 + 2] = this.armorOrbitRadius * Math.cos(phi);

            // Orbital velocity (tangent to sphere surface)
            const tangentX = -Math.sin(theta);
            const tangentY = Math.cos(theta);
            this.armorVelocities[i * 3] = tangentX * this.armorOrbitSpeed;
            this.armorVelocities[i * 3 + 1] = tangentY * this.armorOrbitSpeed;
            this.armorVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

            // Size variation
            this.armorSizes[i] = 0.12 * (0.8 + Math.random() * 0.4);

            // Alpha (will be set based on armor tier)
            this.armorAlphas[i] = 0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.armorPositions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(this.armorSizes, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(this.armorAlphas, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: this.armorColor },
                uPixelRatio: { value: window.devicePixelRatio },
                uArmorOpacity: { value: 0 },
                uSoftness: { value: 0.4 },  // 0 = sharp, 1 = very blurry
                uGlow: { value: 0.3 }       // Sheen intensity
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;

                uniform float uPixelRatio;

                varying float vAlpha;

                void main() {
                    vAlpha = alpha;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uArmorOpacity;
                uniform float uTime;
                uniform float uSoftness;
                uniform float uGlow;

                varying float vAlpha;

                void main() {
                    if (vAlpha < 0.01) discard;

                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center) * 2.0;

                    // Sharp circle cutoff
                    float radius = 0.8;
                    if (dist > radius) discard;

                    // Softness controls edge blur (0 = hard edge)
                    float edgeWidth = uSoftness * radius;
                    float edgeStart = radius - edgeWidth;
                    float alpha = 1.0 - smoothstep(edgeStart, radius, dist);

                    // Metallic sheen at center (uGlow controls intensity)
                    float sheenSize = 0.3;
                    float sheen = 1.0 - smoothstep(0.0, sheenSize, dist);
                    vec3 color = uColor + vec3(sheen * uGlow);

                    // Subtle shimmer
                    float shimmer = sin(gl_FragCoord.x * 0.1 + gl_FragCoord.y * 0.1 + uTime * 2.0) * 0.1 + 0.9;

                    alpha = alpha * vAlpha * uArmorOpacity * shimmer;

                    if (alpha < 0.01) discard;

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false
        });

        this.armorMesh = new THREE.Points(geometry, material);
        this.armorMaterial = material;  // Store reference for tuning
        this.group.add(this.armorMesh);

        // Create damage particle system (particles flying off)
        this.createDamageParticleSystem();
    }

    createDamageParticleSystem() {
        // Pool of particles for damage effects
        const maxDamageParticles = 50;
        this.damageParticlePositions = new Float32Array(maxDamageParticles * 3);
        this.damageParticleVelocities = new Float32Array(maxDamageParticles * 3);
        this.damageParticleLifetimes = new Float32Array(maxDamageParticles);
        this.damageParticleAlphas = new Float32Array(maxDamageParticles);
        this.damageParticleSizes = new Float32Array(maxDamageParticles);
        this.maxDamageParticles = maxDamageParticles;
        this.activeDamageParticles = 0;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.damageParticlePositions, 3));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(this.damageParticleAlphas, 1));
        geometry.setAttribute('size', new THREE.BufferAttribute(this.damageParticleSizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: this.armorColor },
                uPixelRatio: { value: window.devicePixelRatio }
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;

                uniform float uPixelRatio;

                varying float vAlpha;

                void main() {
                    vAlpha = alpha;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
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
                    float alpha = (1.0 - smoothstep(0.5, 1.0, dist)) * vAlpha;

                    if (alpha < 0.01) discard;

                    // Fading to darker as particle flies away
                    vec3 color = uColor * (0.5 + vAlpha * 0.5);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false
        });

        this.damageParticleMesh = new THREE.Points(geometry, material);
        this.group.add(this.damageParticleMesh);
    }

    createVitalitySystem() {
        // Initialize vitality particles at core with gentle motion
        for (let i = 0; i < this.maxVitalityParticles; i++) {
            // Random position in small sphere at center
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.random() * this.vitalityCoreRadius;

            this.vitalityPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            this.vitalityPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            this.vitalityPositions[i * 3 + 2] = r * Math.cos(phi);

            // Gentle random drift velocity (user tuned: 0.4)
            this.vitalityVelocities[i * 3] = (Math.random() - 0.5) * 0.4;
            this.vitalityVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
            this.vitalityVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

            // Size variation - slightly larger than elemental particles
            this.vitalitySizes[i] = 0.15 * (0.8 + Math.random() * 0.4);

            // All visible initially
            this.vitalityAlphas[i] = 1.0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.vitalityPositions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(this.vitalitySizes, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(this.vitalityAlphas, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: this.vitalityColor },
                uPixelRatio: { value: window.devicePixelRatio },
                uHealthPercent: { value: 1.0 },
                uSoftness: { value: 0.4 },  // 0 = sharp, 1 = very blurry
                uGlow: { value: 0.5 }       // Core glow intensity
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;

                uniform float uPixelRatio;
                uniform float uHealthPercent;

                varying float vAlpha;
                varying float vHealth;

                void main() {
                    vAlpha = alpha;
                    vHealth = uHealthPercent;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uTime;
                uniform float uSoftness;
                uniform float uGlow;

                varying float vAlpha;
                varying float vHealth;

                void main() {
                    if (vAlpha < 0.01) discard;

                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center) * 2.0;

                    // Sharp circle cutoff
                    float radius = 0.8;
                    if (dist > radius) discard;

                    // Softness controls edge blur (0 = hard edge)
                    float edgeWidth = uSoftness * radius;
                    float edgeStart = radius - edgeWidth;
                    float alpha = 1.0 - smoothstep(edgeStart, radius, dist);

                    // Pulsing effect based on health
                    float pulse = 0.8 + 0.2 * sin(uTime * 3.0 + gl_FragCoord.x * 0.02);

                    // Color intensity based on health
                    vec3 color = uColor * (0.7 + vHealth * 0.3);

                    // Core glow (uGlow controls brightness at center)
                    float coreSize = 0.3;
                    float core = 1.0 - smoothstep(0.0, coreSize, dist);
                    color = color * (1.0 + core * uGlow) * pulse;

                    alpha = alpha * vAlpha * (0.6 + vHealth * 0.4);

                    if (alpha < 0.01) discard;

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.vitalityMesh = new THREE.Points(geometry, material);
        this.vitalityMaterial = material;  // Store reference for tuning
        this.group.add(this.vitalityMesh);
    }

    // Update vitality particle positions (gentle core drift)
    updateVitality(delta) {
        if (!this.isAlive) return;

        // Passive regeneration
        if (this.vitality < this.maxVitality) {
            this.vitality = Math.min(this.maxVitality, this.vitality + this.vitalityRegenRate * delta);
            this.updateVitalityVisuals();
        }

        // Update particle positions with gentle drift
        for (let i = 0; i < this.vitalityParticleCount; i++) {
            const i3 = i * 3;

            // Get position
            let px = this.vitalityPositions[i3];
            let py = this.vitalityPositions[i3 + 1];
            let pz = this.vitalityPositions[i3 + 2];

            // Apply velocity
            px += this.vitalityVelocities[i3] * delta;
            py += this.vitalityVelocities[i3 + 1] * delta;
            pz += this.vitalityVelocities[i3 + 2] * delta;

            // Keep within core radius
            const dist = Math.sqrt(px * px + py * py + pz * pz);
            if (dist > this.vitalityCoreRadius) {
                // Bounce back toward center
                const bounce = 0.5;
                this.vitalityVelocities[i3] = -this.vitalityVelocities[i3] * bounce + (Math.random() - 0.5) * 0.05;
                this.vitalityVelocities[i3 + 1] = -this.vitalityVelocities[i3 + 1] * bounce + (Math.random() - 0.5) * 0.05;
                this.vitalityVelocities[i3 + 2] = -this.vitalityVelocities[i3 + 2] * bounce + (Math.random() - 0.5) * 0.05;

                // Clamp to core radius
                px = (px / dist) * this.vitalityCoreRadius * 0.95;
                py = (py / dist) * this.vitalityCoreRadius * 0.95;
                pz = (pz / dist) * this.vitalityCoreRadius * 0.95;
            }

            // Add gentle random drift
            this.vitalityVelocities[i3] += (Math.random() - 0.5) * 0.02 * delta;
            this.vitalityVelocities[i3 + 1] += (Math.random() - 0.5) * 0.02 * delta;
            this.vitalityVelocities[i3 + 2] += (Math.random() - 0.5) * 0.02 * delta;

            // Damping
            this.vitalityVelocities[i3] *= 0.98;
            this.vitalityVelocities[i3 + 1] *= 0.98;
            this.vitalityVelocities[i3 + 2] *= 0.98;

            this.vitalityPositions[i3] = px;
            this.vitalityPositions[i3 + 1] = py;
            this.vitalityPositions[i3 + 2] = pz;
        }

        this.vitalityMesh.geometry.attributes.position.needsUpdate = true;
        this.vitalityMesh.material.uniforms.uTime.value = this.time;
        this.vitalityMesh.material.uniforms.uHealthPercent.value = this.vitality / this.maxVitality;
    }

    // Update visual representation based on current vitality
    updateVitalityVisuals() {
        const healthPercent = this.vitality / this.maxVitality;

        // Number of visible particles scales with health
        this.vitalityParticleCount = Math.ceil(this.maxVitalityParticles * healthPercent);

        // Update alphas - active particles visible, others hidden
        for (let i = 0; i < this.maxVitalityParticles; i++) {
            this.vitalityAlphas[i] = i < this.vitalityParticleCount ? 1.0 : 0.0;
        }
        this.vitalityMesh.geometry.attributes.alpha.needsUpdate = true;
    }

    // Set vitality directly
    setVitality(amount) {
        this.vitality = Math.max(0, Math.min(amount, this.maxVitality));
        this.updateVitalityVisuals();

        if (this.vitality <= 0 && this.isAlive) {
            this.die();
        }
    }

    // Heal the creature
    heal(amount) {
        if (!this.isAlive) return;

        const oldVitality = this.vitality;
        this.vitality = Math.min(this.maxVitality, this.vitality + amount);
        this.updateVitalityVisuals();

        const healed = this.vitality - oldVitality;
        console.log(`Healed ${healed} HP. Vitality: ${this.vitality}/${this.maxVitality}`);
        return healed;
    }

    // Get vitality info
    getVitalityInfo() {
        return {
            current: Math.round(this.vitality),
            max: this.maxVitality,
            percentage: this.vitality / this.maxVitality,
            particles: this.vitalityParticleCount,
            isAlive: this.isAlive
        };
    }

    // Creature death
    die() {
        if (!this.isAlive) return;

        this.isAlive = false;
        this.vitality = 0;
        console.log('Creature died!');

        // Trigger death effect - all particles scatter outward
        this.triggerDeathEffect();

        // Call death callback if set
        if (this.onDeath) {
            this.onDeath(this);
        }
    }

    // Death effect - scatter all particles
    triggerDeathEffect() {
        // Scatter vitality particles outward (if enabled)
        if (!this.disableVitality && this.vitalityPositions) {
            for (let i = 0; i < this.maxVitalityParticles; i++) {
                const i3 = i * 3;
                const px = this.vitalityPositions[i3];
                const py = this.vitalityPositions[i3 + 1];
                const pz = this.vitalityPositions[i3 + 2];
                const dist = Math.sqrt(px * px + py * py + pz * pz) || 0.1;

                // Explode outward
                this.vitalityVelocities[i3] = (px / dist) * 3 + (Math.random() - 0.5);
                this.vitalityVelocities[i3 + 1] = (py / dist) * 3 + Math.random() * 2;
                this.vitalityVelocities[i3 + 2] = (pz / dist) * 3 + (Math.random() - 0.5);

                // All visible for death animation
                this.vitalityAlphas[i] = 1.0;
            }
            this.vitalityParticleCount = this.maxVitalityParticles;
            this.vitalityMesh.geometry.attributes.alpha.needsUpdate = true;
        }

        // Also scatter elemental particles
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            const px = this.positions[i3];
            const py = this.positions[i3 + 1];
            const pz = this.positions[i3 + 2];
            const dist = Math.sqrt(px * px + py * py + pz * pz) || 0.1;

            this.velocities[i3] = (px / dist) * 2 + (Math.random() - 0.5);
            this.velocities[i3 + 1] = (py / dist) * 2 + Math.random() * 1.5;
            this.velocities[i3 + 2] = (pz / dist) * 2 + (Math.random() - 0.5);
        }

        // Make bubble pop (fade out)
        this.bubbleMesh.material.uniforms.uOpacity.value = 0.05;

        // Scatter essence particles too (if enabled)
        if (!this.disableEssence && this.essencePositions) {
            for (let i = 0; i < this.maxEssenceParticles; i++) {
                const i3 = i * 3;
                const px = this.essencePositions[i3];
                const py = this.essencePositions[i3 + 1];
                const pz = this.essencePositions[i3 + 2];
                const dist = Math.sqrt(px * px + py * py + pz * pz) || 0.1;

                this.essenceVelocities[i3] = (px / dist) * 2.5 + (Math.random() - 0.5);
                this.essenceVelocities[i3 + 1] = (py / dist) * 2.5 + Math.random() * 1.5;
                this.essenceVelocities[i3 + 2] = (pz / dist) * 2.5 + (Math.random() - 0.5);

                this.essenceAlphas[i] = 1.0;
            }
            this.essenceParticleCount = this.maxEssenceParticles;
            this.essenceMesh.geometry.attributes.alpha.needsUpdate = true;
        }
    }

    createEssenceSystem() {
        // Initialize essence particles in orbital shell between core and outer
        for (let i = 0; i < this.maxEssenceParticles; i++) {
            // Random position in orbital shell
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = this.essenceInnerRadius + Math.random() * (this.essenceOuterRadius - this.essenceInnerRadius);

            this.essencePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            this.essencePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            this.essencePositions[i * 3 + 2] = r * Math.cos(phi);

            // Orbital velocity (tangent to sphere)
            const tangentX = -Math.sin(theta);
            const tangentZ = Math.cos(theta);
            const speed = this.essenceOrbitSpeed * (0.7 + Math.random() * 0.6);
            this.essenceVelocities[i * 3] = tangentX * speed;
            this.essenceVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
            this.essenceVelocities[i * 3 + 2] = tangentZ * speed;

            // Size - slightly smaller, more ethereal
            this.essenceSizes[i] = 0.1 * (0.8 + Math.random() * 0.4);

            // All visible initially
            this.essenceAlphas[i] = 1.0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.essencePositions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(this.essenceSizes, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(this.essenceAlphas, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: this.essenceColor },
                uPixelRatio: { value: window.devicePixelRatio },
                uEssencePercent: { value: 1.0 },
                uSoftness: { value: 0.0 },  // 0 = sharp, 1 = very blurry
                uGlow: { value: 0.0 }       // Core glow intensity
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;

                uniform float uPixelRatio;
                uniform float uEssencePercent;
                uniform float uTime;

                varying float vAlpha;
                varying float vEssence;

                void main() {
                    vAlpha = alpha;
                    vEssence = uEssencePercent;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uTime;
                uniform float uEssencePercent;
                uniform float uSoftness;
                uniform float uGlow;

                varying float vAlpha;
                varying float vEssence;

                void main() {
                    if (vAlpha < 0.01) discard;

                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center) * 2.0;

                    // Sharp circle cutoff
                    float radius = 0.8;
                    if (dist > radius) discard;

                    // Softness controls edge blur (0 = hard edge)
                    float edgeWidth = uSoftness * radius;
                    float edgeStart = radius - edgeWidth;
                    float alpha = 1.0 - smoothstep(edgeStart, radius, dist);

                    // Twinkling effect
                    float twinkle = 0.7 + 0.3 * sin(uTime * 5.0 + gl_FragCoord.x * 0.05 + gl_FragCoord.y * 0.03);

                    // Color with slight blue tint when low on essence
                    vec3 color = uColor;
                    if (vEssence < 0.3) {
                        color = mix(vec3(0.6, 0.7, 1.0), uColor, vEssence / 0.3);
                    }

                    // Core glow (uGlow controls brightness at center)
                    float coreSize = 0.3;
                    float core = 1.0 - smoothstep(0.0, coreSize, dist);
                    color = color * (1.0 + core * uGlow) * twinkle;

                    alpha = alpha * vAlpha * (0.5 + vEssence * 0.5);

                    if (alpha < 0.01) discard;

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.essenceMesh = new THREE.Points(geometry, material);
        this.essenceMaterial = material;  // Store reference for tuning
        this.group.add(this.essenceMesh);
    }

    // Update essence particle positions (orbital motion)
    updateEssence(delta) {
        if (!this.isAlive) return;

        // Fast regeneration
        if (this.essence < this.maxEssence) {
            this.essence = Math.min(this.maxEssence, this.essence + this.essenceRegenRate * delta);
            this.updateEssenceVisuals();
        }

        // Update particle positions with orbital motion
        for (let i = 0; i < this.essenceParticleCount; i++) {
            const i3 = i * 3;

            let px = this.essencePositions[i3];
            let py = this.essencePositions[i3 + 1];
            let pz = this.essencePositions[i3 + 2];

            // Apply velocity
            px += this.essenceVelocities[i3] * delta;
            py += this.essenceVelocities[i3 + 1] * delta;
            pz += this.essenceVelocities[i3 + 2] * delta;

            // Calculate distance from center
            const dist = Math.sqrt(px * px + py * py + pz * pz);

            // Keep within orbital shell
            if (dist < this.essenceInnerRadius || dist > this.essenceOuterRadius) {
                // Calculate normal
                const nx = px / dist;
                const ny = py / dist;
                const nz = pz / dist;

                // Bounce back into shell
                if (dist < this.essenceInnerRadius) {
                    // Push outward
                    const targetR = this.essenceInnerRadius + 0.05;
                    px = nx * targetR;
                    py = ny * targetR;
                    pz = nz * targetR;
                } else {
                    // Push inward
                    const targetR = this.essenceOuterRadius - 0.05;
                    px = nx * targetR;
                    py = ny * targetR;
                    pz = nz * targetR;
                }

                // Reverse radial component of velocity
                const radialSpeed = this.essenceVelocities[i3] * nx +
                                   this.essenceVelocities[i3 + 1] * ny +
                                   this.essenceVelocities[i3 + 2] * nz;
                this.essenceVelocities[i3] -= 2 * radialSpeed * nx;
                this.essenceVelocities[i3 + 1] -= 2 * radialSpeed * ny;
                this.essenceVelocities[i3 + 2] -= 2 * radialSpeed * nz;
            }

            // Add slight orbital acceleration (tangent force)
            if (dist > 0.01) {
                const nx = px / dist;
                const ny = py / dist;
                const nz = pz / dist;

                // Cross with up vector for tangent
                const tx = ny;
                const tz = -nx;
                const tLen = Math.sqrt(tx * tx + tz * tz);

                if (tLen > 0.01) {
                    const accel = 0.1 * delta;
                    this.essenceVelocities[i3] += (tx / tLen) * accel;
                    this.essenceVelocities[i3 + 2] += (tz / tLen) * accel;
                }
            }

            // Gentle damping
            this.essenceVelocities[i3] *= 0.995;
            this.essenceVelocities[i3 + 1] *= 0.99;
            this.essenceVelocities[i3 + 2] *= 0.995;

            // Vertical drift toward equator
            this.essenceVelocities[i3 + 1] -= py * 0.1 * delta;

            this.essencePositions[i3] = px;
            this.essencePositions[i3 + 1] = py;
            this.essencePositions[i3 + 2] = pz;
        }

        this.essenceMesh.geometry.attributes.position.needsUpdate = true;
        this.essenceMesh.material.uniforms.uTime.value = this.time;
        this.essenceMesh.material.uniforms.uEssencePercent.value = this.essence / this.maxEssence;
    }

    // Update visual representation based on current essence
    updateEssenceVisuals() {
        const essencePercent = this.essence / this.maxEssence;

        // Number of visible particles scales with essence
        this.essenceParticleCount = Math.ceil(this.maxEssenceParticles * essencePercent);

        // Update alphas
        for (let i = 0; i < this.maxEssenceParticles; i++) {
            this.essenceAlphas[i] = i < this.essenceParticleCount ? 1.0 : 0.0;
        }
        this.essenceMesh.geometry.attributes.alpha.needsUpdate = true;
    }

    // Set essence directly
    setEssence(amount) {
        this.essence = Math.max(0, Math.min(amount, this.maxEssence));
        this.updateEssenceVisuals();
    }

    // Spend essence (for casting spells)
    spendEssence(amount) {
        if (this.essence < amount) {
            return false; // Not enough essence
        }
        this.essence -= amount;
        this.updateEssenceVisuals();
        return true;
    }

    // Check if has enough essence
    hasEssence(amount) {
        return this.essence >= amount;
    }

    // Get essence info
    getEssenceInfo() {
        return {
            current: Math.round(this.essence),
            max: this.maxEssence,
            percentage: this.essence / this.maxEssence,
            particles: this.essenceParticleCount,
            regenRate: this.essenceRegenRate
        };
    }

    // Set armor tier (none, light, medium, heavy)
    setArmorTier(tierName) {
        const tier = ARMOR_TIERS[tierName];
        if (!tier) {
            console.warn(`Unknown armor tier: ${tierName}`);
            return;
        }

        this.armorTier = tierName;
        this.armorCount = tier.particles;

        // Update armor particle alphas (active particles are visible)
        for (let i = 0; i < this.maxArmorParticles; i++) {
            this.armorAlphas[i] = i < this.armorCount ? 1.0 : 0.0;
        }
        this.armorMesh.geometry.attributes.alpha.needsUpdate = true;

        // Update armor opacity uniform
        this.armorMesh.material.uniforms.uArmorOpacity.value = tier.opacity;

        // Update internal particle visibility based on armor
        this.updateInternalVisibility(tier.internalVisibility);

        console.log(`Armor set to ${tier.name}: ${this.armorCount} particles`);
    }

    // Set specific armor particle count
    setArmorCount(count) {
        this.armorCount = Math.max(0, Math.min(count, this.maxArmorParticles));

        // Determine tier based on count
        if (this.armorCount === 0) {
            this.armorTier = 'none';
        } else if (this.armorCount <= 30) {
            this.armorTier = 'light';
        } else if (this.armorCount <= 60) {
            this.armorTier = 'medium';
        } else {
            this.armorTier = 'heavy';
        }

        const tier = ARMOR_TIERS[this.armorTier];

        // Update alphas
        for (let i = 0; i < this.maxArmorParticles; i++) {
            this.armorAlphas[i] = i < this.armorCount ? 1.0 : 0.0;
        }
        this.armorMesh.geometry.attributes.alpha.needsUpdate = true;

        // Update opacity based on current tier
        this.armorMesh.material.uniforms.uArmorOpacity.value = tier.opacity;
        this.updateInternalVisibility(tier.internalVisibility);
    }

    // Update internal particle visibility (affected by armor density)
    updateInternalVisibility(visibility) {
        // Dim internal particles when armor is heavy
        // This is done by adjusting the particle material
        // For now, we'll store this value and use it in rendering
        this.internalVisibility = visibility;

        // Could also adjust the internal particle opacity
        // this.particleMesh.material.uniforms.uOpacity.value = visibility;
    }

    // Get current armor info
    getArmorInfo() {
        const tier = ARMOR_TIERS[this.armorTier];
        return {
            tier: this.armorTier,
            tierName: tier.name,
            current: this.armorCount,
            max: this.maxArmorParticles,
            percentage: this.armorCount / this.maxArmorParticles
        };
    }

    // Take damage - removes armor particles first, then vitality
    takeDamage(amount) {
        if (!this.isAlive) return { absorbed: 0, vitalityDamage: 0, died: false };

        let remainingDamage = amount;
        let armorAbsorbed = 0;
        let vitalityDamage = 0;

        // Armor absorbs first (if enabled)
        if (!this.disableArmor && this.armorCount > 0) {
            const particleDamage = Math.ceil(remainingDamage / 2);
            armorAbsorbed = Math.min(particleDamage, this.armorCount);
            this.armorCount -= armorAbsorbed;

            // Spawn flying particles for visual feedback
            this.spawnDamageParticles(armorAbsorbed);

            // Update armor alphas
            for (let i = 0; i < this.maxArmorParticles; i++) {
                this.armorAlphas[i] = i < this.armorCount ? 1.0 : 0.0;
            }
            this.armorMesh.geometry.attributes.alpha.needsUpdate = true;

            // Update tier based on remaining armor
            this.setArmorCount(this.armorCount);

            // Calculate overflow damage
            remainingDamage = (particleDamage - armorAbsorbed) * 2;
        }

        // Remaining damage goes to vitality (if enabled)
        if (remainingDamage > 0 && !this.disableVitality) {
            vitalityDamage = remainingDamage;
            this.vitality = Math.max(0, this.vitality - vitalityDamage);
            this.updateVitalityVisuals();

            // Spawn red damage particles from core
            this.spawnVitalityDamageParticles(Math.ceil(vitalityDamage / 5));

            // Check for death
            if (this.vitality <= 0) {
                this.die();
            }
        }

        return {
            absorbed: armorAbsorbed * 2,
            vitalityDamage: vitalityDamage,
            died: !this.isAlive
        };
    }

    // Spawn red particles flying off when vitality is damaged
    spawnVitalityDamageParticles(count) {
        // Skip if armor system is disabled (no damage particle mesh)
        if (this.disableArmor || !this.damageParticleMesh) return;

        // Reuse damage particle system but with different origin
        for (let i = 0; i < count && this.activeDamageParticles < this.maxDamageParticles; i++) {
            const idx = this.activeDamageParticles;
            const idx3 = idx * 3;

            // Start near the core
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = this.vitalityCoreRadius * 0.5;

            this.damageParticlePositions[idx3] = r * Math.sin(phi) * Math.cos(theta);
            this.damageParticlePositions[idx3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            this.damageParticlePositions[idx3 + 2] = r * Math.cos(phi);

            // Fly outward
            const speed = 1.5 + Math.random() * 2;
            this.damageParticleVelocities[idx3] = (this.damageParticlePositions[idx3] / r) * speed;
            this.damageParticleVelocities[idx3 + 1] = (this.damageParticlePositions[idx3 + 1] / r) * speed + Math.random();
            this.damageParticleVelocities[idx3 + 2] = (this.damageParticlePositions[idx3 + 2] / r) * speed;

            this.damageParticleLifetimes[idx] = 0.8;
            this.damageParticleAlphas[idx] = 1.0;
            this.damageParticleSizes[idx] = 0.12 * (0.7 + Math.random() * 0.6);

            this.activeDamageParticles++;
        }

        // Temporarily change damage particle color to red for this burst
        // (In a full implementation, we'd have separate systems or per-particle colors)

        this.damageParticleMesh.geometry.attributes.position.needsUpdate = true;
        this.damageParticleMesh.geometry.attributes.alpha.needsUpdate = true;
        this.damageParticleMesh.geometry.attributes.size.needsUpdate = true;
    }

    // Spawn particles flying off from damage
    spawnDamageParticles(count) {
        // Skip if armor system is disabled
        if (this.disableArmor || !this.damageParticleMesh) return;

        for (let i = 0; i < count && this.activeDamageParticles < this.maxDamageParticles; i++) {
            const idx = this.activeDamageParticles;
            const idx3 = idx * 3;

            // Start at a random point on the armor shell
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            this.damageParticlePositions[idx3] = this.armorOrbitRadius * Math.sin(phi) * Math.cos(theta);
            this.damageParticlePositions[idx3 + 1] = this.armorOrbitRadius * Math.sin(phi) * Math.sin(theta);
            this.damageParticlePositions[idx3 + 2] = this.armorOrbitRadius * Math.cos(phi);

            // Fly outward with some randomness
            const speed = 2 + Math.random() * 3;
            this.damageParticleVelocities[idx3] = (this.damageParticlePositions[idx3] / this.armorOrbitRadius) * speed;
            this.damageParticleVelocities[idx3 + 1] = (this.damageParticlePositions[idx3 + 1] / this.armorOrbitRadius) * speed + Math.random() * 2;
            this.damageParticleVelocities[idx3 + 2] = (this.damageParticlePositions[idx3 + 2] / this.armorOrbitRadius) * speed;

            this.damageParticleLifetimes[idx] = 1.0; // 1 second lifetime
            this.damageParticleAlphas[idx] = 1.0;
            this.damageParticleSizes[idx] = 0.15 * (0.7 + Math.random() * 0.6);

            this.activeDamageParticles++;
        }

        this.damageParticleMesh.geometry.attributes.position.needsUpdate = true;
        this.damageParticleMesh.geometry.attributes.alpha.needsUpdate = true;
        this.damageParticleMesh.geometry.attributes.size.needsUpdate = true;
    }

    // Update armor particle orbits
    updateArmor(delta) {
        if (this.armorCount === 0) return;

        for (let i = 0; i < this.armorCount; i++) {
            const i3 = i * 3;

            // Get current position
            let px = this.armorPositions[i3];
            let py = this.armorPositions[i3 + 1];
            let pz = this.armorPositions[i3 + 2];

            // Calculate tangent for orbital motion
            const dist = Math.sqrt(px * px + py * py + pz * pz);
            if (dist < 0.001) continue;

            // Normalize to sphere surface
            const nx = px / dist;
            const ny = py / dist;
            const nz = pz / dist;

            // Cross product with up vector for tangent
            let tx = ny * 1 - nz * 0;
            let ty = nz * 0 - nx * 1;
            let tz = nx * 0 - ny * 0;

            // Normalize tangent
            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen > 0.001) {
                tx /= tLen;
                ty /= tLen;
                tz /= tLen;
            }

            // Apply orbital velocity
            const orbitSpeed = this.armorOrbitSpeed * (0.8 + Math.sin(i * 0.5) * 0.4);
            px += tx * orbitSpeed * delta;
            py += ty * orbitSpeed * delta;
            pz += tz * orbitSpeed * delta;

            // Add some wobble
            const wobble = Math.sin(this.time * 2 + i * 0.7) * 0.02;
            px += nx * wobble;
            py += ny * wobble;
            pz += nz * wobble;

            // Project back to orbit radius
            const newDist = Math.sqrt(px * px + py * py + pz * pz);
            if (newDist > 0.001) {
                this.armorPositions[i3] = (px / newDist) * this.armorOrbitRadius;
                this.armorPositions[i3 + 1] = (py / newDist) * this.armorOrbitRadius;
                this.armorPositions[i3 + 2] = (pz / newDist) * this.armorOrbitRadius;
            }
        }

        this.armorMesh.geometry.attributes.position.needsUpdate = true;
        this.armorMesh.material.uniforms.uTime.value = this.time;
    }

    // Update damage particles (flying off)
    updateDamageParticles(delta) {
        if (this.activeDamageParticles === 0) return;

        let newActiveCount = 0;

        for (let i = 0; i < this.activeDamageParticles; i++) {
            const i3 = i * 3;

            // Update lifetime
            this.damageParticleLifetimes[i] -= delta;

            if (this.damageParticleLifetimes[i] <= 0) {
                // Particle expired, skip
                this.damageParticleAlphas[i] = 0;
                continue;
            }

            // Move particle
            this.damageParticlePositions[i3] += this.damageParticleVelocities[i3] * delta;
            this.damageParticlePositions[i3 + 1] += this.damageParticleVelocities[i3 + 1] * delta;
            this.damageParticlePositions[i3 + 2] += this.damageParticleVelocities[i3 + 2] * delta;

            // Apply gravity
            this.damageParticleVelocities[i3 + 1] -= 5 * delta;

            // Fade out
            this.damageParticleAlphas[i] = this.damageParticleLifetimes[i];

            // Compact active particles to front
            if (i !== newActiveCount) {
                // Swap with first inactive slot
                for (let j = 0; j < 3; j++) {
                    this.damageParticlePositions[newActiveCount * 3 + j] = this.damageParticlePositions[i3 + j];
                    this.damageParticleVelocities[newActiveCount * 3 + j] = this.damageParticleVelocities[i3 + j];
                }
                this.damageParticleLifetimes[newActiveCount] = this.damageParticleLifetimes[i];
                this.damageParticleAlphas[newActiveCount] = this.damageParticleAlphas[i];
                this.damageParticleSizes[newActiveCount] = this.damageParticleSizes[i];
            }
            newActiveCount++;
        }

        this.activeDamageParticles = newActiveCount;

        this.damageParticleMesh.geometry.attributes.position.needsUpdate = true;
        this.damageParticleMesh.geometry.attributes.alpha.needsUpdate = true;
    }

    // Build spatial hash grid for efficient neighbor lookup
    buildSpatialGrid() {
        this.grid.clear();

        for (let i = 0; i < this.particleCount; i++) {
            const x = Math.floor(this.positions[i * 3] / this.gridSize);
            const y = Math.floor(this.positions[i * 3 + 1] / this.gridSize);
            const z = Math.floor(this.positions[i * 3 + 2] / this.gridSize);
            const key = `${x},${y},${z}`;

            if (!this.grid.has(key)) {
                this.grid.set(key, []);
            }
            this.grid.get(key).push(i);
        }
    }

    // Get neighbor particles from grid
    getNeighbors(px, py, pz) {
        const neighbors = [];
        const cx = Math.floor(px / this.gridSize);
        const cy = Math.floor(py / this.gridSize);
        const cz = Math.floor(pz / this.gridSize);

        // Check surrounding cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const key = `${cx + dx},${cy + dy},${cz + dz}`;
                    const cell = this.grid.get(key);
                    if (cell) {
                        neighbors.push(...cell);
                    }
                }
            }
        }
        return neighbors;
    }

    update(delta) {
        this.time += delta;

        // Clamp delta to prevent explosion on tab switch
        delta = Math.min(delta, 0.05);

        // Build spatial grid
        this.buildSpatialGrid();

        // Particle interaction tuning (user tuned values)
        const tuning = this.tuning || {};
        const interactionRadius = this.radius * (tuning.interactionRadiusMult || 0.65);
        const repulsionDist = tuning.repulsionDist || 0.12;

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            const px = this.positions[i3];
            const py = this.positions[i3 + 1];
            const pz = this.positions[i3 + 2];
            const typeA = this.particleTypes[i];

            let fx = 0, fy = 0, fz = 0;

            // Get nearby particles
            const neighbors = this.getNeighbors(px, py, pz);

            for (const j of neighbors) {
                if (i === j) continue;

                const j3 = j * 3;
                const dx = this.positions[j3] - px;
                const dy = this.positions[j3 + 1] - py;
                const dz = this.positions[j3 + 2] - pz;
                const distSq = dx * dx + dy * dy + dz * dz;
                const dist = Math.sqrt(distSq);

                if (dist < 0.001 || dist > interactionRadius) continue;

                const typeB = this.particleTypes[j];
                const attraction = this.attractions[typeA][typeB];

                // Normalize direction
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;

                if (dist < repulsionDist) {
                    // Strong repulsion when too close (user tuned: 1.5)
                    const repulsionForce = tuning.repulsionForce || 1.5;
                    const repel = (repulsionDist - dist) / repulsionDist * repulsionForce;
                    fx -= nx * repel;
                    fy -= ny * repel;
                    fz -= nz * repel;
                } else {
                    // Attraction/repulsion based on type interaction
                    const forceMag = attraction * (1 - dist / interactionRadius);
                    fx += nx * forceMag;
                    fy += ny * forceMag;
                    fz += nz * forceMag;
                }
            }

            // Boundary force - keep inside bubble (user tuned values)
            const distFromCenter = Math.sqrt(px * px + py * py + pz * pz);
            const boundaryStartPct = tuning.boundaryStart || 0.85;
            const boundaryForceMult = tuning.boundaryForce || 6;
            const boundaryStart = this.radius * boundaryStartPct;

            if (distFromCenter > boundaryStart) {
                const pushBack = (distFromCenter - boundaryStart) / (this.radius - boundaryStart);
                const boundaryForce = pushBack * pushBack * boundaryForceMult;
                fx -= (px / distFromCenter) * boundaryForce;
                fy -= (py / distFromCenter) * boundaryForce;
                fz -= (pz / distFromCenter) * boundaryForce;
            }

            // Apply forces with speed multiplier
            const forceMult = this.speed * delta * 2;
            this.velocities[i3] += fx * forceMult;
            this.velocities[i3 + 1] += fy * forceMult;
            this.velocities[i3 + 2] += fz * forceMult;

            // Friction/damping (user tuned: 0.91)
            const friction = tuning.friction || 0.91;
            this.velocities[i3] *= friction;
            this.velocities[i3 + 1] *= friction;
            this.velocities[i3 + 2] *= friction;

            // Update position
            this.positions[i3] += this.velocities[i3] * delta * 60;
            this.positions[i3 + 1] += this.velocities[i3 + 1] * delta * 60;
            this.positions[i3 + 2] += this.velocities[i3 + 2] * delta * 60;

            // Hard clamp: never let a particle escape the bubble radius
            const newPx = this.positions[i3];
            const newPy = this.positions[i3 + 1];
            const newPz = this.positions[i3 + 2];
            const newDist = Math.sqrt(newPx * newPx + newPy * newPy + newPz * newPz);
            const maxDist = this.radius * 0.95;
            if (newDist > maxDist) {
                const scale = maxDist / newDist;
                this.positions[i3] *= scale;
                this.positions[i3 + 1] *= scale;
                this.positions[i3 + 2] *= scale;
                // Kill outward velocity component so particle doesn't keep pushing out
                const nx = newPx / newDist;
                const ny = newPy / newDist;
                const nz = newPz / newDist;
                const radialVel = this.velocities[i3] * nx + this.velocities[i3 + 1] * ny + this.velocities[i3 + 2] * nz;
                if (radialVel > 0) {
                    this.velocities[i3] -= radialVel * nx;
                    this.velocities[i3 + 1] -= radialVel * ny;
                    this.velocities[i3 + 2] -= radialVel * nz;
                }
            }
        }

        // Apply formation attractor forces (Living Arsenal Layer 2)
        if (this.formationControllers) {
            for (const fc of this.formationControllers) {
                fc.applyForces(delta);
            }
        }

        // Update GPU buffers
        this.particleMesh.geometry.attributes.position.needsUpdate = true;

        // Update shader time uniforms
        this.bubbleMesh.material.uniforms.uTime.value = this.time;
        this.particleMesh.material.uniforms.uTime.value = this.time;

        // Update bubble physics
        this.updatePhysics(delta);

        // Update armor shell particles (if enabled)
        if (!this.disableArmor) {
            this.updateArmor(delta);
            this.updateDamageParticles(delta);
        }

        // Update vitality particles (if enabled)
        if (!this.disableVitality) {
            this.updateVitality(delta);
        }

        // Update essence particles (if enabled)
        if (!this.disableEssence) {
            this.updateEssence(delta);
        }
    }

    // Change creature type
    setPreset(presetName) {
        const config = CREATURE_PRESETS[presetName];
        if (!config) return;

        this.types = config.types;
        this.colors = config.colors.map(c => new THREE.Color(c));
        this.speed = config.speed || 1.0;
        this.elements = config.elements || null;

        // Generate attraction matrix from elements
        if (config.elements) {
            this.attractions = generateElementalMatrix(config.elements);
        } else if (config.attractions) {
            this.attractions = config.attractions;
        }

        // Update bubble appearance
        this.bubbleMesh.material.uniforms.uColor.value = new THREE.Color(config.bubbleColor);
        this.bubbleMesh.material.uniforms.uOpacity.value = config.bubbleOpacity;

        // Reassign particle types and colors
        for (let i = 0; i < this.particleCount; i++) {
            const type = Math.floor(Math.random() * this.types);
            this.particleTypes[i] = type;

            const color = this.colors[type];
            this.particleColors[i * 3] = color.r;
            this.particleColors[i * 3 + 1] = color.g;
            this.particleColors[i * 3 + 2] = color.b;
        }

        this.particleMesh.geometry.attributes.color.needsUpdate = true;
    }

    // Set particle size
    setParticleSize(size) {
        this.particleSize = size;

        // Update all particle sizes with slight variation
        for (let i = 0; i < this.particleCount; i++) {
            this.particleSizes[i] = size * (0.8 + Math.random() * 0.4);
        }

        this.particleMesh.geometry.attributes.size.needsUpdate = true;
    }

    // Get current particle size
    getParticleSize() {
        return this.particleSize;
    }

    // Get element names for display
    getElementNames() {
        if (!this.elements) return [];

        const names = ['Fire', 'Water', 'Earth', 'Air', 'Shadow', 'Light'];
        return this.elements.map(e => names[e]);
    }

    // === BUBBLE PHYSICS METHODS ===

    // Update bubble physics and apply to shader
    updatePhysics(delta) {
        // Calculate velocity from position change
        const currentPos = this.group.position;
        const velocity = new THREE.Vector3(
            currentPos.x - this.lastPosition.x,
            currentPos.y - this.lastPosition.y,
            currentPos.z - this.lastPosition.z
        ).divideScalar(Math.max(delta, 0.001));

        this.physics.setVelocity(velocity);
        this.lastPosition.copy(currentPos);

        // Update physics simulation
        const state = this.physics.update(delta);

        // Apply physics state to bubble shader uniforms
        const uniforms = this.bubbleMesh.material.uniforms;
        uniforms.uDeformation.value = state.deformation;
        uniforms.uDeformAxis.value.copy(state.deformAxis);
        uniforms.uGroundSag.value = state.groundSag || 0;  // Ground sag for tire bulge effect
        uniforms.uTurnBulge.value = state.turnBulge || 0;  // Turn bulge (centrifugal effect)
        if (state.turnBulgeDir) {
            uniforms.uTurnBulgeDir.value.copy(state.turnBulgeDir);
        }
        uniforms.uWobblePhase.value = state.wobblePhase;
        uniforms.uWobbleAmplitude.value = state.wobbleAmplitude;
        uniforms.uWobbleAxis.value.copy(state.wobbleAxis);
        uniforms.uStretchAmount.value = state.stretchAmount;
        uniforms.uStretchAxis.value.copy(state.stretchAxis);

        // Apply particle momentum from physics to internal particles
        if (this.physics.isDeforming()) {
            this.applyParticleMomentum(state.particleMomentum, delta);
        }
    }

    // Apply momentum to internal particles (shift them during impacts)
    applyParticleMomentum(momentum, delta) {
        const strength = momentum.length();
        if (strength < 0.01) return;

        // Shift elemental particles
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            this.velocities[i3] += momentum.x * delta * 5;
            this.velocities[i3 + 1] += momentum.y * delta * 5;
            this.velocities[i3 + 2] += momentum.z * delta * 5;
        }

        // Shift vitality particles
        for (let i = 0; i < this.vitalityParticleCount; i++) {
            const i3 = i * 3;
            this.vitalityVelocities[i3] += momentum.x * delta * 3;
            this.vitalityVelocities[i3 + 1] += momentum.y * delta * 3;
            this.vitalityVelocities[i3 + 2] += momentum.z * delta * 3;
        }

        // Shift essence particles
        for (let i = 0; i < this.essenceParticleCount; i++) {
            const i3 = i * 3;
            this.essenceVelocities[i3] += momentum.x * delta * 4;
            this.essenceVelocities[i3 + 1] += momentum.y * delta * 4;
            this.essenceVelocities[i3 + 2] += momentum.z * delta * 4;
        }
    }

    // Apply an impact to the bubble (e.g., from damage or collision)
    applyImpact(direction, force = 0.5) {
        // Normalize direction if not already
        const dir = direction.clone().normalize();
        this.physics.applyImpact(dir, force);

        console.log(`Impact applied: force=${force.toFixed(2)}, dir=(${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)})`);
    }

    // Apply impact from a world position (calculates direction from creature center)
    applyImpactFromPosition(worldPosition, force = 0.5) {
        const creaturePos = this.group.position;
        const direction = new THREE.Vector3(
            creaturePos.x - worldPosition.x,
            creaturePos.y - worldPosition.y,
            creaturePos.z - worldPosition.z
        );

        if (direction.length() < 0.001) {
            // If impact is at center, use random direction
            direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        }

        this.applyImpact(direction, force);
    }

    // Simulate a ground landing impact (from above)
    applyLandingImpact(force = 0.3) {
        this.applyImpact(new THREE.Vector3(0, -1, 0), force);
    }

    // Set grounded state for ground sag effect (low-pressure tire bulge)
    setGrounded(grounded) {
        if (this.physics) {
            this.physics.setGrounded(grounded);
        }
    }

    // Set velocity for acceleration-based physics (new approach)
    setVelocityForPhysics(velocity) {
        if (this.physics) {
            this.physics.setVelocityForPhysics(velocity);
        }
    }

    // DEPRECATED: Use setVelocityForPhysics instead
    setTurnInfo(turnCross, momentum) {
        if (this.physics) {
            this.physics.setTurnInfo(turnCross, momentum);
        }
    }

    // Check if currently deforming (for visual feedback)
    isDeforming() {
        return this.physics.isDeforming();
    }

    // Get current deformation amount (0-1)
    getDeformation() {
        return this.physics.getShaderState().deformation;
    }

    // Get physics info for debugging/UI
    getPhysicsInfo() {
        const state = this.physics.getShaderState();
        return {
            deformation: Math.round(state.deformation * 100),
            wobbleAmplitude: Math.round(state.wobbleAmplitude * 100),
            stretchAmount: Math.round(state.stretchAmount * 100),
            isDeforming: this.physics.isDeforming()
        };
    }

    // === FORMATION METHODS (Living Arsenal Layer 2) ===

    addFormation(controller) {
        if (!this.formationControllers) {
            this.formationControllers = [];
        }
        this.formationControllers.push(controller);
    }

    removeFormation(controller) {
        if (!this.formationControllers) return;
        const idx = this.formationControllers.indexOf(controller);
        if (idx >= 0) {
            this.formationControllers.splice(idx, 1);
        }
        if (this.formationControllers.length === 0) {
            this.formationControllers = null;
        }
    }

    // Dispose resources
    dispose() {
        if (this.bubbleMesh) {
            this.bubbleMesh.geometry.dispose();
            this.bubbleMesh.material.dispose();
        }
        if (this.particleMesh) {
            this.particleMesh.geometry.dispose();
            this.particleMesh.material.dispose();
        }
        if (this.armorMesh) {
            this.armorMesh.geometry.dispose();
            this.armorMesh.material.dispose();
        }
        if (this.damageParticleMesh) {
            this.damageParticleMesh.geometry.dispose();
            this.damageParticleMesh.material.dispose();
        }
        if (this.vitalityMesh) {
            this.vitalityMesh.geometry.dispose();
            this.vitalityMesh.material.dispose();
        }
        if (this.essenceMesh) {
            this.essenceMesh.geometry.dispose();
            this.essenceMesh.material.dispose();
        }
        this.group.clear();
    }

    // Get center position in world space
    getWorldPosition() {
        const pos = new THREE.Vector3();
        this.group.getWorldPosition(pos);
        return pos;
    }
}
