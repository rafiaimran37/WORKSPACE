const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.warn(
    "WARNING: OPENAI_API_KEY is not set. The /api/analyze endpoint will fail without it."
  );
}

const openai = new OpenAI({ apiKey: openaiApiKey });

app.post("/api/analyze", async (req, res) => {
  const { title, description, targetAudience } = req.body;

  if (!title || !description || !targetAudience) {
    return res.status(400).json({
      error: "Please provide title, description, and targetAudience in the request body.",
    });
  }

  try {
    const prompt = `You are an expert startup advisor. Analyze the following startup idea and provide JSON with the following keys: marketDemand, competitors, revenueModel, swot, suggestions.\n\nIdea Title: ${title}\nDescription: ${description}\nTarget Audience: ${targetAudience}\n\nReturn JSON only (no surrounding text).`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant that responds in strict JSON format." },
        { role: "user", content: prompt },
      ],
      max_tokens: 600,
    });

    const text = completion.data.choices[0].message?.content?.trim();

    // Try to parse JSON from the model response.
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      // If parsing fails, return raw text so frontend can show it.
      return res.json({ raw: text, warning: "Failed to parse JSON from OpenAI response." });
    }

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to analyze idea." });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
