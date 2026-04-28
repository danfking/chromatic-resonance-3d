// progression.js - XP and leveling system

export class ProgressionSystem {
    constructor() {
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;
        this.totalXp = 0;

        // Stats that improve with level
        this.stats = {
            maxHealth: 100,
            damage: 1.0,
            colorEfficiency: 1.0  // Multiplier for color gains
        };

        this.init();
        this.setupEventListeners();
    }

    init() {
        this.createUI();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'progression-ui';
        container.innerHTML = `
            <div class="level-display">
                <span class="level-label">Lv.</span>
                <span class="level-number">1</span>
            </div>
            <div class="xp-bar-container">
                <div class="xp-bar-fill"></div>
                <div class="xp-text">0 / 100</div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #progression-ui {
                position: fixed;
                top: 10px;
                right: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 100;
            }

            .level-display {
                background: linear-gradient(135deg, #3a3a5a, #2a2a4a);
                border: 2px solid rgba(212, 165, 116, 0.6);
                border-radius: 8px;
                padding: 4px 12px;
                display: flex;
                align-items: baseline;
                gap: 4px;
            }

            .level-label {
                color: #aaa;
                font-size: 12px;
                font-family: 'Georgia', serif;
            }

            .level-number {
                color: #d4a574;
                font-size: 20px;
                font-weight: bold;
                font-family: 'Georgia', serif;
            }

            .xp-bar-container {
                width: 150px;
                height: 20px;
                background: rgba(26, 26, 46, 0.9);
                border: 1px solid rgba(212, 165, 116, 0.4);
                border-radius: 10px;
                overflow: hidden;
                position: relative;
            }

            .xp-bar-fill {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #8855aa, #aa77cc);
                transition: width 0.3s ease-out;
                box-shadow: 0 0 10px rgba(136, 85, 170, 0.5);
            }

            .xp-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #f5f0e6;
                font-size: 11px;
                font-family: monospace;
                text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
            }

            .level-up-notification {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, rgba(136, 85, 170, 0.95), rgba(58, 58, 90, 0.95));
                border: 3px solid #d4a574;
                border-radius: 12px;
                padding: 30px 50px;
                text-align: center;
                z-index: 200;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }

            .level-up-notification.visible {
                opacity: 1;
            }

            .level-up-title {
                color: #d4a574;
                font-size: 28px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                margin-bottom: 10px;
                text-shadow: 0 0 20px rgba(212, 165, 116, 0.5);
            }

            .level-up-level {
                color: #f5f0e6;
                font-size: 48px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                margin-bottom: 15px;
            }

            .level-up-stats {
                color: #88cc88;
                font-size: 14px;
                font-family: monospace;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);

        // Create level up notification
        const levelUpNotif = document.createElement('div');
        levelUpNotif.className = 'level-up-notification';
        levelUpNotif.innerHTML = `
            <div class="level-up-title">LEVEL UP!</div>
            <div class="level-up-level">2</div>
            <div class="level-up-stats">+10 Max Health<br>+10% Damage</div>
        `;
        document.body.appendChild(levelUpNotif);
        this.levelUpNotification = levelUpNotif;

        // Store UI references
        this.levelNumber = document.querySelector('.level-number');
        this.xpBarFill = document.querySelector('.xp-bar-fill');
        this.xpText = document.querySelector('.xp-text');
    }

    setupEventListeners() {
        // Gain XP when enemies die
        window.addEventListener('enemy-died', (e) => {
            const { type } = e.detail;
            const xpGain = type.xpValue || 10;
            this.addXp(xpGain);
        });

        // Bonus XP for wave completion
        window.addEventListener('wave-complete', (e) => {
            const { wave } = e.detail;
            const bonusXp = wave * 25;
            this.addXp(bonusXp);
            this.showXpGain(`+${bonusXp} XP (Wave Bonus)`);
        });

        // Combo bonus XP
        window.addEventListener('combo-bonus-xp', (e) => {
            const { amount, combo } = e.detail;
            this.addXp(amount);
            this.showXpGain(`+${amount} XP (${combo}x Combo)`);
        });
    }

    addXp(amount) {
        this.xp += amount;
        this.totalXp += amount;

        // Check for level up
        while (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.levelUp();
        }

        this.updateUI();
    }

    levelUp() {
        this.level++;

        // Calculate XP for next level (exponential curve)
        this.xpToNextLevel = Math.floor(100 * Math.pow(1.5, this.level - 1));

        // Improve stats
        this.stats.maxHealth += 10;
        this.stats.damage += 0.1;
        this.stats.colorEfficiency += 0.05;

        // Dispatch level up event
        window.dispatchEvent(new CustomEvent('level-up', {
            detail: {
                level: this.level,
                stats: { ...this.stats }
            }
        }));

        // Show level up notification
        this.showLevelUpNotification();

        // Play level up sound
        window.dispatchEvent(new CustomEvent('play-level-up-sound'));
    }

    showLevelUpNotification() {
        const notif = this.levelUpNotification;
        notif.querySelector('.level-up-level').textContent = this.level;
        notif.querySelector('.level-up-stats').innerHTML =
            `Max Health: ${this.stats.maxHealth}<br>` +
            `Damage: +${Math.round((this.stats.damage - 1) * 100)}%<br>` +
            `Color Gain: +${Math.round((this.stats.colorEfficiency - 1) * 100)}%`;

        notif.classList.add('visible');

        setTimeout(() => {
            notif.classList.remove('visible');
        }, 2500);
    }

    showXpGain(text) {
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 35px;
            right: 175px;
            color: #aa77cc;
            font-size: 14px;
            font-family: monospace;
            text-shadow: 0 0 10px rgba(136, 85, 170, 0.8);
            z-index: 150;
            animation: xpFloat 1.5s ease-out forwards;
        `;
        popup.textContent = text;

        // Add animation
        if (!document.getElementById('xp-animation-style')) {
            const animStyle = document.createElement('style');
            animStyle.id = 'xp-animation-style';
            animStyle.textContent = `
                @keyframes xpFloat {
                    0% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-30px); }
                }
            `;
            document.head.appendChild(animStyle);
        }

        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 1500);
    }

    updateUI() {
        const percent = (this.xp / this.xpToNextLevel) * 100;

        this.levelNumber.textContent = this.level;
        this.xpBarFill.style.width = `${percent}%`;
        this.xpText.textContent = `${this.xp} / ${this.xpToNextLevel}`;
    }

    getStats() {
        return { ...this.stats };
    }

    getLevel() {
        return this.level;
    }
}
