# Core-Based Particle Generation System - Implementation Plan

## Status: IN PROGRESS (Task 1 of 8)

## Overview

Replace the automatic level-up stat system with a **Core System** where each resource (health, armor, elemental colors) is represented by a large central particle that generates smaller particles around it. Core size determines regeneration rate and maximum capacity. Level-ups become meaningful player choices: add new cores or upgrade existing ones.

---

## Task List

- [ ] **Task 1**: Create `src/systems/core-system.js` with ResourceCore class
- [ ] **Task 2**: Create `src/systems/core-manager.js` for managing all cores
- [ ] **Task 3**: Move wand blob to top position with bob/sway in `blob-player-controller.js`
- [ ] **Task 4**: Add core rendering to `particle-life-creature.js`
- [ ] **Task 5**: Create `src/ui/levelup-ui.js` for level-up choices
- [ ] **Task 6**: Integrate `color-inventory.js` with core system
- [ ] **Task 7**: Update `progression.js` to remove auto-stats
- [ ] **Task 8**: Wire all systems together in `main.js`

---

## Key Changes

### 1. Wand Blob Repositioning
- Move from side offset `(0.4, 0, 0)` to top of body `(0, 0.6, 0)` - like a head
- Add natural bob/sway animation
- Slight lean toward movement direction

### 2. Core System
Each resource has a "core" - a large solid particle that:
- Generates small particles around it over time
- Size determines regen rate AND max particle capacity
- Lives inside relevant blob (health/armor in body, elements in wand)

**Core Tiers:**
| Tier | Radius | Regen | Max | Particles |
|------|--------|-------|-----|-----------|
| 1 | 0.08 | 1.0x | 100 | 15 |
| 2 | 0.11 | 1.3x | 125 | 22 |
| 3 | 0.14 | 1.6x | 150 | 30 |
| 4 | 0.17 | 2.0x | 175 | 40 |
| 5 | 0.20 | 2.5x | 200 | 50 |

### 3. Level-Up Choices
On level-up, player chooses:
- **Upgrade existing core** - increases tier (size, regen, max)
- **Add new core** - unlocks new element/resource at tier 1

### 4. Starting State
- **Body Blob**: Vitality Core (Tier 1) - health only
- **Wand Blob**: Ivory Core (Tier 1) - pure mana only

### 5. Progression Paths
- **Specialist**: Few cores, high tiers - powerful but limited
- **Generalist**: Many cores, low tiers - versatile combos

---

## Files to Create

### `src/systems/core-system.js`
```javascript
// Core types
export const CORE_TYPES = {
    VITALITY: 'vitality',    // Body: Health (red)
    ARMOR: 'armor',          // Body: Shield (grey)
    IVORY: 'ivory',          // Wand: Pure mana (white)
    CRIMSON: 'crimson',      // Wand: Fire/burn
    AZURE: 'azure',          // Wand: Water/slow
    VERDANT: 'verdant',      // Wand: Earth/lifesteal
    GOLDEN: 'golden',        // Wand: Light/pierce
    VIOLET: 'violet'         // Wand: Shadow/homing
};

// Core tier definitions
export const CORE_TIERS = {
    1: { radius: 0.08, regenMult: 1.0, maxMult: 1.0, maxParticles: 15 },
    2: { radius: 0.11, regenMult: 1.3, maxMult: 1.25, maxParticles: 22 },
    3: { radius: 0.14, regenMult: 1.6, maxMult: 1.5, maxParticles: 30 },
    4: { radius: 0.17, regenMult: 2.0, maxMult: 1.75, maxParticles: 40 },
    5: { radius: 0.20, regenMult: 2.5, maxMult: 2.0, maxParticles: 50 }
};

// ResourceCore class with:
// - type, tier, current, baseMax, baseRegen
// - position (relative to blob center)
// - generatedParticles array
// - getRadius(), getRegenRate(), getMax(), getMaxParticles()
// - update(delta) - regen + spawn particles
// - upgrade() - increase tier (max 5)
// - consume(amount), extract(amount)
```

