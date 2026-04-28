// jeep-vehicle.js - Procedural jeep from Three.js primitives
// Extends THREE.Group with update(delta) and dispose() matching blob-vehicle.js pattern

import * as THREE from 'three';

const DEFAULT_CONFIG = {
    length: 4.0,
    width: 1.8,
    height: 1.2,
    groundClearance: 0.45,
    wheelRadius: 0.40,
    wheelWidth: 0.25,
    cabinHeight: 0.8,
    windshieldAngle: 25,
    bodyColor: 0x4a6741,
    trimColor: 0x2a2a2a,
    wheelColor: 0x1a1a1a,
    rimColor: 0x888888,
    glassColor: 0x88aacc,
    headlightColor: 0xffffee,
};

// Reusable temp vectors
const _v1 = new THREE.Vector3();

export class JeepVehicle extends THREE.Group {
    /**
     * @param {object} config - Vehicle configuration overrides
     */
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.wheelMeshes = [];
        this.wheelSpeed = 0;

        // Groups for explode view
        this.bodyGroup = new THREE.Group();
        this.bodyGroup.name = 'body';
        this.cabinGroup = new THREE.Group();
        this.cabinGroup.name = 'cabin';
        this.wheelGroup = new THREE.Group();
        this.wheelGroup.name = 'wheels';
        this.detailGroup = new THREE.Group();
        this.detailGroup.name = 'details';
        this.accessoryGroup = new THREE.Group();
        this.accessoryGroup.name = 'accessories';

        this.add(this.bodyGroup);
        this.add(this.cabinGroup);
        this.add(this.wheelGroup);
        this.add(this.detailGroup);
        this.add(this.accessoryGroup);

        // Explode state — original positions stored for reset
        this._explodeFactor = 0;
        this._groupRestPositions = new Map();

        // Materials (shared across meshes for efficiency)
        this._materials = this._createMaterials();

        // Build all geometry
        this._buildChassis();
        this._buildCabin();
        this._buildWheels();
        this._buildDetails();
        this._buildAccessories();

