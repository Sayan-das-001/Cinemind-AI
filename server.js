const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let model = null;

if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

function cleanJsonText(rawText) {
  const trimmed = String(rawText || "").trim();

  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  }

  return trimmed;
}

function extractLikelyJson(rawText) {
  const cleaned = cleanJsonText(rawText);

  if (cleaned.startsWith("[") || cleaned.startsWith("{")) {
    return cleaned;
  }

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  return cleaned;
}

function normalizeCast(payload) {
  return Array.isArray(payload)
    ? payload.filter((person) => typeof person === "string" && person.trim()).slice(0, 6)
    : [];
}

function normalizeMoviePayload(payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};

  return {
    mediaType: "movie",
    title: String(safePayload.title || "").trim(),
    year: String(safePayload.year || "").trim(),
    rating: String(safePayload.rating || "").trim(),
    desc: String(safePayload.desc || "").trim(),
    director: String(safePayload.director || "").trim(),
    cast: normalizeCast(safePayload.cast),
    runtime: String(safePayload.runtime || "").trim(),
    streaming: String(safePayload.streaming || safePayload.platform || "").trim(),
    reason: String(safePayload.reason || "").trim(),
  };
}

function normalizeSeriesPayload(payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};

  return {
    mediaType: "series",
    title: String(safePayload.title || "").trim(),
    seasons: String(safePayload.seasons || "").trim(),
    episodes: String(safePayload.episodes || "").trim(),
    rating: String(safePayload.rating || "").trim(),
    desc: String(safePayload.desc || "").trim(),
    cast: normalizeCast(safePayload.cast),
    platform: String(safePayload.platform || safePayload.streaming || "").trim(),
    status: String(safePayload.status || "").trim(),
    reason: String(safePayload.reason || "").trim(),
  };
}

function normalizeMediaList(payload, mediaType, fallbackCount = 4) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload?.movies)
          ? payload.movies
          : Array.isArray(payload?.series)
            ? payload.series
            : payload
              ? [payload]
              : [];

  const normalize = mediaType === "series" ? normalizeSeriesPayload : normalizeMoviePayload;

  return source
    .map(normalize)
    .filter((item) => item.title)
    .slice(0, Math.min(Math.max(fallbackCount, 3), 5));
}

function getGeminiErrorMessage(error) {
  const statusCode = error?.status;
  const detailedMessage = error?.errorDetails?.find((detail) => detail?.message)?.message;

  if (statusCode === 429) {
    return "Gemini quota exceeded. Check your billing or rate limits, then try again.";
  }

  if (detailedMessage) {
    return detailedMessage;
  }

  if (statusCode === 404) {
    return `The Gemini model "${GEMINI_MODEL}" is unavailable for this API key. Try another supported model.`;
  }

  if (statusCode === 403) {
    return "Gemini API access was denied. Check that the API is enabled, billing is active, and your key has access.";
  }

  return error?.message || "Failed to fetch recommendations from Gemini.";
}

async function generateStructuredJson(prompt, options = {}) {
  const retries = options.retries ?? 1;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    });

    const rawText = result.response.text();
    const jsonCandidate = extractLikelyJson(rawText);

    try {
      return JSON.parse(jsonCandidate);
    } catch (error) {
      if (attempt === retries) {
        throw new Error("The AI returned invalid JSON after retrying.");
      }
    }
  }

  throw new Error("The AI returned an empty response.");
}

