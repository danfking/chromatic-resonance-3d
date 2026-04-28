// arena-level.js - Open arena level with scattered cover for wand combat

import * as THREE from 'three';
import { ELEMENT_TYPES } from '../creatures/particle-life-creature.js';

// Default arena theme
const ARENA_THEME = {
    name: 'Arena',
    colors: {
        floor: 0x555566,
        wall: 0x444455,
        accent: 0xddaa44,
        emissive: 0xffaa00,
    },
};

/**
 * Cover object types for arena decoration
 */
const COVER_TYPES = {
    pillar: { radius: 1.5, height: 6, health: true },
    ruinWall: { width: 4, height: 3, depth: 0.8 },
    crystal: { radius: 1, height: 3, emissive: true },
    boulder: { radius: 2, segments: 6 },
    shrine: { width: 3, height: 2, depth: 3 },
};

/**
 * ArenaLevel - Open arena with scattered cover objects
 * Designed for wand-based ranged combat
 */
export class ArenaLevel {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            width: options.width || 80,        // Arena width
            height: options.height || 80,      // Arena depth
            element: options.element ?? ELEMENT_TYPES.FIRE,
            coverDensity: options.coverDensity || 0.3,  // 0-1, how much cover
            ...options
        };

        this.theme = ARENA_THEME;
        this.group = new THREE.Group();
        this.group.name = 'arena';

        this.colliders = [];
        this.coverObjects = [];
        this.sceneLights = [];
        this.enemySpawnPoints = [];
        this.animatedObjects = [];
        this.dustParticles = null;

        // Platform system stub
        this.platformSystem = null;
    }

    async build() {
        console.log(`Building arena: ${this.options.width}x${this.options.height}, element ${this.options.element}`);

        // Create ground
        this.createGround();

        // Create perimeter walls
        this.createPerimeter();

        // Scatter cover objects
        this.createCover();

        // Generate enemy spawn points
        this.generateSpawnPoints();

        // Add scene lighting
        this.setupSceneLighting();

        // Add atmospheric particles
        this.createAtmosphericElements();

        // Add to scene
        this.scene.add(this.group);

        console.log(`Arena generated: ${this.coverObjects.length} cover objects, ${this.enemySpawnPoints.length} spawn points`);
        console.log(`Theme: ${this.theme.name}`);

        return { theme: this.theme, size: { width: this.options.width, height: this.options.height } };
    }

    /**
     * Create the arena floor
     */
    createGround() {
        const { width, height } = this.options;

        // Brighten floor color for outdoor visibility
        const floorColor = new THREE.Color(this.theme.colors.floor);
        floorColor.multiplyScalar(2.5); // Brighten significantly

        // Main ground plane
        const groundGeo = new THREE.PlaneGeometry(width, height, 32, 32);
        const groundMat = new THREE.MeshStandardMaterial({
            color: floorColor,
            roughness: 0.8,
            metalness: 0.0,
        });

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(width / 2, 0, height / 2);
        ground.receiveShadow = true;
        ground.userData = { type: 'floor' };

        this.group.add(ground);
        this.colliders.push(ground);

        // Add subtle grid lines
        const gridHelper = new THREE.GridHelper(
            Math.max(width, height),
            Math.max(width, height) / 4,
            new THREE.Color(this.theme.colors.wall).multiplyScalar(0.5),
            new THREE.Color(this.theme.colors.wall).multiplyScalar(0.3)
        );
        gridHelper.position.set(width / 2, 0.01, height / 2);
        this.group.add(gridHelper);
    }

    /**
     * Create perimeter walls
     */
    createPerimeter() {
        const { width, height } = this.options;
        const wallHeight = 5;
        const wallThickness = 1;

        // Brighten wall color
        const wallColor = new THREE.Color(this.theme.colors.wall);
        wallColor.multiplyScalar(2.0);

        const wallMat = new THREE.MeshStandardMaterial({
            color: wallColor,
            roughness: 0.8,
            metalness: 0.05,
        });

        const walls = [
            // North wall
            { pos: [width / 2, wallHeight / 2, 0], size: [width + wallThickness * 2, wallHeight, wallThickness] },
            // South wall
            { pos: [width / 2, wallHeight / 2, height], size: [width + wallThickness * 2, wallHeight, wallThickness] },
            // West wall
            { pos: [0, wallHeight / 2, height / 2], size: [wallThickness, wallHeight, height] },
            // East wall
            { pos: [width, wallHeight / 2, height / 2], size: [wallThickness, wallHeight, height] },
        ];

        for (const wall of walls) {
            const geo = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(...wall.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { type: 'wall' };

            this.group.add(mesh);
            this.colliders.push(mesh);
        }
    }

    /**
     * Create scattered cover objects
     */
    createCover() {
        const { width, height, coverDensity } = this.options;

        // Calculate number of cover objects based on density
        const areaFactor = (width * height) / 1600; // Base area of 40x40
        const numCover = Math.floor(15 * areaFactor * coverDensity);

        const margin = 8; // Keep cover away from edges
        const minSpacing = 6; // Minimum distance between cover objects

        const placedPositions = [];

        for (let i = 0; i < numCover; i++) {
            // Try to find a valid position
            let attempts = 0;
            let validPos = null;

            while (attempts < 20 && !validPos) {
                const x = margin + Math.random() * (width - margin * 2);
                const z = margin + Math.random() * (height - margin * 2);

                // Check distance from other cover
                const tooClose = placedPositions.some(p => {
                    const dx = p.x - x;
                    const dz = p.z - z;
                    return Math.sqrt(dx * dx + dz * dz) < minSpacing;
                });

                // Keep center area more open for player spawn
                const centerDist = Math.sqrt(
                    Math.pow(x - width / 2, 2) + Math.pow(z - height / 2, 2)
                );
                const tooCenter = centerDist < 10;

                if (!tooClose && !tooCenter) {
                    validPos = { x, z };
                }
                attempts++;
            }

            if (validPos) {
                placedPositions.push(validPos);
                this.addCoverObject(validPos.x, validPos.z);
            }
        }
    }

    /**
     * Add a single cover object at position
     */
    addCoverObject(x, z) {
        const types = Object.keys(COVER_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];
        const config = COVER_TYPES[type];

        // Brighten colors for outdoor visibility
        const brightWall = new THREE.Color(this.theme.colors.wall).multiplyScalar(2.0);
        const brightAccent = new THREE.Color(this.theme.colors.accent).multiplyScalar(1.5);

        let mesh;

        switch (type) {
            case 'pillar': {
                const geo = new THREE.CylinderGeometry(config.radius, config.radius * 1.2, config.height, 8);
                const mat = new THREE.MeshStandardMaterial({
                    color: brightWall,
                    roughness: 0.7,
                    metalness: 0.1,
                });
                mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, config.height / 2, z);
                break;
            }

            case 'ruinWall': {
                const geo = new THREE.BoxGeometry(config.width, config.height, config.depth);
                const mat = new THREE.MeshStandardMaterial({
                    color: brightWall,
                    roughness: 0.85,
                    metalness: 0.05,
                });
                mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, config.height / 2, z);
                mesh.rotation.y = Math.random() * Math.PI;
                break;
            }

            case 'crystal': {
                const geo = new THREE.OctahedronGeometry(config.radius);
                const mat = new THREE.MeshStandardMaterial({
                    color: brightAccent,
                    roughness: 0.3,
                    metalness: 0.4,
                    emissive: this.theme.colors.accent,
                    emissiveIntensity: 0.5,
                });
                mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, config.height / 2, z);
                mesh.rotation.y = Math.random() * Math.PI;
                mesh.scale.y = config.height / config.radius;

                // Add brighter point light for crystals
                const light = new THREE.PointLight(this.theme.colors.accent, 1.0, 12);
                light.position.set(x, config.height, z);
                this.group.add(light);
                break;
            }

            case 'boulder': {
                const geo = new THREE.DodecahedronGeometry(config.radius, 0);
                const mat = new THREE.MeshStandardMaterial({
                    color: brightWall,
                    roughness: 0.9,
                    metalness: 0.05,
                });
                mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, config.radius * 0.7, z);
                mesh.rotation.set(
                    Math.random() * 0.3,
                    Math.random() * Math.PI,
                    Math.random() * 0.3
                );
                break;
            }

            case 'shrine': {
                // Base platform
                const baseGeo = new THREE.BoxGeometry(config.width, 0.5, config.depth);
                const baseMat = new THREE.MeshStandardMaterial({
                    color: brightAccent,
                    roughness: 0.6,
                    metalness: 0.2,
                });
                mesh = new THREE.Mesh(baseGeo, baseMat);
                mesh.position.set(x, 0.25, z);

                // Add pillar on top
                const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, config.height, 6);
                const pillarMat = new THREE.MeshStandardMaterial({
                    color: brightWall,
                    roughness: 0.7,
                    metalness: 0.1,
                });
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(x, 0.5 + config.height / 2, z);
                pillar.castShadow = true;
                this.group.add(pillar);
                this.colliders.push(pillar);
                break;
            }
        }

        if (mesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { type: 'cover', coverType: type };

            this.group.add(mesh);
            this.colliders.push(mesh);
            this.coverObjects.push(mesh);
        }
    }

    /**
     * Generate enemy spawn points around the perimeter
     */
    generateSpawnPoints() {
        const { width, height } = this.options;
        const margin = 5;
        const numSpawns = 20;

        // Spawn points along perimeter
        for (let i = 0; i < numSpawns; i++) {
            const angle = (i / numSpawns) * Math.PI * 2;
            const radiusX = (width / 2) - margin;
            const radiusZ = (height / 2) - margin;

            const x = width / 2 + Math.cos(angle) * radiusX;
            const z = height / 2 + Math.sin(angle) * radiusZ;

            this.enemySpawnPoints.push({
                position: new THREE.Vector3(x, 1, z),
                type: null, // Random enemy type
            });
        }

        // Some spawn points near cover
        for (const cover of this.coverObjects.slice(0, 10)) {
            const offset = 3 + Math.random() * 2;
            const angle = Math.random() * Math.PI * 2;

            this.enemySpawnPoints.push({
                position: new THREE.Vector3(
                    cover.position.x + Math.cos(angle) * offset,
                    1,
                    cover.position.z + Math.sin(angle) * offset
                ),
                type: null,
            });
        }
    }

    /**
     * Setup scene lighting for open arena
     */
    setupSceneLighting() {
        const { width, height } = this.options;

        // Bright ambient light for outdoor feel
        const ambient = new THREE.AmbientLight(0x9090b0, 1.5);
        this.scene.add(ambient);
        this.sceneLights.push(ambient);

        // Strong directional "sun" light
        const dirLight = new THREE.DirectionalLight(0xffffee, 2.0);
        dirLight.position.set(width / 2 + 30, 80, height / 2 + 30);
        dirLight.target.position.set(width / 2, 0, height / 2);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 200;
        const shadowSize = Math.max(width, height) * 0.6;
        dirLight.shadow.camera.left = -shadowSize;
        dirLight.shadow.camera.right = shadowSize;
        dirLight.shadow.camera.top = shadowSize;
        dirLight.shadow.camera.bottom = -shadowSize;
        this.scene.add(dirLight);
        this.scene.add(dirLight.target);
        this.sceneLights.push(dirLight);

        // Secondary fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0xaaccff, 0.8);
        fillLight.position.set(width / 2 - 40, 50, height / 2 - 40);
        this.scene.add(fillLight);
        this.sceneLights.push(fillLight);

        // Hemisphere light for sky/ground color bleed
        const hemiLight = new THREE.HemisphereLight(
            0xccccff, // Bright sky color
            0x886644, // Warm ground color
            1.0
        );
        this.scene.add(hemiLight);
        this.sceneLights.push(hemiLight);

        // Reduce or disable fog for better visibility
        this.scene.fog = null;

        console.log('Arena lighting setup complete');
    }

    /**
     * Create atmospheric particles
     */
    createAtmosphericElements() {
        const { width, height } = this.options;
        const particleCount = 200;

        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const themeColors = [
            new THREE.Color(this.theme.colors.floor),
            new THREE.Color(this.theme.colors.accent),
            new THREE.Color(this.theme.ambientLight?.color || 0x404060),
        ];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = Math.random() * width;
            positions[i * 3 + 1] = Math.random() * 6 + 0.5;
            positions[i * 3 + 2] = Math.random() * height;

            const color = themeColors[Math.floor(Math.random() * themeColors.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.12,
            vertexColors: true,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
        });

        this.dustParticles = new THREE.Points(geometry, material);
        this.dustParticles.userData.isParticles = true;
        this.scene.add(this.dustParticles);
    }

    // === PUBLIC API ===

    getPlatformSystem() {
        return this.platformSystem;
    }

    getPlayerSpawnPosition() {
        const { width, height } = this.options;
        // Spawn in center
        return new THREE.Vector3(width / 2, 0, height / 2);
    }

    getEnemySpawns() {
        return this.enemySpawnPoints;
    }

    getBossRoomPosition() {
        const { width, height } = this.options;
        // Boss spawns at north end
        return new THREE.Vector3(width / 2, 0, height * 0.1);
    }

    getBounds() {
        const { width, height } = this.options;
        return {
            minX: 0,
            maxX: width,
            minZ: 0,
            maxZ: height,
            centerX: width / 2,
            centerZ: height / 2,
        };
    }

    getTheme() {
        return this.theme;
    }

    getStats() {
        return {
            reachableTiles: 1, // Single arena
            enemies: this.enemySpawnPoints.length,
            props: this.coverObjects.length,
            lore: 0,
        };
    }

    update(delta, elapsed) {
        // Animate particles
        if (this.dustParticles) {
            this.dustParticles.rotation.y += 0.01 * delta;

            const positions = this.dustParticles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] += Math.sin(elapsed + i * 0.1) * 0.003;
            }
            this.dustParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    dispose() {
        // Remove group
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }

        // Remove particles
        if (this.dustParticles) {
            this.dustParticles.geometry.dispose();
            this.dustParticles.material.dispose();
            this.scene.remove(this.dustParticles);
        }

        // Remove scene lights
        if (this.sceneLights) {
            this.sceneLights.forEach(light => {
                this.scene.remove(light);
                if (light.target) this.scene.remove(light.target);
            });
        }

        // Clear fog
        this.scene.fog = null;

        this.colliders = [];
        this.coverObjects = [];
        this.enemySpawnPoints = [];
    }

    async regenerate(options = {}) {
        this.dispose();
        this.options = { ...this.options, ...options };
        return this.build();
    }
}
