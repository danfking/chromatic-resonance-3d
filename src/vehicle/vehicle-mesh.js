// vehicle-mesh.js - Enhanced procedural vehicle mesh with socket attachment system
// Extends THREE.Group with damage visuals, detachable panels, and named attachment sockets

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
    bodyColor: 0x8B7355,  // dusty khaki — scrappy research cart, not a new car
    trimColor: 0x2a2a2a,
    wheelColor: 0x1a1a1a,
    rimColor: 0x888888,
    glassColor: 0x88aacc,
    headlightColor: 0xffffee,
    chromeColor: 0xcccccc,
};

// Named socket attachment points with categories
export const VEHICLE_SOCKETS = {
    'roof-center':  { pos: null, categories: ['WEAPON'] },
    'bed-left':     { pos: null, categories: ['WEAPON', 'UTILITY'] },
    'bed-right':    { pos: null, categories: ['WEAPON', 'UTILITY'] },
    'bumper-front': { pos: null, categories: ['DEFENSE'] },
    'bumper-rear':  { pos: null, categories: ['DEFENSE'] },
    'side-left':    { pos: null, categories: ['ARMOR'] },
    'side-right':   { pos: null, categories: ['ARMOR'] },
    'wheel-fl':     { pos: null, categories: ['PROPULSION'] },
    'wheel-fr':     { pos: null, categories: ['PROPULSION'] },
    'wheel-rl':     { pos: null, categories: ['PROPULSION'] },
    'wheel-rr':     { pos: null, categories: ['PROPULSION'] },
    'hitch-rear':   { pos: null, categories: ['UTILITY'] },
    'rack-roof':    { pos: null, categories: ['UTILITY'] },
    'engine':       { pos: null, categories: ['ENGINE'] },
};

export class VehicleMesh extends THREE.Group {
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.wheelMeshes = [];

        // Named groups for damage system
        this.bodyGroup = new THREE.Group();
        this.bodyGroup.name = 'body';
        this.cabinGroup = new THREE.Group();
        this.cabinGroup.name = 'cabin';
        this.doorLeft = new THREE.Group();
        this.doorLeft.name = 'doorLeft';
        this.doorRight = new THREE.Group();
        this.doorRight.name = 'doorRight';
        this.hoodGroup = new THREE.Group();
        this.hoodGroup.name = 'hood';
        this.wheelGroup = new THREE.Group();
        this.wheelGroup.name = 'wheels';
        this.detailGroup = new THREE.Group();
        this.detailGroup.name = 'details';
        this.interiorGroup = new THREE.Group();
        this.interiorGroup.name = 'interior';
        this.suspensionGroup = new THREE.Group();
        this.suspensionGroup.name = 'suspension';

        this.add(this.bodyGroup);
        this.add(this.cabinGroup);
        this.add(this.doorLeft);
        this.add(this.doorRight);
        this.add(this.hoodGroup);
        this.add(this.wheelGroup);
        this.add(this.detailGroup);
        this.add(this.interiorGroup);
        this.add(this.suspensionGroup);

        // Socket Object3Ds
        this._sockets = new Map();
        this._attachedComponents = new Map();

        // Damage state
        this._damageRoughnessIncrease = 0;

        // Materials
        this._materials = this._createMaterials();

        // Build everything
        this._buildChassis();
        this._buildHood();
        this._buildCabin();
        this._buildDoors();
        this._buildInterior();
        this._buildWheels();
        this._buildSuspension();
        this._buildDetails();
        this._buildSockets();