### `src/systems/core-manager.js`
```javascript
// CoreManager class:
// - bodyCores[] - vitality, armor
// - wandCores[] - ivory, crimson, azure, verdant, golden, violet
// - addCore(type) - creates new core at tier 1
// - upgradeCore(type) - increases existing core tier
// - getCore(type) - returns core or null
// - getCoresByLocation(location) - 'body' or 'wand'
// - getAllCores() - returns all cores
// - update(delta) - updates all cores
// - getUpgradeOptions() - returns cores that can be upgraded
// - getUnlockOptions() - returns core types not yet unlocked
```

### `src/ui/levelup-ui.js`
```javascript
// LevelUpUI class (following equipment-ui.js pattern):
// - Full-screen modal on level-up event
// - Shows upgrade options for existing cores (with tier preview)
// - Shows unlock options for new cores (with description)
// - Pauses game while open (dispatch game-paused)
// - On selection: apply choice, dispatch 'levelup-choice-made', close modal
// - Resume game (dispatch game-resumed)
```

---

## Files to Modify

### `src/creatures/particle-life-creature.js`
**Add core rendering:**
```javascript
// In constructor:
this.cores = [];           // Array of ResourceCore references
this.coresMesh = null;     // THREE.Points for core spheres
this.corePositions = [];   // Cached positions for rendering

// New methods:
addCore(core)              // Add core, reposition all cores
removeCore(coreType)       // Remove core by type
repositionCores()          // Fibonacci sphere distribution inside blob
rebuildCoreMeshes()        // Create/update THREE.Points geometry
updateCores(delta)         // Update positions, sizes, pulse animation

// In update(delta):
this.updateCores(delta);
```

### `src/character/blob-player-controller.js`
**Move wand to top:**
```javascript
// Change line 112:
// FROM: this.wandOffset = new THREE.Vector3(0.4, 0, 0);
// TO:   this.wandOffset = new THREE.Vector3(0, 0.6, 0);

// Add animation state (around line 114):
this.wandBobTime = 0;
this.wandSwayTime = 0;

// Modify updateWandPosition(delta) - around line 377:
updateWandPosition(delta) {
    if (!this.wandBlob) return;

    // Update animation timers
    this.wandBobTime += delta;
    this.wandSwayTime += delta;

    // Base position: on top of body
    const baseOffset = new THREE.Vector3(0, 0.6, 0);

    // Natural bob animation
    const bob = Math.sin(this.wandBobTime * 2) * 0.03;
    baseOffset.y += bob;

    // Gentle sway
    const swayX = Math.sin(this.wandSwayTime * 1.5) * 0.02;
    const swayZ = Math.cos(this.wandSwayTime * 1.2) * 0.02;
    baseOffset.x += swayX;
    baseOffset.z += swayZ;

    // Movement lean: tilt toward movement direction
    if (this.movementDirection.lengthSq() > 0.1) {
        const leanAmount = 0.1;
        baseOffset.x += this.movementDirection.x * leanAmount;
        baseOffset.z += this.movementDirection.z * leanAmount;
    }

    // Smooth follow
    this.wandOffset.lerp(baseOffset, delta * 8);
    this.wandBlob.group.position.copy(this.wandOffset);
}
```

### `src/systems/color-inventory.js`
**Integrate with cores:**
```javascript
// Add after line 86 (in constructor):
this.coreManager = null;

// Add new method:
setCoreManager(coreManager) {
    this.coreManager = coreManager;
}

// Modify update(delta) - around line 399:
// If coreManager exists, sync charges from cores instead of using hardcoded regen
update(delta) {
    if (!this.regenEnabled) return;

    if (this.coreManager) {
        // Sync from cores
        for (const [color, data] of Object.entries(this.charges)) {
            const core = this.coreManager.getCore(color);
            if (core) {
                data.current = core.current;
                data.max = core.getMax();
            }
        }
    } else {
        // Legacy behavior (existing code)
        // ... existing regen logic ...
    }

    this.updateUI();
}

// Modify extract(color, amount) - around line 425:
extract(color, amount = 25) {
    if (this.coreManager) {
        const core = this.coreManager.getCore(color);
        if (core) {
            core.extract(amount);
            this.updateUI();
            this.pulseSlot(color);
            return true;
        }
        return false; // No core for this color
    }
    // ... existing fallback logic ...
}

// Modify consume(color, amount) - around line 448:
consume(color, amount) {
    if (this.coreManager) {
        const core = this.coreManager.getCore(color);
        if (core && core.current >= amount) {
            core.consume(amount);
            this.updateUI();
            return true;
        }
        return false;
    }
    // ... existing fallback logic ...
}
```

