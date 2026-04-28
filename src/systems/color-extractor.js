// color-extractor.js - 3D color extraction system

import * as THREE from 'three';

export class ColorExtractor {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;

        this.raycaster = new THREE.Raycaster();
        this.center = new THREE.Vector2(0, 0); // Screen center

        this.currentTarget = null;
        this.extractedColors = [];

        // UI elements
        this.crosshair = document.getElementById('crosshair');
        this.tooltip = document.getElementById('color-tooltip');
        this.tooltipPreview = this.tooltip?.querySelector('.color-preview');
        this.tooltipName = this.tooltip?.querySelector('.color-name');
    }

    update() {
        // Raycast from screen center
        this.raycaster.setFromCamera(this.center, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Find first extractable object
        let found = null;
        for (const hit of intersects) {
            if (hit.object.userData?.extractable) {
                found = hit;
                break;
            }
        }

        if (found) {
            this.currentTarget = found.object;
            this.showExtractUI(found.object);
        } else {
            this.currentTarget = null;
            this.hideExtractUI();
        }
    }

    showExtractUI(object) {
        // Activate crosshair
        if (this.crosshair) {
            this.crosshair.classList.add('active');
        }

        // Show tooltip with color info
        if (this.tooltip) {
            const colorName = object.userData.colorName || 'Unknown';
            const colorType = object.userData.colorType || 'ivory';
            const colorHex = object.userData.colorHex ||
                object.material?.color?.getHex() || 0xffffff;

            if (this.tooltipPreview) {
                this.tooltipPreview.style.backgroundColor = '#' + colorHex.toString(16).padStart(6, '0');
            }

            if (this.tooltipName) {
                this.tooltipName.textContent = `${colorName} (${colorType})`;
            }

            this.tooltip.classList.add('visible');
        }
    }

    hideExtractUI() {
        if (this.crosshair) {
            this.crosshair.classList.remove('active');
        }
        if (this.tooltip) {
            this.tooltip.classList.remove('visible');
        }
    }

    extract() {
        if (!this.currentTarget) return false;

        const object = this.currentTarget;
        const colorType = object.userData.colorType || 'ivory';
        const colorName = object.userData.colorName || 'Unknown';
        const colorHex = object.userData.colorHex ||
            object.material?.color?.getHex() || 0xffffff;

        // Play extraction effect
        this.playExtractionEffect(object);

        // Store extracted color
        this.extractedColors.push({
            type: colorType,
            name: colorName,
            hex: colorHex,
            timestamp: Date.now()
        });

        console.log(`Extracted: ${colorName} (${colorType})`);

        // Emit event for game systems
        window.dispatchEvent(new CustomEvent('color-extracted', {
            detail: {
                type: colorType,
                name: colorName,
                hex: colorHex,
                position: object.position.clone()
            }
        }));

        return true;
    }

    playExtractionEffect(object) {
        // Visual feedback: pulse and desaturate the object
        const originalColor = object.material.color.clone();
        const originalEmissive = object.material.emissive?.clone() || new THREE.Color(0);

        // Flash bright
        object.material.emissive = originalColor;
        object.material.emissiveIntensity = 1.0;

        // Animate back to normal
        const duration = 500;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out
            const eased = 1 - Math.pow(1 - progress, 3);

            object.material.emissiveIntensity = 1.0 - eased * 0.9;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                object.material.emissive = originalEmissive;
                object.material.emissiveIntensity = 0.1;
            }
        };

        animate();

        // Screen flash effect
        this.flashScreen();
    }

    flashScreen() {
        // Reuse a single flash element instead of creating new ones
        if (!this.flashElement) {
            this.flashElement = document.createElement('div');
            this.flashElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.3);
                pointer-events: none;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.1s;
            `;
            document.body.appendChild(this.flashElement);
        }

        // Flash by toggling opacity
        this.flashElement.style.opacity = '1';
        setTimeout(() => {
            this.flashElement.style.opacity = '0';
        }, 100);
    }

    getExtractedColors() {
        return this.extractedColors;
    }

    getColorCount(type) {
        return this.extractedColors.filter(c => c.type === type).length;
    }
}
