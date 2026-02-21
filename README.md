<div align="center">
  <h1>STICH AI</h1>
  <p>A beautifully designed, highly functional, hybrid AI chat client built with Neutralino.js, integrating both local models (Ollama) and top-tier cloud models (OpenAI, Anthropic, Gemini).</p>
</div>

![Screenshot of STICH AI App]((placeholder for screenshot))

## ✨ Features

- **🚀 Universal Cloud Integration**: Supports **OpenAI (GPT-4o, GPT-4o Mini)**, **Anthropic (Claude 3.5 Sonnet, Opus)**, and **Google Gemini (1.5 Pro, Flash)** native endpoints.
- **🧠 Local AI execution (Ollama)**: Automatically detects and utilizes your locally running Ollama instance, avoiding cloud privacy concerns. Features a direct UI button to **pull new models** from Ollama instantly.
- **⚡ Dynamic Model Caching**: Entering a valid API Key automatically pings the service to download the full live roster of available models. It saves the metadata gracefully native to your machine (`stich_cache.json`) for 1 Hour to keep UI performance lightning fast, eliminating wasteful web requests. 
- **🎨 Image Generation (DALL-E 3)**: Select the dedicated `DALL-E 3` model under Cloud options to generate stunning 1024x1024 images natively mapped to Markdown directly inside your conversation bubble.
- **📎 Multimodal File Attachments**: A built-in image and file attachment workflow that securely base64's your uploads and allows GPT-4o, Claude-3.5-V, and Gemini 1.5 to perform vision analysis on your files instantly.
- **📓 Export to Markdown**: A single click converts your entire chat log into a perfectly formatted `.md` Markdown file saved anywhere directly to your hard drive natively.
- **💾 Robust Local History**: Your entire chat timeline and history seamlessly sync and write directly into a secure system JSON log in the data folder via `Neutralino.filesystem` rather than vulnerable browser DOM caches.
- **💅 Premium UI/UX**: Designed around a dark-theme, glassmorphism aesthetic loaded with responsive sliders, fluid transitions, typing indicator micro-animations, and code syntax highlighting (Highlight.js).

## 📥 Installation and Running

This app is built using **Neutralino.js**, making it extremely lightweight relative to Electron apps.

### Prerequisites
Make sure you have Node.js and the `neu` CLI installed:
```bash
npm install -g @neutralinojs/neu
```

### Setup
Clone the repository and jump into it:
```bash
git clone https://github.com/Supp140106/STICH.git
cd STICH
```

Make sure Neutralino dependencies are downloaded:
```bash
neu update
```

### Run Locally
Spins up the native window instantly:
```bash
neu run
```

### Build Executables
To turn this project into standalone compiled `.exe`, `.app`, and Linux executable binaries:
```bash
neu build
```

## ⚙️ Configuration (Adding API Keys)

1. Open the app and click the **Models** link on the left-hand sidebar.
2. Under the **Cloud APIs** tab, drop in your API Keys (such as `sk-ant[...]`). 
3. Hit Save. STICH will instantly process the keys, ping the endpoint backend, cache the resulting models natively, and populate your top-bar dropdown allowing you to switch between models fluidly.

If you don't enter an API key, that provider's models section simply hides from your UI, remaining clean and uncluttered. 

## 🛡️ License
[MIT License](LICENSE) 
