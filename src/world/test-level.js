// test-level.js - Test level with platform system for vertical gameplay

import * as THREE from 'three';
import { TextureManager } from '../systems/texture-manager.js';
import { PlatformSystem, PLATFORM_TYPES } from './platform-system.js';

export class TestLevel {
    constructor(scene) {
        this.scene = scene;
        this.animatedObjects = [];
        this.groundMesh = null;
        this.wallMeshes = [];
        this.pillarMeshes = [];

        // Platform system for verticality
        this.platformSystem = null;
        this.enablePlatforms = true; // Set to false for classic flat arena
    }

    async build() {
        this.createGround();
        this.createWalls();
        this.createColoredObjects();
        this.createPillars();
        this.createAtmosphericElements();

        // Create platform system for vertical gameplay
        if (this.enablePlatforms) {
            this.createPlatformSystem();
        }

        // Load and apply textures asynchronously
        await this.applyTextures();
    }

    /**
     * Get the platform system for collision detection
     */
    getPlatformSystem() {
        return this.platformSystem;
    }

    /**
     * Create the platform system with arena layout
     */
    createPlatformSystem() {
        this.platformSystem = new PlatformSystem(this.scene);

        // Create standard arena with platforms
        this.platformSystem.createArenaLayout('standard');

        console.log('Platform system initialized with standard arena layout');
    }

    update(delta, elapsed) {
        // Animate colored objects
        this.animatedObjects.forEach(obj => {
            if (obj.userData.rotationSpeed) {
                obj.rotation.y += obj.userData.rotationSpeed * delta;
            }
            // Floating bob animation
            if (obj.userData.baseY !== undefined) {
                obj.position.y = obj.userData.baseY + Math.sin(elapsed * 2 + obj.userData.phaseOffset) * 0.15;
            }
        });

        // Update platform system (moving platforms, etc.)
        if (this.platformSystem) {
            this.platformSystem.update(delta);
        }
    }

