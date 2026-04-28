// boss-ui.js - Boss announcement and health bar

export class BossUI {
    constructor() {
        this.currentBoss = null;
        this.container = null;

        this.init();
        this.setupEventListeners();
    }

    init() {
        this.createUI();
    }

    createUI() {
        // Boss announcement
        const announcement = document.createElement('div');
        announcement.id = 'boss-announcement';
        announcement.innerHTML = `
            <div class="boss-warning">⚠ WARNING ⚠</div>
            <div class="boss-name">Boss Name</div>
            <div class="boss-subtitle">has appeared!</div>
        `;

        // Boss health bar (shown during fight)
        const healthBar = document.createElement('div');
        healthBar.id = 'boss-health-bar';
        healthBar.innerHTML = `
            <div class="boss-health-name">Boss Name</div>
            <div class="boss-health-container">
                <div class="boss-health-fill"></div>
            </div>
            <div class="boss-health-text">100%</div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #boss-announcement {
                position: fixed;
                top: 30%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 200;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            }

            #boss-announcement.visible {
                opacity: 1;
            }

            .boss-warning {
                font-size: 24px;
                color: #ff4444;
                font-family: monospace;
                letter-spacing: 5px;
                margin-bottom: 10px;
                animation: warningFlash 0.5s ease-in-out infinite;
            }

            @keyframes warningFlash {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            .boss-name {
                font-size: 48px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                color: #d4a574;
                text-shadow:
                    0 0 30px rgba(212, 165, 116, 0.8),
                    0 0 60px rgba(212, 165, 116, 0.4),
                    3px 3px 0 rgba(0, 0, 0, 0.8);
                animation: bossNamePulse 1s ease-in-out infinite;
            }

            @keyframes bossNamePulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .boss-subtitle {
                font-size: 20px;
                color: #888;
                font-family: 'Georgia', serif;
                font-style: italic;
                margin-top: 5px;
            }

            #boss-health-bar {
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                text-align: center;
                z-index: 100;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            }

            #boss-health-bar.visible {
                opacity: 1;
            }

            .boss-health-name {
                font-size: 18px;
                font-family: 'Georgia', serif;
                color: #d4a574;
                margin-bottom: 5px;
                text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
            }

            .boss-health-container {
                width: 400px;
                height: 20px;
                background: rgba(26, 26, 46, 0.9);
                border: 2px solid rgba(212, 165, 116, 0.6);
                border-radius: 10px;
                overflow: hidden;
            }

            .boss-health-fill {
                height: 100%;
                width: 100%;
                background: linear-gradient(90deg, #882222, #cc4444, #882222);
                background-size: 200% 100%;
                animation: healthGradient 2s linear infinite;
                transition: width 0.2s;
            }

            @keyframes healthGradient {
                0% { background-position: 0% 50%; }
                100% { background-position: 200% 50%; }
            }

            .boss-health-text {
                font-size: 14px;
                font-family: monospace;
                color: #f5f0e6;
                margin-top: 3px;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(announcement);
        document.body.appendChild(healthBar);

        this.announcement = announcement;
        this.healthBar = healthBar;
        this.bossNameEl = announcement.querySelector('.boss-name');
        this.healthNameEl = healthBar.querySelector('.boss-health-name');
        this.healthFillEl = healthBar.querySelector('.boss-health-fill');
        this.healthTextEl = healthBar.querySelector('.boss-health-text');
    }

    setupEventListeners() {
        window.addEventListener('boss-spawned', (e) => {
            const { name } = e.detail;
            this.showAnnouncement(name);
        });

        // Track boss health via enemy-hit events
        window.addEventListener('enemy-hit', (e) => {
            // Check if this hit was on a boss (we'd need more info)
            // For now, we'll track via a separate system
        });

        window.addEventListener('enemy-died', (e) => {
            const { type } = e.detail;
            if (type.isBoss) {
                this.hideBossHealth();
            }
        });
    }

    showAnnouncement(bossName) {
        this.currentBoss = bossName;
        this.bossNameEl.textContent = bossName;
        this.healthNameEl.textContent = bossName;

        // Show announcement
        this.announcement.classList.add('visible');

        // Play boss sound
        window.dispatchEvent(new CustomEvent('play-boss-sound'));

        // Hide announcement after delay, show health bar
        setTimeout(() => {
            this.announcement.classList.remove('visible');
            this.healthBar.classList.add('visible');
            this.updateHealthBar(100);
        }, 3000);
    }

    updateHealthBar(percent) {
        this.healthFillEl.style.width = `${percent}%`;
        this.healthTextEl.textContent = `${Math.round(percent)}%`;
    }

    hideBossHealth() {
        this.healthBar.classList.remove('visible');
        this.currentBoss = null;
    }

    // Called by enemy system to update boss health
    setBossHealth(current, max) {
        if (this.currentBoss) {
            const percent = (current / max) * 100;
            this.updateHealthBar(percent);
        }
    }
}
