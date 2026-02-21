// main.js - Core UI Logic

let appState = {
    chats: [],
    currentChatId: null,
    settings: {
        model: 'ollama-llama3',
        systemPromptEnabled: false,
        temperature: 0.7,
        geminiKey: '',
        openaiKey: '',
        anthropicKey: ''
    },
    attachedFiles: [],
    modelsCache: {
        gemini: null,
        openai: null,
        anthropic: null
    },
    modelsCacheTime: {
        gemini: 0,
        openai: 0,
        anthropic: 0
    }
};

// Initialize Neutralino
if (typeof Neutralino !== 'undefined') {
    Neutralino.init();

    Neutralino.events.on('ready', async () => {
        console.log('STICH App is ready');
        lucide.createIcons();
        await Store.init();

        appState.settings = await Store.loadSettings();
        appState.chats = await Store.loadChats();

        // Populate UI with settings
        document.getElementById('systemPromptToggle').checked = appState.settings.systemPromptEnabled || false;
        const tempVal = appState.settings.temperature !== undefined ? appState.settings.temperature : 0.7;
        document.getElementById('tempSlider').value = tempVal;
        const tempDisplay = document.getElementById('tempValue');
        if (tempDisplay) tempDisplay.innerText = tempVal;
        document.getElementById('geminiKey').value = appState.settings.geminiKey || '';
        document.getElementById('openaiKey').value = appState.settings.openaiKey || '';
        document.getElementById('anthropicKey').value = appState.settings.anthropicKey || '';

        // Try reading cache from Store side
        const savedCache = await Store.loadModelsCache?.();
        if (savedCache) {
            appState.modelsCache = savedCache.models || appState.modelsCache;
            appState.modelsCacheTime = savedCache.times || appState.modelsCacheTime;
        }

        await fetchModels();

        // Set Model Select Value after fetch
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect.querySelector(`option[value="${appState.settings.model}"]`)) {
            modelSelect.value = appState.settings.model;
        } else if (modelSelect.options.length > 0) {
            appState.settings.model = modelSelect.options[0].value;
            Store.saveSettings(appState.settings);
        }

        renderSidebarChats();

        // Restore previous chat context or start a new one
        if (appState.chats.length > 0) {
            loadChat(appState.chats[0].id);
        } else {
            startNewChat();
        }
    });

    Neutralino.events.on('windowClose', () => {
        Neutralino.app.exit();
    });
} else {
    console.warn("Neutralino backend not found. Running in browser mode.");
    document.addEventListener('DOMContentLoaded', () => {
        lucide.createIcons();
        renderSidebarChats();
    });
}