    createGround() {
        // Main ground plane with grid pattern - white base for accurate texture display
        const groundGeometry = new THREE.PlaneGeometry(40, 40, 40, 40);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;

        // Store for color extraction
        ground.userData.extractable = true;
        ground.userData.colorName = 'Stone Gray';
        ground.userData.colorType = 'ivory';

        this.scene.add(ground);
        this.groundMesh = ground;

        // Grid lines
        const gridHelper = new THREE.GridHelper(40, 40, 0x444466, 0x333355);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    createWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.85,
            metalness: 0.0
        });

        const walls = [
            { pos: [0, 2.5, -20], size: [40, 5, 0.5] },
            { pos: [0, 2.5, 20], size: [40, 5, 0.5] },
            { pos: [-20, 2.5, 0], size: [0.5, 5, 40] },
            { pos: [20, 2.5, 0], size: [0.5, 5, 40] }
        ];

        walls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geometry, wallMaterial.clone());
            mesh.position.set(...wall.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.extractable = true;
            mesh.userData.colorName = 'Dark Stone';
            mesh.userData.colorType = 'ivory';
            this.scene.add(mesh);
            this.wallMeshes.push(mesh);
        });
    }

    createColoredObjects() {
        // Chromatic color objects for extraction testing
        const colorObjects = [
            // Crimson objects
            { color: 0xc44444, pos: [-8, 1, -8], name: 'Crimson Crystal', type: 'crimson' },
            { color: 0xaa3333, pos: [-6, 0.5, -10], name: 'Blood Ruby', type: 'crimson' },

            // Azure objects
            { color: 0x4477aa, pos: [8, 1, -8], name: 'Azure Orb', type: 'azure' },
            { color: 0x3366aa, pos: [10, 0.75, -6], name: 'Sapphire Shard', type: 'azure' },

            // Verdant objects
            { color: 0x44aa66, pos: [-8, 1, 8], name: 'Verdant Growth', type: 'verdant' },
            { color: 0x339955, pos: [-10, 0.6, 6], name: 'Emerald Moss', type: 'verdant' },

            // Golden objects
            { color: 0xddaa44, pos: [8, 1, 8], name: 'Golden Chalice', type: 'golden' },
            { color: 0xcc9933, pos: [6, 0.5, 10], name: 'Amber Ingot', type: 'golden' },

            // Violet objects
            { color: 0x8855aa, pos: [0, 1.5, -12], name: 'Violet Essence', type: 'violet' },
            { color: 0x7744aa, pos: [2, 1, -14], name: 'Amethyst Core', type: 'violet' },

            // Ivory objects (central)
            { color: 0xeeeedd, pos: [0, 2, 0], name: 'Ivory Light', type: 'ivory' },
        ];

        colorObjects.forEach(obj => {
            // Create varied shapes
            let geometry;
            const rand = Math.random();
            if (rand < 0.3) {
                geometry = new THREE.SphereGeometry(0.5, 16, 16);
            } else if (rand < 0.6) {
                geometry = new THREE.OctahedronGeometry(0.6);
            } else if (rand < 0.8) {
                geometry = new THREE.DodecahedronGeometry(0.5);
            } else {
                geometry = new THREE.IcosahedronGeometry(0.55);
            }

            const material = new THREE.MeshStandardMaterial({
                color: obj.color,
                roughness: 0.3,
                metalness: 0.2,
                emissive: obj.color,
                emissiveIntensity: 0.1
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(...obj.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Metadata for color extraction
            mesh.userData.extractable = true;
            mesh.userData.colorName = obj.name;
            mesh.userData.colorType = obj.type;
            mesh.userData.colorHex = obj.color;

            // Animate rotation and bobbing
            mesh.userData.rotationSpeed = 0.5 + Math.random() * 0.5;
            mesh.userData.baseY = obj.pos[1];
            mesh.userData.phaseOffset = Math.random() * Math.PI * 2;

            this.scene.add(mesh);
            this.animatedObjects.push(mesh);
        });
    }

    createPillars() {
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.7,
            metalness: 0.05
        });

        const pillarPositions = [
            [-12, 0, -12], [12, 0, -12],
            [-12, 0, 12], [12, 0, 12],
            [-6, 0, 0], [6, 0, 0],
            [0, 0, -6], [0, 0, 6]
        ];

        pillarPositions.forEach(pos => {
            // Base
            const baseGeometry = new THREE.CylinderGeometry(0.8, 1, 0.5, 8);
            const base = new THREE.Mesh(baseGeometry, pillarMaterial.clone());
            base.position.set(pos[0], 0.25, pos[2]);
            base.castShadow = true;
            base.receiveShadow = true;
            this.scene.add(base);

            // Column
            const columnGeometry = new THREE.CylinderGeometry(0.5, 0.6, 3, 8);
            const column = new THREE.Mesh(columnGeometry, pillarMaterial.clone());
            column.position.set(pos[0], 2, pos[2]);
            column.castShadow = true;
            column.receiveShadow = true;
            column.userData.extractable = true;
            column.userData.colorName = 'Ancient Stone';
            column.userData.colorType = 'ivory';
            this.scene.add(column);
            this.pillarMeshes.push(column);

            // Capital
            const capitalGeometry = new THREE.CylinderGeometry(0.7, 0.5, 0.4, 8);
            const capital = new THREE.Mesh(capitalGeometry, pillarMaterial.clone());
            capital.position.set(pos[0], 3.7, pos[2]);
            capital.castShadow = true;
            capital.receiveShadow = true;
            this.scene.add(capital);
        });
    }

    createAtmosphericElements() {
        // Floating dust/magic particles using points
        const particleCount = 100;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const colorPalette = [
            new THREE.Color(0xd4a574), // Gold
            new THREE.Color(0x7a5aaa), // Violet
            new THREE.Color(0x4477aa), // Azure
            new THREE.Color(0xf5f0e6), // Ivory
        ];

        for (let i = 0; i < particleCount; i++) {
            // Random position within the level
            positions[i * 3] = (Math.random() - 0.5) * 36;
            positions[i * 3 + 1] = Math.random() * 4 + 0.5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 36;

            // Random color from palette
            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        particles.userData.isParticles = true;
        this.scene.add(particles);

        // Store for animation
        this.dustParticles = particles;
        this.animatedObjects.push({
            userData: { rotationSpeed: 0.02 },
            rotation: particles.rotation
        });
    }

    async applyTextures() {
        // Apply ground texture with 8x8 repeat
        try {
            const groundTexture = await TextureManager.getWorldTexture('groundFloor', 8, 8);
            if (groundTexture && this.groundMesh) {
                this.groundMesh.material.map = groundTexture;
                this.groundMesh.material.needsUpdate = true;
                console.log('Applied ground floor texture');
            }
        } catch (e) {
            console.log('Ground texture not found, using solid color');
        }

        // Apply wall texture with 4x1 repeat
        try {
            const wallTexture = await TextureManager.getWorldTexture('wallStone', 4, 1);
            if (wallTexture) {
                this.wallMeshes.forEach(wall => {
                    wall.material.map = wallTexture.clone();
                    wall.material.map.wrapS = THREE.RepeatWrapping;
                    wall.material.map.wrapT = THREE.RepeatWrapping;
                    wall.material.map.repeat.set(4, 1);
                    wall.material.needsUpdate = true;
                });
                console.log('Applied wall stone texture');
            }
        } catch (e) {
            console.log('Wall texture not found, using solid color');
        }

        // Apply pillar texture with 2x3 repeat
        try {
            const pillarTexture = await TextureManager.getWorldTexture('pillarStone', 2, 3);
            if (pillarTexture) {
                this.pillarMeshes.forEach(pillar => {
                    pillar.material.map = pillarTexture.clone();
                    pillar.material.map.wrapS = THREE.RepeatWrapping;
                    pillar.material.map.wrapT = THREE.RepeatWrapping;
                    pillar.material.map.repeat.set(2, 3);
                    pillar.material.needsUpdate = true;
                });
                console.log('Applied pillar stone texture');
            }
        } catch (e) {
            console.log('Pillar texture not found, using solid color');
        }
    }
}
