// style-lab.js - Quick visual style comparison system
// Toggle between 4 NPR styles via keys 1-4 in debug mode

import * as THREE from 'three';
// Procedural texture stubs (textures not used in current pipeline)
function clearTextureCache() {}
function setTextureMode() {}
function getStyledTexture() { return null; }

// ─── Style Preset Definitions ───────────────────────────────────────

const STYLE_PRESETS = {
    watercolor: {
        name: 'Watercolor',
        key: '1',
        npr: {
            kuwaharaRadius: 2,
            edgeStrength: 0.35,
            edgeThreshold: 0.15,
            bloomStrength: 0.3,
            bloomRadius: 0.4,
            bloomThreshold: 0.80,
            grainIntensity: 0.04,
            vignetteIntensity: 0.10,
            saturationAdjust: 0.95,
        },
        lighting: {
            toneExposure: 1.6,
            ambientMult: 1.0,
            fogDensityMult: 1.0,
        },
        material: {
            flatShading: false,
            useToon: false,
            normalMaps: true,
            textureMode: 'watercolor',
            colorSatMult: 1.0,
            roughness: null, // keep original
            metalness: null,
        },
    },

    lowPoly: {
        name: 'Low Poly',
        key: '2',
        npr: {
            kuwaharaRadius: 0,
            edgeStrength: 0.15,
            edgeThreshold: 0.25,
            bloomStrength: 0.15,
            bloomRadius: 0.3,
            bloomThreshold: 0.85,
            grainIntensity: 0,
            vignetteIntensity: 0.05,
            saturationAdjust: 1.1,
        },
        lighting: {
            toneExposure: 1.8,
            ambientMult: 1.2,
            fogDensityMult: 0.6,
        },
        material: {
            flatShading: true,
            useToon: false,
            normalMaps: false,
            textureMode: 'none',
            colorSatMult: 1.3,
            roughness: 0.95,
            metalness: 0.0,
        },
    },

    borderlands: {
        name: 'Borderlands',
        key: '3',
        npr: {
            kuwaharaRadius: 1,
            edgeStrength: 0.85,
            edgeThreshold: 0.05,
            bloomStrength: 0.2,
            bloomRadius: 0.3,
            bloomThreshold: 0.85,
            grainIntensity: 0,
            vignetteIntensity: 0.15,
            saturationAdjust: 1.05,
        },
        lighting: {
            toneExposure: 1.4,
            ambientMult: 0.7,
            fogDensityMult: 0.8,
        },
        material: {
            flatShading: false,
            useToon: true,
            normalMaps: true,
            textureMode: 'none',
            colorSatMult: 1.2,
            roughness: null,
            metalness: null,
        },
    },

    botw: {
        name: 'BotW',
        key: '4',
        npr: {
            kuwaharaRadius: 3,
            edgeStrength: 0.20,
            edgeThreshold: 0.20,
            bloomStrength: 0.5,
            bloomRadius: 0.5,
            bloomThreshold: 0.70,
            grainIntensity: 0,
            vignetteIntensity: 0.20,
            saturationAdjust: 0.75,
        },
        lighting: {
            toneExposure: 1.9,
            ambientMult: 1.4,
            fogDensityMult: 1.3,
        },
        material: {
            flatShading: false,
            useToon: false,
            normalMaps: true,
            textureMode: 'none',
            colorSatMult: 0.7,
            roughness: null,
            metalness: null,
        },
    },

    sable: {
        name: 'Sable',
        key: '5',
        npr: {
            kuwaharaRadius: 0,          // No painterly blur — clean flat colors
            edgeStrength: 0.15,         // Minimal soft edge (Sable outline pass handles bold lines)
            edgeThreshold: 0.20,
            sableOutlineEnabled: true,  // Bold Moebius ink outlines
            sableLineThickness: 1.3,   // Thick lines (~2-3px at 1080p)
            sableLineStrength: 0.80,   // Strong but not pure black — leaves particle detail visible
            sableLineThreshold: 0.12,  // Higher threshold: catches geometry edges, spares particle clusters
            bloomStrength: 0.25,       // More bloom so emissive particles punch through outlines
            bloomRadius: 0.4,
            bloomThreshold: 0.80,      // Moderate threshold: particles glow prominently
            grainIntensity: 0,
            vignetteIntensity: 0.08,
            saturationAdjust: 0.85,    // Slightly desaturated, muted Moebius palette
            posterizeLevels: 6.0,      // 6 discrete shading levels — smoother than 5, still flat
            colorTransferStrength: 0.10, // Very subtle warm shift
        },
        lighting: {
            toneExposure: 1.5,         // Moderate — not blown out
            ambientMult: 1.3,          // Higher ambient for flatter lighting
            fogDensityMult: 0.5,       // Reduced fog — Sable has clear distant vistas
        },
        material: {
            flatShading: true,         // Faceted geometry
            useToon: false,
            normalMaps: false,         // No normal maps — flat surfaces
            textureMode: 'none',       // No textures — pure flat color
            colorSatMult: 0.9,
            roughness: 0.95,           // Matte surfaces
            metalness: 0.0,            // No metal reflections
        },
        visibility: {
            // Hide noisy detail geometry for clean Sable look
            hideTypes: [
                'grass',                // 30k instanced grass blades
                'ground-particles',     // Scattered ground detail points
                'vegetation-particles', // Tree/bush particle clouds
                'structure-particles',  // Rock/ruin particle detail
            ],
        },
    },

    // Hybrid: Borderlands toon shading + Sable clean world & bold outlines
    hybrid: {
        name: 'Hybrid',
        key: '6',
        npr: {
            kuwaharaRadius: 0,          // No blur — keep edges crisp for outlines
            edgeStrength: 0.70,         // Strong soft edges (from Borderlands)
            edgeThreshold: 0.08,        // Sensitive edge detection
            sableOutlineEnabled: true,  // Bold ink outlines (from Sable)
            sableLineThickness: 1.3,   // Thick Moebius lines
            sableLineStrength: 0.75,   // Slightly softer so toon shading reads through
            sableLineThreshold: 0.12,  // Geometry edges, not particle clusters
            bloomStrength: 0.25,       // Particles glow
            bloomRadius: 0.35,
            bloomThreshold: 0.82,
            grainIntensity: 0,
            vignetteIntensity: 0.12,
            saturationAdjust: 1.10,    // Punchy saturated colors (from Borderlands)
            posterizeLevels: 0.0,      // No posterization — let toon shading handle steps
            colorTransferStrength: 0.08,
        },
        lighting: {
            toneExposure: 1.45,        // Between Borderlands (1.4) and Sable (1.5)
            ambientMult: 0.85,         // Some contrast (Borderlands feel) but not too dark
            fogDensityMult: 0.6,       // Clear vistas (from Sable)
        },
        material: {
            flatShading: false,        // Smooth geometry (toon handles the stepping)
            useToon: true,             // Toon shading (from Borderlands) — stepped light/dark
            normalMaps: false,         // No normal maps — clean surfaces
            textureMode: 'none',       // No textures — flat color (from Sable)
            colorSatMult: 1.15,        // Saturated (from Borderlands)
            roughness: null,           // Let toon material handle
            metalness: null,
        },
        visibility: {
            // Clean ground from Sable
            hideTypes: [
                'grass',
                'ground-particles',
                'vegetation-particles',
                'structure-particles',
            ],
        },
    },
};

