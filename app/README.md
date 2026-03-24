# AI Startup Idea Validator

A simple full-stack web app that lets you enter a startup idea and generates mock AI analysis without requiring any API keys.

## Features

- Submit startup idea data (title, description, target audience)
- Sends request to a Node.js/Express backend
- Generates mock AI analysis with:
  - Market demand assessment
  - Competitor analysis
  - Revenue model suggestions
  - SWOT analysis
  - Improvement suggestions
- Displays analysis in a clean, sectioned UI
- **No API keys required** - Works completely offline!

## Getting Started

### 1) Clone / download

```bash
cd ai-startup-idea-validator
```

### 2) Install dependencies

```bash
npm install
```

### 3) Run the app

```bash
npm start
```

Then open http://localhost:3000 in your browser.

## Project Structure

- `server.js` - Express backend and OpenAI API integration
- `public/index.html` - Frontend form + result view
- `public/script.js` - Frontend JavaScript fetch logic
- `public/styles.css` - Basic styling

---

> Note: This is a beginner-friendly starter project that works offline with mock AI analysis. For production use with real AI, integrate with OpenAI, Google Gemini, or other AI APIs.
