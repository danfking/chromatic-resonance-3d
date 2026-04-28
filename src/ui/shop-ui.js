// shop-ui.js - Between-zone shop for the roguelike alpha
// Player spends gold on core upgrades, vehicle parts, augments
// Appears when RunManager transitions to SHOP state

import { PART_CATALOG } from '../systems/vehicle-builder.js';
import { AUGMENT_CATALOG } from '../systems/augment-system.js';

const SHOP_ITEMS = [
    // Core upgrades
    { id: 'vitality-up', name: 'Vitality Boost', description: '+5 max vitality particles', cost: 30, type: 'core', core: 'vitality', bonus: { capacity: 5 } },
    { id: 'vitality-regen', name: 'Vitality Regen', description: '+0.3 vitality regen/sec', cost: 25, type: 'core', core: 'vitality', bonus: { regenRate: 0.3 } },
    { id: 'shell-up', name: 'Shell Reinforcement', description: '+3 max shell particles', cost: 25, type: 'core', core: 'shell', bonus: { capacity: 3 } },
    { id: 'spark-up', name: 'Spark Amplifier', description: '+4 max spark particles', cost: 35, type: 'core', core: 'spark', bonus: { capacity: 4 } },
    { id: 'essence-up', name: 'Essence Reservoir', description: '+4 max essence particles', cost: 30, type: 'core', core: 'essence', bonus: { capacity: 4 } },
    // Healing
    { id: 'heal-full', name: 'Full Restore', description: 'Restore all vitality', cost: 20, type: 'heal', healPercent: 1.0 },
    { id: 'heal-half', name: 'Quick Patch', description: 'Restore 50% vitality', cost: 10, type: 'heal', healPercent: 0.5 },
];

export class ShopUI {
    constructor(runManager) {
        this.runManager = runManager;
        this.gold = 0;
        this.isOpen = false;
        this.purchasedThisVisit = new Set();
        this.vehicleBuilder = null;
        this.augmentSystem = null;

        this.createStyles();
        this.createPanel();
        this.setupEventListeners();
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #shop-overlay {
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: linear-gradient(135deg, rgba(20, 18, 35, 0.97), rgba(30, 25, 45, 0.97));
                z-index: 500;
                display: none;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                font-family: 'Georgia', serif;
                color: #f5f0e6;
            }

