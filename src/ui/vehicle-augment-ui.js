// vehicle-augment-ui.js - Vehicle schematic + augment slot UI
// Replaces the equipment panel (I key) with vehicle-focused interface
// Left: Vehicle schematic with 4 component slots + augment sub-slots
// Right: Inventory grid (scavenged parts + augments)
// Bottom: Stats panel (vehicle speed, armor, damage, augment effects)

import { VEHICLE_SLOTS, PART_CATALOG } from '../systems/vehicle-builder.js';
import { AUGMENT_CATALOG, AUGMENT_TARGETS } from '../systems/augment-system.js';

const SLOT_LABELS = {
    [VEHICLE_SLOTS.CHASSIS]: 'Chassis',
    [VEHICLE_SLOTS.WHEELS]: 'Wheels',
    [VEHICLE_SLOTS.ENGINE]: 'Engine',
    [VEHICLE_SLOTS.WEAPON]: 'Weapon',
};

const SLOT_ICONS = {
    [VEHICLE_SLOTS.CHASSIS]: '\u25A1', // square
    [VEHICLE_SLOTS.WHEELS]: '\u25CB', // circle
    [VEHICLE_SLOTS.ENGINE]: '\u2699', // gear
    [VEHICLE_SLOTS.WEAPON]: '\u2694', // crossed swords
};

// Map vehicle slots to augment targets
const SLOT_TO_AUGMENT_TARGET = {
    [VEHICLE_SLOTS.CHASSIS]: AUGMENT_TARGETS.CHASSIS,
    [VEHICLE_SLOTS.ENGINE]: AUGMENT_TARGETS.ENGINE,
    [VEHICLE_SLOTS.WEAPON]: AUGMENT_TARGETS.WEAPON,
};

export class VehicleAugmentUI {
    constructor(vehicleBuilder, augmentSystem) {
        this.vehicleBuilder = vehicleBuilder;
        this.augmentSystem = augmentSystem;
        this.isOpen = false;
        this.panelElement = null;

        // Selection state
        this.selectedSlot = null;
        this.selectedAugment = null;

        this.init();
    }

    init() {
        this.createStyles();
        this.createPanel();
        this.setupEventListeners();
    }

