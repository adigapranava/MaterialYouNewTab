// ai-ui.js

const PINNED_CHATS_KEY = "ai_pinned_conversations";

class AIChatUI {
    constructor() {
        this.isOpen = false;
        this.currentHistory = [];
        this.activeCommand = null;
        this.activePrompt = "";
        this.paletteIndex = 0;
        this.activeChatId = null;
        
        this.initElements();
        this.initEventListeners();
        this.loadSettingsToUI();
    }

    initElements() {
        this.modal = document.getElementById('aiChatModal');
        this.overlay = document.getElementById('aiChatOverlay');
        this.input = document.getElementById('aiChatInput');
        this.messagesCont = document.getElementById('aiChatMessages');
        this.sendBtn = document.getElementById('sendAIChatBtn');
        this.closeBtn = document.getElementById('closeAIChatBtn');
        this.settingsBtn = document.getElementById('aiChatSettingsBtn');
        this.historyBtn = document.getElementById('aiChatHistoryBtn');
        this.pinBtn = document.getElementById('pinChatBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.palette = document.getElementById('aiCommandPalette');
        this.chip = document.getElementById('aiActiveChip');
        this.chipName = document.getElementById('chipName');
        this.settingsPanel = document.getElementById('aiChatSettingsPanel');
        this.historyPanel = document.getElementById('aiChatHistoryPanel');
        this.pinnedList = document.getElementById('aiPinnedList');
    }

    initEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.toggleModal();
            }
        });

        this.closeBtn.addEventListener('click', () => this.toggleModal(false));
        this.overlay.addEventListener('click', () => this.toggleModal(false));
        this.input.addEventListener('input', (e) => this.handleInput(e));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        this.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('settings');
        });
        this.historyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('history');
        });

        this.pinBtn.addEventListener('click', () => this.handlePinClick());
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        this.messagesCont.addEventListener('click', () => this.closeAllPanels());
        
        this.modal.addEventListener('click', (e) => {
            if (!this.settingsPanel.contains(e.target) && 
                !this.historyPanel.contains(e.target) && 
                !this.settingsBtn.contains(e.target) && 
                !this.historyBtn.contains(e.target) &&
                !this.newChatBtn.contains(e.target) &&
                !this.pinBtn.contains(e.target)) {
                this.closeAllPanels();
            }
        });

        document.getElementById('saveAISettingsInternalBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('aiProviderSelect').addEventListener('change', (e) => this.updateProviderUI(e.target.value));
        document.getElementById('refreshOllamaModels').addEventListener('click', () => this.loadOllamaModels());
        
        this.palette.querySelectorAll('.ai-command-item').forEach(item => {
            item.addEventListener('click', () => this.selectCommand(item));
        });
    }

    toggleModal(force) {
        this.isOpen = force !== undefined ? force : !this.isOpen;
        this.modal.style.display = this.isOpen ? 'block' : 'none';
        this.overlay.style.display = this.isOpen ? 'block' : 'none';
        if (this.isOpen) {
            this.input.focus();
            this.renderPinnedChats();
            this.closeAllPanels();
        } else {
            if (!this.activeChatId) {
                this.startNewChat(false);
            }
        }
    }

    startNewChat(focus = true) {
        this.activeChatId = null;
        this.currentHistory = [];
        this.messagesCont.innerHTML = '<div class="ai-message system">Welcome! Press <strong>Ctrl + K</strong> to toggle this chat. Type <strong>/</strong> for quick tools.</div>';
        this.pinBtn.classList.remove('pinned');
        this.pinBtn.title = "Pin Conversation";
        this.removeCommand();
        this.closeAllPanels();
        if (focus) this.input.focus();
    }

    closeAllPanels() {
        this.settingsPanel.style.display = 'none';
        this.historyPanel.style.display = 'none';
    }

    togglePanel(type) {
        const panel = type === 'settings' ? this.settingsPanel : this.historyPanel;
        const otherPanel = type === 'settings' ? this.historyPanel : this.settingsPanel;
        
        const wasOpen = panel.style.display === 'flex';
        otherPanel.style.display = 'none';
        panel.style.display = wasOpen ? 'none' : 'flex';
        
        if (type === 'settings' && !wasOpen) {
            this.loadOllamaModels();
        }
    }

    handleInput() {
        const value = this.input.value;
        if (value === '/' && !this.activeCommand) {
            this.showPalette();
        } else if (!value.startsWith('/')) {
            this.hidePalette();
        }
    }

    handleKeydown(e) {
        if (this.palette.style.display === 'block') {
            const items = this.palette.querySelectorAll('.ai-command-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.paletteIndex = (this.paletteIndex + 1) % items.length;
                this.updatePaletteSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.paletteIndex = (this.paletteIndex - 1 + items.length) % items.length;
                this.updatePaletteSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.selectCommand(items[this.paletteIndex]);
            } else if (e.key === 'Escape') {
                this.hidePalette();
            }
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }

        if (e.key === 'Backspace' && this.input.value === '' && this.activeCommand) {
            this.removeCommand();
        }
    }

    showPalette() {
        this.palette.style.display = 'block';
        this.paletteIndex = 0;
        this.updatePaletteSelection();
    }

    hidePalette() {
        this.palette.style.display = 'none';
    }

    updatePaletteSelection() {
        const items = this.palette.querySelectorAll('.ai-command-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.paletteIndex);
        });
    }

    selectCommand(item) {
        this.activeCommand = item.dataset.command;
        this.activePrompt = item.dataset.prompt;
        this.chipName.innerText = `/${this.activeCommand}`;
        this.chip.style.display = 'flex';
        this.chip.title = this.activePrompt;
        this.input.value = '';
        this.input.placeholder = '';
        this.hidePalette();
        this.input.focus();
    }

    removeCommand() {
        this.activeCommand = null;
        this.activePrompt = "";
        this.chip.style.display = 'none';
        this.input.placeholder = 'Ask anything...';
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text && !this.activeCommand) return;

        const userMessage = text;
        const displayMessage = this.activeCommand ? `/${this.activeCommand} ${text}` : text;
        
        this.addMessage('user', displayMessage);
        this.input.value = '';
        this.showTypingIndicator();

        try {
            const systemPrompt = this.activePrompt || "";
            const response = await window.aiHandler.sendMessage(userMessage, this.currentHistory, systemPrompt);
            this.hideTypingIndicator();
            this.addMessage('ai', response);
            
            this.currentHistory.push({ role: 'user', content: displayMessage });
            this.currentHistory.push({ role: 'assistant', content: response });
            
            if (this.activeChatId) {
                this.updatePinnedChat();
            }

        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('system', `Error: ${error.message}`);
        }
    }

    handlePinClick() {
        if (this.currentHistory.length === 0) return;
        
        if (this.activeChatId) {
            this.unpinChat(this.activeChatId);
            return;
        }

        const firstMsg = this.currentHistory[0].content;
        const title = firstMsg.replace(/^\/\w+\s*/, '').substring(0, 30) + (firstMsg.length > 30 ? '...' : '');
        
        this.pinCurrentChat(title || "Untitled Chat");
        this.pinBtn.classList.add('pinned');
        this.pinBtn.title = "Unpin Conversation";
    }

    addMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ${role}`;
        
        if (role === 'ai') {
            msgDiv.innerHTML = this.formatAIResponse(content);
        } else {
            msgDiv.innerText = content;
        }
        
        this.messagesCont.appendChild(msgDiv);
        this.messagesCont.scrollTop = this.messagesCont.scrollHeight;
    }

    formatAIResponse(text) {
        let cleanText = text.trim().replace(/\n{3,}/g, '\n\n');

        let formatted = cleanText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const id = 'code-' + Math.random().toString(36).substr(2, 9);
            const language = lang.toLowerCase() || 'javascript';
            let highlightedCode = "";

            if (window.Prism && Prism.languages[language]) {
                highlightedCode = Prism.highlight(code.trim(), Prism.languages[language], language);
            } else if (window.Prism && Prism.languages.javascript) {
                highlightedCode = Prism.highlight(code.trim(), Prism.languages.javascript, 'javascript');
            } else {
                highlightedCode = this.escapeHtml(code.trim());
            }
            
            return `__C_START__<div class="ai-code-block"><div class="ai-code-header"><span>${language}</span><button class="copy-code-btn" data-code-id="${id}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copy</button></div><pre class="language-${language}"><code id="${id}" class="language-${language}">${highlightedCode}</code></pre></div>__C_END__`;
        });

        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');

        const parts = formatted.split(/(__C_START__|__C_END__)/);
        let finalHtml = "";
        let inCode = false;

        parts.forEach(part => {
            if (part === "__C_START__") { inCode = true; return; }
            if (part === "__C_END__") { inCode = false; return; }
            
            if (inCode) {
                finalHtml += part;
            } else {
                finalHtml += part.replace(/\n/g, '<br>');
            }
        });

        finalHtml = finalHtml.replace(/<br>\s*<div class="ai-code-block">/g, '<div class="ai-code-block">');
        finalHtml = finalHtml.replace(/<\/div>\s*<br>/g, '</div>');

        setTimeout(() => this.attachCopyListeners(), 100);
        return finalHtml;
    }

    attachCopyListeners() {
        document.querySelectorAll('.copy-code-btn').forEach(btn => {
            if (btn.dataset.listenerAttached) return;
            btn.dataset.listenerAttached = "true";
            btn.addEventListener('click', (e) => {
                const codeId = btn.dataset.codeId;
                const codeElement = document.getElementById(codeId);
                if (codeElement) {
                    const codeText = codeElement.innerText;
                    navigator.clipboard.writeText(codeText).then(() => {
                        const originalContent = btn.innerHTML;
                        btn.innerText = "Copied!";
                        setTimeout(() => btn.innerHTML = originalContent, 2000);
                    });
                }
            });
        });
    }

    escapeHtml(unsafe) {
        return unsafe.replace(/[&<"']/g, m => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;', "'": '&#039;' }[m]));
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'aiTypingIndicator';
        indicator.className = 'ai-typing-indicator';
        indicator.innerHTML = '<div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div>';
        this.messagesCont.appendChild(indicator);
        this.messagesCont.scrollTop = this.messagesCont.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('aiTypingIndicator');
        if (indicator) indicator.remove();
    }

    loadSettingsToUI() {
        const config = window.aiHandler.config;
        document.getElementById('aiProviderSelect').value = config.provider;
        document.getElementById('aiApiKeyInput').value = config.apiKey;
        this.updateProviderUI(config.provider);
    }

    updateProviderUI(provider) {
        const apiSection = document.getElementById('apiKeySection');
        const ollamaSection = document.getElementById('ollamaModelSection');
        const apiLabel = document.getElementById('apiKeyLabel');

        if (provider === 'ollama') {
            apiSection.style.display = 'none';
            ollamaSection.style.display = 'flex';
        } else {
            apiSection.style.display = 'flex';
            ollamaSection.style.display = 'none';
            apiLabel.innerText = provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key';
        }
    }

    async loadOllamaModels() {
        const select = document.getElementById('ollamaModelSelect');
        const models = await window.aiHandler.getOllamaModels();
        
        select.innerHTML = '';
        if (models.length === 0) {
            select.innerHTML = '<option value="">No models found</option>';
            return;
        }

        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.innerText = m;
            if (m === window.aiHandler.config.ollamaModel) opt.selected = true;
            select.appendChild(opt);
        });
    }

    saveSettings() {
        const provider = document.getElementById('aiProviderSelect').value;
        const apiKey = document.getElementById('aiApiKeyInput').value;
        const ollamaModel = document.getElementById('ollamaModelSelect').value;

        window.aiHandler.saveConfig({ provider, apiKey, ollamaModel });
        this.closeAllPanels();
    }

    pinCurrentChat(title) {
        const pinned = JSON.parse(localStorage.getItem(PINNED_CHATS_KEY) || "[]");
        const newChat = {
            id: Date.now(),
            title: title,
            date: new Date().toLocaleDateString(),
            history: JSON.parse(JSON.stringify(this.currentHistory))
        };
        pinned.unshift(newChat);
        localStorage.setItem(PINNED_CHATS_KEY, JSON.stringify(pinned));
        this.activeChatId = newChat.id;
    }

    updatePinnedChat() {
        if (!this.activeChatId) return;
        const pinned = JSON.parse(localStorage.getItem(PINNED_CHATS_KEY) || "[]");
        const index = pinned.findIndex(c => c.id === this.activeChatId);
        if (index !== -1) {
            pinned[index].history = JSON.parse(JSON.stringify(this.currentHistory));
            localStorage.setItem(PINNED_CHATS_KEY, JSON.stringify(pinned));
        }
    }

    unpinChat(id) {
        const pinned = JSON.parse(localStorage.getItem(PINNED_CHATS_KEY) || "[]");
        const filtered = pinned.filter(c => c.id !== id);
        localStorage.setItem(PINNED_CHATS_KEY, JSON.stringify(filtered));
        
        if (this.activeChatId === id) {
            this.activeChatId = null;
            this.pinBtn.classList.remove('pinned');
            this.pinBtn.title = "Pin Conversation";
        }
        this.renderPinnedChats();
    }

    renderPinnedChats() {
        const pinned = JSON.parse(localStorage.getItem(PINNED_CHATS_KEY) || "[]");
        this.pinnedList.innerHTML = '';
        
        if (pinned.length === 0) {
            this.pinnedList.innerHTML = '<div style="padding:20px; text-align:center; font-size:12px; color:gray;">No pinned chats yet</div>';
            return;
        }

        pinned.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'pinned-chat-item';
            item.innerHTML = `
                <div class="pinned-chat-content">
                    <span class="pinned-chat-title">${chat.title}</span>
                    <span class="pinned-chat-date">${chat.date}</span>
                </div>
                <button class="unpin-btn" title="Delete chat">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            `;
            
            item.onclick = () => this.loadChat(chat);
            item.querySelector('.unpin-btn').onclick = (e) => {
                e.stopPropagation();
                this.unpinChat(chat.id);
            };
            
            this.pinnedList.appendChild(item);
        });
    }

    loadChat(chat) {
        this.currentHistory = JSON.parse(JSON.stringify(chat.history));
        this.activeChatId = chat.id;
        this.messagesCont.innerHTML = '';
        
        this.currentHistory.forEach(msg => {
            this.addMessage(msg.role === 'user' ? 'user' : 'ai', msg.content);
        });
        
        this.pinBtn.classList.add('pinned');
        this.pinBtn.title = "Unpin Conversation";
        this.closeAllPanels();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.AIChatUIInstance = new AIChatUI();
});