### `src/systems/progression.js`
**Remove automatic stats:**
```javascript
// Modify levelUp() - around line 204:
levelUp() {
    this.level++;

    // Calculate XP for next level (exponential curve)
    this.xpToNextLevel = Math.floor(100 * Math.pow(1.5, this.level - 1));

    // REMOVED: Automatic stat increases
    // this.stats.maxHealth += 10;
    // this.stats.damage += 0.1;
    // this.stats.colorEfficiency += 0.05;

    // Dispatch level up event - UI will handle choices
    window.dispatchEvent(new CustomEvent('level-up', {
        detail: {
            level: this.level,
            stats: { ...this.stats }
        }
    }));

    // Note: Level-up notification now handled by LevelUpUI
    // this.showLevelUpNotification(); // Remove or keep as backup
}
```

### `src/main.js`
**Wire systems:**
```javascript
// Add imports at top:
import { CoreManager, CORE_TYPES } from './systems/core-manager.js';
import { LevelUpUI } from './ui/levelup-ui.js';

// In init() or setup, after creating colorInventory and controller:
this.coreManager = new CoreManager();
this.levelUpUI = new LevelUpUI(this.coreManager);

// Connect to color inventory:
this.colorInventory.setCoreManager(this.coreManager);

// Add starting cores:
this.coreManager.addCore(CORE_TYPES.VITALITY); // body - health
this.coreManager.addCore(CORE_TYPES.IVORY);    // wand - mana

// Connect cores to blobs for rendering:
const vitalityCore = this.coreManager.getCore(CORE_TYPES.VITALITY);
const ivoryCore = this.coreManager.getCore(CORE_TYPES.IVORY);

this.controller.bodyBlob.addCore(vitalityCore);
this.controller.wandBlob.addCore(ivoryCore);

// In update loop, update core manager:
this.coreManager.update(delta);
```

---

## Implementation Order

1. **Core System** - `core-system.js`, `core-manager.js`
2. **Wand Repositioning** - Move to top with bob/sway in `blob-player-controller.js`
3. **Core Rendering** - Add to `particle-life-creature.js`
4. **Level-Up UI** - Create `levelup-ui.js`
5. **Color Integration** - Connect `color-inventory.js` to cores
6. **Progression Update** - Remove auto-stats from `progression.js`
7. **Main Wiring** - Connect all in `main.js`

---

## Verification Checklist

1. [ ] **Visual test**: Load game, verify wand blob is on top of body with bob/sway
2. [ ] **Core test**: Verify core spheres visible inside blobs (pulsing)
3. [ ] **Level-up test**: Gain XP, verify choice modal appears and pauses game
4. [ ] **Choice test**: Select upgrade/new core, verify it applies correctly
5. [ ] **Resource test**: Verify unlocked elements regenerate, locked ones don't
6. [ ] **Balance test**: Play through 5+ levels, verify progression feels meaningful

---

## Balance Considerations

- **Early game**: Only Ivory (mana) regenerates, other colors from enemy drops
- **Mid game**: Player chooses between element variety vs. power
- **Late game**: Tier 4-5 cores are significantly powerful (2x regen/max)
- **Trade-off**: Wide element coverage (combos) vs. deep specialization (raw power)

---

## Color Mapping Reference

| Core Type | Color Name | Hex Color | Effect | Location |
|-----------|------------|-----------|--------|----------|
| VITALITY | Red | 0xc44444 | Health | Body |
| ARMOR | Grey | 0x888888 | Shield | Body |
| IVORY | White | 0xeeeedd | Pure mana | Wand |
| CRIMSON | Red | 0xc44444 | Fire/burn | Wand |
| AZURE | Blue | 0x4477aa | Water/slow | Wand |
| VERDANT | Green | 0x44aa66 | Earth/lifesteal | Wand |
| GOLDEN | Yellow | 0xddaa44 | Light/pierce | Wand |
| VIOLET | Purple | 0x8855aa | Shadow/homing | Wand |

---

## Resume Instructions

To continue this implementation:
1. Run `claude` in the `chromatic-resonance-3d` directory
2. Say: "Continue implementing the Core System from docs/CORE-SYSTEM-IMPLEMENTATION.md - start with Task 1"
3. Claude will read this file and continue from where we left off
