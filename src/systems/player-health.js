// player-health.js - Player health and damage system

export class PlayerHealth {
    constructor() {
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.invulnerable = false;
        this.invulnerabilityDuration = 500; // ms after taking damage

        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
    }

    createUI() {
        const panel = document.createElement('div');
        panel.id = 'player-health';
        panel.innerHTML = `
            <div class="health-bar-container">
                <div class="health-bar-bg">
                    <div class="health-bar-fill"></div>
                </div>
                <span class="health-text">100 / 100</span>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #player-health {
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 100;
            }

            .health-bar-container {
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(26, 26, 46, 0.9);
                padding: 8px 16px;
                border-radius: 8px;
                border: 1px solid rgba(212, 165, 116, 0.3);
            }

            .health-bar-bg {
                width: 200px;
                height: 16px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                overflow: hidden;
            }

            .health-bar-fill {
                width: 100%;
                height: 100%;
                background: linear-gradient(to right, #44aa44, #66cc66);
                transition: width 0.3s ease;
            }

            .health-bar-fill.low {
                background: linear-gradient(to right, #aa4444, #cc6666);
            }

            .health-bar-fill.medium {
                background: linear-gradient(to right, #aaaa44, #cccc66);
            }

            .health-text {
                color: #f5f0e6;
                font-size: 14px;
                font-weight: bold;
                min-width: 70px;
            }

            #damage-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 50;
                background: radial-gradient(ellipse at center, transparent 50%, rgba(170, 68, 68, 0) 100%);
                opacity: 0;
                transition: opacity 0.1s;
            }

            #damage-overlay.flash {
                opacity: 1;
                background: radial-gradient(ellipse at center, transparent 30%, rgba(170, 68, 68, 0.5) 100%);
            }

            #game-over {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: none;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                z-index: 200;
            }

            #game-over.visible {
                display: flex;
            }

            #game-over h1 {
                color: #aa4444;
                font-size: 48px;
                margin-bottom: 20px;
            }

            #game-over p {
                color: #f5f0e6;
                font-size: 18px;
                margin-bottom: 30px;
            }

            #game-over button {
                padding: 12px 32px;
                font-size: 16px;
                background: #d4a574;
                border: none;
                border-radius: 4px;
                color: #1a1a2e;
                cursor: pointer;
                font-weight: bold;
            }

            #game-over button:hover {
                background: #e4b584;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Create damage overlay
        const overlay = document.createElement('div');
        overlay.id = 'damage-overlay';
        document.body.appendChild(overlay);

        // Create game over screen
        const gameOver = document.createElement('div');
        gameOver.id = 'game-over';
        gameOver.innerHTML = `
            <h1>YOU DIED</h1>
            <p>Your colors have faded...</p>
            <button onclick="location.reload()">Try Again</button>
        `;
        document.body.appendChild(gameOver);

        this.healthFill = panel.querySelector('.health-bar-fill');
        this.healthText = panel.querySelector('.health-text');
        this.damageOverlay = overlay;
        this.gameOverScreen = gameOver;
    }

    setupEventListeners() {
        // Spawn invulnerability — 8 seconds when entering a zone
        // Also set on ZONE_INTRO to guarantee it's active before enemies spawn
        window.addEventListener('run-state-changed', (e) => {
            const { to } = e.detail || {};
            if (to === 'ZONE_INTRO' || to === 'PLAYING') {
                this.invulnerable = true;
                this.isDead = false;
                this.health = this.maxHealth;
                this.updateUI();
                if (this._spawnInvulnTimer) clearTimeout(this._spawnInvulnTimer);
                this._spawnInvulnTimer = setTimeout(() => {
                    this.invulnerable = false;
                }, 8000);
            }
        });

        // Reset on new run
        window.addEventListener('run-reset', () => {
            this.isDead = false;
            this.health = this.maxHealth;
            this.invulnerable = false;
            this.updateUI();
        });

        // Core system integration — vitality capacity drives maxHealth
        const updateFromCore = (e) => {
            if (e.detail?.type === 'vitality') {
                const newMax = e.detail.capacity || this.maxHealth;
                this.maxHealth = newMax;
                this.health = Math.min(this.health, this.maxHealth);
                this.updateUI();
            }
        };
        window.addEventListener('core-leveled', updateFromCore);
        window.addEventListener('core-upgraded', updateFromCore);
        window.addEventListener('core-unlocked', updateFromCore);

        // Listen for enemy attacks
        window.addEventListener('enemy-attack', (e) => {
            const { damage } = e.detail;
            this.takeDamage(damage);
        });

        // Listen for healing
        window.addEventListener('player-heal', (e) => {
            const { amount } = e.detail;
            this.heal(amount);
        });

        // Listen for equipment stat changes (Living Arsenal)
        window.addEventListener('equipment-stats-changed', (e) => {
            const { stats } = e.detail;
            if (stats && stats.health !== undefined) {
                const baseHealth = 100;
                this.maxHealth = baseHealth + stats.health;
                this.health = Math.min(this.health, this.maxHealth);
                this.updateUI();
            }
        });
    }

    takeDamage(amount) {
        if (this.isDead || this.invulnerable) return;

        this.health = Math.max(0, this.health - amount);
        this.updateUI();

        // Flash damage overlay
        this.damageOverlay.classList.add('flash');
        setTimeout(() => this.damageOverlay.classList.remove('flash'), 150);

        // Dispatch damage event for audio and HUD
        window.dispatchEvent(new CustomEvent('player-damaged', {
            detail: { damage: amount, health: this.health, newHealth: this.health, maxHealth: this.maxHealth }
        }));

        // Camera shake effect
        window.dispatchEvent(new CustomEvent('camera-shake', {
            detail: { intensity: 0.1, duration: 200 }
        }));

        // Invulnerability frames
        this.invulnerable = true;
        setTimeout(() => {
            this.invulnerable = false;
        }, this.invulnerabilityDuration);

        // Check death
        if (this.health <= 0) {
            this.die();
        }
    }

    heal(amount) {
        if (this.isDead) return;

        this.health = Math.min(this.maxHealth, this.health + amount);
        this.updateUI();

        // Visual feedback
        window.dispatchEvent(new CustomEvent('player-healed', {
            detail: {
                amount: amount,
                newHealth: this.health,
                maxHealth: this.maxHealth
            }
        }));
    }

    updateUI() {
        const percent = this.health / this.maxHealth;

        // Update health bar
        if (this.healthFill) {
            this.healthFill.style.width = `${percent * 100}%`;

            // Color based on health
            this.healthFill.classList.remove('low', 'medium');
            if (percent <= 0.25) {
                this.healthFill.classList.add('low');
            } else if (percent <= 0.5) {
                this.healthFill.classList.add('medium');
            }
        }

        // Update text
        if (this.healthText) {
            this.healthText.textContent = `${Math.ceil(this.health)} / ${this.maxHealth}`;
        }
    }

    die() {
        this.isDead = true;

        // Dispatch death event for game state UI
        window.dispatchEvent(new CustomEvent('player-died'));

        // Note: game-state.js handles showing the game over screen
        // and releasing pointer lock
    }

    getHealth() {
        return this.health;
    }

    getMaxHealth() {
        return this.maxHealth;
    }

    isAlive() {
        return !this.isDead;
    }
}
