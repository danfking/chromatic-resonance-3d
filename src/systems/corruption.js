// corruption.js - Corruption visual system
// Manages the spread of grayscale corruption across the arena

import * as THREE from 'three';

/**
 * CorruptionSystem - Manages visual corruption effects
 * Higher corruption = more desaturated, grayscale environment
 */
export class CorruptionSystem {
    constructor(scene) {
        this.scene = scene;

        // Corruption level (0.0 = pristine, 1.0 = fully corrupted)
        this.level = 0;
        this.targetLevel = 0;
        this.transitionSpeed = 0.5; // How fast corruption changes

        // Corruption zones (localized high-corruption areas)
        this.zones = [];

        // Materials to affect
        this.affectedMaterials = [];

        // Corruption overlay
        this.overlay = null;
        this.overlayMaterial = null;

        // Event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Increase corruption on wave start
        window.addEventListener('wave-start', (e) => {
            const { wave } = e.detail || {};
            if (wave) {
                this.onWaveStart(wave);
            }
        });

        // Decrease corruption on boss defeat
        window.addEventListener('boss-defeated', () => {
            this.onBossDefeat();
        });

        // Also listen for enemy deaths - bosses reduce corruption
        window.addEventListener('enemy-died', (e) => {
            const { type } = e.detail;
            if (type && type.isBoss) {
                this.onBossDefeat();
            }
        });

        // Wave complete can also adjust corruption
        window.addEventListener('wave-complete', (e) => {
            // Small corruption decrease for completing a wave
            this.decreaseCorruption(0.05);
        });
    }