// UI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Sidebar Toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Modal Logic
    const apiModal = document.getElementById('apiModal');

    // Open Models dialog when pressing Models
    const navModels = document.getElementById('navModels');
    navModels?.addEventListener('click', (e) => {
        e.preventDefault();
        apiModal.classList.add('active');
    });

    // Modal Tabs Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = e.target.getAttribute('data-tab');
            e.target.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });

    document.getElementById('closeApiModal')?.addEventListener('click', () => apiModal.classList.remove('active'));
    document.getElementById('saveApiModalBtn')?.addEventListener('click', async () => {
        appState.settings.geminiKey = document.getElementById('geminiKey').value;
        appState.settings.openaiKey = document.getElementById('openaiKey').value;
        appState.settings.anthropicKey = document.getElementById('anthropicKey').value;
        saveCurrentSettings();

        // Refetch models if gemini key was updated
        document.getElementById('saveApiModalBtn').innerText = "Saving...";
        await fetchModels();
        document.getElementById('saveApiModalBtn').innerText = "Save Setup";

        apiModal.classList.remove('active');
    });

    // File Attachment Logic
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileAttachment');
    const attachmentsPreview = document.getElementById('attachmentsPreview');

    attachBtn?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target.result;
                appState.attachedFiles.push({ name: file.name, type: file.type, data: base64String });
                renderAttachments();
            };
            reader.readAsDataURL(file);
        });
        fileInput.value = ''; // Reset
    });

    function renderAttachments() {
        if (!attachmentsPreview) return;
        attachmentsPreview.innerHTML = appState.attachedFiles.map((file, idx) => `
            <div class="attachment-chip">
                ${file.type.startsWith('image/') ? `<img src="${file.data}">` : '<i data-lucide="file"></i>'}
                <span>${file.name.substring(0, 15)}...</span>
                <i data-lucide="x" class="remove-file" data-index="${idx}"></i>
            </div>
        `).join('');
        lucide.createIcons({ root: attachmentsPreview });

        document.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                appState.attachedFiles.splice(idx, 1);
                renderAttachments();
            });
        });
    }

    // Pull Ollama Model
    const pullBtn = document.getElementById('pullModelBtn');
    if (pullBtn) {
        pullBtn.addEventListener('click', async () => {
            const pullInput = document.getElementById('ollamaPullInput');
            const progressDiv = document.getElementById('pullProgress');
            const modelName = pullInput.value.trim();
            if (!modelName) return;

            progressDiv.innerText = `Pulling ${modelName}... Please wait.`;
            pullBtn.disabled = true;
            try {
                const res = await fetch('http://localhost:11434/api/pull', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: modelName, stream: false })
                });
                if (res.ok) {
                    progressDiv.innerHTML = `<span style="color:var(--success)">Successfully pulled ${modelName}!</span>`;
                    pullInput.value = '';
                    await fetchModels(); // Refresh native models
                } else {
                    progressDiv.innerText = `Failed to pull ${modelName}.`;
                }
            } catch (err) {
                progressDiv.innerText = `Error: ${err.message}. Is Ollama running?`;
            }
            pullBtn.disabled = false;
        });
    }

    // Auto-resize textarea
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
        promptInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            if (this.value === '') this.style.height = 'auto';
        });

        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    }

    document.getElementById('sendBtn')?.addEventListener('click', handleSend);
    document.getElementById('newChatBtn')?.addEventListener('click', startNewChat);

    // Settings Auto-Save Hook
    const saveCurrentSettings = () => {
        if (!Store.saveSettings) return;
        appState.settings.model = document.getElementById('modelSelect').value;
        appState.settings.systemPromptEnabled = document.getElementById('systemPromptToggle').checked;
        appState.settings.temperature = document.getElementById('tempSlider').value;
        Store.saveSettings(appState.settings);
    };

    document.getElementById('modelSelect')?.addEventListener('change', saveCurrentSettings);
    document.getElementById('systemPromptToggle')?.addEventListener('change', saveCurrentSettings);
    document.getElementById('tempSlider')?.addEventListener('input', (e) => {
        const tempDisplay = document.getElementById('tempValue');
        if (tempDisplay) tempDisplay.innerText = e.target.value;
        saveCurrentSettings();
    });

    // Chat Management Overrides
    document.getElementById('exportChatBtn')?.addEventListener('click', async () => {
        if (!appState.currentChatId) return;
        const currentChat = appState.chats.find(c => c.id === appState.currentChatId);
        if (!currentChat) return;

        let mdContent = `# ${currentChat.title}\n\nGenerated with STICH AI.\n\n---\n\n`;
        currentChat.messages.forEach(msg => {
            mdContent += `### ${msg.role === 'user' ? 'You' : 'AI'}:\n${msg.text}\n\n`;
        });

        try {
            let defaultName = currentChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'chat_export';
            const savePath = await Neutralino.os.showSaveDialog('Export Chat', {
                defaultPath: `${defaultName}.md`,
                filters: [{ name: 'Markdown', extensions: ['md'] }]
            });
            if (savePath) {
                await Neutralino.filesystem.writeFile(savePath, mdContent);
            }
        } catch (err) {
            console.error('Export failed:', err);
        }
    });

    document.getElementById('deleteChatBtn')?.addEventListener('click', async () => {
        if (!appState.currentChatId) return;

        let confirmAction = false;
        try {
            let res = await Neutralino.os.showMessageBox('Delete Chat', 'Are you sure you want to delete this conversation?', 'YES_NO', 'WARNING');
            confirmAction = res === 'YES';
        } catch (e) {
            confirmAction = confirm("Are you sure you want to delete this chat?");
        }

        if (confirmAction) {
            appState.chats = appState.chats.filter(c => c.id !== appState.currentChatId);
            Store.saveChats(appState.chats);
            startNewChat();
            renderSidebarChats();
        }
    });
});

