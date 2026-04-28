const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// NOTE: This line is intentionally added to create a small, trackable change for git commit/push flow.
app.use(express.static(path.join(__dirname, "public")));

const geminiApiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
  "";
const hasGeminiKey = Boolean(geminiApiKey);
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";

if (!hasGeminiKey) {
  console.warn(
    "WARNING: GEMINI_API_KEY is not set. The /api/analyze endpoint will return an error until you configure it."
  );
}

function buildAnalysisPrompt({ title, description, targetAudience }) {
  return [
    "You are an analyst helping validate startup ideas.",
    "Return ONLY valid JSON (no markdown, no code fences, no extra text).",
    "The JSON MUST have these keys:",
    "- marketDemand (string)",
    "- competitors (array of 3-6 objects; each object MUST have: name (string), details (string), businessModel (string))",
    "  - details: what they offer + who they serve + why they compete with this idea",
    "  - businessModel: how they make money (e.g., commissions, subscriptions, ads, usage fees)",
    "- revenueModel (string)",
    "- swot (object with arrays: strengths, weaknesses, opportunities, threats)",
    "- suggestions (string)",
    "Keep each field concise but specific.",
    "",
    `Title: ${title}`,
    `Description: ${description}`,
    `Target Audience: ${targetAudience}`,
  ].join("\n");
}

function tryParseJson(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    // fall through
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  const maybeJson = text.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(maybeJson);
  } catch (_) {
    return null;
  }
}

function normalizeTextField(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value.description === "string") return value.description;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }
  if (value == null) return "";
  return String(value);
}

function normalizeList(value) {
  if (!value) return [];
  const array = Array.isArray(value) ? value : [value];
  return array
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && typeof item.description === "string") {
        return item.description;
      }
      if (item == null) return "";
      return String(item);
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSwot(value) {
  const swot = value && typeof value === "object" ? value : {};
  return {
    strengths: normalizeList(swot.strengths),
    weaknesses: normalizeList(swot.weaknesses),
    opportunities: normalizeList(swot.opportunities),
    threats: normalizeList(swot.threats),
  };
}

function normalizeCompetitorItem(value, fallbackName) {
  if (typeof value === "string") {
    const name = value.trim();
    return {
      name: name || (fallbackName ? String(fallbackName) : ""),
      details: "",
      businessModel: "",
    };
  }

  const obj = value && typeof value === "object" ? value : {};
  const name = normalizeTextField(obj.name || fallbackName).trim();
  const details = normalizeTextField(
    obj.details || obj.summary || obj.description || obj.whatTheyDo || obj.overview
  ).trim();
  const businessModel = normalizeTextField(
    obj.businessModel || obj.business_model || obj.model
  ).trim();
  return { name, details, businessModel };
}

function normalizeCompetitors(value) {
  if (!value) return [];

  // If a model returned competitors as a JSON string, try to parse it.
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed) {
      return normalizeCompetitors(parsed);
    }
    const details = value.trim();
    if (!details) return [];
    return [{ name: "Competitors", details, businessModel: "" }];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCompetitorItem(item))
      .filter((c) => c.name || c.details || c.businessModel);
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([name, details]) => {
        if (details && typeof details === "object") {
          return normalizeCompetitorItem({ name, ...details }, name);
        }
        return normalizeCompetitorItem({ name, details }, name);
      })
      .filter((c) => c.name || c.details || c.businessModel);
  }

  return [];
}

function normalizeAnalysis(parsed) {
  const obj = parsed && typeof parsed === "object" ? parsed : {};
  return {
    marketDemand: normalizeTextField(obj.marketDemand),
    competitors: normalizeCompetitors(obj.competitors),
    revenueModel: normalizeTextField(obj.revenueModel),
    swot: normalizeSwot(obj.swot),
    suggestions: normalizeTextField(obj.suggestions),
  };
}

async function generateWithGemini({ prompt, temperature = 0.7 }) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    geminiModel
  )}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

  const maxOutputTokens = 2048;
  const requestTimeoutMs = Number.parseInt(
    process.env.GEMINI_TIMEOUT_MS || "30000",
    10
  );
  const timeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 30000;

  const baseBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  const jsonModeBody = {
    ...baseBody,
    generationConfig: {
      ...baseBody.generationConfig,
      responseMimeType: "application/json",
    },
  };

  async function callGemini(body) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          (data && data.error && data.error.message) ||
          `Gemini request failed (${response.status}).`;
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts;
      const text = Array.isArray(parts)
        ? parts
            .map((p) => (typeof p?.text === "string" ? p.text : ""))
            .filter(Boolean)
            .join("")
            .trim()
        : "";

      if (!text) {
        const blockReason = data?.promptFeedback?.blockReason;
        const finishReason = candidate?.finishReason;
        if (blockReason) {
          throw new Error(`Gemini blocked the response (blockReason=${blockReason}).`);
        }
        throw new Error(
          `Gemini returned empty content${finishReason ? ` (finishReason=${finishReason})` : ""}.`
        );
      }

      return { text, data };
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error(`Gemini request timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  try {
    return await callGemini(jsonModeBody);
  } catch (error) {
    const message = String(error?.message || "");
    const shouldRetryWithoutJsonMode =
      message.includes("responseMimeType") &&
      (message.includes("Unknown") || message.includes("unknown") || message.includes("Invalid"));
    if (shouldRetryWithoutJsonMode) {
      return await callGemini(baseBody);
    }
    throw error;
  }
}

function generateMockAnalysis({ title, description, targetAudience }) {
  return {
    marketDemand: `There is a healthy market interest in '${title}' from ${targetAudience}, especially for solutions that ${description.slice(0, 120)}...`,
    competitors: `Competitors are likely existing products and services in the same market niche, including established players and indirect alternatives.`,
    revenueModel: `A strong revenue model could include subscriptions, premium features, or consulting services that address the needs of ${targetAudience}.`,
    swot: {
      strengths: [
        `Clear problem focus based on the idea description`,
        `Product could appeal to ${targetAudience}`,
      ],
      weaknesses: [
        `May need strong differentiation from competitors`,
        `Initial traction may require targeted marketing`,
      ],
      opportunities: [
        `Expand into adjacent audiences once product-market fit is found`,
        `Use customer feedback to refine the core offering`,
      ],
      threats: [
        `Established competitors with more resources`,
        `Potential challenges in acquiring early users`,
      ],
    },
    suggestions: `Validate the core idea with early users, focus on a narrow target segment, and iterate on the product based on feedback.`,
  };
}

app.post("/api/analyze", async (req, res) => {
  const { title, description, targetAudience } = req.body;

  if (!title || !description || !targetAudience) {
    return res.status(400).json({
      error: "Please provide title, description, and targetAudience in the request body.",
    });
  }

  if (!hasGeminiKey) {
    return res.status(400).json({
      error: "GEMINI_API_KEY is not configured. Please set the GEMINI_API_KEY environment variable.",
    });
  }

  try {
    const prompt = buildAnalysisPrompt({ title, description, targetAudience });
    const { text } = await generateWithGemini({ prompt, temperature: 0.7 });

    const parsed = tryParseJson(text);
    if (!parsed) {
      return res.json({
        raw: text,
        warning:
          "Gemini returned non-JSON output. Please review the raw response.",
        provider: "gemini",
        model: geminiModel,
      });
    }

    return res.json({
      ...normalizeAnalysis(parsed),
      raw: text,
      provider: "gemini",
      model: geminiModel,
    });
  } catch (error) {
    console.error(error);
    const message =
      error && typeof error.message === "string" && error.message.trim()
        ? error.message
        : "Failed to analyze idea with Gemini.";
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
