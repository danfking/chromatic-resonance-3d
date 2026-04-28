// run-hud.js - Minimal in-game HUD for roguelike alpha
// Particles ARE the UI. This module only provides:
// - Gold counter (small text, only mandatory text element)
// - Zone indicator (on entry, fades after 3s)
// - Low vitality warning (screen edges redden)
// - Hides legacy HUD elements (health bar, XP bar, minimap, wave/score)

const ZONE_NAMES = [
    'Chillagoe Research Site',
    'Herberton Scrapyard',
    'Innisfail',
];

export class RunHUD {
    constructor() {
        this.gold = 0;
        this.zoneTimeout = null;
        this.lowVitalityActive = false;

        this.init();
    }

    init() {
        this.createStyles();
        this.createGoldCounter();
        this.createZoneIndicator();
        this.createVitalityWarning();
        this.hideLegacyHUD();
        this.setupEventListeners();
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Gold counter - top left, readable */
            #run-gold {
                position: fixed;
                top: 14px;
                left: 16px;
                z-index: 110;
                font-family: 'Georgia', serif;
                font-size: 20px;
                color: #e8d06a;
                text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(232, 208, 106, 0.3);
                pointer-events: none;
                background: rgba(10, 10, 20, 0.5);
                padding: 4px 12px;
                border-radius: 4px;
            }

