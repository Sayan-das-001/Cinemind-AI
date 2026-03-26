const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
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

function normalizeMoviePayload(payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};

  const cast = Array.isArray(safePayload.cast)
    ? safePayload.cast
        .filter((person) => typeof person === "string" && person.trim())
        .slice(0, 5)
    : [];

  return {
    title: String(safePayload.title || "").trim(),
    year: String(safePayload.year || "").trim(),
    rating: String(safePayload.rating || "").trim(),
    desc: String(safePayload.desc || "").trim(),
    director: String(safePayload.director || "").trim(),
    cast,
    runtime: String(safePayload.runtime || "").trim(),
    streaming: String(safePayload.streaming || "").trim(),
    reason: String(safePayload.reason || "").trim(),
  };
}

function normalizeMovieList(payload, fallbackCount = 4) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.movies)
      ? payload.movies
      : payload
        ? [payload]
        : [];

  return source
    .map(normalizeMoviePayload)
    .filter((movie) => movie.title)
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

  return error?.message || "Failed to fetch a movie recommendation from Gemini.";
}

async function generateStructuredJson(prompt, options = {}) {
  const retries = options.retries ?? 1;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await model.generateContent(prompt);
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

function buildMoviePrompt({ mode, mood, title, count }) {
  const subjectLine =
    mode === "similar"
      ? `Recommend ${count} movies similar to "${title}".`
      : `Recommend ${count} movies for this mood: "${mood}".`;

  return `Return ONLY valid JSON. No markdown. No explanation.

Output must be a JSON array with ${count} movie objects.

Format:
[
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
]

Rules:
- Return exactly ${count} movies.
- Keep descriptions concise and clear.
- "reason" must explain why the movie matches the mood or why it is similar.
- Use real movies only.
- Keep streaming suggestions practical but brief.

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
  "trending": [
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
  ]
}

Rules:
- Return 4 trending movies.
- Movie of the Day should feel broadly appealing today.
- Keep descriptions concise and reasons helpful.`;
}

app.post("/api/movie", async (req, res) => {
  const mode = String(req.body?.mode || "mood").trim().toLowerCase();
  const mood = String(req.body?.mood || "").trim();
  const title = String(req.body?.title || "").trim();
  const count = Math.min(Math.max(Number(req.body?.count) || 4, 3), 5);

  if (!mood && !title) {
    return res.status(400).json({ error: "Please enter a mood or movie title first." });
  }

  if (!model) {
    return res.status(500).json({
      error: "Gemini API key is missing. Add GEMINI_API_KEY to your .env file.",
    });
  }

  try {
    const prompt = buildMoviePrompt({ mode, mood, title, count });
    const parsed = await generateStructuredJson(prompt, { retries: 1 });
    const movies = normalizeMovieList(parsed, count);

    if (movies.length < 3) {
      return res.status(502).json({
        error: "The AI returned too few movie recommendations. Please try again.",
      });
    }

    return res.json(movies);
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
      trending: normalizeMovieList(parsed?.trending || parsed?.movies || [], 4),
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
