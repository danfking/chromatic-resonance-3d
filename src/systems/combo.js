// combo.js - Kill combo system for bonus XP and score

export class ComboSystem {
    constructor() {
        this.currentCombo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.comboTimeout = 3.0; // seconds to maintain combo
        this.lastKillTime = 0;

        this.multiplierThresholds = [
            { combo: 3, multiplier: 1.5, name: 'Nice!' },
            { combo: 5, multiplier: 2.0, name: 'Great!' },
            { combo: 10, multiplier: 3.0, name: 'Awesome!' },
            { combo: 15, multiplier: 4.0, name: 'Incredible!' },
            { combo: 25, multiplier: 5.0, name: 'CHROMATIC FURY!' }
        ];

        this.init();
        this.setupEventListeners();
    }

    init() {
        this.createUI();
        this.startUpdateLoop();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'combo-display';
        container.innerHTML = `
            <div class="combo-count">0</div>
            <div class="combo-label">COMBO</div>
            <div class="combo-multiplier">x1.0</div>
            <div class="combo-timer-bar">
                <div class="combo-timer-fill"></div>
            </div>
            <div class="combo-message"></div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #combo-display {
                position: fixed;
                top: 120px;
                left: 10px;
                text-align: center;
                z-index: 100;
                opacity: 0;
                transform: scale(0.8);
                transition: opacity 0.2s, transform 0.2s;
                pointer-events: none;
            }

            #combo-display.active {
                opacity: 1;
                transform: scale(1);
            }

            #combo-display.pulse {
                animation: comboPulse 0.3s ease-out;
            }

            @keyframes comboPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }

            .combo-count {
                font-size: 48px;
                font-weight: bold;
                font-family: 'Georgia', serif;
                color: #d4a574;
                text-shadow:
                    0 0 20px rgba(212, 165, 116, 0.8),
                    2px 2px 0 rgba(0, 0, 0, 0.5);
                line-height: 1;
            }

            .combo-label {
                font-size: 14px;
                color: #888;
                letter-spacing: 3px;
                margin-top: -5px;
            }

            .combo-multiplier {
                font-size: 20px;
                font-family: monospace;
                color: #ffdd44;
                margin-top: 5px;
                text-shadow: 0 0 10px rgba(255, 221, 68, 0.5);
            }

            .combo-timer-bar {
                width: 80px;
                height: 4px;
                background: rgba(100, 100, 120, 0.5);
                border-radius: 2px;
                margin: 8px auto 0;
                overflow: hidden;
            }

            .combo-timer-fill {
                height: 100%;
                width: 100%;
                background: linear-gradient(90deg, #d4a574, #ffdd44);
                transition: width 0.1s linear;
            }

            .combo-message {
                font-size: 16px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                color: #ffdd44;
                margin-top: 8px;
                text-shadow: 0 0 15px rgba(255, 221, 68, 0.8);
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.2s, transform 0.2s;
            }

            .combo-message.visible {
                opacity: 1;
                transform: translateY(0);
            }

            /* Color variations based on multiplier tier */
            #combo-display.tier-1 .combo-count { color: #88cc88; }
            #combo-display.tier-1 .combo-multiplier { color: #88cc88; }

            #combo-display.tier-2 .combo-count { color: #44aaff; }
            #combo-display.tier-2 .combo-multiplier { color: #44aaff; }

            #combo-display.tier-3 .combo-count { color: #ff88ff; }
            #combo-display.tier-3 .combo-multiplier { color: #ff88ff; }

            #combo-display.tier-4 .combo-count { color: #ffaa44; }
            #combo-display.tier-4 .combo-multiplier { color: #ffaa44; }

            #combo-display.tier-5 .combo-count {
                color: #ff4444;
                animation: comboGlow 0.5s ease-in-out infinite alternate;
            }
            #combo-display.tier-5 .combo-multiplier {
                color: #ff4444;
            }

            @keyframes comboGlow {
                from { text-shadow: 0 0 20px rgba(255, 68, 68, 0.8), 2px 2px 0 rgba(0,0,0,0.5); }
                to { text-shadow: 0 0 40px rgba(255, 68, 68, 1), 0 0 60px rgba(255, 68, 68, 0.5), 2px 2px 0 rgba(0,0,0,0.5); }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);

        this.container = container;
        this.comboCountEl = container.querySelector('.combo-count');
        this.multiplierEl = container.querySelector('.combo-multiplier');
        this.timerFillEl = container.querySelector('.combo-timer-fill');
        this.messageEl = container.querySelector('.combo-message');
    }

    setupEventListeners() {
        window.addEventListener('enemy-died', (e) => {
            this.addKill(e.detail);
        });
    }

    addKill(enemyData) {
        const now = performance.now() / 1000;

        // Increment combo
        this.currentCombo++;
        this.comboTimer = this.comboTimeout;
        this.lastKillTime = now;

        // Track max combo
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
        }

        // Calculate multiplier
        const multiplier = this.getMultiplier();

        // Apply bonus XP
        const baseXp = enemyData.type?.xpValue || 10;
        const bonusXp = Math.floor(baseXp * (multiplier - 1));

        if (bonusXp > 0) {
            // Dispatch bonus XP event
            window.dispatchEvent(new CustomEvent('combo-bonus-xp', {
                detail: { amount: bonusXp, combo: this.currentCombo }
            }));
        }

        // Update UI
        this.updateUI();

        // Check for milestone messages
        this.checkMilestone();

        // Play combo sound
        if (this.currentCombo > 1) {
            window.dispatchEvent(new CustomEvent('combo-hit', {
                detail: { combo: this.currentCombo }
            }));
        }
    }

    getMultiplier() {
        let multiplier = 1.0;
        for (const threshold of this.multiplierThresholds) {
            if (this.currentCombo >= threshold.combo) {
                multiplier = threshold.multiplier;
            }
        }
        return multiplier;
    }

    getTier() {
        let tier = 0;
        for (let i = 0; i < this.multiplierThresholds.length; i++) {
            if (this.currentCombo >= this.multiplierThresholds[i].combo) {
                tier = i + 1;
            }
        }
        return tier;
    }

    checkMilestone() {
        for (const threshold of this.multiplierThresholds) {
            if (this.currentCombo === threshold.combo) {
                this.showMessage(threshold.name);
                break;
            }
        }
    }

    showMessage(text) {
        this.messageEl.textContent = text;
        this.messageEl.classList.add('visible');

        setTimeout(() => {
            this.messageEl.classList.remove('visible');
        }, 1500);
    }

    updateUI() {
        // Show container
        this.container.classList.add('active');

        // Update count
        this.comboCountEl.textContent = this.currentCombo;

        // Update multiplier
        const multiplier = this.getMultiplier();
        this.multiplierEl.textContent = `x${multiplier.toFixed(1)}`;

        // Update tier styling
        const tier = this.getTier();
        this.container.className = 'active';
        if (tier > 0) {
            this.container.classList.add(`tier-${tier}`);
        }

        // Pulse animation
        this.container.classList.remove('pulse');
        void this.container.offsetWidth; // Trigger reflow
        this.container.classList.add('pulse');
    }

    startUpdateLoop() {
        let lastTime = performance.now();

        const update = () => {
            const now = performance.now();
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            if (this.comboTimer > 0) {
                this.comboTimer -= delta;

                // Update timer bar
                const percent = (this.comboTimer / this.comboTimeout) * 100;
                this.timerFillEl.style.width = `${percent}%`;

                if (this.comboTimer <= 0) {
                    this.resetCombo();
                }
            }

            requestAnimationFrame(update);
        };
        update();
    }

    resetCombo() {
        if (this.currentCombo > 0) {
            // Dispatch combo ended event with stats
            window.dispatchEvent(new CustomEvent('combo-ended', {
                detail: {
                    finalCombo: this.currentCombo,
                    maxCombo: this.maxCombo
                }
            }));
        }

        this.currentCombo = 0;
        this.comboTimer = 0;

        // Hide UI
        this.container.classList.remove('active');
        this.container.className = '';
    }

    getCombo() {
        return this.currentCombo;
    }

    getMaxCombo() {
        return this.maxCombo;
    }
}