// Fetch models
async function fetchModels() {
    const modelSelect = document.getElementById('modelSelect');
    const indicator = document.getElementById('connectionIndicator');

    let ollamaModels = [];
    try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (res.ok) {
            const data = await res.json();
            ollamaModels = data.models || [];
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected');
        }
    } catch (err) {
        console.warn("Ollama is not running locally.");
        indicator.classList.remove('connected');
    }

    // Fetch Gemini Models
    let geminiModels = [];
    const geminiKey = appState.settings.geminiKey;
    if (geminiKey) {
        if (appState.modelsCache.gemini && (Date.now() - appState.modelsCacheTime.gemini < 3600000)) {
            geminiModels = appState.modelsCache.gemini;
        } else {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
                if (res.ok) {
                    const data = await res.json();
                    geminiModels = data.models.filter(m => m.supportedGenerationMethods?.includes("generateContent") || m.name.includes("gemini"));
                    appState.modelsCache.gemini = geminiModels;
                    appState.modelsCacheTime.gemini = Date.now();
                }
            } catch (err) {
                console.warn("Error fetching Gemini models:", err);
            }
        }
    }

    // Fetch OpenAI Models
    let openaiModels = [];
    const openaiKey = appState.settings.openaiKey;
    if (openaiKey) {
        if (appState.modelsCache.openai && (Date.now() - appState.modelsCacheTime.openai < 3600000)) {
            openaiModels = appState.modelsCache.openai;
        } else {
            try {
                const res = await fetch(`https://api.openai.com/v1/models`, {
                    headers: { 'Authorization': `Bearer ${openaiKey}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    openaiModels = data.data.filter(m => m.id.includes("gpt"));
                    appState.modelsCache.openai = openaiModels;
                    appState.modelsCacheTime.openai = Date.now();
                }
            } catch (err) {
                console.warn("Error fetching OpenAI models:", err);
            }
        }
    }

    // Fetch Anthropic Models
    let anthropicModels = [];
    const anthropicKey = appState.settings.anthropicKey;
    if (anthropicKey) {
        if (appState.modelsCache.anthropic && (Date.now() - appState.modelsCacheTime.anthropic < 3600000)) {
            anthropicModels = appState.modelsCache.anthropic;
        } else {
            try {
                const res = await fetch(`https://api.anthropic.com/v1/models`, {
                    headers: {
                        'x-api-key': anthropicKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    anthropicModels = data.data;
                    appState.modelsCache.anthropic = anthropicModels;
                    appState.modelsCacheTime.anthropic = Date.now();
                } else {
                    // Fallback models if API endpoint is blocked
                    anthropicModels = [{ id: "claude-3-5-sonnet-20240620", display_name: "Claude 3.5 Sonnet" }, { id: "claude-3-opus-20240229", display_name: "Claude 3 Opus" }];
                    appState.modelsCache.anthropic = anthropicModels;
                    appState.modelsCacheTime.anthropic = Date.now();
                }
            } catch (err) {
                console.warn("Error fetching Anthropic models:", err);
                anthropicModels = [{ id: "claude-3-5-sonnet-20240620", display_name: "Claude 3.5 Sonnet" }, { id: "claude-3-opus-20240229", display_name: "Claude 3 Opus" }];
            }
        }
    }

    // Save Unified Cache
    Store.saveModelsCache?.({ models: appState.modelsCache, times: appState.modelsCacheTime });

    let html = `<optgroup label="Local Models (Ollama)">`;
    if (ollamaModels.length > 0) {
        ollamaModels.forEach(m => {
            html += `<option value="ollama-${m.name}">${m.name}</option>`;
        });
    } else {
        html += `<option value="" disabled>No local models found</option>`;
    }

    html += `</optgroup><optgroup label="Cloud Models (Gemini)">`;
    if (geminiModels.length > 0) {
        geminiModels.forEach(m => {
            let name = m.name.replace('models/', '');
            html += `<option value="gemini-${name}">${m.displayName || name}</option>`;
        });
    } else {
        html += `<option value="" disabled>Enter valid Gemini Key to fetch models</option>`;
    }

    html += `</optgroup><optgroup label="Cloud Models (OpenAI)">`;
    if (openaiModels.length > 0) {
        openaiModels.forEach(m => {
            html += `<option value="openai-${m.id}">${m.id}</option>`;
        });
    } else {
        html += `<option value="" disabled>Enter valid OpenAI Key to fetch models</option>`;
    }

    html += `</optgroup>
    <optgroup label="Cloud Models (Anthropic)">`;
    if (anthropicModels.length > 0) {
        anthropicModels.forEach(m => {
            html += `<option value="anthropic-${m.id}">${m.display_name || m.id}</option>`;
        });
    } else {
        html += `<option value="" disabled>Enter valid Anthropic Key to fetch models</option>`;
    }

    html += `</optgroup>
    <optgroup label="Cloud Models (Other)">
      <option value="openai-gpt-4o">GPT-4o (OpenAI)</option>
      <option value="openai-gpt-4o-mini">GPT-4o Mini</option>
      <option value="openai-vision-dall-e-3">DALL-E 3 (Image Generation)</option>
      <option value="anthropic-claude-3-5-sonnet-20240620">Claude 3.5 Sonnet (Anthropic)</option>
    </optgroup>`;
    modelSelect.innerHTML = html;
}

// Chat Management
function startNewChat() {
    appState.currentChatId = null;
    document.getElementById('chatMessages').innerHTML = `
    <div class="empty-state" id="emptyState">
      <div class="empty-icon-wrapper"><i data-lucide="sparkles"></i></div>
      <h2>How can I help you today?</h2>
      <p>Select a model and start typing to begin.</p>
    </div>
  `;
    lucide.createIcons();
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));

    // Hide management buttons
    const exportBtn = document.getElementById('exportChatBtn');
    const deleteBtn = document.getElementById('deleteChatBtn');
    if (exportBtn) exportBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
}

