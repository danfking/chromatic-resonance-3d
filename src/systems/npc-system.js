// npc-system.js - NPC blob spawning, AI behavior, and interaction
// Manages Keeper, Wanderer, and Fragment NPCs

import * as THREE from 'three';
import { ParticleLifeCreature, NPC_PRESETS, ELEMENT_TYPES } from '../creatures/particle-life-creature.js';
import { getRandomLore, LORE_FRAGMENTS } from '../world/lore-fragments.js';

/**
 * NPC dialogue lines per type, beyond lore fragments
 */
const NPC_DIALOGUE = {
    keeper: [
        { text: 'Your particle signature is unusually coherent. Guard that stability.' },
        { text: 'The facility corridors ahead are heavily irradiated. Brace yourself.' },
        { text: 'I remember when this lab hummed with purpose. Before the containment breach.' },
        { text: 'System integrity at 14%. But the data here is still intact. You still have time.' },
        { text: 'I have logged many anomalies passing through this terminal. Few persist.' },
        { text: 'Rest here a moment. The ADF patrols haven\'t found this place... not yet.' },
    ],
    keeperFirstInteraction: {
        text: "You're awake. Good. The Bloom is spreading through the facility. Collect the spark core ahead \u2014 you'll need its energy. There's a vehicle past the containment zone. Reach the exit portal once the commander is dealt with.",
    },
    wanderer: [
        { text: 'I move between the ruins, collecting field notes. Would you hear one?' },
        { text: 'Something stirs deeper in. The monsoon is washing the old readings away.' },
        { text: 'I spotted ADF drones three klicks east. Tread carefully.' },
        { text: 'The rainforest shifts constantly out here. Trust your instincts, not the old maps.' },
        { text: 'Other CSIRO staff passed this way. Their camp is still warm.' },
        { text: 'Follow the river downstream. It leads away from the facility.' },
    ],
    fragment: [
        { text: '...remember... something important... the experiment...' },
        { text: 'I was part of something larger once. The pieces scattered when the containment failed.' },
        { text: 'Careful ahead... I can feel the signal pulling...' },
        { text: 'You glow so brightly. I had almost forgotten what coherence looked like.' },
        { text: 'The other fragments... have you seen them? We are searching for each other.' },
        { text: 'Stay close... the interference is weaker near you.' },
    ]
};

/**
 * Single NPC instance with blob creature, position, and behavior
 */
class NPC {
    constructor(type, position, scene, element) {
        this.type = type;
        this.scene = scene;
        this.element = element;
        this.position = position.clone();
        this.isInteracting = false;
        this.interactionCooldown = 0;
        this.dialogueIndex = 0;
        this.firstInteraction = true;
        this.time = 0;

        // Behavior state
        this.behaviorTimer = 0;
        this.moveTarget = null;
        this.moveSpeed = type === 'wanderer' ? 1.5 : 0;
        this.patrolRadius = type === 'wanderer' ? 15 : 0;
        this.patrolCenter = position.clone();
        this.isPlayerNearby = false;

        // Fragment follows player
        this.followTarget = null;
        this.followDistance = type === 'fragment' ? 3.0 : 0;
        this.followSpeed = type === 'fragment' ? 4.0 : 0;

        // Create blob creature (disable vitality/armor for friendly NPCs)
        this.creature = new ParticleLifeCreature(type, {
            disableVitality: true,
            disableArmor: true,
            disableEssence: type !== 'keeper', // Only keeper shows essence (wisdom glow)
        });

        // Position the NPC
        this.creature.group.position.copy(position);
        scene.add(this.creature.group);

        // Interaction indicator (floating glow above NPC)
        this.indicator = this._createIndicator();
        this.creature.group.add(this.indicator);
    }