function buildRecommendationPrompt({ mediaType, mode, mood, title, count }) {
  const isSeries = mediaType === "series";
  const itemLabel = isSeries ? "web series" : "movies";
  const subjectLine =
    mode === "similar"
      ? `Recommend ${count} ${itemLabel} similar to "${title}".`
      : `Recommend ${count} ${itemLabel} for this mood: "${mood}".`;

  const shape = isSeries
    ? `[
  {
    "title": "",
    "seasons": "",
    "episodes": "",
    "rating": "",
    "desc": "",
    "cast": ["", ""],
    "platform": "",
    "status": "Completed/Ongoing",
    "reason": ""
  }
]`
    : `[
  {
    "title": "",
    "year": "",
    "rating": "",
    "desc": "",
    "director": "",
    "cast": ["", ""],
    "runtime": "",
    "streaming": "",
    "reason": ""
  }
]`;

  return `Return ONLY valid JSON. No markdown. No explanation.

Output must be a JSON array with exactly ${count} ${isSeries ? "web series" : "movie"} objects.

Format:
${shape}

Rules:
- Return real ${itemLabel} only.
- Keep descriptions concise and beginner-friendly.
- "reason" must explain why the recommendation fits the mood or similarity request.
- Prefer well-known, accessible streaming/platform suggestions when possible.
- No duplicate titles.

${subjectLine}`;
}

function buildDiscoveryPrompt() {
  return `Return ONLY valid JSON. No markdown. No explanation.

Format:
{
  "movieOfDay": {
    "title": "",
    "year": "",
    "rating": "",
    "desc": "",
    "director": "",
    "cast": ["", ""],
    "runtime": "",
    "streaming": "",
    "reason": ""
  },
  "seriesOfDay": {
    "title": "",
    "seasons": "",
    "episodes": "",
    "rating": "",
    "desc": "",
    "cast": ["", ""],
    "platform": "",
    "status": "Completed/Ongoing",
    "reason": ""
  },
  "trendingMovies": [
    {
      "title": "",
      "year": "",
      "rating": "",
      "desc": "",
      "director": "",
      "cast": ["", ""],
      "runtime": "",
      "streaming": "",
      "reason": ""
    }
  ],
  "trendingSeries": [
    {
      "title": "",
      "seasons": "",
      "episodes": "",
      "rating": "",
      "desc": "",
      "cast": ["", ""],
      "platform": "",
      "status": "Completed/Ongoing",
      "reason": ""
    }
  ]
}

Rules:
- Return exactly 4 trending movies and 4 trending series.
- Movie of the Day should feel widely appealing tonight.
- Series of the Day should be binge-worthy and distinct from the movie pick.
- Keep all descriptions concise and all reasons useful.`;
}

app.post("/api/movie", async (req, res) => {
  const mode = String(req.body?.mode || "mood").trim().toLowerCase();
  const mediaType = String(req.body?.mediaType || "movie").trim().toLowerCase() === "series" ? "series" : "movie";
  const mood = String(req.body?.mood || "").trim();
  const title = String(req.body?.title || "").trim();
  const count = Math.min(Math.max(Number(req.body?.count) || 4, 3), 5);

  if (!mood && !title) {
    return res.status(400).json({ error: "Please enter a mood or title first." });
  }

  if (!model) {
    return res.status(500).json({
      error: "Gemini API key is missing. Add GEMINI_API_KEY to your .env file.",
    });
  }

  try {
    const prompt = buildRecommendationPrompt({ mediaType, mode, mood, title, count });
    const parsed = await generateStructuredJson(prompt, { retries: 1 });
    const items = normalizeMediaList(parsed, mediaType, count);

    if (items.length < 3) {
      return res.status(502).json({
        error: "The AI returned too few recommendations. Please try again.",
      });
    }

    return res.json(items);
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({
      error: getGeminiErrorMessage(error),
    });
  }
});

app.post("/api/discovery", async (req, res) => {
  if (!model) {
    return res.status(500).json({
      error: "Gemini API key is missing. Add GEMINI_API_KEY to your .env file.",
    });
  }

  try {
    const parsed = await generateStructuredJson(buildDiscoveryPrompt(), { retries: 1 });

    return res.json({
      movieOfDay: normalizeMoviePayload(parsed?.movieOfDay),
      seriesOfDay: normalizeSeriesPayload(parsed?.seriesOfDay),
      trendingMovies: normalizeMediaList(parsed?.trendingMovies, "movie", 4),
      trendingSeries: normalizeMediaList(parsed?.trendingSeries, "series", 4),
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({
      error: getGeminiErrorMessage(error),
    });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`CineMind AI is running at http://localhost:${PORT}`);
});