    /**
     * Initialize the corruption overlay effect
     * @param {THREE.WebGLRenderer} renderer - Three.js renderer
     */
    initOverlay(renderer) {
        // Create full-screen corruption overlay
        const geometry = new THREE.PlaneGeometry(2, 2);

        this.overlayMaterial = new THREE.ShaderMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            uniforms: {
                corruptionLevel: { value: 0 },
                time: { value: 0 },
                noiseScale: { value: 8.0 },
                vignetteStrength: { value: 0.3 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float corruptionLevel;
                uniform float time;
                uniform float noiseScale;
                uniform float vignetteStrength;
                varying vec2 vUv;

                // Noise functions
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);

                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));

                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                void main() {
                    // Distance from center for vignette
                    vec2 center = vUv - 0.5;
                    float dist = length(center);

                    // Animated noise pattern
                    float n = noise(vUv * noiseScale + time * 0.1);
                    float n2 = noise(vUv * noiseScale * 2.0 - time * 0.05);

                    // Corruption spreads from edges inward
                    float edgeFactor = smoothstep(0.3, 0.8, dist);

                    // Combine noise with edge factor
                    float corruptionMask = edgeFactor * (0.7 + n * 0.3);
                    corruptionMask = mix(corruptionMask, 1.0, corruptionLevel * 0.5);

                    // Final corruption alpha
                    float alpha = corruptionLevel * corruptionMask * 0.4;

                    // Add vignette
                    float vignette = smoothstep(0.4, 1.0, dist) * vignetteStrength * corruptionLevel;
                    alpha = max(alpha, vignette);

                    // Grayscale/bleached color with subtle variation
                    vec3 bleachColor = vec3(0.9, 0.88, 0.85);
                    bleachColor = mix(bleachColor, vec3(0.7, 0.68, 0.65), n2);

                    gl_FragColor = vec4(bleachColor, alpha);
                }
            `
        });

        this.overlay = new THREE.Mesh(geometry, this.overlayMaterial);
        this.overlay.frustumCulled = false;
        this.overlay.renderOrder = 999;
    }

    /**
     * Create corruption overlay as a post-process effect
     * Call this after NPR pipeline is set up
     */
    createOverlayPass() {
        // This would integrate with the NPR pipeline
        // For now, we'll apply corruption directly to materials
        return null;
    }

    /**
     * Register a material to be affected by corruption
     * @param {THREE.Material} material - Material to affect
     * @param {Object} options - Options for corruption effect
     */
    registerMaterial(material, options = {}) {
        const {
            maxDesaturation = 0.8,
            colorShift = true,
            emissiveReduction = true
        } = options;

        this.affectedMaterials.push({
            material,
            maxDesaturation,
            colorShift,
            emissiveReduction,
            originalColor: material.color ? material.color.clone() : null,
            originalEmissive: material.emissive ? material.emissive.clone() : null,
            originalEmissiveIntensity: material.emissiveIntensity || 0
        });
    }

    /**
     * Increase corruption level
     * @param {number} amount - Amount to increase (0-1 scale)
     */
    increaseCorruption(amount) {
        this.targetLevel = Math.min(1, this.targetLevel + amount);
    }

    /**
     * Decrease corruption level
     * @param {number} amount - Amount to decrease (0-1 scale)
     */
    decreaseCorruption(amount) {
        this.targetLevel = Math.max(0, this.targetLevel - amount);
    }

    /**
     * Set corruption level directly
     * @param {number} level - Target corruption level (0-1)
     */
    setCorruption(level) {
        this.targetLevel = Math.max(0, Math.min(1, level));
    }

    /**
     * Add a localized corruption zone
     * @param {THREE.Vector3} position - Center of corruption zone
     * @param {number} radius - Zone radius
     * @param {number} intensity - Zone intensity (0-1)
     */
    addZone(position, radius = 5, intensity = 0.5) {
        const zone = {
            position: position.clone(),
            radius,
            intensity,
            createdAt: performance.now()
        };
        this.zones.push(zone);

        // Create visual indicator
        this.createZoneVisual(zone);

        return zone;
    }

    /**
     * Remove a corruption zone
     * @param {Object} zone - Zone to remove
     */
    removeZone(zone) {
        const index = this.zones.indexOf(zone);
        if (index >= 0) {
            if (zone.visual) {
                this.scene.remove(zone.visual);
                zone.visual.geometry?.dispose();
                zone.visual.material?.dispose();
            }
            this.zones.splice(index, 1);
        }
    }

    createZoneVisual(zone) {
        // Create ground decal for corruption zone
        const geometry = new THREE.CircleGeometry(zone.radius, 32);
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                intensity: { value: zone.intensity },
                time: { value: 0 },
                color: { value: new THREE.Color(0x666655) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float intensity;
                uniform float time;
                uniform vec3 color;
                varying vec2 vUv;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                void main() {
                    vec2 center = vUv - 0.5;
                    float dist = length(center) * 2.0;

                    // Noise for organic edge
                    float noise = hash(vUv * 20.0 + time * 0.1);

                    // Edge falloff
                    float edge = smoothstep(1.0, 0.5, dist + (noise - 0.5) * 0.3);

                    float alpha = edge * intensity * 0.5;

                    gl_FragColor = vec4(color, alpha);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(zone.position);
        mesh.position.y = 0.02; // Just above ground

        this.scene.add(mesh);
        zone.visual = mesh;
        zone.material = material;
    }

    /**
     * Called when a wave starts
     * @param {number} waveNumber - Current wave number
     */
    onWaveStart(waveNumber) {
        // Increase corruption based on wave progression
        const increase = waveNumber * 0.05;
        this.increaseCorruption(increase);

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('corruption-changed', {
            detail: { level: this.targetLevel, cause: 'wave-start', wave: waveNumber }
        }));
    }

    /**
     * Called when a boss is defeated
     */
    onBossDefeat() {
        // Significant corruption decrease
        this.decreaseCorruption(0.2);

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('corruption-changed', {
            detail: { level: this.targetLevel, cause: 'boss-defeat' }
        }));

        // Visual feedback - flash of color restoration
        this.flashRestoration();
    }

    flashRestoration() {
        // Temporary boost to saturation
        const originalTransitionSpeed = this.transitionSpeed;
        this.transitionSpeed = 2.0; // Faster transition for dramatic effect

        setTimeout(() => {
            this.transitionSpeed = originalTransitionSpeed;
        }, 500);
    }

    /**
     * Update corruption system
     * @param {number} delta - Time delta in seconds
     * @param {number} elapsed - Total elapsed time
     */
    update(delta, elapsed) {
        // Smooth transition to target level
        if (Math.abs(this.level - this.targetLevel) > 0.001) {
            this.level = THREE.MathUtils.lerp(
                this.level,
                this.targetLevel,
                this.transitionSpeed * delta
            );
        }

        // Update overlay
        if (this.overlayMaterial) {
            this.overlayMaterial.uniforms.corruptionLevel.value = this.level;
            this.overlayMaterial.uniforms.time.value = elapsed;
        }

        // Update affected materials
        this.updateMaterials();

        // Update corruption zones
        this.updateZones(elapsed);
    }

    updateMaterials() {
        for (const entry of this.affectedMaterials) {
            const { material, maxDesaturation, colorShift, emissiveReduction, originalColor, originalEmissive } = entry;

            if (!material) continue;

            // Desaturate color based on corruption
            if (originalColor && material.color) {
                const desatAmount = this.level * maxDesaturation;

                // Convert to HSL, reduce saturation, convert back
                const hsl = {};
                originalColor.getHSL(hsl);
                hsl.s = hsl.s * (1 - desatAmount);

                // Slight shift toward gray-brown
                if (colorShift) {
                    hsl.h = THREE.MathUtils.lerp(hsl.h, 0.1, this.level * 0.3);
                    hsl.l = THREE.MathUtils.lerp(hsl.l, 0.5, this.level * 0.2);
                }

                material.color.setHSL(hsl.h, hsl.s, hsl.l);
            }

            // Reduce emissive
            if (emissiveReduction && originalEmissive && material.emissive) {
                const emissiveFactor = 1 - this.level * 0.7;
                material.emissive.copy(originalEmissive).multiplyScalar(emissiveFactor);
            }

            if (emissiveReduction && entry.originalEmissiveIntensity !== undefined) {
                material.emissiveIntensity = entry.originalEmissiveIntensity * (1 - this.level * 0.5);
            }
        }
    }

    updateZones(elapsed) {
        for (const zone of this.zones) {
            if (zone.material) {
                zone.material.uniforms.time.value = elapsed;
            }
        }
    }

    /**
     * Get current corruption level
     * @returns {number} Current level (0-1)
     */
    getLevel() {
        return this.level;
    }

    /**
     * Get corruption description for UI
     * @returns {string} Description
     */
    getDescription() {
        if (this.level < 0.2) return 'Pristine';
        if (this.level < 0.4) return 'Fading';
        if (this.level < 0.6) return 'Corrupted';
        if (this.level < 0.8) return 'Decaying';
        return 'Nearly Lost';
    }

    /**
     * Cleanup
     */
    dispose() {
        // Remove overlay
        if (this.overlay) {
            this.scene.remove(this.overlay);
            this.overlayMaterial?.dispose();
        }

        // Remove zones
        for (const zone of this.zones) {
            if (zone.visual) {
                this.scene.remove(zone.visual);
                zone.visual.geometry?.dispose();
                zone.visual.material?.dispose();
            }
        }
        this.zones = [];

        // Restore materials
        for (const entry of this.affectedMaterials) {
            if (entry.originalColor && entry.material.color) {
                entry.material.color.copy(entry.originalColor);
            }
            if (entry.originalEmissive && entry.material.emissive) {
                entry.material.emissive.copy(entry.originalEmissive);
            }
            if (entry.originalEmissiveIntensity !== undefined) {
                entry.material.emissiveIntensity = entry.originalEmissiveIntensity;
            }
        }
        this.affectedMaterials = [];
    }
}
