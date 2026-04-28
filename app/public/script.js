const form = document.getElementById("idea-form");
const resultSection = document.getElementById("result");
const statusEl = document.getElementById("status");
const spinner = document.getElementById("spinner");
const submitBtn = document.getElementById("submit-btn");
const clearBtn = document.getElementById("clear-btn");

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
};

const showSpinner = (show) => {
  if (show) {
    spinner.classList.remove("hidden");
  } else {
    spinner.classList.add("hidden");
  }
};

const ANALYZE_TIMEOUT_MS = 60_000;

function getDisplayValue(val) {
  if (typeof val === "object" && val !== null) {
    if (val.description) return val.description;
    return JSON.stringify(val, null, 2);
  }
  return val || "(no output)";
}

function tryParseJson(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (
    !(trimmed.startsWith("{") || trimmed.startsWith("[")) ||
    !(trimmed.endsWith("}") || trimmed.endsWith("]"))
  ) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return null;
  }
}

function toText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "object") {
    if (typeof value.description === "string") return value.description;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

function formatCompetitorItem(item, fallbackName) {
  if (typeof item === "string") {
    return item.trim();
  }

  const obj = item && typeof item === "object" ? item : {};
  const name = toText(obj.name || obj.competitor || obj.title || fallbackName || "Competitor").trim();
  const details = toText(obj.details || obj.summary || obj.description || obj.whatTheyDo || obj.overview).trim();
  const businessModel = toText(obj.businessModel || obj.business_model || obj.model).trim();

  const lines = [name];
  lines.push(`- Details: ${details || "(not provided)"}`);
  lines.push(`- Business model: ${businessModel || "(not provided)"}`);

  // If the object contains other fields, show them as extra details.
  const knownKeys = new Set([
    "name",
    "competitor",
    "title",
    "details",
    "summary",
    "description",
    "whatTheyDo",
    "overview",
    "businessModel",
    "business_model",
    "model",
  ]);
  const extra = Object.keys(obj)
    .filter((k) => !knownKeys.has(k))
    .reduce((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
  if (Object.keys(extra).length) {
    lines.push(`- Other: ${toText(extra).replace(/\s+/g, " ").trim()}`);
  }

  return lines.join("\n");
}

function formatCompetitors(value) {
  let v = value;
  if (typeof v === "string") {
    const parsed = tryParseJson(v);
    if (parsed) v = parsed;
  }

  if (Array.isArray(v)) {
    return v.map((item) => formatCompetitorItem(item)).filter(Boolean).join("\n\n");
  }

  if (v && typeof v === "object") {
    return Object.entries(v)
      .map(([name, details]) => {
        if (details && typeof details === "object") {
          return formatCompetitorItem({ name, ...details }, name);
        }
        return formatCompetitorItem({ name, details }, name);
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return getDisplayValue(value);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

const clearResults = () => {
  resultSection.classList.add("hidden");
  form.reset();
  setStatus("");
  showSpinner(false);
};

clearBtn.addEventListener("click", clearResults);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const targetAudience = document.getElementById("targetAudience").value.trim();

  if (!title || !description || !targetAudience) {
    setStatus("Please fill in all required fields.", true);
    return;
  }

  setStatus("Analyzing... This may take a few seconds.");
  showSpinner(true);
  submitBtn.disabled = true;

  try {
    const response = await fetchWithTimeout(
      "/api/analyze",
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, description, targetAudience }),
      },
      ANALYZE_TIMEOUT_MS
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || `Analysis failed (${response.status}).`);
    }
    if (!data) {
      throw new Error("Server returned an invalid JSON response.");
    }

    const { marketDemand, competitors, revenueModel, swot, suggestions, raw } = data;

    document.querySelector("#market-demand .content").textContent = getDisplayValue(marketDemand);
    document.querySelector("#competitors .content").textContent = formatCompetitors(competitors);
    document.querySelector("#revenue-model .content").textContent = getDisplayValue(revenueModel);
    document.querySelector("#suggestions .content").textContent = getDisplayValue(suggestions);

    // For SWOT, show description if object, else fallback
    const maybeSwot = swot || {};
    const fillList = (selector, items) => {
      const ul = document.querySelector(selector);
      ul.innerHTML = "";
      if (!items) return;
      (Array.isArray(items) ? items : [items]).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = typeof item === "object" && item !== null && item.description ? item.description : (item || "(no output)");
        ul.appendChild(li);
      });
    };

    fillList("#strengths", maybeSwot.strengths);
    fillList("#weaknesses", maybeSwot.weaknesses);
    fillList("#opportunities", maybeSwot.opportunities);
    fillList("#threats", maybeSwot.threats);

    document.getElementById("rawOutput").textContent =
      raw || JSON.stringify(data, null, 2);

    resultSection.classList.remove("hidden");
    setStatus("Analysis complete.");
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
    console.error(error);
  } finally {
    showSpinner(false);
    submitBtn.disabled = false;
  }
});
