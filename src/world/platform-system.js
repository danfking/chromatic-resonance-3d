// platform-system.js - Platform generation and management for vertical gameplay

import * as THREE from 'three';

// Platform types
export const PLATFORM_TYPES = {
    STATIC: 'static',
    FLOATING: 'floating',  // Hover effect
    MOVING: 'moving'       // Oscillating
};

// Platform visual styles
const PLATFORM_STYLES = {
    stone: {
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.1,
        emissive: 0x222222,
        emissiveIntensity: 0.05
    },
    magic: {
        color: 0x6688aa,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 0x4466aa,
        emissiveIntensity: 0.2
    },
    golden: {
        color: 0xddaa44,
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0xaa7722,
        emissiveIntensity: 0.15
    },
    void: {
        color: 0x553388,
        roughness: 0.5,
        metalness: 0.3,
        emissive: 0x442266,
        emissiveIntensity: 0.25
    }
};

/**
 * Individual platform
 */
export class Platform {
    constructor(options = {}) {
        const {
            position = new THREE.Vector3(0, 1, 0),
            size = new THREE.Vector3(4, 0.5, 4),
            type = PLATFORM_TYPES.STATIC,
            style = 'stone',
            movementAxis = 'y',
            movementRange = 1,
            movementSpeed = 1
        } = options;

        this.position = position.clone();
        this.size = size.clone();
        this.type = type;
        this.style = style;
        this.movementAxis = movementAxis;
        this.movementRange = movementRange;
        this.movementSpeed = movementSpeed;

        this.mesh = null;
        this.basePosition = position.clone();
        this.time = Math.random() * Math.PI * 2; // Random phase offset

        this.createMesh();
    }

