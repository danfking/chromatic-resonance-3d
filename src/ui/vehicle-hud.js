// vehicle-hud.js - Vehicle-specific HUD for vehicle-combat mode
// Shows vehicle HP, speedometer, weapon status, controls hint, and enter/exit prompt

import { DAMAGE_STATES } from '../vehicle/vehicle-damage.js';

const DAMAGE_STATE_COLORS = {
    PRISTINE:  '#44aa44',
    SCRATCHED: '#88cc44',
    DENTED:    '#cccc44',
    DAMAGED:   '#cc8844',
    CRITICAL:  '#cc4444',
    BURNING:   '#ff2222',
    DESTROYED: '#444444',
};

const CONTROLS_FADE_TIME = 10; // seconds before controls hint fades

export class VehicleHUD {
    constructor(vehicleCombat) {
        this.vc = vehicleCombat;
        this.container = null;
        this._controlsTimer = CONTROLS_FADE_TIME;
        this._pulsePhase = 0;
        this._visible = false;
        this._enterPromptVisible = false;

        this._createStyles();
        this._createElements();
    }

    _createStyles() {
        const style = document.createElement('style');
        style.id = 'vehicle-hud-styles';
        style.textContent = `
            #vehicle-hud {
                position: fixed;
                inset: 0;
                z-index: 100;
                pointer-events: none;
                font-family: 'Segoe UI', system-ui, sans-serif;
                display: none;
            }

            #vehicle-hud.active { display: block; }

            /* Vehicle HP Bar — top center */
            .vhud-hp {
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(26, 26, 46, 0.85);
                padding: 8px 16px;
                border-radius: 8px;
                border: 1px solid rgba(212, 165, 116, 0.3);
            }

            .vhud-hp-bar-bg {
                width: 250px;
                height: 18px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                overflow: hidden;
            }

            .vhud-hp-bar-fill {
                width: 100%;
                height: 100%;
                background: #44aa44;
                transition: width 0.3s ease, background-color 0.3s ease;
            }

            .vhud-hp-text {
                color: #f5f0e6;
                font-size: 13px;
                font-weight: bold;
                min-width: 90px;
                text-align: right;
            }

            .vhud-hp-state {
                color: #d4a574;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                min-width: 70px;
            }

            /* Speedometer — bottom left */
            .vhud-speed {
                position: absolute;
                bottom: 20px;
                left: 20px;
                background: rgba(26, 26, 46, 0.85);
                padding: 10px 16px;
                border-radius: 8px;
                border: 1px solid rgba(212, 165, 116, 0.3);
                text-align: center;
            }

            .vhud-speed-value {
                color: #f5f0e6;
                font-size: 28px;
                font-weight: bold;
                line-height: 1;
            }

            .vhud-speed-value.fast { color: #ff8844; }
            .vhud-speed-value.very-fast { color: #ff4444; }

            .vhud-speed-label {
                color: #d4a574;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            /* Weapon Status — bottom right */
            .vhud-weapons {
                position: absolute;
                bottom: 20px;
                right: 20px;
                display: flex;
                gap: 8px;
            }

            .vhud-weapon-slot {
                width: 56px;
                height: 56px;
                background: rgba(26, 26, 46, 0.85);
                border-radius: 8px;
                border: 1px solid rgba(212, 165, 116, 0.3);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
            }

            .vhud-weapon-label {
                color: #d4a574;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .vhud-weapon-status {
                color: #f5f0e6;
                font-size: 10px;
                font-weight: bold;
                margin-top: 2px;
            }

            .vhud-weapon-status.has-target { color: #ff6644; }
            .vhud-weapon-status.no-target { color: #888; }
            .vhud-weapon-status.ready { color: #44cc44; }

            .vhud-weapon-cooldown {
                position: absolute;
                inset: 0;
                border-radius: 8px;
                pointer-events: none;
            }

            /* Controls Hint — bottom center */
            .vhud-controls {
                position: absolute;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(26, 26, 46, 0.7);
                padding: 6px 14px;
                border-radius: 6px;
                color: #d4a574;
                font-size: 12px;
                transition: opacity 1s ease;
                white-space: nowrap;
            }

            /* Enter/Exit Prompt — center screen */
            .vhud-enter-prompt {
                position: absolute;
                top: 60%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(26, 26, 46, 0.85);
                padding: 12px 24px;
                border-radius: 8px;
                border: 1px solid rgba(212, 165, 116, 0.4);
                color: #f5f0e6;
                font-size: 16px;
                font-weight: bold;
                display: none;
            }

            .vhud-enter-prompt .key {
                display: inline-block;
                background: rgba(212, 165, 116, 0.3);
                padding: 2px 8px;
                border-radius: 4px;
                margin: 0 4px;
                border: 1px solid rgba(212, 165, 116, 0.5);
            }
        `;
        document.head.appendChild(style);
    }

