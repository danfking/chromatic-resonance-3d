// floating-text.js - LitRPG-style floating damage numbers and notifications

import * as THREE from 'three';

export class FloatingTextManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.texts = [];
        this.container = null;

        this.init();
        this.setupEventListeners();
    }

    init() {
        // Create container for floating text
        this.container = document.createElement('div');
        this.container.id = 'floating-text-container';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 150;
            overflow: hidden;
        `;
        document.body.appendChild(this.container);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .floating-text {
                position: absolute;
                font-family: 'Georgia', serif;
                font-weight: bold;
                text-shadow:
                    2px 2px 0 rgba(0,0,0,0.8),
                    -1px -1px 0 rgba(0,0,0,0.5);
                white-space: nowrap;
                transform: translate(-50%, -50%);
                transition: opacity 0.1s;
            }

            .floating-text.damage {
                color: #ff6644;
                font-size: 24px;
            }

            .floating-text.damage.critical {
                color: #ffaa00;
                font-size: 32px;
                text-shadow:
                    0 0 10px rgba(255, 170, 0, 0.8),
                    2px 2px 0 rgba(0,0,0,0.8);
            }

            .floating-text.heal {
                color: #44ff66;
                font-size: 22px;
            }

            .floating-text.xp {
                color: #aa77ff;
                font-size: 18px;
            }

            .floating-text.level-up {
                color: #ffdd44;
                font-size: 36px;
                text-shadow:
                    0 0 20px rgba(255, 221, 68, 0.8),
                    2px 2px 0 rgba(0,0,0,0.8);
            }

            .floating-text.color-gain {
                font-size: 16px;
            }

            .floating-text.miss {
                color: #888888;
                font-size: 18px;
                font-style: italic;
            }

            .floating-text.blocked {
                color: #4488ff;
                font-size: 20px;
            }
        `;
        document.head.appendChild(style);

        // Start update loop
        this.startUpdateLoop();
    }

    setupEventListeners() {
        // Enemy takes damage
        window.addEventListener('enemy-hit', (e) => {
            const { damage, position, isCritical } = e.detail;
            if (position) {
                this.spawnDamageNumber(position, damage, isCritical);
            }
        });

        // Enemy dies - show XP
        window.addEventListener('enemy-died', (e) => {
            const { position, type } = e.detail;
            if (position && type) {
                const xp = type.xpValue || 10;
                setTimeout(() => {
                    this.spawnText(position, `+${xp} XP`, 'xp');
                }, 200);
            }
        });

        // Player heals - show at bottom center of screen
        window.addEventListener('player-healed', (e) => {
            const { amount } = e.detail;
            if (amount) {
                this.spawnScreenText(`+${Math.round(amount)} HP`, 'heal', {
                    x: window.innerWidth / 2,
                    y: window.innerHeight * 0.7
                });
            }
        });

        // Level up
        window.addEventListener('level-up', (e) => {
            const { level } = e.detail;
            // Show in center of screen
            this.spawnCenterText(`LEVEL ${level}!`, 'level-up');
        });

        // Color gained
        window.addEventListener('color-extracted', (e) => {
            const { color, position } = e.detail;
            if (color && position) {
                this.spawnColorText(position, color);
            }
        });
    }

    spawnDamageNumber(worldPos, damage, isCritical = false) {
        const text = Math.round(damage).toString();
        const className = isCritical ? 'damage critical' : 'damage';
        this.spawnText(worldPos, text, className, {
            scatter: true,
            scale: isCritical ? 1.3 : 1
        });
    }

    spawnColorText(worldPos, colorName) {
        const colorMap = {
            crimson: '#c44444',
            azure: '#4477aa',
            verdant: '#44aa66',
            golden: '#ddaa44',
            violet: '#8855aa',
            ivory: '#f5f0e6'
        };

        const color = colorMap[colorName.toLowerCase()] || '#ffffff';
        this.spawnText(worldPos, `+1 ${colorName}`, 'color-gain', {
            color: color
        });
    }

    spawnCenterText(text, className) {
        this.spawnScreenText(text, className, {
            x: window.innerWidth / 2,
            y: window.innerHeight * 0.4
        }, 2.0);
    }

    spawnScreenText(text, className, pos, life = 1.2) {
        const element = document.createElement('div');
        element.className = `floating-text ${className}`;
        element.textContent = text;
        element.style.left = `${pos.x}px`;
        element.style.top = `${pos.y}px`;

        this.container.appendChild(element);

        this.texts.push({
            element,
            worldPos: null,
            screenPos: { x: pos.x, y: pos.y },
            velocity: { x: 0, y: -50 },
            life: life,
            maxLife: life,
            isScreenSpace: true
        });
    }

    spawnText(worldPos, text, className, options = {}) {
        const element = document.createElement('div');
        element.className = `floating-text ${className}`;
        element.textContent = text;

        if (options.color) {
            element.style.color = options.color;
        }

        this.container.appendChild(element);

        // Random scatter for multiple hits
        const scatter = options.scatter ? {
            x: (Math.random() - 0.5) * 40,
            y: (Math.random() - 0.5) * 20
        } : { x: 0, y: 0 };

        // Convert world position to THREE.Vector3 if needed
        const pos = worldPos instanceof THREE.Vector3
            ? worldPos.clone()
            : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

        // Add slight height offset
        pos.y += 1 + Math.random() * 0.5;

        this.texts.push({
            element,
            worldPos: pos,
            scatter,
            velocity: { x: scatter.x * 2, y: -80 - Math.random() * 40 },
            life: 1.2,
            maxLife: 1.2,
            scale: options.scale || 1,
            isScreenSpace: false
        });
    }

    startUpdateLoop() {
        let lastTime = performance.now();

        const update = () => {
            const now = performance.now();
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            this.update(delta);
            requestAnimationFrame(update);
        };
        update();
    }

    update(delta) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const text = this.texts[i];
            text.life -= delta;

            if (text.life <= 0) {
                text.element.remove();
                this.texts.splice(i, 1);
                continue;
            }

            // Calculate opacity based on life
            const lifePercent = text.life / text.maxLife;
            const opacity = lifePercent < 0.3 ? lifePercent / 0.3 : 1;
            text.element.style.opacity = opacity;

            if (text.isScreenSpace) {
                // Screen space text (like level up)
                text.screenPos.y += text.velocity.y * delta;
                text.element.style.left = `${text.screenPos.x}px`;
                text.element.style.top = `${text.screenPos.y}px`;
            } else {
                // World space text
                // Move world position up
                text.worldPos.y += 1.5 * delta;

                // Project to screen
                const screenPos = this.worldToScreen(text.worldPos);

                if (screenPos) {
                    text.element.style.left = `${screenPos.x + text.scatter.x}px`;
                    text.element.style.top = `${screenPos.y + text.scatter.y}px`;
                    text.element.style.display = 'block';

                    // Scale based on distance
                    const scale = text.scale * Math.max(0.5, Math.min(1.5, 10 / screenPos.distance));
                    text.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
                } else {
                    text.element.style.display = 'none';
                }
            }
        }
    }

    worldToScreen(worldPos) {
        const vector = worldPos.clone();
        vector.project(this.camera);

        // Check if in front of camera
        if (vector.z > 1) return null;

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        // Calculate distance for scaling
        const distance = worldPos.distanceTo(this.camera.position);

        return { x, y, distance };
    }
}