// ─── StyleLab Class ─────────────────────────────────────────────────

export class StyleLab {
    /**
     * @param {object} params
     * @param {import('./npr-pipeline.js').NPRPipeline} params.nprPipeline
     * @param {THREE.Scene} params.scene
     * @param {THREE.WebGLRenderer} params.renderer
     */
    constructor({ nprPipeline, scene, renderer }) {
        this.nprPipeline = nprPipeline;
        this.scene = scene;
        this.renderer = renderer;

        this.isEnabled = false;
        this.activeStyle = null;
        this.hudElement = null;

        // Cached baselines (captured on first enable)
        this._baseLightIntensities = null;
        this._baseFog = null;
        this._baseToneExposure = null;

        // Cached original materials for Toon swap restoration
        this._originalMaterials = new Map(); // uuid -> MeshStandardMaterial

        // Toon gradient texture (created once, reused)
        this._toonGradientMap = null;

        // World builder reference (set externally)
        this._builder = null;

        // World theme reference (set externally)
        this._theme = null;

        // Snapshot of original texture maps on the 3 core surface materials
        // { floor: Texture|null, wall: Texture|null, ceiling: Texture|null }
        this._origSurfaceMaps = null;
    }

    /**
     * Set the world builder reference for material traversal.
     * @param {object} builder - World builder instance
     */
    setBuilder(builder) {
        this._builder = builder;
    }