        // Apply shadow casting to all meshes
        this.traverse(obj => {
            if (obj.isMesh) obj.castShadow = true;
        });
    }

    // --- Materials ---

    _createMaterials() {
        const c = this.config;
        return {
            body: new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.95, metalness: 0.05 }),
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
            chrome: new THREE.MeshStandardMaterial({ color: c.chromeColor, roughness: 0.15, metalness: 0.8 }),
            interior: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, metalness: 0.0 }),
            gauge: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x44ff44, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.2 }),
            suspension: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.4 }),
        };
    }

    // --- Computed dimensions (used throughout) ---

    get _dims() {
        const c = this.config;
        const baseY = c.groundClearance + c.height * 0.25;
        const topY = c.groundClearance + c.height * 0.5 + c.cabinHeight;
        const frontZ = c.length * 0.5;
        const rearZ = -c.length * 0.5;
        const halfW = c.width * 0.5;
        const midY = baseY + c.height * 0.25;
        const cabinZ = c.length * 0.05;
        const frontAxleZ = c.length * 0.37;
        const rearAxleZ = -c.length * 0.37;
        return { baseY, topY, frontZ, rearZ, halfW, midY, cabinZ, frontAxleZ, rearAxleZ };
    }

    // --- Chassis (main body panels with chamfered edges) ---

    _buildChassis() {
        const c = this.config;
        const { baseY, frontZ, rearZ, halfW } = this._dims;

        // Main chassis box
        const chassis = new THREE.Mesh(
            new THREE.BoxGeometry(c.width, c.height * 0.5, c.length),
            this._materials.body
        );
        chassis.position.set(0, baseY, 0);
        chassis.name = 'chassis';
        this.bodyGroup.add(chassis);

        // Chamfered bottom edges (4 long boxes angled at 45 deg along bottom edges)
        const chamferSize = 0.08;
        const chamferGeo = new THREE.BoxGeometry(chamferSize, chamferSize, c.length - 0.1);
        const bottomY = baseY - c.height * 0.25;
        const edgePositions = [
            { x: halfW, y: bottomY, rz: Math.PI / 4 },
            { x: -halfW, y: bottomY, rz: -Math.PI / 4 },
        ];
        for (const ep of edgePositions) {
            const chamfer = new THREE.Mesh(chamferGeo, this._materials.body);
            chamfer.position.set(ep.x, ep.y, 0);
            chamfer.rotation.z = ep.rz;
            chamfer.name = 'chamfer';
            this.bodyGroup.add(chamfer);
        }

        // Rear bed
        const bedLen = c.length * 0.25;
        const bedWallH = c.height * 0.3;
        const bedBaseZ = rearZ + bedLen * 0.5 + 0.05;

        // Bed floor
        const bedFloor = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, 0.06, bedLen),
            this._materials.body
        );
        bedFloor.position.set(0, baseY + c.height * 0.25, bedBaseZ);
        bedFloor.name = 'bedFloor';
        this.bodyGroup.add(bedFloor);

        // Bed side walls
        for (const side of [-1, 1]) {
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, bedWallH, bedLen),
                this._materials.body
            );
            wall.position.set(side * (halfW - 0.04), baseY + c.height * 0.25 + bedWallH * 0.5, bedBaseZ);
            wall.name = `bedWall${side > 0 ? 'Right' : 'Left'}`;
            this.bodyGroup.add(wall);
        }

        // Tailgate
        const tailgate = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, bedWallH, 0.08),
            this._materials.body
        );
        tailgate.position.set(0, baseY + c.height * 0.25 + bedWallH * 0.5, rearZ + 0.04);
        tailgate.name = 'tailgate';
        this.bodyGroup.add(tailgate);

        // Skid plate
        const skidPlate = new THREE.Mesh(
            new THREE.BoxGeometry(c.width * 0.6, 0.04, c.length * 0.5),
            this._materials.trim
        );
        skidPlate.position.set(0, c.groundClearance - 0.02, 0);
        skidPlate.name = 'skidPlate';
        this.bodyGroup.add(skidPlate);
    }

    // --- Hood (separate group, openable) ---

    _buildHood() {
        const c = this.config;
        const { baseY, frontZ } = this._dims;

        const hoodLen = c.length * 0.3;
        const hoodY = baseY + c.height * 0.25 + c.height * 0.075;

        // Main hood panel
        const hood = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, c.height * 0.15, hoodLen),
            this._materials.body
        );
        hood.position.set(0, hoodY, frontZ - hoodLen * 0.5 - 0.05);
        hood.name = 'hoodPanel';
        this.hoodGroup.add(hood);

        // Hood scoop
        const scoop = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.06, hoodLen * 0.6),
            this._materials.trim
        );
        scoop.position.set(0, hoodY + c.height * 0.075 + 0.03, hood.position.z);
        scoop.name = 'hoodScoop';
        this.hoodGroup.add(scoop);

        // Hood chamfered front edge
        const frontEdge = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.15, 0.05, 0.05),
            this._materials.body
        );
        frontEdge.position.set(0, hoodY + c.height * 0.06, frontZ - 0.07);
        frontEdge.rotation.x = Math.PI / 6;
        frontEdge.name = 'hoodFrontEdge';
        this.hoodGroup.add(frontEdge);
    }

    // --- Cabin ---

    _buildCabin() {
        const c = this.config;
        const { baseY, cabinZ } = this._dims;
        const cabinBaseY = c.groundClearance + c.height * 0.5;

        // Cabin box
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.15, c.cabinHeight, c.length * 0.35),
            this._materials.body
        );
        cabin.position.set(0, cabinBaseY + c.cabinHeight * 0.5, cabinZ);
        cabin.name = 'cabin';
        this.cabinGroup.add(cabin);

        // Windshield
        const wsWidth = c.width - 0.3;
        const wsHeight = c.cabinHeight * 0.7;
        const wsAngleRad = THREE.MathUtils.degToRad(c.windshieldAngle);
        const wsFrontZ = cabinZ + c.length * 0.35 * 0.5;

        const windshield = new THREE.Mesh(
            new THREE.BoxGeometry(wsWidth, wsHeight, 0.04),
            this._materials.glass
        );
        windshield.rotation.x = -wsAngleRad;
        windshield.position.set(0, cabinBaseY + c.cabinHeight * 0.55, wsFrontZ + 0.08);
        windshield.name = 'windshield';
        this.cabinGroup.add(windshield);

        // Rear window
        const rearWindow = new THREE.Mesh(
            new THREE.BoxGeometry(wsWidth * 0.85, wsHeight * 0.7, 0.04),
            this._materials.glass
        );
        const rearWinZ = cabinZ - c.length * 0.35 * 0.5;
        rearWindow.rotation.x = wsAngleRad * 0.3;
        rearWindow.position.set(0, cabinBaseY + c.cabinHeight * 0.55, rearWinZ - 0.08);
        rearWindow.name = 'rearWindow';
        this.cabinGroup.add(rearWindow);

        // Roof
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.1, 0.06, c.length * 0.36),
            this._materials.body
        );
        roof.position.set(0, cabinBaseY + c.cabinHeight + 0.03, cabinZ);
        roof.name = 'roof';
        this.cabinGroup.add(roof);
    }

    // --- Doors (separate groups, detachable) ---

    _buildDoors() {
        const c = this.config;
        const cabinBaseY = c.groundClearance + c.height * 0.5;
        const { cabinZ, halfW } = this._dims;
        const doorHeight = c.cabinHeight * 0.75;
        const doorLen = c.length * 0.22;

        for (const [side, group] of [[-1, this.doorLeft], [1, this.doorRight]]) {
            const xPos = side * (halfW - 0.04);

            // Door panel
            const door = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, doorHeight, doorLen),
                this._materials.body
            );
            door.position.set(xPos, cabinBaseY + doorHeight * 0.4, cabinZ);
            door.name = 'doorPanel';
            group.add(door);

            // Door window
            const doorWindow = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, doorHeight * 0.4, doorLen * 0.8),
                this._materials.glass
            );
            doorWindow.position.set(
                xPos + side * 0.01,
                cabinBaseY + doorHeight * 0.65 + doorHeight * 0.15,
                cabinZ
            );
            doorWindow.name = 'doorWindow';
            group.add(doorWindow);

            // Door handle
            const handle = new THREE.Mesh(
                new THREE.BoxGeometry(0.03, 0.03, 0.12),
                this._materials.chrome
            );
            handle.position.set(
                xPos + side * 0.04,
                cabinBaseY + doorHeight * 0.5,
                cabinZ + doorLen * 0.15
            );
            handle.name = 'doorHandle';
            group.add(handle);
        }
    }

    // --- Interior (dashboard, gauges, seats visible through glass) ---

    _buildInterior() {
        const c = this.config;
        const cabinBaseY = c.groundClearance + c.height * 0.5;
        const { cabinZ, halfW } = this._dims;
        const cabinFrontZ = cabinZ + c.length * 0.35 * 0.5;

        // Dashboard
        const dashboard = new THREE.Mesh(
            new THREE.BoxGeometry(c.width - 0.4, 0.25, 0.2),
            this._materials.interior
        );
        dashboard.position.set(0, cabinBaseY + 0.25, cabinFrontZ - 0.15);
        dashboard.name = 'dashboard';
        this.interiorGroup.add(dashboard);

        // Gauge clusters (3 cylinders on dashboard)
        for (let i = -1; i <= 1; i++) {
            const gauge = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12),
                this._materials.gauge
            );
            gauge.rotation.x = Math.PI / 2;
            gauge.position.set(i * 0.2, cabinBaseY + 0.38, cabinFrontZ - 0.08);
            gauge.name = `gauge${i + 1}`;
            this.interiorGroup.add(gauge);
        }

        // Steering column
        const steeringCol = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8),
            this._materials.trim
        );
        steeringCol.rotation.x = -Math.PI / 4;
        steeringCol.position.set(0, cabinBaseY + 0.38, cabinFrontZ - 0.2);
        steeringCol.name = 'steeringColumn';
        this.interiorGroup.add(steeringCol);

        // Steering wheel (torus)
        const steeringWheel = new THREE.Mesh(
            new THREE.TorusGeometry(0.1, 0.015, 8, 16),
            this._materials.trim
        );
        steeringWheel.rotation.x = -Math.PI / 4;
        steeringWheel.position.set(0, cabinBaseY + 0.47, cabinFrontZ - 0.28);
        steeringWheel.name = 'steeringWheel';
        this.interiorGroup.add(steeringWheel);

        // Seats (2 simple boxes)
        for (const side of [-1, 1]) {
            const seat = new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.35, 0.35),
                this._materials.interior
            );
            seat.position.set(side * 0.3, cabinBaseY + 0.15, cabinZ - 0.05);
            seat.name = `seat${side > 0 ? 'Right' : 'Left'}`;
            this.interiorGroup.add(seat);

            // Seat back
            const seatBack = new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.4, 0.08),
                this._materials.interior
            );
            seatBack.position.set(side * 0.3, cabinBaseY + 0.35, cabinZ - 0.2);
            seatBack.name = `seatBack${side > 0 ? 'Right' : 'Left'}`;
            this.interiorGroup.add(seatBack);
        }
    }

    // --- Wheels ---

    _buildWheels() {
        const c = this.config;
        const wheelY = c.wheelRadius;
        const { frontAxleZ, rearAxleZ, halfW } = this._dims;
        const halfWidth = halfW + c.wheelWidth * 0.3;

        const positions = [
            { x: -halfWidth, z: frontAxleZ, name: 'wheelFL' },
            { x: halfWidth, z: frontAxleZ, name: 'wheelFR' },
            { x: -halfWidth, z: rearAxleZ, name: 'wheelRL' },
            { x: halfWidth, z: rearAxleZ, name: 'wheelRR' },
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

            // Rim
            const rim = new THREE.Mesh(
                new THREE.CylinderGeometry(c.wheelRadius * 0.7, c.wheelRadius * 0.7, c.wheelWidth * 0.7, 12),
                this._materials.rim
            );
            rim.rotation.z = Math.PI / 2;
            wheelAssembly.add(rim);

            // Hub cap
            const hub = new THREE.Mesh(
                new THREE.CylinderGeometry(c.wheelRadius * 0.2, c.wheelRadius * 0.2, c.wheelWidth * 0.8, 8),
                this._materials.chrome
            );
            hub.rotation.z = Math.PI / 2;
            wheelAssembly.add(hub);

            // Spokes
            for (let i = 0; i < 5; i++) {
                const spoke = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04, c.wheelRadius * 0.5, 0.04),
                    this._materials.rim
                );
                spoke.position.y = c.wheelRadius * 0.35;
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

    // --- Suspension linkages ---

    _buildSuspension() {
        const c = this.config;
        const { baseY, frontAxleZ, rearAxleZ, halfW } = this._dims;
        const linkR = 0.02;
        const chassisBottomY = baseY - c.height * 0.25 + 0.05;
        const wheelY = c.wheelRadius;

        const wheelPositions = [
            { x: -halfW, z: frontAxleZ, name: 'suspFL' },
            { x: halfW, z: frontAxleZ, name: 'suspFR' },
            { x: -halfW, z: rearAxleZ, name: 'suspRL' },
            { x: halfW, z: rearAxleZ, name: 'suspRR' },
        ];

        for (const wp of wheelPositions) {
            // Vertical strut from chassis to wheel area
            const strutLen = chassisBottomY - wheelY;
            const strut = new THREE.Mesh(
                new THREE.CylinderGeometry(linkR, linkR, strutLen, 6),
                this._materials.suspension
            );
            strut.position.set(wp.x * 0.85, wheelY + strutLen * 0.5, wp.z);
            strut.name = wp.name + 'Strut';
            this.suspensionGroup.add(strut);

            // Lower A-arm (angled link from chassis center-ish to wheel)
            const armLen = Math.abs(wp.x) * 0.4;
            const arm = new THREE.Mesh(
                new THREE.CylinderGeometry(linkR * 0.8, linkR * 0.8, armLen, 6),
                this._materials.suspension
            );
            arm.rotation.z = Math.sign(wp.x) * Math.PI / 4;
            arm.position.set(wp.x * 0.7, wheelY + 0.05, wp.z);
            arm.name = wp.name + 'Arm';
            this.suspensionGroup.add(arm);
        }

        // Front and rear axle bars
        for (const z of [frontAxleZ, rearAxleZ]) {
            const axle = new THREE.Mesh(
                new THREE.CylinderGeometry(linkR * 1.2, linkR * 1.2, c.width * 0.6, 6),
                this._materials.suspension
            );
            axle.rotation.z = Math.PI / 2;
            axle.position.set(0, wheelY, z);
            axle.name = z > 0 ? 'frontAxle' : 'rearAxle';
            this.suspensionGroup.add(axle);
        }
    }

    // --- Details (bumpers, grille, headlights, fenders, side steps) ---

    _buildDetails() {
        const c = this.config;
        const { baseY, frontZ, rearZ, halfW } = this._dims;

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

        // Grille - horizontal bars
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

        // Headlights
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

        // Fenders
        this._buildFenders();

        // Side steps
        for (const side of [-1, 1]) {
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.04, c.length * 0.45),
                this._materials.trim
            );
            step.position.set(side * (halfW + 0.08), c.groundClearance + 0.05, 0);
            step.name = `sideStep${side > 0 ? 'Right' : 'Left'}`;
            this.detailGroup.add(step);
        }
    }

    _buildFenders() {
        const c = this.config;
        const wheelY = c.wheelRadius;
        const { frontAxleZ, rearAxleZ, halfW } = this._dims;

        const positions = [
            { x: halfW, z: frontAxleZ, name: 'fenderFR' },
            { x: -halfW, z: frontAxleZ, name: 'fenderFL' },
            { x: halfW, z: rearAxleZ, name: 'fenderRR' },
            { x: -halfW, z: rearAxleZ, name: 'fenderRL' },
        ];

        for (const pos of positions) {
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

    // --- Sockets ---

    _buildSockets() {
        const c = this.config;
        const { baseY, topY, frontZ, rearZ, halfW, midY, cabinZ, frontAxleZ, rearAxleZ } = this._dims;
        const halfWidth = halfW + c.wheelWidth * 0.3;

        // Compute socket positions based on vehicle geometry
        const socketPositions = {
            'roof-center':  [0, topY + 0.12, cabinZ],
            'bed-left':     [-halfW, baseY + 0.3, rearZ + 0.5],
            'bed-right':    [halfW, baseY + 0.3, rearZ + 0.5],
            'bumper-front': [0, baseY, frontZ + 0.1],
            'bumper-rear':  [0, baseY, rearZ - 0.1],
            'side-left':    [-halfW - 0.05, midY, 0],
            'side-right':   [halfW + 0.05, midY, 0],
            'wheel-fl':     [-halfWidth, 0, frontAxleZ],
            'wheel-fr':     [halfWidth, 0, frontAxleZ],
            'wheel-rl':     [-halfWidth, 0, rearAxleZ],
            'wheel-rr':     [halfWidth, 0, rearAxleZ],
            'hitch-rear':   [0, baseY + 0.2, rearZ],
            'rack-roof':    [0, topY + 0.2, 0],
            'engine':       [0, baseY + 0.3, frontZ * 0.5],
        };

        for (const [socketId, pos] of Object.entries(socketPositions)) {
            const socketObj = new THREE.Object3D();
            socketObj.position.set(pos[0], pos[1], pos[2]);
            socketObj.name = `socket_${socketId}`;
            socketObj.userData.socketId = socketId;
            socketObj.userData.categories = VEHICLE_SOCKETS[socketId].categories;
            this.add(socketObj);
            this._sockets.set(socketId, socketObj);

            // Update VEHICLE_SOCKETS with computed positions
            VEHICLE_SOCKETS[socketId].pos = pos;
        }
    }

    // =====================
    // Public API - Sockets
    // =====================

    /**
     * Get a socket Object3D by name
     * @param {string} socketId
     * @returns {THREE.Object3D|undefined}
     */
    getSocket(socketId) {
        return this._sockets.get(socketId);
    }

    /**
     * Attach a component mesh to a named socket
     * @param {string} socketId
     * @param {THREE.Object3D} componentMesh
     * @returns {boolean}
     */
    attachComponent(socketId, componentMesh) {
        const socket = this._sockets.get(socketId);
        if (!socket) return false;

        // Detach any existing component
        this.detachComponent(socketId);

        socket.add(componentMesh);
        this._attachedComponents.set(socketId, componentMesh);
        return true;
    }

    /**
     * Detach a component from a socket
     * @param {string} socketId
     * @returns {THREE.Object3D|null}
     */
    detachComponent(socketId) {
        const existing = this._attachedComponents.get(socketId);
        if (!existing) return null;

        const socket = this._sockets.get(socketId);
        if (socket) socket.remove(existing);
        this._attachedComponents.delete(socketId);
        return existing;
    }

    /**
     * Get all currently attached components
     * @returns {Map<string, THREE.Object3D>}
     */
    getAttachedComponents() {
        return this._attachedComponents;
    }

    // ==========================
    // Public API - Damage Visuals
    // ==========================

    /**
     * Deform a panel by displacing vertices near an impact point
     * @param {string} panelName - Name of the mesh to deform
     * @param {THREE.Vector3} impactPoint - World-space impact location
     * @param {number} intensity - Deformation strength (0-1)
     */
    deformPanel(panelName, impactPoint, intensity) {
        let target = null;
        this.traverse(obj => {
            if (obj.isMesh && obj.name === panelName) target = obj;
        });
        if (!target) return;

        const geo = target.geometry;
        if (!geo.isBufferGeometry) return;

        const posAttr = geo.getAttribute('position');
        if (!posAttr) return;

        const localImpact = target.worldToLocal(impactPoint.clone());
        const radius = 0.5;
        const deformStrength = intensity * 0.15;

        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);

            const dx = vx - localImpact.x;
            const dy = vy - localImpact.y;
            const dz = vz - localImpact.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < radius) {
                const falloff = 1 - dist / radius;
                // Push inward (toward local center approximation)
                posAttr.setX(i, vx - dx * falloff * deformStrength);
                posAttr.setY(i, vy - dy * falloff * deformStrength);
                posAttr.setZ(i, vz - dz * falloff * deformStrength);
            }
        }

        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
    }

    /**
     * Detach a named panel mesh and return it (for debris physics)
     * @param {string} panelName
     * @returns {THREE.Mesh|null}
     */
    detachPanel(panelName) {
        let target = null;
        let parentGroup = null;
        this.traverse(obj => {
            if (obj.isMesh && obj.name === panelName) {
                target = obj;
                parentGroup = obj.parent;
            }
        });
        if (!target || !parentGroup) return null;

        // Compute world position before removing
        target.getWorldPosition(_v1);
        const worldQuat = new THREE.Quaternion();
        target.getWorldQuaternion(worldQuat);

        parentGroup.remove(target);

        // Set to world transform so caller can add to scene directly
        target.position.copy(_v1);
        target.quaternion.copy(worldQuat);

        return target;
    }

    /**
     * Increase roughness on all body materials to simulate damage/wear
     * @param {number} roughnessIncrease - Amount to add (0-0.5 typical)
     */
    setDamageState(roughnessIncrease) {
        this._damageRoughnessIncrease = roughnessIncrease;
        const mats = [this._materials.body, this._materials.trim];
        for (const mat of mats) {
            mat.roughness = Math.min(1.0, mat.roughness + roughnessIncrease);
        }
    }

    // ==========================
    // Public API - Animation
    // ==========================

    /**
     * Per-frame update for animated elements
     * @param {number} delta - Frame delta in seconds
     */
    update(delta) {
        // Animate wheels (spin based on external speed if set, else idle)
        const spinSpeed = this._wheelSpinSpeed || 0;
        for (const wheel of this.wheelMeshes) {
            wheel.rotation.x += spinSpeed * delta;
        }
    }

    /**
     * Set wheel spin speed (called by physics controller)
     * @param {number} speed - Radians per second
     */
    setWheelSpin(speed) {
        this._wheelSpinSpeed = speed;
    }

    // ==========================
    // Public API - Cleanup
    // ==========================

    dispose() {
        this.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
            }
        });
        for (const mat of Object.values(this._materials)) {
            mat.dispose();
        }
        // Dispose any taillight materials created inline
        this.traverse(obj => {
            if (obj.isMesh && obj.material && !Object.values(this._materials).includes(obj.material)) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
}

const _v1 = new THREE.Vector3();