function loadChat(id) {
    appState.currentChatId = id;
    const chat = appState.chats.find(c => c.id === id);
    if (!chat) return;

    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    chat.messages.forEach(msg => {
        addMessageToDOM(msg.role, msg.text, msg.attachments || []);
    });
    renderSidebarChats();

    // Show management buttons
    const exportBtn = document.getElementById('exportChatBtn');
    const deleteBtn = document.getElementById('deleteChatBtn');
    if (exportBtn) exportBtn.style.display = 'inline-flex';
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
}

// Send Message Flow
async function handleSend() {
    const promptInput = document.getElementById('promptInput');
    const text = promptInput.value.trim();
    if (!text) return;

    promptInput.value = '';
    promptInput.style.height = 'auto';

    // Create chat if it doesn't exist
    if (!appState.currentChatId) {
        const newId = Date.now().toString();
        appState.currentChatId = newId;
        appState.chats.unshift({
            id: newId,
            title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
            messages: []
        });

        const exportBtn = document.getElementById('exportChatBtn');
        const deleteBtn = document.getElementById('deleteChatBtn');
        if (exportBtn) exportBtn.style.display = 'inline-flex';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    }

    // Capture attached files
    const attachments = [...appState.attachedFiles];
    appState.attachedFiles = [];
    document.getElementById('attachmentsPreview').innerHTML = '';

    const currentChat = appState.chats.find(c => c.id === appState.currentChatId);
    currentChat.messages.push({ role: 'user', text, attachments });
    Store.saveChats(appState.chats);

    addMessageToDOM('user', text, attachments);
    renderSidebarChats();

    // Create typing indicator
    const chatMessages = document.getElementById('chatMessages');
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message ai typing-message';
    typingIndicator.innerHTML = `
    <div class="avatar"><i data-lucide="zap"></i></div>
    <div class="message-content">
      <div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    </div>
  `;
    chatMessages.appendChild(typingIndicator);
    lucide.createIcons({ root: typingIndicator });
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Call API
    const model = appState.settings.model;
    let responseText = "";

    try {
        if (model.startsWith('ollama-')) {
            responseText = await generateOllama(model.replace('ollama-', ''), text, attachments);
        } else if (model.startsWith('gemini-')) {
            responseText = await generateGemini(model, text, attachments);
        } else if (model.startsWith('openai-vision-dall-e-')) {
            responseText = await generateOpenAIImage(model.replace('openai-vision-', ''), text);
        } else if (model.startsWith('openai-')) {
            responseText = await generateOpenAI(model.replace('openai-', ''), text, attachments);
        } else if (model.startsWith('anthropic-')) {
            responseText = await generateAnthropic(model.replace('anthropic-', ''), text, attachments);
        } else {
            responseText = "Selected model is not configured properly.";
        }
    } catch (err) {
        responseText = "Error generating response: " + err.message;
    }

    // Hide indicator and add response
    if (chatMessages.contains(typingIndicator)) chatMessages.removeChild(typingIndicator);

    currentChat.messages.push({ role: 'ai', text: responseText });
    Store.saveChats(appState.chats);
    addMessageToDOM('ai', responseText);
}