    _createElements() {
        const container = document.createElement('div');
        container.id = 'vehicle-hud';

        container.innerHTML = `
            <div class="vhud-hp">
                <div class="vhud-hp-bar-bg">
                    <div class="vhud-hp-bar-fill"></div>
                </div>
                <span class="vhud-hp-text">1000 / 1000</span>
                <span class="vhud-hp-state">PRISTINE</span>
            </div>

            <div class="vhud-speed">
                <div class="vhud-speed-value">0</div>
                <div class="vhud-speed-label">m/s</div>
            </div>

            <div class="vhud-weapons">
                <div class="vhud-weapon-slot" data-weapon="turret">
                    <div class="vhud-weapon-cooldown"></div>
                    <span class="vhud-weapon-label">Turret</span>
                    <span class="vhud-weapon-status no-target">NO TARGET</span>
                </div>
                <div class="vhud-weapon-slot" data-weapon="spell">
                    <div class="vhud-weapon-cooldown"></div>
                    <span class="vhud-weapon-label">Spell</span>
                    <span class="vhud-weapon-status ready">LMB</span>
                </div>
            </div>

            <div class="vhud-controls">WASD: Drive &nbsp;|&nbsp; Mouse: Look &nbsp;|&nbsp; LMB: Spell &nbsp;|&nbsp; E: Exit</div>

            <div class="vhud-enter-prompt">Press <span class="key">E</span> to enter vehicle</div>
        `;

        document.body.appendChild(container);
        this.container = container;

        // Cache element refs
        this._hpFill = container.querySelector('.vhud-hp-bar-fill');
        this._hpText = container.querySelector('.vhud-hp-text');
        this._hpState = container.querySelector('.vhud-hp-state');
        this._speedValue = container.querySelector('.vhud-speed-value');
        this._turretSlot = container.querySelector('[data-weapon="turret"]');
        this._turretStatus = this._turretSlot.querySelector('.vhud-weapon-status');
        this._turretCooldown = this._turretSlot.querySelector('.vhud-weapon-cooldown');
        this._spellSlot = container.querySelector('[data-weapon="spell"]');
        this._spellStatus = this._spellSlot.querySelector('.vhud-weapon-status');
        this._spellCooldown = this._spellSlot.querySelector('.vhud-weapon-cooldown');
        this._controls = container.querySelector('.vhud-controls');
        this._enterPrompt = container.querySelector('.vhud-enter-prompt');
    }

    /**
     * Called by VehicleDriverController.onStateChanged
     */
    onStateChanged(newState) {
        const playerHealth = document.getElementById('player-health');
        const wandHud = document.getElementById('wand-hud');

        if (newState === 'DRIVING') {
            this._show();
            this._controlsTimer = CONTROLS_FADE_TIME;
            this._controls.style.opacity = '1';
            if (playerHealth) playerHealth.style.display = 'none';
            if (wandHud) wandHud.style.display = 'none';
            this._enterPrompt.style.display = 'none';
        } else if (newState === 'ON_FOOT') {
            this._hide();
            if (playerHealth) playerHealth.style.display = '';
            if (wandHud) wandHud.style.display = '';
        } else {
            // ENTERING, EXITING, DESTROYED — hide all HUDs briefly
            this._hide();
            if (playerHealth) playerHealth.style.display = 'none';
            if (wandHud) wandHud.style.display = 'none';
            this._enterPrompt.style.display = 'none';
        }
    }

    _show() {
        this._visible = true;
        this.container.classList.add('active');
    }

    _hide() {
        this._visible = false;
        this.container.classList.remove('active');
    }

    /**
     * Update HUD every frame
     */
    update(delta) {
        // Update enter prompt visibility (when on foot near vehicle)
        this._updateEnterPrompt();

        if (!this._visible) return;

        this._updateHP();
        this._updateSpeed();
        this._updateWeapons(delta);
        this._updateControlsFade(delta);
    }