            #shop-overlay.visible {
                display: flex;
            }

            .shop-header {
                text-align: center;
                margin-bottom: 30px;
            }

            .shop-title {
                font-size: 36px;
                color: #d4a574;
                letter-spacing: 4px;
                text-shadow: 0 0 20px rgba(212, 165, 116, 0.3);
                margin-bottom: 8px;
            }

            .shop-subtitle {
                font-size: 16px;
                color: #8888aa;
                letter-spacing: 2px;
            }

            .shop-gold {
                font-size: 26px;
                color: #e8d06a;
                margin: 12px 0 20px;
                text-shadow: 0 0 10px rgba(232, 208, 106, 0.4);
                background: rgba(232, 208, 106, 0.08);
                padding: 6px 20px;
                border-radius: 6px;
                border: 1px solid rgba(232, 208, 106, 0.15);
            }

            .shop-gold .gold-icon {
                font-size: 18px;
                opacity: 0.8;
                margin-right: 6px;
            }

            .shop-items {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
                max-width: 700px;
                width: 90%;
                margin-bottom: 30px;
            }

            .shop-item {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(212, 165, 116, 0.2);
                border-radius: 8px;
                padding: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: center;
            }

            .shop-item:hover:not(.sold):not(.too-expensive) {
                background: rgba(212, 165, 116, 0.1);
                border-color: rgba(212, 165, 116, 0.5);
                transform: translateY(-2px);
            }

            .shop-item.sold {
                opacity: 0.4;
                cursor: default;
                border-color: rgba(100, 100, 100, 0.2);
            }

            .shop-item.too-expensive {
                opacity: 0.6;
                cursor: default;
            }

            .shop-item-name {
                font-size: 16px;
                color: #d4a574;
                margin-bottom: 6px;
                font-weight: bold;
            }

            .shop-item-desc {
                font-size: 13px;
                color: #aaaacc;
                margin-bottom: 10px;
                line-height: 1.4;
            }

            .shop-item-cost {
                font-size: 15px;
                color: #e8d06a;
            }

            .shop-item-cost .gold-icon {
                font-size: 12px;
                opacity: 0.7;
                margin-right: 3px;
            }

            .shop-item.sold .shop-item-cost {
                color: #66aa66;
            }

            .shop-continue {
                padding: 14px 50px;
                font-size: 18px;
                font-family: 'Georgia', serif;
                background: linear-gradient(to bottom, #d4a574, #b8895e);
                border: 2px solid #e8c494;
                border-radius: 6px;
                color: #1a1a2e;
                cursor: pointer;
                font-weight: bold;
                letter-spacing: 2px;
                transition: all 0.2s ease;
            }

            .shop-continue:hover {
                background: linear-gradient(to bottom, #e4b584, #c8996e);
                transform: translateY(-1px);
            }

            .shop-zone-info {
                font-size: 14px;
                color: #666688;
                margin-top: 12px;
                letter-spacing: 1px;
            }
        `;
        document.head.appendChild(style);
    }

    createPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'shop-overlay';

        overlay.innerHTML = `
            <div class="shop-header">
                <div class="shop-title">SCAVENGER'S CACHE</div>
                <div class="shop-subtitle">REST &bull; RESUPPLY &bull; REGROUP</div>
            </div>
            <div class="shop-gold"><span class="gold-icon">G</span><span id="shop-gold-value">0</span></div>
            <div class="shop-items" id="shop-items"></div>
            <button class="shop-continue" id="shop-continue-btn">CONTINUE</button>
            <div class="shop-zone-info" id="shop-zone-info"></div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.goldDisplay = document.getElementById('shop-gold-value');
        this.itemsContainer = document.getElementById('shop-items');
        this.continueBtn = document.getElementById('shop-continue-btn');
        this.zoneInfo = document.getElementById('shop-zone-info');

        this.continueBtn.addEventListener('click', () => {
            this.close();
            window.dispatchEvent(new CustomEvent('shop-continue'));
        });
    }

    setupEventListeners() {
        // Open shop when RunManager transitions to SHOP
        window.addEventListener('run-state-changed', (e) => {
            const { to, zoneIndex } = e.detail;
            if (to === 'SHOP') {
                this.open(zoneIndex);
            }
            if (to === 'MENU' || to === 'DEAD' || to === 'VICTORY' || to === 'ZONE_INTRO' || to === 'PLAYING') {
                this.close();
            }
        });

        // Track gold
        window.addEventListener('gold-collected', (e) => {
            this.gold += (e.detail?.amount || 0);
        });

        window.addEventListener('gold-spent', (e) => {
            this.gold = Math.max(0, this.gold - (e.detail?.amount || 0));
        });

        // Reset on new run
        window.addEventListener('run-reset', () => {
            this.gold = 0;
            this.purchasedThisVisit.clear();
        });
    }

    open(completedZoneIndex) {
        this.isOpen = true;
        this.purchasedThisVisit.clear();

        // Update gold display
        this.goldDisplay.textContent = this.gold;

        // Show next zone info
        const nextZone = completedZoneIndex + 1;
        this.zoneInfo.textContent = `Preparing for Zone ${nextZone + 1}...`;

        // Populate shop items
        this.renderItems();

        this.overlay.classList.add('visible');

        // Pause game
        window.dispatchEvent(new CustomEvent('game-paused'));

        console.log(`[Shop] Opened after zone ${completedZoneIndex}. Gold: ${this.gold}`);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.overlay.classList.remove('visible');

        // Resume game
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    /**
     * Generate dynamic shop items (vehicle parts + augments) alongside static items
     */
    _generateDynamicItems() {
        const items = [...SHOP_ITEMS];

        // Vehicle parts: 2-3 parts one tier above current
        if (this.vehicleBuilder) {
            const currentTier = this._getCurrentVehicleTier();
            const availableParts = Object.entries(PART_CATALOG)
                .filter(([id, part]) => part.tier === currentTier + 1)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);
            for (const [partId, part] of availableParts) {
                items.push({
                    id: `part-${partId}`,
                    name: part.name || partId.replace(/([A-Z])/g, ' $1').trim(),
                    type: 'vehicle-part',
                    partId: partId,
                    cost: (part.tier + 1) * 40,
                    description: `${part.slot} - Tier ${part.tier}`,
                });
            }
        }

        // Augments: 2-3 random augments
        const augmentIds = Object.keys(AUGMENT_CATALOG);
        const shuffled = augmentIds.sort(() => Math.random() - 0.5).slice(0, 3);
        for (const augId of shuffled) {
            const aug = AUGMENT_CATALOG[augId];
            items.push({
                id: `aug-${augId}`,
                name: aug.name || augId,
                type: 'augment',
                augmentId: augId,
                cost: aug.target === 'weapon' ? 50 : 30,
                description: aug.description || aug.target,
            });
        }

        return items;
    }

    _getCurrentVehicleTier() {
        if (!this.vehicleBuilder) return -1;
        let maxTier = -1;
        const parts = this.vehicleBuilder.getAllParts();
        for (const slot of Object.keys(parts)) {
            const part = parts[slot];
            if (part && part.tier > maxTier) maxTier = part.tier;
        }
        return maxTier;
    }

    renderItems() {
        this.itemsContainer.innerHTML = '';
        const allItems = this._generateDynamicItems();

        for (const item of allItems) {
            const el = document.createElement('div');
            el.className = 'shop-item';

            const sold = this.purchasedThisVisit.has(item.id);
            const tooExpensive = this.gold < item.cost;

            if (sold) el.classList.add('sold');
            else if (tooExpensive) el.classList.add('too-expensive');

            el.innerHTML = `
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.description}</div>
                <div class="shop-item-cost">
                    ${sold ? 'SOLD' : `<span class="gold-icon">G</span>${item.cost}`}
                </div>
            `;

            if (!sold && !tooExpensive) {
                el.addEventListener('click', () => this.purchaseItem(item));
            }

            this.itemsContainer.appendChild(el);
        }

        // Vehicle stats display
        if (this.vehicleBuilder && this.vehicleBuilder.isFunctional()) {
            const stats = this.vehicleBuilder.getStats();
            const statsEl = document.createElement('div');
            statsEl.style.cssText = 'margin-top: 12px; font-size: 13px; color: #88aacc; text-align: center;';
            statsEl.textContent = `Vehicle: Speed ${stats.effectiveSpeed?.toFixed(1) || 0} | Armor ${stats.armorCapacity || 0} | DMG ${stats.damage || 0}`;
            this.itemsContainer.appendChild(statsEl);
        }
    }

    purchaseItem(item) {
        if (this.gold < item.cost) return;
        if (this.purchasedThisVisit.has(item.id)) return;

        // Spend gold
        this.gold -= item.cost;
        window.dispatchEvent(new CustomEvent('gold-spent', {
            detail: { amount: item.cost }
        }));

        this.purchasedThisVisit.add(item.id);

        // Apply item effect
        if (item.type === 'core') {
            window.dispatchEvent(new CustomEvent('shop-core-upgrade', {
                detail: { core: item.core, bonus: item.bonus }
            }));
        } else if (item.type === 'heal') {
            window.dispatchEvent(new CustomEvent('player-heal', {
                detail: { amount: item.healPercent * 100, percent: item.healPercent }
            }));
        } else if (item.type === 'vehicle-part') {
            window.dispatchEvent(new CustomEvent('vehicle-part-found', {
                detail: { partId: item.partId }
            }));
        } else if (item.type === 'augment') {
            this.augmentSystem?.addToInventory(item.augmentId);
        }

        // Update display
        this.goldDisplay.textContent = this.gold;
        this.renderItems();

        console.log(`[Shop] Purchased ${item.name} for ${item.cost}G. Remaining: ${this.gold}G`);
    }
}
