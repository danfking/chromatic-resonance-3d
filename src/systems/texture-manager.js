// texture-manager.js - Loads and caches textures for sprites and models

import * as THREE from 'three';
import { createTriplanarPortraitMaterial } from './triplanar-portrait-material.js';

// Mapping of game IDs to texture filenames
const TEXTURE_MAP = {
    // Enemies
    'shade': 'color-shade',
    'crimsonWraith': 'crimson-wraith',
    'azurePhantom': 'azure-phantom',
    'verdantSlime': 'verdant-slime',
    'chromaticGuardian': 'chromatic-guardian',
    'voidHarbinger': 'void-harbinger',

    // Player
    'player': 'player-character',

    // Color orbs
    'crimson': 'color-orb-crimson',
    'azure': 'color-orb-azure',
    'verdant': 'color-orb-verdant',
    'golden': 'color-orb-golden',
    'violet': 'color-orb-violet',

    // Environment
    'ground': 'ground-texture',
    'arena': 'arena-background',

    // World textures (tileable)
    'groundFloor': 'ground-floor-tileable',
    'wallStone': 'wall-stone-tileable',
    'pillarStone': 'pillar-stone-tileable',

    // Ground textures
    'ground-asphalt': 'ground-asphalt',
    'ground-concrete': 'ground-concrete',
    'ground-grass-lawn': 'ground-grass-lawn',
    'ground-dirt-path': 'ground-dirt-path',

    // Wall textures
    'wall-brick-red': 'wall-brick-red',
    'wall-concrete-modern': 'wall-concrete-modern',
    'wall-wood-siding': 'wall-wood-siding',
    'wall-corrugated-metal': 'wall-corrugated-metal',

    // Clothing textures
    'clothing-civilian-casual': 'clothing-civilian-casual',
    'clothing-police-uniform': 'clothing-police-uniform',
    'clothing-soldier-camo': 'clothing-soldier-camo',
    'clothing-riot-gear': 'clothing-riot-gear',
    'clothing-commander-dress': 'clothing-commander-dress',

    // Vehicle paint textures
    'vehicle-paint-green': 'vehicle-paint-green',
    'vehicle-paint-rust': 'vehicle-paint-rust',

    // Face atlas
    'face-atlas-googly': 'face-atlas-googly',
};

class TextureManagerClass {
    constructor() {
        this.loader = new THREE.TextureLoader();
        this.cache = new Map();
        this.triplanarCache = new Map();
        this.basePath = './sprites/';
        this.texturesEnabled = false;

        // Check if textures exist
        this.checkTexturesAvailable();
    }

    async checkTexturesAvailable() {
        // Try to load a test texture to see if assets exist
        try {
            const testPath = `${this.basePath}color-shade.png`;
            await this.loadTexture(testPath);
            this.texturesEnabled = true;
            console.log('Texture sprites enabled');
        } catch (e) {
            this.texturesEnabled = false;
            console.log('Texture sprites not found - using geometric shapes');
        }
    }

    loadTexture(path) {
        return new Promise((resolve, reject) => {
            if (this.cache.has(path)) {
                resolve(this.cache.get(path));
                return;
            }

            this.loader.load(
                path,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    this.cache.set(path, texture);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    reject(error);
                }
            );
        });
    }

    async getTexture(id) {
        const filename = TEXTURE_MAP[id] || id;
        const path = `${this.basePath}${filename}.png`;

        try {
            return await this.loadTexture(path);
        } catch (e) {
            console.warn(`Texture not found: ${path}`);
            return null;
        }
    }

    getTextureSync(id) {
        const filename = TEXTURE_MAP[id] || id;
        const path = `${this.basePath}${filename}.png`;
        const cached = this.cache.get(path);
        if (cached) return cached;
        // Start async load for next frame
        this.getTexture(id);
        return null;
    }

    async getWorldTexture(id, repeatX = 1, repeatY = 1) {
        const texture = await this.getTexture(id);
        if (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeatX, repeatY);
        }
        return texture;
    }

    isEnabled() {
        return this.texturesEnabled;
    }

    async getTriplanarMaterial(id, enemyColor, size) {
        const texture = await this.getTexture(id);
        if (!texture) return null;
        return createTriplanarPortraitMaterial(texture, enemyColor, size);
    }

    // Create a billboard sprite with texture
    async createSprite(id, scale = 1) {
        const texture = await this.getTexture(id);

        if (!texture) {
            return null;
        }

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(scale, scale, 1);

        return sprite;
    }

    // Create a sprite material for custom use
    async createSpriteMaterial(id, options = {}) {
        const texture = await this.getTexture(id);

        if (!texture) {
            return null;
        }

        return new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            ...options
        });
    }
}

// Singleton instance
export const TextureManager = new TextureManagerClass();