    /**
     * Set the world theme for texture regeneration.
     * @param {object} theme
     */
    setTheme(theme) {
        this._theme = theme;
    }

    /**
     * Enable the Style Lab: create HUD, cache baselines, bind keyboard.
     */
    enable() {
        if (this.isEnabled) return;
        this.isEnabled = true;

        // Cache baseline light intensities
        this._cacheLightBaselines();

        // Cache baseline tone mapping exposure
        this._baseToneExposure = this.renderer.toneMappingExposure;

        // Cache baseline fog
        if (this.scene.fog) {
            if (this.scene.fog.isFogExp2) {
                this._baseFog = { type: 'exp2', density: this.scene.fog.density, color: this.scene.fog.color.clone() };
            } else if (this.scene.fog.isFog) {
                this._baseFog = { type: 'linear', near: this.scene.fog.near, far: this.scene.fog.far, color: this.scene.fog.color.clone() };
            }
        }

        // Snapshot original texture maps from the 3 core surface materials
        this._snapshotSurfaceMaps();

        // Create HUD
        this._createHUD();

        // Apply watercolor as default
        this.switchStyle('watercolor');

        console.log('[StyleLab] Enabled');
    }

    /**
     * Disable the Style Lab: restore baselines, remove HUD.
     */
    disable() {
        if (!this.isEnabled) return;

        // Restore original materials before disabling
        this._restoreOriginalMaterials();

        // Restore baselines
        if (this._baseToneExposure !== null) {
            this.renderer.toneMappingExposure = this._baseToneExposure;
        }
        this._restoreLightBaselines();
        this._restoreFogBaseline();

        // Remove HUD
        if (this.hudElement) {
            this.hudElement.remove();
            this.hudElement = null;
        }

        this.isEnabled = false;
        this.activeStyle = null;
        console.log('[StyleLab] Disabled');
    }

    /**
     * Switch to a named style. Applies NPR -> Lighting -> Materials -> Textures atomically.
     * @param {string} name - 'watercolor', 'lowPoly', 'borderlands', or 'botw'
     */
    switchStyle(name) {
        const preset = STYLE_PRESETS[name];
        if (!preset) {
            console.warn(`[StyleLab] Unknown style: ${name}`);
            return;
        }

        const startTime = performance.now();

        this.activeStyle = name;

        // Apply in order: NPR -> Lighting -> Materials -> Textures -> Visibility
        this._applyNPR(preset.npr);
        this._applyLighting(preset.lighting);
        this._applyMaterials(preset.material);
        this._regenerateTextures(preset.material);
        this._applyVisibility(preset.visibility);

        // Update HUD
        this._updateHUD();

        const elapsed = (performance.now() - startTime).toFixed(1);
        console.log(`[StyleLab] Switched to ${preset.name} in ${elapsed}ms`);
    }

    // ─── NPR Application ───────────────────────────────────────────

    _applyNPR(config) {
        this.nprPipeline.applyPreset(config);
    }

    // ─── Lighting Application ───────────────────────────────────────

    _cacheLightBaselines() {
        this._baseLightIntensities = new Map();
        this.scene.traverse((obj) => {
            if (obj.isLight) {
                this._baseLightIntensities.set(obj.uuid, obj.intensity);
            }
        });
    }

    _restoreLightBaselines() {
        if (!this._baseLightIntensities) return;
        this.scene.traverse((obj) => {
            if (obj.isLight && this._baseLightIntensities.has(obj.uuid)) {
                obj.intensity = this._baseLightIntensities.get(obj.uuid);
            }
        });
    }