async function generateOllama(modelName, prompt, attachments) {
    let images = [];
    if (attachments && attachments.length > 0) {
        images = attachments.filter(a => a.type.startsWith('image/')).map(a => a.data.split(',')[1]);
    }

    const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelName,
            prompt: prompt,
            images: images.length > 0 ? images : undefined,
            stream: false,
            options: { temperature: parseFloat(appState.settings.temperature) }
        })
    });
    if (!res.ok) {
        let errMsg = "Ollama API Error";
        try {
            const errData = await res.json();
            if (errData.error) errMsg = errData.error;
        } catch (e) { }
        throw new Error(errMsg);
    }
    const data = await res.json();
    return data.response;
}

async function generateGemini(modelName, prompt, attachments) {
    const key = appState.settings.geminiKey;
    if (!key) throw new Error("Gemini API key is not set. Please set it in Settings.");

    // Handle exact API name format
    let apiModelName = modelName;
    if (apiModelName.startsWith('gemini-')) {
        apiModelName = apiModelName.substring(7); // strip internal identifier prefix
    }

    let parts = [{ text: prompt }];
    if (attachments && attachments.length > 0) {
        attachments.forEach(file => {
            const b64 = file.data.split(',')[1];
            parts.push({
                inlineData: { mimeType: file.type, data: b64 }
            });
        });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelName}:generateContent?key=${key}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: { temperature: parseFloat(appState.settings.temperature) }
        })
    });

    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Gemini API Error");
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
}

async function generateOpenAI(modelName, prompt, attachments) {
    const key = appState.settings.openaiKey;
    if (!key) throw new Error("OpenAI API key is not set.");

    let content = [{ type: "text", text: prompt }];
    if (attachments && attachments.length > 0) {
        attachments.forEach(file => {
            if (file.type.startsWith('image/')) {
                content.push({ type: "image_url", image_url: { url: file.data } });
            }
        });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: content }],
            temperature: parseFloat(appState.settings.temperature)
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
}

