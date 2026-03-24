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
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, description, targetAudience }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Analysis failed.");
    }

    const data = await response.json();

    const { marketDemand, competitors, revenueModel, swot, suggestions, raw } = data;

    document.querySelector("#market-demand .content").textContent =
      marketDemand || "(no output)";
    document.querySelector("#competitors .content").textContent =
      competitors || "(no output)";
    document.querySelector("#revenue-model .content").textContent =
      revenueModel || "(no output)";

    const maybeSwot = swot || {};
    const fillList = (selector, items) => {
      const ul = document.querySelector(selector);
      ul.innerHTML = "";
      if (!items) return;
      (Array.isArray(items) ? items : [items]).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      });
    };

    fillList("#strengths", maybeSwot.strengths);
    fillList("#weaknesses", maybeSwot.weaknesses);
    fillList("#opportunities", maybeSwot.opportunities);
    fillList("#threats", maybeSwot.threats);

    document.querySelector("#suggestions .content").textContent =
      suggestions || "(no output)";

    document.getElementById("rawOutput").textContent =
      raw || JSON.stringify(data, null, 2);

    resultSection.classList.remove("hidden");
    setStatus("Analysis complete.");
    showSpinner(false);
    submitBtn.disabled = false;
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
    showSpinner(false);
    submitBtn.disabled = false;
    console.error(error);
  }
});