    _restoreFogBaseline() {
        if (!this._baseFog) return;
        if (this._baseFog.type === 'exp2') {
            this.scene.fog = new THREE.FogExp2(this._baseFog.color, this._baseFog.density);
        } else if (this._baseFog.type === 'linear') {
            this.scene.fog = new THREE.Fog(this._baseFog.color, this._baseFog.near, this._baseFog.far);
        }
    }

    _applyLighting(config) {
        // Tone mapping exposure
        this.renderer.toneMappingExposure = config.toneExposure;

        // Multiply light intensities from cached baselines
        if (this._baseLightIntensities) {
            this.scene.traverse((obj) => {
                if (obj.isLight && this._baseLightIntensities.has(obj.uuid)) {
                    obj.intensity = this._baseLightIntensities.get(obj.uuid) * config.ambientMult;
                }
            });
        }

        // Scale fog density
        if (this._baseFog) {
            if (this._baseFog.type === 'exp2' && this.scene.fog?.isFogExp2) {
                this.scene.fog.density = this._baseFog.density * config.fogDensityMult;
            } else if (this._baseFog.type === 'linear' && this.scene.fog?.isFog) {
                // Scale fog range inversely with density multiplier
                const scale = 1 / config.fogDensityMult;
                this.scene.fog.near = this._baseFog.near * scale;
                this.scene.fog.far = this._baseFog.far * scale;
            }
        }
    }

    // ─── Material Application ───────────────────────────────────────

    _getWorldGroup() {
        // Find the world group in the scene (outdoor-world or arena)
        const worldGroupNames = ['outdoor-world', 'arena'];
        let worldGroup = null;
        this.scene.traverse((obj) => {
            if (worldGroupNames.includes(obj.name)) {
                worldGroup = obj;
            }
        });
        return worldGroup;
    }

    _applyMaterials(config) {
        const worldGroup = this._getWorldGroup();
        if (!worldGroup) return;

        // If switching TO toon, save originals first then swap
        if (config.useToon) {
            this._swapToToon(worldGroup, config);
        } else {
            // Restore originals if we were previously in toon mode
            this._restoreOriginalMaterials();
            // Apply standard material tweaks
            this._tweakStandardMaterials(worldGroup, config);
        }
    }