    _createIndicator() {
        const geo = new THREE.SphereGeometry(0.08, 8, 8);
        const preset = NPC_PRESETS[this.type];
        const mat = new THREE.MeshBasicMaterial({
            color: preset.colors[0],
            transparent: true,
            opacity: 0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = preset.radius + 0.4;
        return mesh;
    }

    update(delta, playerPosition) {
        this.time += delta;
        this.creature.update(delta);

        // Interaction cooldown
        if (this.interactionCooldown > 0) {
            this.interactionCooldown -= delta;
        }

        // Check player proximity
        const dist = this.creature.group.position.distanceTo(playerPosition);
        const interactionRange = 3.0;
        const wasNearby = this.isPlayerNearby;
        this.isPlayerNearby = dist < interactionRange;

        // Show/hide interaction indicator
        const targetOpacity = this.isPlayerNearby && !this.isInteracting ? 0.8 : 0;
        this.indicator.material.opacity += (targetOpacity - this.indicator.material.opacity) * delta * 5;
        // Bob the indicator
        this.indicator.position.y = NPC_PRESETS[this.type].radius + 0.4 + Math.sin(this.time * 3) * 0.1;

        // NPC response to player proximity
        if (this.isPlayerNearby && !wasNearby) {
            this._onPlayerApproach();
        }

        // Type-specific behavior
        switch (this.type) {
            case 'keeper':
                this._updateKeeper(delta);
                break;
            case 'wanderer':
                this._updateWanderer(delta, playerPosition);
                break;
            case 'fragment':
                this._updateFragment(delta, playerPosition);
                break;
        }
    }

    _onPlayerApproach() {
        // Pulse the creature particles to acknowledge player
        const creature = this.creature;
        if (creature.physics) {
            creature.physics.applyImpact(new THREE.Vector3(0, 1, 0), 0.15);
        }
    }

    _updateKeeper(delta) {
        // Keepers are stationary with gentle bob
        const bob = Math.sin(this.time * 1.5) * 0.05;
        this.creature.group.position.y = this.position.y + bob;
    }

    _updateWanderer(delta, playerPosition) {
        // Wanderers patrol between points, stop when player is nearby
        if (this.isPlayerNearby) {
            // Stop moving when player approaches
            return;
        }

        this.behaviorTimer -= delta;
        if (this.behaviorTimer <= 0) {
            // Pick new patrol target
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.patrolRadius;
            this.moveTarget = new THREE.Vector3(
                this.patrolCenter.x + Math.cos(angle) * dist,
                this.position.y,
                this.patrolCenter.z + Math.sin(angle) * dist
            );
            this.behaviorTimer = 3 + Math.random() * 5;
        }

        if (this.moveTarget) {
            const pos = this.creature.group.position;
            const dir = new THREE.Vector3().subVectors(this.moveTarget, pos);
            dir.y = 0;
            const dist = dir.length();

            if (dist > 0.5) {
                dir.normalize();
                pos.x += dir.x * this.moveSpeed * delta;
                pos.z += dir.z * this.moveSpeed * delta;
            } else {
                this.moveTarget = null;
            }
        }
    }

    _updateFragment(delta, playerPosition) {
        // Fragments follow the player at a distance
        const pos = this.creature.group.position;
        const dir = new THREE.Vector3().subVectors(playerPosition, pos);
        dir.y = 0;
        const dist = dir.length();

        if (dist > this.followDistance + 1) {
            // Move toward player
            dir.normalize();
            const speed = Math.min(this.followSpeed, dist - this.followDistance) * delta;
            pos.x += dir.x * speed * 3;
            pos.z += dir.z * speed * 3;
        } else if (dist < this.followDistance - 0.5) {
            // Too close, drift away slightly
            dir.normalize();
            pos.x -= dir.x * 0.5 * delta;
            pos.z -= dir.z * 0.5 * delta;
        }

        // Gentle vertical bob
        pos.y = this.position.y + Math.sin(this.time * 2.5) * 0.15;

        // Flicker effect (fragment is unstable)
        const flicker = Math.sin(this.time * 8) * 0.5 + 0.5;
        if (this.creature.bubbleMesh) {
            this.creature.bubbleMesh.material.uniforms.uOpacity.value =
                NPC_PRESETS.fragment.bubbleOpacity * (0.6 + flicker * 0.4);
        }
    }

    /**
     * Get next dialogue line (mix of NPC lines and lore fragments)
     */
    getDialogue() {
        // Keeper first interaction: onboarding guidance
        if (this.type === 'keeper' && this.firstInteraction) {
            this.firstInteraction = false;
            const line = NPC_DIALOGUE.keeperFirstInteraction;
            return {
                speaker: NPC_PRESETS[this.type].name,
                title: null,
                text: line.text,
                isLore: false
            };
        }

        const lines = NPC_DIALOGUE[this.type];
        const lorePool = LORE_FRAGMENTS[this.element] || LORE_FRAGMENTS[ELEMENT_TYPES.LIGHT];

        // Alternate between NPC-specific dialogue and lore
        const useLore = this.dialogueIndex % 3 === 2 && lorePool.length > 0;
        this.dialogueIndex++;

        if (useLore) {
            const lore = lorePool[Math.floor(Math.random() * lorePool.length)];
            return {
                speaker: NPC_PRESETS[this.type].name,
                title: lore.title,
                text: lore.text,
                isLore: true
            };
        }

        const line = lines[(this.dialogueIndex - 1) % lines.length];
        return {
            speaker: NPC_PRESETS[this.type].name,
            title: null,
            text: line.text,
            isLore: false
        };
    }

    /**
     * Check if this NPC can be interacted with
     */
    canInteract() {
        return this.isPlayerNearby && !this.isInteracting && this.interactionCooldown <= 0;
    }

    /**
     * Start interaction
     */
    startInteraction() {
        this.isInteracting = true;
    }

    /**
     * End interaction
     */
    endInteraction() {
        this.isInteracting = false;
        this.interactionCooldown = 1.0; // 1 second cooldown between interactions
    }

    dispose() {
        this.creature.dispose();
        this.scene.remove(this.creature.group);
    }
}

/**
 * NPCSystem - Manages all NPC blobs in the level
 */
export class NPCSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.npcs = [];
        this.element = options.element ?? ELEMENT_TYPES.FIRE;
        this.activeDialogue = null;

        // Dialogue UI callbacks
        this.onDialogueOpen = null;
        this.onDialogueClose = null;

        // Interaction key
        this._setupInputHandlers();
    }

