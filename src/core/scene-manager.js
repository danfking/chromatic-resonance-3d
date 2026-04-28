// scene-manager.js - Core Three.js scene setup

import * as THREE from 'three';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }

    async init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x3a3a5a);
        this.scene.fog = new THREE.Fog(0x3a3a5a, 25, 70);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 5, 10);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true  // Required for screenshot capture (canvas.toDataURL / Playwright)
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.6;
        this.container.appendChild(this.renderer.domElement);

        // Set up lighting
        this.setupLighting();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        return this;
    }

    setupLighting() {
        // Ambient light - brighter fill for visibility
        const ambient = new THREE.AmbientLight(0x9999bb, 1.5);
        this.scene.add(ambient);

        // Hemisphere light - sky/ground color variation
        const hemisphere = new THREE.HemisphereLight(0x99bbee, 0x665566, 1.1);
        this.scene.add(hemisphere);

        // Main directional light (sun/moon) - key light
        const directional = new THREE.DirectionalLight(0xffeedd, 1.8);
        directional.position.set(10, 20, 10);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        directional.shadow.camera.near = 0.5;
        directional.shadow.camera.far = 50;
        directional.shadow.camera.left = -20;
        directional.shadow.camera.right = 20;
        directional.shadow.camera.top = 20;
        directional.shadow.camera.bottom = -20;
        directional.shadow.bias = -0.0001;
        this.scene.add(directional);

        // Fill directional light from opposite angle
        const fillDirectional = new THREE.DirectionalLight(0xddddff, 0.6);
        fillDirectional.position.set(-10, 15, -10);
        this.scene.add(fillDirectional);

        // Point lights for atmosphere - increased intensity for enemy illumination
        const pointLight1 = new THREE.PointLight(0xd4a574, 1.8, 25);
        pointLight1.position.set(-5, 3, -5);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x7a5aaa, 1.5, 22);
        pointLight2.position.set(5, 2, -8);
        this.scene.add(pointLight2);

        // Center arena point light for overall visibility
        const centerLight = new THREE.PointLight(0xffffff, 1.2, 35);
        centerLight.position.set(0, 8, 0);
        this.scene.add(centerLight);

        // 4 corner fill lights for even illumination
        const cornerPositions = [
            [-15, 4, -15],
            [15, 4, -15],
            [-15, 4, 15],
            [15, 4, 15]
        ];
        cornerPositions.forEach(pos => {
            const cornerLight = new THREE.PointLight(0xaaaacc, 0.6, 20);
            cornerLight.position.set(...pos);
            this.scene.add(cornerLight);
        });
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    getScene() {
        return this.scene;
    }

    getCamera() {
        return this.camera;
    }

    getRenderer() {
        return this.renderer;
    }
}