    _updateHP() {
        const damage = this.vc.damage;
        if (!damage) return;

        const hp = damage.currentHP;
        const maxHP = damage.maxHP;
        const pct = hp / maxHP;
        const state = damage.state;

        // Bar width
        this._hpFill.style.width = `${Math.max(0, pct * 100)}%`;

        // Bar color from damage state
        const color = DAMAGE_STATE_COLORS[state] || '#44aa44';
        this._hpFill.style.backgroundColor = color;

        // Pulse for critical/burning
        if (state === 'CRITICAL' || state === 'BURNING') {
            this._pulsePhase += 0.15;
            const pulse = 0.6 + 0.4 * Math.sin(this._pulsePhase);
            this._hpFill.style.opacity = pulse;
        } else {
            this._pulsePhase = 0;
            this._hpFill.style.opacity = 1;
        }

        // Text
        this._hpText.textContent = `${Math.round(hp)} / ${maxHP}`;
        this._hpState.textContent = state;
        this._hpState.style.color = color;
    }

    _updateSpeed() {
        const physics = this.vc.vehicleController?.physics;
        if (!physics) return;

        const speed = Math.abs(physics.speed);
        const display = speed.toFixed(1);
        this._speedValue.textContent = display;

        // Color based on speed
        this._speedValue.className = 'vhud-speed-value';
        if (speed > 15) {
            this._speedValue.classList.add('very-fast');
        } else if (speed > 8) {
            this._speedValue.classList.add('fast');
        }
    }

    _updateWeapons(delta) {
        const weapons = this.vc.weapons;
        if (!weapons) return;

        // Turret
        const turret = weapons.turrets[0];
        if (turret) {
            const hasTarget = turret.targetEnemy !== null;
            const cooldownPct = turret.fireCooldown > 0
                ? turret.fireCooldown / (1.0 / 3) // TURRET_FIRE_RATE = 3
                : 0;

            this._turretStatus.textContent = hasTarget ? 'TARGET' : 'NO TARGET';
            this._turretStatus.className = 'vhud-weapon-status ' + (hasTarget ? 'has-target' : 'no-target');

            // Cooldown arc via conic-gradient
            if (cooldownPct > 0.01) {
                const deg = Math.round(cooldownPct * 360);
                this._turretCooldown.style.background =
                    `conic-gradient(rgba(255,100,50,0.3) ${deg}deg, transparent ${deg}deg)`;
            } else {
                this._turretCooldown.style.background = 'none';
            }
        }

        // Spell launcher
        const spell = weapons.spellLaunchers[0];
        if (spell) {
            const ready = spell.fireCooldown <= 0;
            this._spellStatus.textContent = ready ? 'LMB' : 'WAIT';
            this._spellStatus.className = 'vhud-weapon-status ' + (ready ? 'ready' : 'no-target');

            const cooldownPct = spell.fireCooldown > 0 ? spell.fireCooldown / 2.0 : 0;
            if (cooldownPct > 0.01) {
                const deg = Math.round(cooldownPct * 360);
                this._spellCooldown.style.background =
                    `conic-gradient(rgba(100,200,255,0.3) ${deg}deg, transparent ${deg}deg)`;
            } else {
                this._spellCooldown.style.background = 'none';
            }
        }
    }

    _updateControlsFade(delta) {
        if (this._controlsTimer > 0) {
            this._controlsTimer -= delta;
            if (this._controlsTimer <= 0) {
                this._controls.style.opacity = '0';
            } else if (this._controlsTimer < 2) {
                // Fade over last 2 seconds
                this._controls.style.opacity = (this._controlsTimer / 2).toFixed(2);
            }
        }
    }

    _updateEnterPrompt() {
        const driver = this.vc.driver;
        if (!driver || driver.state !== 'ON_FOOT') {
            if (this._enterPromptVisible) {
                this._enterPrompt.style.display = 'none';
                this._enterPromptVisible = false;
            }
            return;
        }

        // Check proximity
        const blob = this.vc.blobController;
        const vehicleMesh = this.vc.vehicleMesh;
        if (!blob || !vehicleMesh) return;

        const playerPos = blob.getPosition();
        const vehPos = vehicleMesh.position;
        const dx = playerPos.x - vehPos.x;
        const dz = playerPos.z - vehPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const shouldShow = dist <= 4.0;
        if (shouldShow !== this._enterPromptVisible) {
            this._enterPromptVisible = shouldShow;
            this._enterPrompt.style.display = shouldShow ? 'block' : 'none';
        }
    }

    dispose() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        const style = document.getElementById('vehicle-hud-styles');
        if (style) style.remove();
    }
}
