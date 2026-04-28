// test-flat-level.js - Minimal flat arena for vehicle physics testing
// 200x200 flat plane with grid overlay, no obstacles, no sky dome
// URL: ?level=test-flat

import * as THREE from 'three';

const WORLD_SIZE = 200;
const GRID_SPACING = 10;
const GROUND_COLOR = 0xb0bfa0; // light gray-green

/**
 * TestFlatLevel - Flat arena for isolated vehicle physics testing.
 * getHeightAt() always returns 0, terrain normal always (0,1,0).
 * Grid lines every 10 units provide visual speed reference.
 */
export class TestFlatLevel {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'test-flat-world';
    }

    async build() {
        this._createGround();
        this._createGrid();
        this._createLights();
        this.scene.add(this.group);
    }

    // ─── Ground Plane ───────────────────────────────────────────────

    _createGround() {
        const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
        geometry.rotateX(-Math.PI / 2);
        // Center the plane so it spans 0..200 on both X and Z
        geometry.translate(WORLD_SIZE / 2, 0, WORLD_SIZE / 2);

        const material = new THREE.MeshStandardMaterial({
            color: GROUND_COLOR,
            roughness: 0.9,
            metalness: 0.0,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.name = 'ground';
        this.group.add(mesh);
    }

    // ─── Grid Overlay ───────────────────────────────────────────────

    _createGrid() {
        const positions = [];
        const lineCount = WORLD_SIZE / GRID_SPACING;

        // Lines parallel to Z axis (varying X)
        for (let i = 0; i <= lineCount; i++) {
            const x = i * GRID_SPACING;
            positions.push(x, 0.01, 0, x, 0.01, WORLD_SIZE);
        }

        // Lines parallel to X axis (varying Z)
        for (let i = 0; i <= lineCount; i++) {
            const z = i * GRID_SPACING;
            positions.push(0, 0.01, z, WORLD_SIZE, 0.01, z);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.4,
        });

        const grid = new THREE.LineSegments(geometry, material);
        grid.name = 'grid-overlay';
        this.group.add(grid);
    }

    // ─── Lights ─────────────────────────────────────────────────────

    _createLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        ambient.name = 'ambient-light';
        this.group.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(50, 80, 50);
        directional.castShadow = true;
        directional.shadow.mapSize.set(1024, 1024);
        directional.shadow.camera.left = -WORLD_SIZE / 2;
        directional.shadow.camera.right = WORLD_SIZE / 2;
        directional.shadow.camera.top = WORLD_SIZE / 2;
        directional.shadow.camera.bottom = -WORLD_SIZE / 2;
        directional.shadow.camera.near = 1;
        directional.shadow.camera.far = 200;
        directional.name = 'directional-light';
        this.group.add(directional);
    }

    // ─── Public API (matches OutdoorLevel) ──────────────────────────

    getPlatformSystem() {
        return null;
    }

    getBounds() {
        return { minX: 0, maxX: WORLD_SIZE, minZ: 0, maxZ: WORLD_SIZE };
    }

    getPlayerSpawnPosition() {
        return { x: WORLD_SIZE / 2, y: 0, z: WORLD_SIZE / 2 };
    }

    getHeightAt(x, z) {
        return 0;
    }

    _getTerrainNormal(x, z) {
        return { x: 0, y: 1, z: 0 };
    }

    update(delta, elapsed) {
        // No animated objects on the flat level
    }
}