        // Store rest positions for explode
        this._storeRestPositions();
    }

    // --- Material factory ---

    _createMaterials() {
        const c = this.config;
        return {
            body: new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.7, metalness: 0.1 }),
            trim: new THREE.MeshStandardMaterial({ color: c.trimColor, roughness: 0.8, metalness: 0.2 }),
            wheel: new THREE.MeshStandardMaterial({ color: c.wheelColor, roughness: 0.9, metalness: 0.05 }),
            rim: new THREE.MeshStandardMaterial({ color: c.rimColor, roughness: 0.3, metalness: 0.6 }),
            glass: new THREE.MeshStandardMaterial({
                color: c.glassColor, roughness: 0.1, metalness: 0.1,
                transparent: true, opacity: 0.4,
            }),
            headlight: new THREE.MeshStandardMaterial({
                color: c.headlightColor, emissive: c.headlightColor,
                emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3,
            }),
            chrome: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.15, metalness: 0.8 }),
        };
    }

    // --- Chassis (body, hood, rear bed) ---

    _buildChassis() {
        const c = this.config;
        const baseY = c.groundClearance + c.height * 0.25;

        // Main chassis box
        const chassis = new THREE.Mesh(
            new THREE.BoxGeometry(c.width, c.height * 0.5, c.length),
            this._materials.body
        );
        chassis.position.set(0, baseY, 0);
        chassis.name = 'chassis';
        this.bodyGroup.add(chassis);

        // Hood — slightly raised front section
        const hoodLen = c.length * 0.3;
        const hood = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, c.height * 0.15, hoodLen),
            this._materials.body
        );
        hood.position.set(0, baseY + c.height * 0.25 + c.height * 0.075, c.length * 0.5 - hoodLen * 0.5 - 0.05);
        hood.name = 'hood';
        this.bodyGroup.add(hood);

        // Hood scoop (subtle raised ridge)
        const scoop = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.06, hoodLen * 0.6),
            this._materials.trim
        );
        scoop.position.set(0, hood.position.y + c.height * 0.075 + 0.03, hood.position.z);
        scoop.name = 'hoodScoop';
        this.bodyGroup.add(scoop);

        // Rear bed — open cargo area behind cabin
        const bedLen = c.length * 0.25;
        const bedWallH = c.height * 0.3;
        const bedBaseZ = -c.length * 0.5 + bedLen * 0.5 + 0.05;

        // Bed floor
        const bedFloor = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, 0.06, bedLen),
            this._materials.body
        );
        bedFloor.position.set(0, baseY + c.height * 0.25, bedBaseZ);
        bedFloor.name = 'bedFloor';
        this.bodyGroup.add(bedFloor);

        // Bed side walls (left and right)
        for (const side of [-1, 1]) {
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, bedWallH, bedLen),
                this._materials.body
            );
            wall.position.set(side * (c.width * 0.5 - 0.04), baseY + c.height * 0.25 + bedWallH * 0.5, bedBaseZ);
            wall.name = `bedWall${side > 0 ? 'Right' : 'Left'}`;
            this.bodyGroup.add(wall);
        }

        // Bed tailgate
        const tailgate = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, bedWallH, 0.08),
            this._materials.body
        );
        tailgate.position.set(0, baseY + c.height * 0.25 + bedWallH * 0.5, -c.length * 0.5 + 0.04);
        tailgate.name = 'tailgate';
        this.bodyGroup.add(tailgate);

        // Skid plate (undercarriage protection)
        const skidPlate = new THREE.Mesh(
            new THREE.BoxGeometry(c.width * 0.6, 0.04, c.length * 0.5),
            this._materials.trim
        );
        skidPlate.position.set(0, c.groundClearance - 0.02, 0);
        skidPlate.name = 'skidPlate';
        this.bodyGroup.add(skidPlate);
    }

    // --- Cabin ---

    _buildCabin() {
        const c = this.config;
        const baseY = c.groundClearance + c.height * 0.5;
        const cabinZ = c.length * 0.05; // slightly forward of center

        // Cabin box
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.15, c.cabinHeight, c.length * 0.35),
            this._materials.body
        );
        cabin.position.set(0, baseY + c.cabinHeight * 0.5, cabinZ);
        cabin.name = 'cabin';
        this.cabinGroup.add(cabin);

        // Windshield — angled glass panel
        const wsWidth = c.width - 0.3;
        const wsHeight = c.cabinHeight * 0.7;
        const windshield = new THREE.Mesh(
            new THREE.BoxGeometry(wsWidth, wsHeight, 0.04),
            this._materials.glass
        );
        const wsAngleRad = THREE.MathUtils.degToRad(c.windshieldAngle);
        windshield.rotation.x = -wsAngleRad;
        const wsFrontZ = cabinZ + c.length * 0.35 * 0.5;
        windshield.position.set(0, baseY + c.cabinHeight * 0.55, wsFrontZ + 0.08);
        windshield.name = 'windshield';
        this.cabinGroup.add(windshield);

        // Rear window
        const rearWindow = new THREE.Mesh(
            new THREE.BoxGeometry(wsWidth * 0.85, wsHeight * 0.7, 0.04),
            this._materials.glass
        );
        rearWindow.rotation.x = wsAngleRad * 0.3;
        const rearZ = cabinZ - c.length * 0.35 * 0.5;
        rearWindow.position.set(0, baseY + c.cabinHeight * 0.55, rearZ - 0.08);
        rearWindow.name = 'rearWindow';
        this.cabinGroup.add(rearWindow);

        // Side windows (left and right)
        const sideWinLen = c.length * 0.35 - 0.3;
        for (const side of [-1, 1]) {
            const sideWindow = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, wsHeight * 0.65, sideWinLen),
                this._materials.glass
            );
            sideWindow.position.set(
                side * (c.width * 0.5 - 0.06),
                baseY + c.cabinHeight * 0.5,
                cabinZ
            );
            sideWindow.name = `sideWindow${side > 0 ? 'Right' : 'Left'}`;
            this.cabinGroup.add(sideWindow);
        }

        // Roof (slightly wider for visual weight)
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, 0.06, c.length * 0.36),
            this._materials.body
        );
        roof.position.set(0, baseY + c.cabinHeight + 0.03, cabinZ);
        roof.name = 'roof';
        this.cabinGroup.add(roof);
    }

    // --- Wheels ---

    _buildWheels() {
        const c = this.config;
        const wheelY = c.wheelRadius;
        const halfLen = c.length * 0.37;
        const halfWidth = c.width * 0.5 + c.wheelWidth * 0.3;

        const positions = [
            { x: halfWidth, z: halfLen, name: 'wheelFR' },
            { x: -halfWidth, z: halfLen, name: 'wheelFL' },
            { x: halfWidth, z: -halfLen, name: 'wheelRR' },
            { x: -halfWidth, z: -halfLen, name: 'wheelRL' },
        ];

        for (const pos of positions) {
            const wheelAssembly = new THREE.Group();
            wheelAssembly.name = pos.name;

            // Tire (torus)
            const tire = new THREE.Mesh(
                new THREE.TorusGeometry(c.wheelRadius, c.wheelRadius * 0.3, 8, 16),
                this._materials.wheel
            );
            tire.rotation.y = Math.PI / 2;
            wheelAssembly.add(tire);

            // Rim (cylinder)
            const rim = new THREE.Mesh(
                new THREE.CylinderGeometry(c.wheelRadius * 0.7, c.wheelRadius * 0.7, c.wheelWidth * 0.7, 12),
                this._materials.rim
            );
            rim.rotation.z = Math.PI / 2;
            wheelAssembly.add(rim);

            // Hub cap (small cylinder)
            const hub = new THREE.Mesh(
                new THREE.CylinderGeometry(c.wheelRadius * 0.2, c.wheelRadius * 0.2, c.wheelWidth * 0.8, 8),
                this._materials.chrome
            );
            hub.rotation.z = Math.PI / 2;
            wheelAssembly.add(hub);

            // Wheel spokes (5 thin boxes radiating from center)
            for (let i = 0; i < 5; i++) {
                const spoke = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04, c.wheelRadius * 0.5, 0.04),
                    this._materials.rim
                );
                spoke.position.y = c.wheelRadius * 0.35;
                spoke.rotation.z = (i / 5) * Math.PI * 2;
                // Rotate around the axle axis
                const spokeGroup = new THREE.Group();
                spokeGroup.rotation.x = (i / 5) * Math.PI * 2;
                spokeGroup.add(spoke);
                wheelAssembly.add(spokeGroup);
            }

            wheelAssembly.position.set(pos.x, wheelY, pos.z);
            this.wheelGroup.add(wheelAssembly);
            this.wheelMeshes.push(wheelAssembly);
        }
    }

    // --- Details (bumpers, grille, headlights, fenders, roll cage, side steps) ---

    _buildDetails() {
        const c = this.config;
        const baseY = c.groundClearance + c.height * 0.25;
        const frontZ = c.length * 0.5;
        const rearZ = -c.length * 0.5;

        // Front bumper
        const frontBumper = new THREE.Mesh(
            new THREE.BoxGeometry(c.width + 0.15, c.height * 0.2, 0.12),
            this._materials.trim
        );
        frontBumper.position.set(0, baseY - c.height * 0.05, frontZ + 0.06);
        frontBumper.name = 'frontBumper';
        this.detailGroup.add(frontBumper);

        // Rear bumper
        const rearBumper = new THREE.Mesh(
            new THREE.BoxGeometry(c.width + 0.1, c.height * 0.18, 0.1),
            this._materials.trim
        );
        rearBumper.position.set(0, baseY - c.height * 0.05, rearZ - 0.05);
        rearBumper.name = 'rearBumper';
        this.detailGroup.add(rearBumper);

        // Grille — 7 horizontal slats
        const grilleWidth = c.width * 0.55;
        const grilleHeight = c.height * 0.35;
        const slotHeight = grilleHeight / 7;
        for (let i = 0; i < 7; i++) {
            const slat = new THREE.Mesh(
                new THREE.BoxGeometry(grilleWidth, slotHeight * 0.6, 0.05),
                this._materials.chrome
            );
            const slotY = baseY + c.height * 0.08 + (i - 3) * slotHeight;
            slat.position.set(0, slotY, frontZ + 0.03);
            slat.name = `grilleSlat${i}`;
            this.detailGroup.add(slat);
        }

        // Headlights (left and right)
        for (const side of [-1, 1]) {
            const headlight = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12),
                this._materials.headlight
            );
            headlight.rotation.x = Math.PI / 2;
            headlight.position.set(side * (c.width * 0.35), baseY + c.height * 0.1, frontZ + 0.04);
            headlight.name = `headlight${side > 0 ? 'Right' : 'Left'}`;
            this.detailGroup.add(headlight);
        }

        // Tail lights
        for (const side of [-1, 1]) {
            const taillight = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.1, 0.06),
                new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x661111, emissiveIntensity: 0.3 })
            );
            taillight.position.set(side * (c.width * 0.38), baseY + c.height * 0.05, rearZ - 0.03);
            taillight.name = `taillight${side > 0 ? 'Right' : 'Left'}`;
            this.detailGroup.add(taillight);
        }

        // Fenders — angled boxes over each wheel
        this._buildFenders();

        // Roll cage
        this._buildRollCage();

        // Side steps
        this._buildSideSteps();
    }

    _buildFenders() {
        const c = this.config;
        const wheelY = c.wheelRadius;
        const halfLen = c.length * 0.37;
        const halfWidth = c.width * 0.5;

        const positions = [
            { x: halfWidth, z: halfLen, name: 'fenderFR' },
            { x: -halfWidth, z: halfLen, name: 'fenderFL' },
            { x: halfWidth, z: -halfLen, name: 'fenderRR' },
            { x: -halfWidth, z: -halfLen, name: 'fenderRL' },
        ];

        for (const pos of positions) {
            // Fender arch — a wider box arching over the wheel
            const fender = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, c.wheelRadius * 0.6, c.wheelRadius * 2.2),
                this._materials.body
            );
            fender.position.set(
                pos.x + Math.sign(pos.x) * 0.06,
                wheelY + c.wheelRadius * 0.6,
                pos.z
            );
            fender.name = pos.name;
            this.detailGroup.add(fender);

            // Fender top cap
            const cap = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.06, c.wheelRadius * 2.3),
                this._materials.body
            );
            cap.position.set(
                pos.x + Math.sign(pos.x) * 0.06,
                wheelY + c.wheelRadius * 0.9,
                pos.z
            );
            cap.name = pos.name + 'Cap';
            this.detailGroup.add(cap);
        }
    }

    _buildRollCage() {
        const c = this.config;
        const baseY = c.groundClearance + c.height * 0.5;
        const cabinZ = c.length * 0.05;
        const cabinHalfLen = c.length * 0.35 * 0.5;
        const topY = baseY + c.cabinHeight;
        const postR = 0.03;

        // 4 vertical posts at cabin corners
        const postPositions = [
            { x: c.width * 0.42, z: cabinZ + cabinHalfLen - 0.1, name: 'rcPostFR' },
            { x: -c.width * 0.42, z: cabinZ + cabinHalfLen - 0.1, name: 'rcPostFL' },
            { x: c.width * 0.42, z: cabinZ - cabinHalfLen + 0.1, name: 'rcPostRR' },
            { x: -c.width * 0.42, z: cabinZ - cabinHalfLen + 0.1, name: 'rcPostRL' },
        ];

        for (const pp of postPositions) {
            const post = new THREE.Mesh(
                new THREE.CylinderGeometry(postR, postR, c.cabinHeight, 6),
                this._materials.trim
            );
            post.position.set(pp.x, baseY + c.cabinHeight * 0.5, pp.z);
            post.name = pp.name;
            this.detailGroup.add(post);
        }

        // Cross bars — front and rear
        for (const z of [cabinZ + cabinHalfLen - 0.1, cabinZ - cabinHalfLen + 0.1]) {
            const crossBar = new THREE.Mesh(
                new THREE.CylinderGeometry(postR * 0.8, postR * 0.8, c.width * 0.84, 6),
                this._materials.trim
            );
            crossBar.rotation.z = Math.PI / 2;
            crossBar.position.set(0, topY + 0.06, z);
            crossBar.name = `rcCrossBar_${z > 0 ? 'front' : 'rear'}`;
            this.detailGroup.add(crossBar);
        }

        // Side bars (connecting front/rear posts on each side)
        for (const side of [-1, 1]) {
            const sideBar = new THREE.Mesh(
                new THREE.CylinderGeometry(postR * 0.8, postR * 0.8, cabinHalfLen * 2 - 0.2, 6),
                this._materials.trim
            );
            sideBar.rotation.x = Math.PI / 2;
            sideBar.position.set(side * c.width * 0.42, topY + 0.06, cabinZ);
            sideBar.name = `rcSideBar${side > 0 ? 'Right' : 'Left'}`;
            this.detailGroup.add(sideBar);
        }
    }

    _buildSideSteps() {
        const c = this.config;
        const stepY = c.groundClearance + 0.05;

        for (const side of [-1, 1]) {
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.04, c.length * 0.45),
                this._materials.trim
            );
            step.position.set(side * (c.width * 0.5 + 0.08), stepY, 0);
            step.name = `sideStep${side > 0 ? 'Right' : 'Left'}`;
            this.detailGroup.add(step);
        }
    }

    // --- Accessories (spare tire, roof rack, light bar, snorkel) ---

    _buildAccessories() {
        const c = this.config;
        const baseY = c.groundClearance + c.height * 0.5;
        const topY = baseY + c.cabinHeight;
        const rearZ = -c.length * 0.5;

        // Spare tire — mounted on tailgate
        const spareTire = new THREE.Group();
        spareTire.name = 'spareTire';
        const spTire = new THREE.Mesh(
            new THREE.TorusGeometry(c.wheelRadius * 0.85, c.wheelRadius * 0.25, 8, 16),
            this._materials.wheel
        );
        spareTire.add(spTire);
        const spRim = new THREE.Mesh(
            new THREE.CylinderGeometry(c.wheelRadius * 0.55, c.wheelRadius * 0.55, c.wheelWidth * 0.5, 12),
            this._materials.rim
        );
        spRim.rotation.z = Math.PI / 2;
        spareTire.add(spRim);
        // Mount bracket
        const bracket = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, c.wheelRadius * 1.2, 0.06),
            this._materials.trim
        );
        bracket.position.z = -0.15;
        spareTire.add(bracket);
        spareTire.position.set(0, baseY + c.height * 0.15, rearZ - 0.2);
        this.accessoryGroup.add(spareTire);

        // Roof rack — flat frame on top of cabin
        const roofRack = new THREE.Group();
        roofRack.name = 'roofRack';
        const rackWidth = c.width - 0.3;
        const rackLen = c.length * 0.3;
        // Side rails
        for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.04, rackLen),
                this._materials.trim
            );
            rail.position.set(side * rackWidth * 0.5, 0, 0);
            roofRack.add(rail);
        }
        // Cross rails
        for (let i = 0; i < 4; i++) {
            const crossRail = new THREE.Mesh(
                new THREE.BoxGeometry(rackWidth, 0.04, 0.04),
                this._materials.trim
            );
            crossRail.position.set(0, 0, (i / 3 - 0.5) * rackLen);
            roofRack.add(crossRail);
        }
        roofRack.position.set(0, topY + 0.1, c.length * 0.05);
        this.accessoryGroup.add(roofRack);

        // Light bar — row of lights on roof rack
        const lightBar = new THREE.Group();
        lightBar.name = 'lightBar';
        const barBase = new THREE.Mesh(
            new THREE.BoxGeometry(c.width * 0.6, 0.08, 0.1),
            this._materials.trim
        );
        lightBar.add(barBase);
        // 5 light pods
        for (let i = 0; i < 5; i++) {
            const pod = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.06, 0.08),
                this._materials.headlight
            );
            pod.position.set((i - 2) * (c.width * 0.12), 0.07, 0);
            lightBar.add(pod);
        }
        lightBar.position.set(0, topY + 0.16, c.length * 0.05 + c.length * 0.15);
        this.accessoryGroup.add(lightBar);

        // Snorkel — air intake running up A-pillar
        const snorkel = new THREE.Group();
        snorkel.name = 'snorkel';
        // Vertical pipe
        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, c.cabinHeight + 0.3, 8),
            this._materials.trim
        );
        pipe.position.y = c.cabinHeight * 0.5;
        snorkel.add(pipe);
        // Top cap (air intake)
        const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.04, 0.15, 8),
            this._materials.trim
        );
        cap.position.y = c.cabinHeight + 0.15;
        snorkel.add(cap);
        snorkel.position.set(
            c.width * 0.5 + 0.05,
            baseY,
            c.length * 0.05 + c.length * 0.35 * 0.5 - 0.1
        );
        this.accessoryGroup.add(snorkel);
    }

    // --- Explode view ---

    _storeRestPositions() {
        const groups = [this.bodyGroup, this.cabinGroup, this.wheelGroup, this.detailGroup, this.accessoryGroup];
        for (const g of groups) {
            this._groupRestPositions.set(g.name, g.position.clone());
        }
    }

    /**
     * Separate groups outward for part inspection
     * @param {number} factor - 0 = assembled, 1 = fully exploded
     */
    setExplode(factor) {
        this._explodeFactor = THREE.MathUtils.clamp(factor, 0, 1);

        const offsets = {
            body: new THREE.Vector3(0, -factor * 0.5, 0),
            cabin: new THREE.Vector3(0, factor * 1.5, 0),
            wheels: new THREE.Vector3(0, -factor * 0.3, 0),
            details: new THREE.Vector3(0, factor * 0.8, factor * 0.5),
            accessories: new THREE.Vector3(0, factor * 2.5, -factor * 0.5),
        };

        const groups = [this.bodyGroup, this.cabinGroup, this.wheelGroup, this.detailGroup, this.accessoryGroup];
        for (const g of groups) {
            const rest = this._groupRestPositions.get(g.name);
            const offset = offsets[g.name];
            if (rest && offset) {
                g.position.copy(rest).add(offset);
            }
        }
    }

    // --- Public API ---

    /**
     * Set the body color
     * @param {number|THREE.Color} color
     */
    setBodyColor(color) {
        this._materials.body.color.set(color);
    }

    /**
     * Toggle accessory visibility by name
     * @param {string} name - 'spareTire', 'roofRack', 'lightBar', 'snorkel'
     * @param {boolean} visible
     */
    toggleAccessory(name, visible) {
        const child = this.accessoryGroup.getObjectByName(name);
        if (child) child.visible = visible;
    }

    /**
     * Get mesh count per group for verification
     * @returns {object}
     */
    getPartCounts() {
        const counts = {};
        const groups = [this.bodyGroup, this.cabinGroup, this.wheelGroup, this.detailGroup, this.accessoryGroup];
        for (const g of groups) {
            let count = 0;
            g.traverse(obj => { if (obj.isMesh) count++; });
            counts[g.name] = count;
        }
        counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
        return counts;
    }

    /**
     * Animate wheel spin
     * @param {number} delta - Frame delta in seconds
     */
    update(delta) {
        // Spin wheels
        this.wheelSpeed = 2; // constant spin for display
        for (const wheel of this.wheelMeshes) {
            wheel.rotation.x += this.wheelSpeed * delta;
        }
    }

    /**
     * Clean up all geometry and materials
     */
    dispose() {
        this.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
            }
        });
        for (const mat of Object.values(this._materials)) {
            mat.dispose();
        }
    }

    // --- Factory presets ---

    /**
     * Default olive drab jeep
     * @returns {JeepVehicle}
     */
    static buildDefault() {
        return new JeepVehicle();
    }

    /**
     * Military OD green with matte finish
     * @returns {JeepVehicle}
     */
    static buildMilitary() {
        return new JeepVehicle({
            bodyColor: 0x3d4f2f,
            trimColor: 0x222222,
            rimColor: 0x555555,
        });
    }

    /**
     * Desert tan variant
     * @returns {JeepVehicle}
     */
    static buildDesert() {
        return new JeepVehicle({
            bodyColor: 0xc4a76c,
            trimColor: 0x3a3a3a,
            rimColor: 0x999999,
        });
    }
}