    createStyles() {
        const style = document.createElement('style');
        style.id = 'vehicle-augment-ui-styles';
        style.textContent = `
            #vehicle-augment-panel {
                position: fixed;
                inset: 0;
                background: rgba(10, 10, 20, 0.95);
                z-index: 500;
                display: none;
                font-family: 'Segoe UI', system-ui, sans-serif;
                color: #f5f0e6;
            }

            #vehicle-augment-panel.visible {
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .vau-container {
                width: 100%;
                max-width: 850px;
                padding: 30px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-height: 90vh;
                overflow-y: auto;
            }

            .vau-title {
                font-size: 22px;
                font-weight: bold;
                color: #d4a574;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .vau-subtitle {
                font-size: 11px;
                color: rgba(255,255,255,0.4);
                text-align: center;
                margin-top: -10px;
            }

            .vau-body {
                display: flex;
                gap: 20px;
            }

            /* Left: Vehicle schematic */
            .vau-schematic {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .vau-slot {
                padding: 12px;
                background: rgba(0,0,0,0.3);
                border: 2px solid rgba(255,255,255,0.1);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s;
            }

            .vau-slot:hover {
                background: rgba(255,255,255,0.05);
                border-color: rgba(212,165,116,0.4);
            }

            .vau-slot.selected {
                border-color: rgba(212,165,116,0.8);
                background: rgba(212,165,116,0.1);
            }

            .vau-slot-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
            }

            .vau-slot-icon {
                font-size: 18px;
                width: 24px;
                text-align: center;
            }

            .vau-slot-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #888;
            }

            .vau-slot-part {
                font-size: 14px;
                font-weight: bold;
                color: #ccc;
            }

            .vau-slot-part.empty {
                font-style: italic;
                color: #555;
                font-weight: normal;
            }

            .vau-slot-part.has-part {
                color: #88cc88;
            }

            /* Augment sub-slots */
            .vau-augment-row {
                display: flex;
                gap: 6px;
                margin-top: 6px;
                padding-top: 6px;
                border-top: 1px solid rgba(255,255,255,0.05);
            }

            .vau-augment-slot {
                flex: 1;
                padding: 4px 8px;
                background: rgba(0,0,0,0.2);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 3px;
                font-size: 11px;
                color: #666;
                text-align: center;
                cursor: pointer;
                transition: all 0.1s;
            }

            .vau-augment-slot:hover {
                border-color: rgba(212,165,116,0.3);
            }

            .vau-augment-slot.filled {
                color: #ffaa44;
                border-color: rgba(255,170,68,0.3);
                background: rgba(255,170,68,0.08);
            }

            .vau-augment-slot.locked {
                color: #333;
                cursor: default;
            }

            /* Right: Inventory */
            .vau-inventory {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .vau-inv-section-title {
                font-size: 13px;
                font-weight: bold;
                color: #d4a574;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .vau-inv-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 6px;
            }

            .vau-inv-item {
                padding: 8px;
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.1s;
                font-size: 11px;
            }

            .vau-inv-item:hover {
                border-color: rgba(212,165,116,0.4);
                background: rgba(255,255,255,0.03);
            }

            .vau-inv-item.selected {
                border-color: rgba(212,165,116,0.8);
                background: rgba(212,165,116,0.1);
            }

            .vau-inv-item-name {
                font-weight: bold;
                color: #ccc;
            }

            .vau-inv-item-type {
                color: #888;
                font-size: 10px;
            }

            /* Bottom: Stats + combos */
            .vau-stats {
                display: flex;
                gap: 16px;
                padding: 12px;
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 6px;
            }

            .vau-stat-group {
                flex: 1;
            }

            .vau-stat-group-title {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #888;
                margin-bottom: 4px;
            }

            .vau-stat-line {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                padding: 1px 0;
            }

            .vau-stat-label { color: #aaa; }
            .vau-stat-value { color: #88cc88; }

            .vau-combos {
                padding: 8px 12px;
                background: rgba(255,170,68,0.05);
                border: 1px solid rgba(255,170,68,0.15);
                border-radius: 4px;
            }

            .vau-combo-line {
                font-size: 11px;
                color: #ffaa44;
                padding: 2px 0;
            }

            .vau-hint {
                font-size: 11px;
                color: rgba(255,255,255,0.3);
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'vehicle-augment-panel';
        panel.innerHTML = `
            <div class="vau-container">
                <div class="vau-title">Vehicle Workshop</div>
                <div class="vau-subtitle">Press I to close | Click slot to select | Click inventory to equip</div>
                <div class="vau-body">
                    <div class="vau-schematic" id="vau-schematic"></div>
                    <div class="vau-inventory" id="vau-inventory"></div>
                </div>
                <div class="vau-stats" id="vau-stats"></div>
                <div class="vau-combos" id="vau-combos" style="display:none"></div>
                <div class="vau-hint">Click a vehicle slot, then click an inventory part to equip it</div>
            </div>
        `;
        document.body.appendChild(panel);
        this.panelElement = panel;
    }

    setupEventListeners() {
        window.addEventListener('vehicle-part-changed', () => {
            if (this.isOpen) this.refresh();
        });
        window.addEventListener('augment-applied', () => {
            if (this.isOpen) this.refresh();
        });
        window.addEventListener('augment-removed', () => {
            if (this.isOpen) this.refresh();
        });
        window.addEventListener('augment-found', () => {
            if (this.isOpen) this.refresh();
        });
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.isOpen = true;
        this.selectedSlot = null;
        this.selectedAugment = null;
        this.panelElement.classList.add('visible');
        this.refresh();

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        window.dispatchEvent(new CustomEvent('game-paused'));
    }

    close() {
        this.isOpen = false;
        this.panelElement.classList.remove('visible');
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    refresh() {
        this.renderSchematic();
        this.renderInventory();
        this.renderStats();
        this.renderCombos();
    }

    renderSchematic() {
        const container = this.panelElement.querySelector('#vau-schematic');
        if (!container) return;

        container.innerHTML = '';

        for (const slot of Object.values(VEHICLE_SLOTS)) {
            const part = this.vehicleBuilder.getPart(slot);
            const isSelected = this.selectedSlot === slot;

            const slotDiv = document.createElement('div');
            slotDiv.className = `vau-slot${isSelected ? ' selected' : ''}`;

            // Header: icon + label + part name
            const partName = part ? part.name : 'Empty';
            const partClass = part ? 'has-part' : 'empty';

            slotDiv.innerHTML = `
                <div class="vau-slot-header">
                    <span class="vau-slot-icon">${SLOT_ICONS[slot]}</span>
                    <span class="vau-slot-label">${SLOT_LABELS[slot]}</span>
                </div>
                <div class="vau-slot-part ${partClass}">${partName}</div>
            `;

            // Augment sub-slots (only for slots that support augments)
            const augmentTarget = SLOT_TO_AUGMENT_TARGET[slot];
            if (augmentTarget && part) {
                const maxSlots = this.vehicleBuilder.getAugmentSlotCount(slot) + this.augmentSystem.bonusSlots;
                const applied = this.augmentSystem.getApplied(augmentTarget);

                if (maxSlots > 0) {
                    const augRow = document.createElement('div');
                    augRow.className = 'vau-augment-row';

                    for (let i = 0; i < Math.max(maxSlots, applied.length); i++) {
                        const augSlot = document.createElement('div');
                        if (i < maxSlots) {
                            if (i < applied.length) {
                                augSlot.className = 'vau-augment-slot filled';
                                augSlot.textContent = applied[i].name;
                                augSlot.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    this.augmentSystem.removeAugment(augmentTarget, i);
                                });
                            } else {
                                augSlot.className = 'vau-augment-slot';
                                augSlot.textContent = '+ Augment';
                                augSlot.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    this.selectedSlot = slot;
                                    this.refresh();
                                });
                            }
                        } else {
                            augSlot.className = 'vau-augment-slot locked';
                            augSlot.textContent = 'Locked';
                        }
                        augRow.appendChild(augSlot);
                    }

                    slotDiv.appendChild(augRow);
                }
            }

            slotDiv.addEventListener('click', () => {
                this.selectedSlot = slot;
                this.selectedAugment = null;
                this.refresh();
            });

            container.appendChild(slotDiv);
        }
    }

    renderInventory() {
        const container = this.panelElement.querySelector('#vau-inventory');
        if (!container) return;

        container.innerHTML = '';

        // Parts section
        const partsTitle = document.createElement('div');
        partsTitle.className = 'vau-inv-section-title';
        partsTitle.textContent = 'Available Parts';
        container.appendChild(partsTitle);

        const partsGrid = document.createElement('div');
        partsGrid.className = 'vau-inv-grid';

        // Show only owned parts that match the selected slot
        const ownedParts = this.vehicleBuilder.getPartInventory();
        for (const partId of ownedParts) {
            const part = PART_CATALOG[partId];
            if (!part) continue;
            if (this.selectedSlot && part.slot !== this.selectedSlot) continue;

            // Don't show parts already equipped
            const equippedPart = this.vehicleBuilder.getPart(part.slot);
            if (equippedPart && equippedPart.id === partId) continue;

            const item = document.createElement('div');
            item.className = 'vau-inv-item';
            item.innerHTML = `
                <div class="vau-inv-item-name">${part.name}</div>
                <div class="vau-inv-item-type">${SLOT_LABELS[part.slot]} | Tier ${part.tier}</div>
            `;
            item.addEventListener('click', () => {
                this.vehicleBuilder.attachPart(part.slot, partId);
            });
            partsGrid.appendChild(item);
        }

        if (partsGrid.children.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#555; font-style:italic; font-size:12px; grid-column:1/-1;';
            empty.textContent = this.selectedSlot ? `No parts for ${SLOT_LABELS[this.selectedSlot]}` : 'No available parts';
            partsGrid.appendChild(empty);
        }

        container.appendChild(partsGrid);

        // Augments section
        const augInv = this.augmentSystem.getInventory();
        if (augInv.length > 0) {
            const augTitle = document.createElement('div');
            augTitle.className = 'vau-inv-section-title';
            augTitle.style.marginTop = '12px';
            augTitle.textContent = 'Augments';
            container.appendChild(augTitle);

            const augGrid = document.createElement('div');
            augGrid.className = 'vau-inv-grid';

            for (const aug of augInv) {
                const item = document.createElement('div');
                item.className = 'vau-inv-item';
                item.innerHTML = `
                    <div class="vau-inv-item-name" style="color:#ffaa44">${aug.name}</div>
                    <div class="vau-inv-item-type">${aug.target} | ${aug.description}</div>
                `;
                item.addEventListener('click', () => {
                    const maxSlots = this.vehicleBuilder.getAugmentSlotCount(aug.target);
                    this.augmentSystem.applyAugment(aug.target, aug.id, maxSlots);
                });
                augGrid.appendChild(item);
            }

            container.appendChild(augGrid);
        }
    }

    renderStats() {
        const container = this.panelElement.querySelector('#vau-stats');
        if (!container) return;

        const stats = this.vehicleBuilder.getStats();
        const weaponFx = this.augmentSystem.getWeaponEffects();
        const defenseFx = this.augmentSystem.getDefenseEffects();
        const engineFx = this.augmentSystem.getEngineEffects();

        container.innerHTML = `
            <div class="vau-stat-group">
                <div class="vau-stat-group-title">Movement</div>
                <div class="vau-stat-line"><span class="vau-stat-label">Speed</span><span class="vau-stat-value">${stats.effectiveSpeed?.toFixed(1) || '0'}</span></div>
                <div class="vau-stat-line"><span class="vau-stat-label">Traction</span><span class="vau-stat-value">${stats.traction?.toFixed(1) || '0'}</span></div>
                <div class="vau-stat-line"><span class="vau-stat-label">Essence Drain</span><span class="vau-stat-value">${(stats.essenceDrain * (engineFx.essenceDrainMult || 1)).toFixed(2)}/s</span></div>
            </div>
            <div class="vau-stat-group">
                <div class="vau-stat-group-title">Combat</div>
                <div class="vau-stat-line"><span class="vau-stat-label">Damage</span><span class="vau-stat-value">${stats.damage || '0'}</span></div>
                <div class="vau-stat-line"><span class="vau-stat-label">Fire Rate</span><span class="vau-stat-value">${stats.fireRate?.toFixed(1) || '0'}/s</span></div>
                <div class="vau-stat-line"><span class="vau-stat-label">Armor</span><span class="vau-stat-value">${stats.armorCapacity || '0'}</span></div>
            </div>
            <div class="vau-stat-group">
                <div class="vau-stat-group-title">Augments</div>
                ${weaponFx.splitCount ? `<div class="vau-stat-line"><span class="vau-stat-label">Split</span><span class="vau-stat-value">x${weaponFx.splitCount}</span></div>` : ''}
                ${weaponFx.burnDamage ? `<div class="vau-stat-line"><span class="vau-stat-label">Burn</span><span class="vau-stat-value">${weaponFx.burnDamage} DPS</span></div>` : ''}
                ${weaponFx.pierceCount ? `<div class="vau-stat-line"><span class="vau-stat-label">Pierce</span><span class="vau-stat-value">+${weaponFx.pierceCount}</span></div>` : ''}
                ${weaponFx.homingStrength ? `<div class="vau-stat-line"><span class="vau-stat-label">Homing</span><span class="vau-stat-value">${(weaponFx.homingStrength * 100).toFixed(0)}%</span></div>` : ''}
                ${defenseFx.thornsDamage ? `<div class="vau-stat-line"><span class="vau-stat-label">Thorns</span><span class="vau-stat-value">${defenseFx.thornsDamage} dmg</span></div>` : ''}
                ${defenseFx.reflectChance ? `<div class="vau-stat-line"><span class="vau-stat-label">Reflect</span><span class="vau-stat-value">${(defenseFx.reflectChance * 100).toFixed(0)}%</span></div>` : ''}
                ${engineFx.nitroSpeedMult ? `<div class="vau-stat-line"><span class="vau-stat-label">Nitro</span><span class="vau-stat-value">x${engineFx.nitroSpeedMult}</span></div>` : ''}
                ${engineFx.ramDamage ? `<div class="vau-stat-line"><span class="vau-stat-label">Ram</span><span class="vau-stat-value">${engineFx.ramDamage} dmg</span></div>` : ''}
                ${!Object.keys(weaponFx).length && !Object.keys(defenseFx).length && !Object.keys(engineFx).length ? '<div style="color:#555; font-size:11px">No augments applied</div>' : ''}
            </div>
        `;
    }

    renderCombos() {
        const container = this.panelElement.querySelector('#vau-combos');
        if (!container) return;

        const combos = this.augmentSystem.getActiveCombos();
        if (combos.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = combos.map(c =>
            `<div class="vau-combo-line">${c.name}: ${c.bonus.description}</div>`
        ).join('');
    }
}
