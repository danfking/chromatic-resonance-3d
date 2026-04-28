// test-track-level.js - Test track with analytic terrain features for vehicle physics testing
// Matches OutdoorLevel / ArenaLevel public API. URL: ?level=testtrack

import * as THREE from 'three';

// ─── Constants ──────────────────────────────────────────────────────
const WORLD_SIZE = 200;
const SPAWN_CENTER = WORLD_SIZE / 2; // 100
const GROUND_SEGMENTS = 100;

// Ramp parameters
const RAMP_START_Z = 115;
const RAMP_END_Z = 145;
const RAMP_MIN_X = 70;
const RAMP_MAX_X = 130;
const RAMP_ANGLE_DEG = 10;
const RAMP_TAN = Math.tan(RAMP_ANGLE_DEG * Math.PI / 180); // tan(10°)

// Sinusoidal hills parameters
const HILLS_START_Z = 150;
const HILLS_END_Z = 190;
const HILLS_AMPLITUDE = 3;
const HILLS_WAVELENGTH = 20;

// Banked curve parameters
const BANK_CENTER_X = 140;
const BANK_CENTER_Z = 70;
const BANK_RADIUS = 20;
const BANK_HALF_WIDTH = 5; // road half-width for cross-slope

// Step drop parameters
const CLIFF_Z = 60;
const CLIFF_MIN_X = 85;
const CLIFF_MAX_X = 115;
const CLIFF_HEIGHT = 2;

// Flat starting zone
const FLAT_CENTER_X = 100;
const FLAT_CENTER_Z = 100;
const FLAT_RADIUS = 15;

/**
 * TestTrackLevel - Analytic terrain test track for vehicle physics verification.
 * Each section exercises a specific physics scenario: flat, ramp, hills, banking, cliff.
 */
export class TestTrackLevel {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = options;

        this.group = new THREE.Group();
        this.group.name = 'test-track-world';