            #run-gold .gold-icon {
                font-size: 14px;
                margin-right: 4px;
                opacity: 0.8;
            }

            /* Persistent zone label below gold */
            #run-zone-label {
                position: fixed;
                top: 48px;
                left: 16px;
                z-index: 110;
                font-family: 'Georgia', serif;
                font-size: 13px;
                color: #8888aa;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
                pointer-events: none;
                background: rgba(10, 10, 20, 0.4);
                padding: 2px 10px;
                border-radius: 3px;
                letter-spacing: 1px;
            }

            /* Zone indicator - centered, fades */
            #zone-indicator {
                position: fixed;
                top: 18%;
                left: 50%;
                transform: translateX(-50%);
                z-index: 120;
                text-align: center;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.6s ease;
            }

            #zone-indicator.visible {
                opacity: 1;
            }

            #zone-indicator .zone-number {
                font-family: 'Georgia', serif;
                font-size: 14px;
                color: #8888aa;
                letter-spacing: 4px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }

            #zone-indicator .zone-name {
                font-family: 'Georgia', serif;
                font-size: 32px;
                color: #d4a574;
                letter-spacing: 3px;
                text-shadow: 0 0 20px rgba(212, 165, 116, 0.3);
            }

            /* Low vitality warning - screen edge vignette */
            #vitality-warning {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 90;
                opacity: 0;
                transition: opacity 0.4s ease;
                background: radial-gradient(
                    ellipse at center,
                    transparent 40%,
                    rgba(170, 40, 40, 0.35) 100%
                );
            }

            #vitality-warning.active {
                opacity: 1;
                animation: vitalityPulse 1.2s ease-in-out infinite;
            }

            @keyframes vitalityPulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }

            /* Hide ALL legacy HUD elements — particles ARE the UI */
            /* Only gold counter, zone indicator, and vitality warning remain visible */
            #player-health,
            #progression-ui,
            #minimap,
            #tutorial-overlay,
            #boss-announcement,
            #boss-health-bar,
            .powerup-pickup-text,
            .level-up-notification,
            #npc-interact-prompt,
            #style-lab-hud,
            #game-over,
            #game-over-screen,
            #victory-screen,
            #damage-overlay,
            #color-tooltip,
            #controls-hint,
            #debug-info,
            #wand-hud,
            #spell-menu,
            #equipment-hud,
            #equipment-panel,
            #floating-text-container,
            #lore-overlay,
            #color-inventory,
            #ability-bar,
            #combo-display,
            #wave-notification,
            #crosshair,
            #hud { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    createGoldCounter() {
        const el = document.createElement('div');
        el.id = 'run-gold';
        el.innerHTML = `<span class="gold-icon">G</span><span id="run-gold-value">0</span>`;
        document.body.appendChild(el);
        this.goldEl = document.getElementById('run-gold-value');

        // Persistent zone label (stays visible throughout gameplay)
        const zoneLabel = document.createElement('div');
        zoneLabel.id = 'run-zone-label';
        zoneLabel.textContent = '';
        document.body.appendChild(zoneLabel);
        this.zoneLabelEl = zoneLabel;
    }

    createZoneIndicator() {
        const el = document.createElement('div');
        el.id = 'zone-indicator';
        el.innerHTML = `
            <div class="zone-number"></div>
            <div class="zone-name"></div>
        `;
        document.body.appendChild(el);
        this.zoneIndicator = el;
    }

    createVitalityWarning() {
        const el = document.createElement('div');
        el.id = 'vitality-warning';
        document.body.appendChild(el);
        this.vitalityWarning = el;
    }

    hideLegacyHUD() {
        // Hide old wave/score from debug-info (keep FPS visible)
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            // Hide wave/score line but keep FPS
            const children = debugInfo.children;
            for (let i = 0; i < children.length; i++) {
                const text = children[i].textContent;
                if (text.includes('Wave') || text.includes('Score')) {
                    children[i].style.display = 'none';
                }
            }
        }

        // Hide controls hint (outdated text)
        const controlsHint = document.getElementById('controls-hint');
        if (controlsHint) controlsHint.style.display = 'none';

        // Hide color tooltip
        const colorTooltip = document.getElementById('color-tooltip');
        if (colorTooltip) colorTooltip.style.display = 'none';
    }

    setupEventListeners() {
        // Gold collection
        window.addEventListener('gold-collected', (e) => {
            this.gold += (e.detail?.amount || 0);
            this.updateGold();
        });

        // Gold spent (shop purchases)
        window.addEventListener('gold-spent', (e) => {
            this.gold = Math.max(0, this.gold - (e.detail?.amount || 0));
            this.updateGold();
        });

        // Zone entry
        window.addEventListener('run-state-changed', (e) => {
            const { to, zoneIndex } = e.detail;
            if (to === 'ZONE_INTRO' || to === 'PLAYING') {
                this.showZoneIndicator(zoneIndex);
            }
        });

        // Reset on new run
        window.addEventListener('run-reset', () => {
            this.gold = 0;
            this.updateGold();
            this.setLowVitality(false);
        });

        // Vitality changes (low health warning)
        window.addEventListener('player-damaged', (e) => {
            this.checkVitality(e.detail);
        });

        window.addEventListener('player-healed', (e) => {
            this.checkVitality(e.detail);
        });

        // Enemy kill gold drops (dispatch gold-collected for all systems to consume)
        window.addEventListener('enemy-died', (e) => {
            const goldAmount = e.detail?.goldDrop || (e.detail?.type?.isBoss ? 50 : 5);
            window.dispatchEvent(new CustomEvent('gold-collected', {
                detail: { amount: goldAmount }
            }));
        });
    }

    updateGold() {
        if (this.goldEl) {
            this.goldEl.textContent = this.gold;
        }
    }

    showZoneIndicator(zoneIndex) {
        const name = ZONE_NAMES[zoneIndex] || `Zone ${zoneIndex + 1}`;

        this.zoneIndicator.querySelector('.zone-number').textContent = `ZONE ${zoneIndex + 1}`;
        this.zoneIndicator.querySelector('.zone-name').textContent = name;
        this.zoneIndicator.classList.add('visible');

        // Update persistent zone label
        if (this.zoneLabelEl) {
            this.zoneLabelEl.textContent = `Zone ${zoneIndex + 1} — ${name}`;
        }

        // Clear existing timeout
        if (this.zoneTimeout) clearTimeout(this.zoneTimeout);

        // Fade out after 3 seconds
        this.zoneTimeout = setTimeout(() => {
            this.zoneIndicator.classList.remove('visible');
            this.zoneTimeout = null;
        }, 3000);
    }

    checkVitality(detail) {
        // Check if health is at critically low level (below 30%)
        const health = detail?.newHealth ?? detail?.health;
        const maxHealth = detail?.maxHealth;
        if (health !== undefined && maxHealth) {
            const ratio = health / maxHealth;
            this.setLowVitality(ratio < 0.3);
        }
    }

    setLowVitality(active) {
        if (active === this.lowVitalityActive) return;
        this.lowVitalityActive = active;
        if (active) {
            this.vitalityWarning.classList.add('active');
        } else {
            this.vitalityWarning.classList.remove('active');
        }
    }
}