    _setupInputHandlers() {
        this._onKeyDown = (e) => {
            if (e.key === 'e' || e.key === 'E') {
                if (this.activeDialogue) {
                    this.dismissDialogue();
                } else {
                    this.tryInteract();
                }
            }
        };
        window.addEventListener('keydown', this._onKeyDown);
    }

    /**
     * Spawn NPCs based on level type and configuration
     */
    spawnForLevel(levelType, bounds, playerPosition) {
        // Keeper: spawns near center of safe area
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;

        // Spawn Keeper inside compound, 5u south of spawn (visible from spawn)
        const keeperPos = new THREE.Vector3(
            playerPosition.x,
            0.8,
            playerPosition.z + 5
        );
        this.spawnNPC('keeper', keeperPos);

        // Spawn a Wanderer in the middle of the level
        const wandererPos = new THREE.Vector3(
            centerX + (Math.random() - 0.5) * 10,
            0.5,
            centerZ + (Math.random() - 0.5) * 10
        );
        this.spawnNPC('wanderer', wandererPos);

        // Spawn a Fragment that follows the player (starts near player)
        const fragmentPos = new THREE.Vector3(
            playerPosition.x - 2,
            0.6,
            playerPosition.z - 2
        );
        this.spawnNPC('fragment', fragmentPos);

        console.log(`[NPC] Spawned 3 NPCs: Keeper, Wanderer, Fragment`);
    }

    /**
     * Spawn a single NPC
     */
    spawnNPC(type, position) {
        const npc = new NPC(type, position, this.scene, this.element);
        this.npcs.push(npc);
        return npc;
    }

    /**
     * Update all NPCs
     */
    update(delta, playerPosition) {
        for (const npc of this.npcs) {
            npc.update(delta, playerPosition);
        }
    }

    /**
     * Try to interact with nearest NPC
     */
    tryInteract() {
        for (const npc of this.npcs) {
            if (npc.canInteract()) {
                this.openDialogue(npc);
                return;
            }
        }
    }

    /**
     * Open dialogue with an NPC
     */
    openDialogue(npc) {
        npc.startInteraction();
        const dialogue = npc.getDialogue();
        this.activeDialogue = { npc, dialogue };

        // Dispatch event for UI
        window.dispatchEvent(new CustomEvent('npc-dialogue-open', {
            detail: dialogue
        }));

        // Pause game during dialogue
        window.dispatchEvent(new CustomEvent('game-paused'));

        if (this.onDialogueOpen) {
            this.onDialogueOpen(dialogue);
        }
    }

    /**
     * Dismiss current dialogue
     */
    dismissDialogue() {
        if (!this.activeDialogue) return;

        this.activeDialogue.npc.endInteraction();
        this.activeDialogue = null;

        window.dispatchEvent(new CustomEvent('npc-dialogue-close'));
        window.dispatchEvent(new CustomEvent('game-resumed'));

        if (this.onDialogueClose) {
            this.onDialogueClose();
        }
    }

    /**
     * Check if any NPC is nearby (for UI prompt)
     */
    hasNearbyNPC() {
        return this.npcs.some(npc => npc.isPlayerNearby && !npc.isInteracting);
    }

    /**
     * Get the nearest interactable NPC type name (for prompt display)
     */
    getNearbyNPCName() {
        for (const npc of this.npcs) {
            if (npc.isPlayerNearby && !npc.isInteracting) {
                return NPC_PRESETS[npc.type].name;
            }
        }
        return null;
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        for (const npc of this.npcs) {
            npc.dispose();
        }
        this.npcs = [];
    }
}
