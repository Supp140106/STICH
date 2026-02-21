// store.js - Handles Saving/Loading History & Settings via Neutralino API
const Store = {
    dataDir: '',
    settingsPath: '',
    chatsPath: '',
    cachePath: '',

    async init() {
        try {
            // Get the standard OS data directory for this app
            this.dataDir = await Neutralino.os.getPath('data');
            this.settingsPath = `${this.dataDir}/stich_settings.json`;
            this.chatsPath = `${this.dataDir}/stich_chats.json`;
            this.cachePath = `${this.dataDir}/stich_cache.json`;

            console.log('Store initialized at:', this.dataDir);
        } catch (err) {
            console.error('Neutralino not available or error getting data path:', err);
        }
    },

    async loadChats() {
        try {
            const content = await Neutralino.filesystem.readFile(this.chatsPath);
            return JSON.parse(content);
        } catch (err) {
            // Return empty array if no chats exist yet
            return [];
        }
    },

    async saveModelsCache(models) {
        try {
            await Neutralino.filesystem.writeFile(this.cachePath, JSON.stringify(models));
        } catch (err) {
            console.error('Failed to save cache', err);
        }
    },

    async loadModelsCache() {
        try {
            const content = await Neutralino.filesystem.readFile(this.cachePath);
            return JSON.parse(content);
        } catch (err) {
            return null;
        }
    },

    async saveChats(chats) {
        try {
            await Neutralino.filesystem.writeFile(this.chatsPath, JSON.stringify(chats, null, 2));
        } catch (err) {
            console.error('Error saving chats:', err);
        }
    },

    async loadSettings() {
        try {
            const content = await Neutralino.filesystem.readFile(this.settingsPath);
            return JSON.parse(content);
        } catch (err) {
            return {
                model: 'ollama-llama3',
                systemPromptEnabled: false,
                temperature: 0.7,
                geminiKey: '',
                openaiKey: '',
                anthropicKey: ''
            };
        }
    },

    async saveSettings(settings) {
        try {
            await Neutralino.filesystem.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
        } catch (err) {
            console.error('Error saving settings:', err);
        }
    }
};
