# AI Startup Idea Validator

A simple full-stack web app that lets you enter a startup idea and generates an AI-powered analysis using Google Gemini.

## Features

- Submit startup idea data (title, description, target audience)
- Sends request to a Node.js/Express backend with Gemini API
- Generates AI analysis with:
  - Market demand assessment
  - Competitor analysis
  - Revenue model suggestions
  - SWOT analysis
  - Improvement suggestions
- Displays analysis in a clean, sectioned UI
- Powered by Google Gemini (Generative Language API)

## Getting Started

### 1) Clone / download

```bash
cd ai-startup-idea-validator
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure Gemini API Key

Create a `.env` file in the `app/` directory and add your Google Gemini API key:

```
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-1.5-flash
```

**To get your Gemini API key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Create an API key for the Generative Language API
3. Copy the key and paste it into `.env`

### 4) Run the app

```bash
npm start
```

Then open http://localhost:3000 in your browser.

## Project Structure

- `server.js` - Express backend with Google Gemini API integration
- `public/index.html` - Frontend form + result view
- `public/script.js` - Frontend JavaScript fetch logic
- `public/styles.css` - Basic styling

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Your Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | The Gemini model to use |

---

> The app requires a valid Gemini API key to function. If the API key is not set, the `/api/analyze` endpoint will return an error.