async function generateOpenAIImage(modelName, prompt) {
    const key = appState.settings.openaiKey;
    if (!key) throw new Error("OpenAI API key is not set. Please set it in Settings.");

    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
            model: modelName,
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // Return markdown formatted image so it natively renders in the chat DOM
    const b64Image = data.data[0].b64_json;
    return `![Generated Image](data:image/png;base64,${b64Image})`;
}

async function generateAnthropic(modelName, prompt, attachments) {
    const key = appState.settings.anthropicKey;
    if (!key) throw new Error("Anthropic API key is not set.");

    let content = [];
    if (attachments && attachments.length > 0) {
        attachments.forEach(file => {
            if (file.type.startsWith('image/')) {
                const b64 = file.data.split(',')[1];
                content.push({ type: "image", source: { type: "base64", media_type: file.type, data: b64 } });
            }
        });
    }
    content.push({ type: "text", text: prompt });

    // Note: Anthropic needs a proxy or specialized backend if run completely from browser due to strict CORS.
    // Assuming neutralino removes CORS, we test direct calling.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true' // Bypass CORS block from browser if applicable
        },
        body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: content }],
            max_tokens: 4000,
            temperature: parseFloat(appState.settings.temperature)
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
}

function addMessageToDOM(role, text, attachments = []) {
    const chatMessages = document.getElementById('chatMessages');
    const emptyState = document.getElementById('emptyState');
    if (emptyState && emptyState.style.display !== 'none') emptyState.style.display = 'none';

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    let htmlContent = text;
    if (typeof marked !== 'undefined') htmlContent = marked.parse(text);

    msgDiv.innerHTML = `
    <div class="avatar">
      ${role === 'ai'
            ? '<i data-lucide="zap"></i>'
            : '<img src="https://ui-avatars.com/api/?name=User&background=6366f1&color=fff" style="width:100%;height:100%;border-radius:var(--radius-md);object-fit:cover;">'
        }
    </div>
    <div class="message-content">
        ${attachments.length > 0 ? `
            <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap;">
                ${attachments.map(a => a.type.startsWith('image/') ?
            `<img src="${a.data}" style="max-height:150px;border-radius:var(--radius-md);">` :
            `<div style="font-size:0.75rem;padding:0.25rem 0.5rem;background:var(--bg-main);border-radius:4px;"><i data-lucide="file"></i> ${a.name}</div>`
        ).join('')}
            </div>
        ` : ''}
        ${htmlContent}
    </div>
    <div class="message-actions">
      <button class="action-btn" title="Copy"><i data-lucide="copy"></i></button>
    </div>
  `;

    chatMessages.appendChild(msgDiv);
    if (typeof hljs !== 'undefined') {
        msgDiv.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
    lucide.createIcons({ root: msgDiv });
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Attach Copy Event Listener
    const copyBtn = msgDiv.querySelector('.action-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                if (typeof Neutralino !== 'undefined') {
                    await Neutralino.clipboard.writeText(text);
                } else {
                    await navigator.clipboard.writeText(text);
                }

                // Visual Feedback
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i data-lucide="check" style="color: var(--success);"></i>';
                lucide.createIcons({ root: copyBtn });

                setTimeout(() => {
                    copyBtn.innerHTML = originalHtml;
                    lucide.createIcons({ root: copyBtn });
                }, 2000);
            } catch (err) {
                console.error("Failed to copy text", err);
            }
        });
    }
}

function renderSidebarChats() {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;

    if (appState.chats.length === 0) {
        chatList.innerHTML = `<li class="chat-item" style="opacity:0.5;">No recent chats</li>`;
        return;
    }

    chatList.innerHTML = appState.chats.map((chat) => `
    <li class="chat-item ${chat.id === appState.currentChatId ? 'active' : ''}" data-id="${chat.id}">
      <i data-lucide="message-square"></i>
      <span>${chat.title}</span>
    </li>
  `).join('');

    lucide.createIcons({ root: chatList });

    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            if (id) loadChat(id);
        });
    });
}
