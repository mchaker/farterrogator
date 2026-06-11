<div align="center">
  <img src="public/favicon.png" width="100" height="100" alt="Farterrogator Logo" />
  <h1>Farterrogator</h1>
  <p><strong>Advanced AI Image Interrogator & Prompt Generator</strong></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#eva-setup">EVA Setup</a>
  </p>
</div>

---

**Farterrogator** is a powerful image interrogation tool designed for Stable Diffusion enthusiasts and dataset creators. It analyzes images to generate strict Danbooru-style tags, offering a seamless workflow between local AI models and cloud services.

## ✨ Features

- **Dual Backend Support**:
  - **Google Gemini**: Fast, cloud-based analysis using Gemini models.
  - **EVA**: Uses a local tagger (WD1.4/ViT/EVA) for high-precision Danbooru tagging.
- **Strict Danbooru Tagging**:
  - Automatically categorizes tags into **Copyright**, **Character**, **Artist**, **General**, **Meta**, and **Rating**.
  - Filters and sorts tags by confidence score.
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

## 🛠️ EVA Setup (Recommended)

To use the **EVA** mode for privacy and zero-cost inference, you need a local service running:

### 1. Local Tagger (WD1.4 / ViT / EVA)
You need a backend that serves a tagging model. This project is configured to work with a service running on port `8000`.
- **Endpoint**: `http://localhost:8000/interrogate/eva`
- **Expected Output**: JSON with `tags` object.

**Configuration in App:**
1. Click the **Configuration** panel in the UI.
2. Select **EVA** under "AI Backend".
3. Ensure endpoints match your local setup.

## ☁️ Gemini Setup
1. Get an API Key from [Google AI Studio](https://aistudio.google.com/).
2. Enter the key in the **Configuration** panel (stored in memory only).

## 📄 License
MIT
