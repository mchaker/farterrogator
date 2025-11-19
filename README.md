<div align="center">
  <img src="public/favicon.png" width="100" height="100" alt="Farterrogator Logo" />
  <h1>Farterrogator</h1>
  <p><strong>Advanced AI Image Interrogator & Prompt Generator</strong></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#local-hybrid-setup">Local Hybrid Setup</a>
  </p>
</div>

---

**Farterrogator** is a powerful image interrogation tool designed for Stable Diffusion enthusiasts and dataset creators. It analyzes images to generate strict Danbooru-style tags and detailed natural language descriptions, offering a seamless workflow between local AI models and cloud services.

## ✨ Features

- **Dual Backend Support**:
  - **Google Gemini**: Fast, cloud-based analysis using Gemini models.
  - **Local Hybrid Mode**: Combines a local tagger (WD1.4/ViT/EVA) for precision tags with **Ollama** for visual reasoning and description.
- **Strict Danbooru Tagging**:
  - Automatically categorizes tags into **Copyright**, **Character**, **Artist**, **General**, **Meta**, and **Rating**.
  - Filters and sorts tags by confidence score.
- **Smart Natural Language Generation**:
  - Generates detailed captions on-demand.
  - Uses existing tags to ground the LLM, ensuring the description matches the visual elements perfectly (no hallucinations).
- **Modern UI**:
  - Built with **React**, **Vite**, and **Tailwind CSS**.
  - Fully responsive with **Dark Mode** support.
  - Drag-and-drop image upload.

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **pnpm** (recommended) or npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mooshieblob1/farterrogator.git
   cd farterrogator
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Run the development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

## 🛠️ Local Hybrid Setup (Recommended)

To use the **Local Hybrid** mode for privacy and zero-cost inference, you need two local services running:

### 1. Local Tagger (WD1.4 / ViT / EVA)
You need a backend that serves a tagging model. This project is configured to work with a service running on port `8000`.
- **Endpoint**: `http://localhost:8000/interrogate/pixai`
- **Expected Output**: JSON with `tags` object.

### 2. Ollama (LLM & Vision)
Install [Ollama](https://ollama.com/) for the natural language descriptions.
- **Endpoint**: `http://localhost:11434`
- **Recommended Model**: `qwen3-vl:30b` (Vision-Language model) or `llava`.

#### ⚠️ Important: CORS Configuration
If you are accessing Ollama from a different domain (e.g., your web app is on `tagger.gpu.garden` and Ollama is on `ollama.gpu.garden`), you **must** configure Ollama to allow Cross-Origin requests.

Set the `OLLAMA_ORIGINS` environment variable when starting Ollama:

```bash
# Allow all origins (Development)
OLLAMA_ORIGINS="*" ollama serve

# Allow specific domain (Production)
OLLAMA_ORIGINS="https://tagger.gpu.garden" ollama serve
```

**Configuration in App:**
1. Click the **Configuration** panel in the UI.
2. Select **Local Hybrid** under "AI Backend".
3. Ensure endpoints match your local setup.
4. (Optional) Enable "Natural Language Output" to generate captions.

## ☁️ Gemini Setup
1. Get an API Key from [Google AI Studio](https://aistudio.google.com/).
2. Enter the key in the **Configuration** panel (stored in memory only).

## 📄 License
MIT