        this.sceneLights = [];
        this.animatedObjects = [];
        this.platformSystem = null;
    }

    async build() {
        console.log('Building test track level...');

        this._setupLighting();
        this._buildGroundMesh();
        this._placeMarkers();

        this.scene.add(this.group);

        console.log('Test track level built.');
        return this;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TERRAIN HEIGHT (analytic)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Analytic terrain height at world position (x, z).
     * Features are evaluated in priority order; first match wins.
     */
    getHeightAt(x, z) {
        // 1. Flat starting zone — circle at center, height = 0
        const dx = x - FLAT_CENTER_X;
        const dz = z - FLAT_CENTER_Z;
        if (dx * dx + dz * dz <= FLAT_RADIUS * FLAT_RADIUS) {
            return 0;
        }

        // 2. Straight ramp — 10° incline from Z=115 to Z=145, X in [70..130]
        if (z >= RAMP_START_Z && z <= RAMP_END_Z && x >= RAMP_MIN_X && x <= RAMP_MAX_X) {
            return RAMP_TAN * (z - RAMP_START_Z);
        }

        // 3. Sinusoidal hills — Z=150 to Z=190, full X range
        if (z >= HILLS_START_Z && z <= HILLS_END_Z) {
            return HILLS_AMPLITUDE * Math.sin((z - HILLS_START_Z) * 2 * Math.PI / HILLS_WAVELENGTH);
        }

        // 4. Banked curve — quarter circle around (140, 70), radius 20
        //    Banking: cross-slope in X direction, angle increases with angular position
        const bx = x - BANK_CENTER_X;
        const bz = z - BANK_CENTER_Z;
        const distToCenter = Math.sqrt(bx * bx + bz * bz);
        if (distToCenter >= BANK_RADIUS - BANK_HALF_WIDTH &&
            distToCenter <= BANK_RADIUS + BANK_HALF_WIDTH) {
            // Only in the quarter circle quadrant (negative X, negative Z from center)
            // i.e., x <= 140 and z <= 70 → angles from PI to 3*PI/2
            if (x <= BANK_CENTER_X && z <= BANK_CENTER_Z) {
                const angle = Math.atan2(bz, bx); // range [-PI, PI]
                // Normalize angular position within the quarter: PI to 3*PI/2 mapped to 0..1
                // atan2 for x<=cx, z<=cz gives angles in [-PI, -PI/2]
                const t = (angle - (-Math.PI)) / ((-Math.PI / 2) - (-Math.PI)); // 0 at -PI, 1 at -PI/2
                const bankAngle = t * 15 * Math.PI / 180; // 0° to 15° banking
                // Cross-slope: height varies with lateral offset from the ideal radius
                const lateralOffset = distToCenter - BANK_RADIUS;
                return Math.tan(bankAngle) * lateralOffset;
            }
        }

        // 5. Step drop (cliff) — at Z=60, X in [85..115]
        if (x >= CLIFF_MIN_X && x <= CLIFF_MAX_X) {
            if (z < CLIFF_Z) {
                return CLIFF_HEIGHT;
            }
            // z >= CLIFF_Z falls through to default (height = 0)
        }

        // 6. Default — flat at height 0
        return 0;
    }

    /**
     * Terrain surface normal via finite differences from getHeightAt.
     */
    _getTerrainNormal(x, z) {
        const eps = 0.5;
        const hL = this.getHeightAt(x - eps, z);
        const hR = this.getHeightAt(x + eps, z);
        const hD = this.getHeightAt(x, z - eps);
        const hU = this.getHeightAt(x, z + eps);

        // Cross product of tangent vectors gives normal
        // tangentX = (2*eps, hR - hL, 0), tangentZ = (0, hU - hD, 2*eps)
        const nx = (hL - hR);
        const ny = 2 * eps;
        const nz = (hD - hU);
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return { x: nx / len, y: ny / len, z: nz / len };
    }

    // ═══════════════════════════════════════════════════════════════════
    // LIGHTING
    // ═══════════════════════════════════════════════════════════════════

    _setupLighting() {
        // Hemisphere light for ambient fill
        const hemi = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.6);
        this.group.add(hemi);
        this.sceneLights.push(hemi);

        // Directional light as sun
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(50, 80, 30);
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        dir.shadow.camera.left = -100;
        dir.shadow.camera.right = 100;
        dir.shadow.camera.top = 100;
        dir.shadow.camera.bottom = -100;
        dir.shadow.camera.near = 1;
        dir.shadow.camera.far = 200;
        this.group.add(dir);
        this.sceneLights.push(dir);
    }

    // ═══════════════════════════════════════════════════════════════════
    // GROUND MESH
    // ═══════════════════════════════════════════════════════════════════

    _buildGroundMesh() {
        const geometry = new THREE.PlaneGeometry(
            WORLD_SIZE, WORLD_SIZE,
            GROUND_SEGMENTS, GROUND_SEGMENTS
        );

        // Rotate plane to lie flat (XZ plane), then translate so it spans 0..200
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(SPAWN_CENTER, 0, SPAWN_CENTER);

        // Displace vertices by analytic height function
        const posAttr = geometry.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i); // Already in world coords after translate
            const z = posAttr.getZ(i);
            const y = this.getHeightAt(x, z);
            posAttr.setY(i, y);

            // Color-code terrain sections for visual clarity
            const color = this._getTerrainColor(x, z);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.0,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.name = 'test-track-ground';
        this.group.add(mesh);
    }

    /**
     * Assign colors to terrain based on which feature zone a point falls in.
     */
    _getTerrainColor(x, z) {
        const dx = x - FLAT_CENTER_X;
        const dz = z - FLAT_CENTER_Z;

        // Flat starting zone — light gray
        if (dx * dx + dz * dz <= FLAT_RADIUS * FLAT_RADIUS) {
            return { r: 0.7, g: 0.7, b: 0.7 };
        }

        // Ramp — warm tan
        if (z >= RAMP_START_Z && z <= RAMP_END_Z && x >= RAMP_MIN_X && x <= RAMP_MAX_X) {
            return { r: 0.8, g: 0.65, b: 0.4 };
        }

        // Hills — green gradient
        if (z >= HILLS_START_Z && z <= HILLS_END_Z) {
            return { r: 0.3, g: 0.65, b: 0.3 };
        }

        // Banked curve region
        const bx = x - BANK_CENTER_X;
        const bz = z - BANK_CENTER_Z;
        const distToCenter = Math.sqrt(bx * bx + bz * bz);
        if (distToCenter >= BANK_RADIUS - BANK_HALF_WIDTH &&
            distToCenter <= BANK_RADIUS + BANK_HALF_WIDTH &&
            x <= BANK_CENTER_X && z <= BANK_CENTER_Z) {
            return { r: 0.85, g: 0.45, b: 0.2 };
        }

        // Cliff area
        if (x >= CLIFF_MIN_X && x <= CLIFF_MAX_X && z < CLIFF_Z + 5 && z > CLIFF_Z - 10) {
            return { r: 0.55, g: 0.45, b: 0.35 };
        }

        // Default terrain — muted green
        return { r: 0.45, g: 0.55, b: 0.35 };
    }

    // ═══════════════════════════════════════════════════════════════════
    // VISUAL MARKERS (cone markers at section boundaries)
    // ═══════════════════════════════════════════════════════════════════

    _placeMarkers() {
        const coneGeo = new THREE.ConeGeometry(0.5, 2, 8);

        // Green cones at ramp start (Z=115)
        this._addMarkerRow(coneGeo, 0x00cc44, RAMP_MIN_X, RAMP_MAX_X, RAMP_START_Z, 10);

        // Blue cones at hills start (Z=150)
        this._addMarkerRow(coneGeo, 0x2288ff, 0, WORLD_SIZE, HILLS_START_Z, 20);

        // Orange cones at cliff edge (Z=60)
        this._addMarkerRow(coneGeo, 0xff8800, CLIFF_MIN_X, CLIFF_MAX_X, CLIFF_Z, 5);

        // Red cones at banked curve entrance
        // Place at the start of the quarter circle (angle = -PI, i.e., x = cx - R, z = cz)
        const entranceX = BANK_CENTER_X - BANK_RADIUS;
        const entranceZ = BANK_CENTER_Z;
        this._addMarkerCone(coneGeo, 0xff2222, entranceX, entranceZ);
        this._addMarkerCone(coneGeo, 0xff2222, entranceX, entranceZ - 3);
        this._addMarkerCone(coneGeo, 0xff2222, entranceX, entranceZ + 3);
        // Also at the exit of the quarter circle (angle = -PI/2, i.e., x = cx, z = cz - R)
        const exitX = BANK_CENTER_X;
        const exitZ = BANK_CENTER_Z - BANK_RADIUS;
        this._addMarkerCone(coneGeo, 0xff2222, exitX, exitZ);
        this._addMarkerCone(coneGeo, 0xff2222, exitX - 3, exitZ);
        this._addMarkerCone(coneGeo, 0xff2222, exitX + 3, exitZ);
    }

    _addMarkerRow(coneGeo, color, minX, maxX, z, spacing) {
        for (let x = minX; x <= maxX; x += spacing) {
            this._addMarkerCone(coneGeo, color, x, z);
        }
    }

    _addMarkerCone(coneGeo, color, x, z) {
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
        });
        const cone = new THREE.Mesh(coneGeo, mat);
        const y = this.getHeightAt(x, z);
        cone.position.set(x, y + 1, z); // world coordinates (group is at origin)
        cone.castShadow = true;
        cone.name = 'marker-cone';
        this.group.add(cone);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PUBLIC API (matches OutdoorLevel / ArenaLevel interface)
    // ═══════════════════════════════════════════════════════════════════

    getPlatformSystem() {
        const self = this;
        const dummyObject = { userData: {} };
        const upNormal = new THREE.Vector3(0, 1, 0);
        const blobGroundOffset = 0.25;

        return {
            isOutdoorTerrain: true,
            getSurfaceBelow(position, maxDistance = 10) {
                const rawGroundY = self.getHeightAt(position.x, position.z);
                const groundY = rawGroundY + blobGroundOffset;

                const dist = position.y - groundY;
                if (dist < 0 || dist > maxDistance) return null;

                const normal = self._getTerrainNormal(position.x, position.z);

                return {
                    point: new THREE.Vector3(position.x, groundY, position.z),
                    distance: dist,
                    normal: new THREE.Vector3(normal.x, normal.y, normal.z),
                    object: dummyObject,
                    isPlatform: false,
                    isRamp: false,
                    slopeAngle: 0,
                };
            },
            isOnPlatform(position, tolerance = 0.5) {
                const surface = this.getSurfaceBelow(position, tolerance + 0.1);
                return surface !== null && surface.distance <= tolerance;
            },
        };
    }

    getPlayerSpawnPosition() {
        const rawY = this.getHeightAt(SPAWN_CENTER, SPAWN_CENTER);
        const blobGroundOffset = 0.25;
        return new THREE.Vector3(SPAWN_CENTER, rawY + blobGroundOffset + 1, SPAWN_CENTER);
    }

    getBounds() {
        return {
            minX: 0,
            maxX: WORLD_SIZE,
            minZ: 0,
            maxZ: WORLD_SIZE,
            centerX: SPAWN_CENTER,
            centerZ: SPAWN_CENTER,
        };
    }

    getEnemySpawns() {
        return []; // No enemies on the test track
    }

    getTheme() {
        return {
            name: 'Test Track',
            colors: {
                floor: 0x888888,
                wall: 0x999999,
                accent: 0xff8800,
            },
        };
    }

    getStats() {
        let meshCount = 0;
        this.group.traverse(obj => {
            if (obj.isMesh) meshCount++;
        });
        return {
            approach: 'test-track',
            meshes: meshCount,
            particles: 0,
        };
    }

    update(delta, elapsed) {
        // No animated objects on the test track currently.
        // Reserved for future wind flags, animated markers, etc.
    }
}
