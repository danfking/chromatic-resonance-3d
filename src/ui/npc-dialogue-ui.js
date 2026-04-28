// npc-dialogue-ui.js - NPC dialogue overlay and interaction prompt

export class NPCDialogueUI {
    constructor() {
        this.isOpen = false;
        this.promptVisible = false;
        this._createUI();
        this._setupEventListeners();
    }

    _createUI() {
        // Interaction prompt ("Press E to talk")
        this.prompt = document.createElement('div');
        this.prompt.id = 'npc-interact-prompt';
        this.prompt.innerHTML = `
            <span class="npc-prompt-key">E</span>
            <span class="npc-prompt-text">Talk</span>
        `;
        document.body.appendChild(this.prompt);

        // Dialogue panel
        this.panel = document.createElement('div');
        this.panel.id = 'npc-dialogue-panel';
        this.panel.innerHTML = `
            <div class="npc-dialogue-speaker"></div>
            <div class="npc-dialogue-title"></div>
            <div class="npc-dialogue-text"></div>
            <div class="npc-dialogue-dismiss">Press E to dismiss</div>
        `;
        document.body.appendChild(this.panel);

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            #npc-interact-prompt {
                position: fixed;
                bottom: 200px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: rgba(0, 0, 0, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: #f0ece0;
                font-family: Georgia, serif;
                font-size: 14px;
                z-index: 400;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }

            #npc-interact-prompt.visible {
                opacity: 1;
            }

            .npc-prompt-key {
                display: inline-block;
                padding: 2px 8px;
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                font-family: monospace;
                font-weight: bold;
                font-size: 13px;
            }

            .npc-prompt-text {
                color: rgba(255, 255, 255, 0.9);
            }

            #npc-dialogue-panel {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                max-width: 520px;
                width: 90%;
                padding: 20px 28px;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #f0ece0;
                font-family: Georgia, serif;
                z-index: 600;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s ease;
            }

            #npc-dialogue-panel.visible {
                opacity: 1;
                pointer-events: auto;
            }

            .npc-dialogue-speaker {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 2px;
                color: rgba(255, 220, 120, 0.8);
                margin-bottom: 6px;
            }

            .npc-dialogue-title {
                font-size: 15px;
                font-weight: bold;
                color: rgba(255, 200, 80, 0.9);
                margin-bottom: 8px;
                display: none;
            }

            .npc-dialogue-title.has-title {
                display: block;
            }

            .npc-dialogue-text {
                font-size: 15px;
                line-height: 1.6;
                font-style: italic;
                color: rgba(240, 236, 224, 0.95);
            }

            .npc-dialogue-dismiss {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.35);
                margin-top: 14px;
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }

    _setupEventListeners() {
        window.addEventListener('npc-dialogue-open', (e) => {
            this.showDialogue(e.detail);
        });

        window.addEventListener('npc-dialogue-close', () => {
            this.hideDialogue();
        });
    }

    /**
     * Show the interaction prompt with NPC name
     */
    showPrompt(npcName) {
        if (this.isOpen) return;
        this.prompt.querySelector('.npc-prompt-text').textContent = `Talk to ${npcName}`;
        this.prompt.classList.add('visible');
        this.promptVisible = true;
    }

    /**
     * Hide the interaction prompt
     */
    hidePrompt() {
        this.prompt.classList.remove('visible');
        this.promptVisible = false;
    }

    /**
     * Show dialogue panel with content
     */
    showDialogue(dialogue) {
        this.hidePrompt();

        const speakerEl = this.panel.querySelector('.npc-dialogue-speaker');
        const titleEl = this.panel.querySelector('.npc-dialogue-title');
        const textEl = this.panel.querySelector('.npc-dialogue-text');

        speakerEl.textContent = dialogue.speaker;

        if (dialogue.title) {
            titleEl.textContent = dialogue.title;
            titleEl.classList.add('has-title');
        } else {
            titleEl.textContent = '';
            titleEl.classList.remove('has-title');
        }

        textEl.textContent = dialogue.text;

        this.panel.classList.add('visible');
        this.isOpen = true;
    }

    /**
     * Hide dialogue panel
     */
    hideDialogue() {
        this.panel.classList.remove('visible');
        this.isOpen = false;
    }

    /**
     * Update prompt visibility based on NPC system state
     */
    updatePrompt(npcSystem) {
        if (this.isOpen) return;

        const nearbyName = npcSystem.getNearbyNPCName();
        if (nearbyName && !npcSystem.activeDialogue) {
            this.showPrompt(nearbyName);
        } else {
            this.hidePrompt();
        }
    }

    dispose() {
        if (this.prompt.parentNode) this.prompt.parentNode.removeChild(this.prompt);
        if (this.panel.parentNode) this.panel.parentNode.removeChild(this.panel);
    }
}
