// ai-handler.js

const AI_CONFIG_KEY = "ai_assistant_config";

/**
 * Handles communication with different AI providers (Gemini, OpenAI, Ollama)
 */
class AIHandler {
    constructor() {
        this.config = this.loadConfig();
    }

    loadConfig() {
        const saved = localStorage.getItem(AI_CONFIG_KEY);
        return saved ? JSON.parse(saved) : {
            provider: 'gemini',
            apiKey: '',
            ollamaModel: 'llama3',
            ollamaUrl: 'http://localhost:11434'
        };
    }

    saveConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(this.config));
    }

    async sendMessage(message, history = [], systemPrompt = "") {
        const { provider } = this.config;

        switch (provider) {
            case 'gemini':
                return this.sendToGemini(message, history, systemPrompt);
            case 'openai':
                return this.sendToOpenAI(message, history, systemPrompt);
            case 'ollama':
                return this.sendToOllama(message, history, systemPrompt);
            default:
                throw new Error("Invalid provider selected");
        }
    }

    async sendToGemini(message, history, systemPrompt) {
        const apiKey = this.config.apiKey;
        if (!apiKey) throw new Error("Gemini API Key is missing");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        // Format history for Gemini
        const contents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Add system prompt if present (Gemini 1.5 handles this differently, but we'll prepend for simplicity)
        const fullMessage = systemPrompt ? `${systemPrompt}\n\nUser Question: ${message}` : message;
        contents.push({ role: 'user', parts: [{ text: fullMessage }] });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Gemini API Error");
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async sendToOpenAI(message, history, systemPrompt) {
        const apiKey = this.config.apiKey;
        if (!apiKey) throw new Error("OpenAI API Key is missing");

        const url = "https://api.openai.com/v1/chat/completions";
        
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        
        history.forEach(msg => {
            messages.push({ role: msg.role, content: msg.content });
        });
        
        messages.push({ role: 'user', content: message });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: messages
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "OpenAI API Error");
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async sendToOllama(message, history, systemPrompt) {
        const { ollamaUrl, ollamaModel } = this.config;
        const url = `${ollamaUrl}/api/chat`;

        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        
        history.forEach(msg => {
            messages.push({ role: msg.role, content: msg.content });
        });
        
        messages.push({ role: 'user', content: message });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ollamaModel,
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error("Ollama connection failed. Is it running?");
        }

        const data = await response.json();
        return data.message.content;
    }

    async getOllamaModels() {
        const { ollamaUrl } = this.config;
        try {
            const response = await fetch(`${ollamaUrl}/api/tags`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.models.map(m => m.name);
        } catch (e) {
            console.error("Failed to fetch Ollama models", e);
            return [];
        }
    }
}

window.aiHandler = new AIHandler();