    _tweakStandardMaterials(group, config) {
        group.traverse((obj) => {
            if (!obj.isMesh || !obj.material) return;

            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const mat of materials) {
                if (!mat.isMeshStandardMaterial) continue;

                // Flat shading
                if (mat.flatShading !== config.flatShading) {
                    mat.flatShading = config.flatShading;
                    mat.needsUpdate = true;
                }

                // Normal maps
                if (!config.normalMaps && mat.normalMap) {
                    if (!mat.userData._origNormalMap) {
                        mat.userData._origNormalMap = mat.normalMap;
                    }
                    mat.normalMap = null;
                    mat.needsUpdate = true;
                } else if (config.normalMaps && mat.userData._origNormalMap) {
                    mat.normalMap = mat.userData._origNormalMap;
                    delete mat.userData._origNormalMap;
                    mat.needsUpdate = true;
                }

                // Roughness/metalness overrides
                if (config.roughness !== null) {
                    if (mat.userData._origRoughness === undefined) {
                        mat.userData._origRoughness = mat.roughness;
                    }
                    mat.roughness = config.roughness;
                } else if (mat.userData._origRoughness !== undefined) {
                    mat.roughness = mat.userData._origRoughness;
                    delete mat.userData._origRoughness;
                }

                if (config.metalness !== null) {
                    if (mat.userData._origMetalness === undefined) {
                        mat.userData._origMetalness = mat.metalness;
                    }
                    mat.metalness = config.metalness;
                } else if (mat.userData._origMetalness !== undefined) {
                    mat.metalness = mat.userData._origMetalness;
                    delete mat.userData._origMetalness;
                }

                // Texture maps (strip for flat-color styles like Sable)
                if (config.textureMode === 'none') {
                    if (mat.map) {
                        if (!mat.userData._origMap) {
                            mat.userData._origMap = mat.map;
                        }
                        mat.map = null;
                        mat.needsUpdate = true;
                    }
                    if (mat.roughnessMap) {
                        if (!mat.userData._origRoughnessMap) {
                            mat.userData._origRoughnessMap = mat.roughnessMap;
                        }
                        mat.roughnessMap = null;
                        mat.needsUpdate = true;
                    }
                    if (mat.metalnessMap) {
                        if (!mat.userData._origMetalnessMap) {
                            mat.userData._origMetalnessMap = mat.metalnessMap;
                        }
                        mat.metalnessMap = null;
                        mat.needsUpdate = true;
                    }
                } else {
                    // Restore texture maps if they were stripped
                    if (mat.userData._origMap) {
                        mat.map = mat.userData._origMap;
                        delete mat.userData._origMap;
                        mat.needsUpdate = true;
                    }
                    if (mat.userData._origRoughnessMap) {
                        mat.roughnessMap = mat.userData._origRoughnessMap;
                        delete mat.userData._origRoughnessMap;
                        mat.needsUpdate = true;
                    }
                    if (mat.userData._origMetalnessMap) {
                        mat.metalnessMap = mat.userData._origMetalnessMap;
                        delete mat.userData._origMetalnessMap;
                        mat.needsUpdate = true;
                    }
                }

                // Color saturation multiplier
                if (config.colorSatMult !== 1.0) {
                    if (!mat.userData._origColor) {
                        mat.userData._origColor = mat.color.clone();
                    }
                    const hsl = {};
                    mat.userData._origColor.getHSL(hsl);
                    mat.color.setHSL(
                        hsl.h,
                        Math.min(1, hsl.s * config.colorSatMult),
                        hsl.l
                    );
                } else if (mat.userData._origColor) {
                    mat.color.copy(mat.userData._origColor);
                    delete mat.userData._origColor;
                }
            }
        });
    }

    // ─── Visibility (hide noisy detail for clean styles) ───────────

    _applyVisibility(config) {
        // Restore previously hidden objects
        if (this._hiddenObjects) {
            for (const obj of this._hiddenObjects) {
                obj.visible = true;
            }
        }
        this._hiddenObjects = [];

        if (!config || !config.hideTypes || config.hideTypes.length === 0) return;

        const hideSet = new Set(config.hideTypes);

        this.scene.traverse((obj) => {
            if (obj.userData?.type && hideSet.has(obj.userData.type)) {
                obj.visible = false;
                this._hiddenObjects.push(obj);
            }
        });

        if (this._hiddenObjects.length > 0) {
            console.log(`[StyleLab] Hidden ${this._hiddenObjects.length} detail objects (${config.hideTypes.join(', ')})`);
        }
    }

    // ─── Borderlands Toon Swap ──────────────────────────────────────

    _getToonGradientMap() {
        if (this._toonGradientMap) return this._toonGradientMap;

        // Create 3-tone step gradient: dark (0.2), mid (0.5), light (0.8)
        const width = 4;
        const data = new Uint8Array(width * 4);
        // Step 0-1: dark
        data[0] = 51; data[1] = 51; data[2] = 51; data[3] = 255;
        data[4] = 51; data[5] = 51; data[6] = 51; data[7] = 255;
        // Step 2: mid
        data[8] = 128; data[9] = 128; data[10] = 128; data[11] = 255;
        // Step 3: light
        data[12] = 204; data[13] = 204; data[14] = 204; data[15] = 255;

        const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;

        this._toonGradientMap = texture;
        return texture;
    }

    _swapToToon(group, config) {
        const gradientMap = this._getToonGradientMap();

        group.traverse((obj) => {
            if (!obj.isMesh || !obj.material) return;

            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            const newMaterials = [];

            for (const mat of materials) {
                // Only swap standard materials
                if (!mat.isMeshStandardMaterial) {
                    newMaterials.push(mat);
                    continue;
                }

                // Cache original for restoration
                if (!this._originalMaterials.has(obj.uuid)) {
                    this._originalMaterials.set(obj.uuid, Array.isArray(obj.material)
                        ? obj.material.map(m => m) : obj.material);
                }

                // Create toon material with same color
                const hsl = {};
                mat.color.getHSL(hsl);
                const satAdjusted = Math.min(1, hsl.s * config.colorSatMult);

                const toonMat = new THREE.MeshToonMaterial({
                    color: new THREE.Color().setHSL(hsl.h, satAdjusted, hsl.l),
                    gradientMap: gradientMap,
                    map: mat.map,
                    normalMap: config.normalMaps ? mat.normalMap : null,
                });

                newMaterials.push(toonMat);
            }

            obj.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
        });

        // Re-store original colors for corruption system compatibility
        if (this._builder && this._builder._storeOriginalColors) {
            this._builder._storeOriginalColors();
        }
    }

    _restoreOriginalMaterials() {
        if (this._originalMaterials.size === 0) return;

        const worldGroup = this._getWorldGroup();
        if (!worldGroup) return;

        worldGroup.traverse((obj) => {
            if (!obj.isMesh) return;
            const orig = this._originalMaterials.get(obj.uuid);
            if (orig) {
                // Dispose toon materials
                const current = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const mat of current) {
                    if (mat.isMeshToonMaterial) {
                        mat.dispose();
                    }
                }
                obj.material = orig;
            }
        });

        this._originalMaterials.clear();

        // Re-store original colors for corruption system
        if (this._builder && this._builder._storeOriginalColors) {
            this._builder._storeOriginalColors();
        }
    }

    // ─── Texture Regeneration ───────────────────────────────────────

    /**
     * Snapshot original texture maps from ALL builder materials.
     * Called once on enable() so watercolor mode can restore them exactly.
     */
    _snapshotSurfaceMaps() {
        if (!this._builder?.materials) return;
        this._origSurfaceMaps = {};
        for (const [key, mat] of Object.entries(this._builder.materials)) {
            if (mat?.map) {
                this._origSurfaceMaps[key] = mat.map;
            }
        }
    }

    _regenerateTextures(config) {
        if (!this._builder?.materials) return;
        const allMats = this._builder.materials;

        setTextureMode(config.textureMode);

        if (config.textureMode === 'watercolor') {
            // Restore original textures on all materials
            if (this._origSurfaceMaps) {
                for (const [key, origMap] of Object.entries(this._origSurfaceMaps)) {
                    if (allMats[key]) {
                        allMats[key].map = origMap;
                        allMats[key].needsUpdate = true;
                    }
                }
            }
            return;
        }

        if (config.textureMode === 'none') {
            // Remove texture maps from ALL builder materials
            for (const mat of Object.values(allMats)) {
                if (mat?.map) {
                    mat.map = null;
                    mat.needsUpdate = true;
                }
            }
            return;
        }
    }

    // ─── HUD ────────────────────────────────────────────────────────

    _createHUD() {
        if (this.hudElement) return;

        this.hudElement = document.createElement('div');
        this.hudElement.id = 'style-lab-hud';
        this.hudElement.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            padding: 8px 14px;
            background: rgba(0, 0, 0, 0.75);
            color: #ccc;
            font-family: monospace;
            font-size: 12px;
            z-index: 1100;
            border: 1px solid #555;
            border-radius: 4px;
            pointer-events: none;
            user-select: none;
        `;
        document.body.appendChild(this.hudElement);
        this._updateHUD();
    }

    _updateHUD() {
        if (!this.hudElement) return;

        const labels = Object.entries(STYLE_PRESETS).map(([key, preset]) => {
            const isActive = this.activeStyle === key;
            const color = isActive ? '#0f0' : '#888';
            const weight = isActive ? 'bold' : 'normal';
            return `<span style="color:${color};font-weight:${weight}">${preset.key}:${preset.name}</span>`;
        });

        this.hudElement.innerHTML = `[STYLE LAB] ${labels.join(' ')}`;
    }

    // ─── Static Helpers ─────────────────────────────────────────────

    /**
     * Get available style names.
     * @returns {string[]}
     */
    static getStyleNames() {
        return Object.keys(STYLE_PRESETS);
    }

    /**
     * Get preset data by name (for external inspection).
     * @param {string} name
     * @returns {object|null}
     */
    static getPreset(name) {
        return STYLE_PRESETS[name] || null;
    }
}