    createMesh() {
        const styleConfig = PLATFORM_STYLES[this.style] || PLATFORM_STYLES.stone;

        // Main platform geometry
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
        const material = new THREE.MeshStandardMaterial({
            color: styleConfig.color,
            roughness: styleConfig.roughness,
            metalness: styleConfig.metalness,
            emissive: styleConfig.emissive,
            emissiveIntensity: styleConfig.emissiveIntensity
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Mark as platform for collision detection
        this.mesh.userData.isPlatform = true;
        this.mesh.userData.platformRef = this;

        // Add edge trim for visual definition
        if (this.type !== PLATFORM_TYPES.STATIC) {
            this.addFloatingEffects();
        }
    }

    addFloatingEffects() {
        // Glowing edge ring for floating/moving platforms
        const edgeGeometry = new THREE.BoxGeometry(
            this.size.x + 0.1,
            0.05,
            this.size.z + 0.1
        );
        const edgeMaterial = new THREE.MeshBasicMaterial({
            color: 0x88aaff,
            transparent: true,
            opacity: 0.5
        });

        const topEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        topEdge.position.y = this.size.y / 2 + 0.03;
        this.mesh.add(topEdge);

        const bottomEdge = new THREE.Mesh(edgeGeometry, edgeMaterial.clone());
        bottomEdge.position.y = -this.size.y / 2 - 0.03;
        this.mesh.add(bottomEdge);
    }

    update(delta) {
        this.time += delta;

        if (this.type === PLATFORM_TYPES.FLOATING) {
            // Gentle hover bob
            const bobAmount = Math.sin(this.time * 2) * 0.1;
            this.mesh.position.y = this.basePosition.y + bobAmount;
        } else if (this.type === PLATFORM_TYPES.MOVING) {
            // Oscillating movement along axis
            const offset = Math.sin(this.time * this.movementSpeed) * this.movementRange;

            this.mesh.position.copy(this.basePosition);
            if (this.movementAxis === 'x') {
                this.mesh.position.x += offset;
            } else if (this.movementAxis === 'y') {
                this.mesh.position.y += offset;
            } else if (this.movementAxis === 'z') {
                this.mesh.position.z += offset;
            }
        }
    }

    getTopY() {
        return this.mesh.position.y + this.size.y / 2;
    }

    getBoundingBox() {
        const halfSize = this.size.clone().multiplyScalar(0.5);
        return new THREE.Box3(
            this.mesh.position.clone().sub(halfSize),
            this.mesh.position.clone().add(halfSize)
        );
    }

    dispose() {
        if (this.mesh) {
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

/**
 * Ramp connecting different elevations
 */
export class Ramp {
    constructor(options = {}) {
        const {
            start = new THREE.Vector3(0, 0, 0),
            end = new THREE.Vector3(4, 2, 0),
            width = 3,
            style = 'stone'
        } = options;

        this.start = start.clone();
        this.end = end.clone();
        this.width = width;
        this.style = style;
        this.mesh = null;

        this.createMesh();
    }

    createMesh() {
        const styleConfig = PLATFORM_STYLES[this.style] || PLATFORM_STYLES.stone;

        // Calculate ramp dimensions
        const direction = new THREE.Vector3().subVectors(this.end, this.start);
        const length = direction.length();
        const heightDiff = this.end.y - this.start.y;
        const horizontalDist = Math.sqrt(
            Math.pow(this.end.x - this.start.x, 2) +
            Math.pow(this.end.z - this.start.z, 2)
        );

        // Create ramp geometry
        const geometry = new THREE.BoxGeometry(this.width, 0.3, length);
        const material = new THREE.MeshStandardMaterial({
            color: styleConfig.color,
            roughness: styleConfig.roughness + 0.1,
            metalness: styleConfig.metalness
        });

        this.mesh = new THREE.Mesh(geometry, material);

        // Position at midpoint
        this.mesh.position.copy(this.start).add(this.end).multiplyScalar(0.5);

        // Calculate rotation to slope
        const angle = Math.atan2(heightDiff, horizontalDist);
        this.mesh.rotation.x = -angle;

        // Rotate to face direction
        const horizontalDir = new THREE.Vector2(
            this.end.x - this.start.x,
            this.end.z - this.start.z
        );
        const yRotation = Math.atan2(horizontalDir.x, horizontalDir.y);
        this.mesh.rotation.y = yRotation;

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isRamp = true;
        this.mesh.userData.rampRef = this;

        // Store slope info for movement
        this.mesh.userData.slopeAngle = angle;
        this.mesh.userData.slopeNormal = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
    }

    getSlopeAngle() {
        const heightDiff = this.end.y - this.start.y;
        const horizontalDist = Math.sqrt(
            Math.pow(this.end.x - this.start.x, 2) +
            Math.pow(this.end.z - this.start.z, 2)
        );
        return Math.atan2(heightDiff, horizontalDist);
    }

    dispose() {
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
    }
}

/**
 * Platform system manager
 */
export class PlatformSystem {
    constructor(scene) {
        this.scene = scene;
        this.platforms = [];
        this.ramps = [];
        this.colliders = []; // All collidable surfaces
    }

    /**
     * Add a platform
     */
    addPlatform(options) {
        const platform = new Platform(options);
        this.platforms.push(platform);
        this.colliders.push(platform.mesh);
        this.scene.add(platform.mesh);
        return platform;
    }

    /**
     * Add a ramp
     */
    addRamp(options) {
        const ramp = new Ramp(options);
        this.ramps.push(ramp);
        this.colliders.push(ramp.mesh);
        this.scene.add(ramp.mesh);
        return ramp;
    }

    /**
     * Create a preset arena layout
     */
    createArenaLayout(layoutType = 'standard') {
        switch (layoutType) {
            case 'standard':
                this.createStandardArena();
                break;
            case 'tower':
                this.createTowerArena();
                break;
            case 'ring':
                this.createRingArena();
                break;
            default:
                this.createStandardArena();
        }
    }

    /**
     * Standard arena with platforms and ramps
     */
    createStandardArena() {
        // Central elevated platform
        this.addPlatform({
            position: new THREE.Vector3(0, 3, 0),
            size: new THREE.Vector3(8, 0.5, 8),
            type: PLATFORM_TYPES.STATIC,
            style: 'magic'
        });

        // Ramps to central platform
        const rampOffset = 6;
        const rampConfigs = [
            { start: new THREE.Vector3(0, 0, -rampOffset), end: new THREE.Vector3(0, 3, -2) },
            { start: new THREE.Vector3(0, 0, rampOffset), end: new THREE.Vector3(0, 3, 2) },
            { start: new THREE.Vector3(-rampOffset, 0, 0), end: new THREE.Vector3(-2, 3, 0) },
            { start: new THREE.Vector3(rampOffset, 0, 0), end: new THREE.Vector3(2, 3, 0) }
        ];

        rampConfigs.forEach(config => {
            this.addRamp({
                start: config.start,
                end: config.end,
                width: 2.5,
                style: 'stone'
            });
        });

        // Corner platforms at low elevation
        const cornerPositions = [
            new THREE.Vector3(-12, 1.5, -12),
            new THREE.Vector3(12, 1.5, -12),
            new THREE.Vector3(-12, 1.5, 12),
            new THREE.Vector3(12, 1.5, 12)
        ];

        cornerPositions.forEach(pos => {
            this.addPlatform({
                position: pos,
                size: new THREE.Vector3(5, 0.4, 5),
                type: PLATFORM_TYPES.STATIC,
                style: 'stone'
            });
        });

        // Floating platforms at medium height
        const floatingPositions = [
            new THREE.Vector3(-8, 5, 0),
            new THREE.Vector3(8, 5, 0),
            new THREE.Vector3(0, 5, -8),
            new THREE.Vector3(0, 5, 8)
        ];

        floatingPositions.forEach(pos => {
            this.addPlatform({
                position: pos,
                size: new THREE.Vector3(3, 0.3, 3),
                type: PLATFORM_TYPES.FLOATING,
                style: 'magic'
            });
        });

        // Moving platforms connecting floating to central
        this.addPlatform({
            position: new THREE.Vector3(-5, 4, 5),
            size: new THREE.Vector3(2.5, 0.3, 2.5),
            type: PLATFORM_TYPES.MOVING,
            style: 'golden',
            movementAxis: 'x',
            movementRange: 2,
            movementSpeed: 0.8
        });

        this.addPlatform({
            position: new THREE.Vector3(5, 4, -5),
            size: new THREE.Vector3(2.5, 0.3, 2.5),
            type: PLATFORM_TYPES.MOVING,
            style: 'golden',
            movementAxis: 'z',
            movementRange: 2,
            movementSpeed: 0.8
        });
    }

    /**
     * Tower arena - vertical stacking
     */
    createTowerArena() {
        const levels = 5;
        const baseRadius = 10;

        for (let i = 0; i < levels; i++) {
            const elevation = i * 2.5;
            const radius = baseRadius - i * 1.5;
            const platformCount = 4 - Math.floor(i / 2);

            for (let j = 0; j < platformCount; j++) {
                const angle = (j / platformCount) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;

                this.addPlatform({
                    position: new THREE.Vector3(x, elevation, z),
                    size: new THREE.Vector3(4, 0.4, 4),
                    type: i % 2 === 0 ? PLATFORM_TYPES.STATIC : PLATFORM_TYPES.FLOATING,
                    style: i === levels - 1 ? 'golden' : 'stone'
                });
            }
        }
    }

    /**
     * Ring arena - circular platforms
     */
    createRingArena() {
        const rings = [
            { radius: 15, count: 8, elevation: 1, size: 3 },
            { radius: 10, count: 6, elevation: 2.5, size: 3.5 },
            { radius: 5, count: 4, elevation: 4, size: 4 }
        ];

        rings.forEach((ring, ringIndex) => {
            for (let i = 0; i < ring.count; i++) {
                const angle = (i / ring.count) * Math.PI * 2;
                const x = Math.cos(angle) * ring.radius;
                const z = Math.sin(angle) * ring.radius;

                this.addPlatform({
                    position: new THREE.Vector3(x, ring.elevation, z),
                    size: new THREE.Vector3(ring.size, 0.4, ring.size),
                    type: ringIndex === 1 ? PLATFORM_TYPES.FLOATING : PLATFORM_TYPES.STATIC,
                    style: ringIndex === 2 ? 'magic' : 'stone'
                });
            }
        });

        // Central platform
        this.addPlatform({
            position: new THREE.Vector3(0, 5.5, 0),
            size: new THREE.Vector3(6, 0.5, 6),
            type: PLATFORM_TYPES.STATIC,
            style: 'golden'
        });
    }

    /**
     * Update all platforms
     */
    update(delta) {
        this.platforms.forEach(platform => platform.update(delta));
    }

    /**
     * Get all collider meshes
     */
    getColliders() {
        return this.colliders;
    }

    /**
     * Find platform/surface below a point
     */
    getSurfaceBelow(position, maxDistance = 10) {
        const raycaster = new THREE.Raycaster(
            position.clone(),
            new THREE.Vector3(0, -1, 0),
            0,
            maxDistance
        );

        const intersects = raycaster.intersectObjects(this.colliders, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            return {
                point: hit.point,
                distance: hit.distance,
                normal: hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0),
                object: hit.object,
                isPlatform: hit.object.userData.isPlatform || false,
                isRamp: hit.object.userData.isRamp || false,
                slopeAngle: hit.object.userData.slopeAngle || 0
            };
        }

        return null;
    }

    /**
     * Check if position is on a platform
     */
    isOnPlatform(position, tolerance = 0.5) {
        const surface = this.getSurfaceBelow(position, tolerance + 0.1);
        return surface !== null && surface.distance <= tolerance;
    }

    /**
     * Dispose all platforms
     */
    dispose() {
        this.platforms.forEach(platform => {
            this.scene.remove(platform.mesh);
            platform.dispose();
        });
        this.ramps.forEach(ramp => {
            this.scene.remove(ramp.mesh);
            ramp.dispose();
        });
        this.platforms = [];
        this.ramps = [];
        this.colliders = [];
    }
}
