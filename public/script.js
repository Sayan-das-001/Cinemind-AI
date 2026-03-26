const moodInput = document.getElementById("moodInput");
const findMovieBtn = document.getElementById("findMovieBtn");
const surpriseBtn = document.getElementById("surpriseBtn");
const loading = document.getElementById("loading");
const skeletonGrid = document.getElementById("skeletonGrid");
const statusMessage = document.getElementById("statusMessage");
const resultsGrid = document.getElementById("resultsGrid");
const emptyState = document.getElementById("emptyState");
const genreButtons = document.getElementById("genreButtons");
const recentSearches = document.getElementById("recentSearches");
const recentCount = document.getElementById("recentCount");
const favoritesPanel = document.getElementById("favoritesPanel");
const favoritesCount = document.getElementById("favoritesCount");
const favoritesBadge = document.getElementById("favoritesBadge");
const toggleFavoritesBtn = document.getElementById("toggleFavoritesBtn");
const exportFavoritesBtn = document.getElementById("exportFavoritesBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const movieOfDayCard = document.getElementById("movieOfDayCard");
const trendingGrid = document.getElementById("trendingGrid");
const refreshDiscoveryBtn = document.getElementById("refreshDiscoveryBtn");
const toastContainer = document.getElementById("toastContainer");

const FAVORITES_KEY = "cinemind-favorites";
const RECENT_KEY = "cinemind-recent-searches";
const moodPresets = [
  "cozy rainy evening",
  "chaotic fun with friends",
  "hopeful and inspired",
  "nostalgic weekend",
  "late-night thriller energy",
  "heartbroken but healing",
  "mind-bending sci-fi mood",
  "feel-good family night",
  "romantic city lights vibe",
  "adrenaline-fueled action binge",
];
const genrePresets = [
  "Sci-Fi",
  "Thriller",
  "Romance",
  "Comedy",
  "Animation",
  "Action",
  "Drama",
  "Fantasy",
];

const state = {
  results: [],
  favorites: loadStorage(FAVORITES_KEY, []),
  recent: loadStorage(RECENT_KEY, []),
  activeMovieKey: null,
  favoritesVisible: true,
  movieOfDay: null,
  trending: [],
};

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function getMovieKey(movie) {
  return `${movie.title || "unknown"}::${movie.year || ""}`.toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = `mt-4 min-h-6 text-sm ${isError ? "text-rose-300" : "text-slate-300"}`;
}

function setLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
  findMovieBtn.disabled = isLoading;
  surpriseBtn.disabled = isLoading;
  moodInput.disabled = isLoading;

  if (isLoading) {
    skeletonGrid.innerHTML = Array.from({ length: 4 }, () => createSkeletonCard()).join("");
  } else {
    skeletonGrid.innerHTML = "";
  }
}

function createSkeletonCard() {
  return `
    <article class="skeleton-card rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <div class="skeleton-line h-3 w-24 rounded-full"></div>
      <div class="skeleton-line mt-4 h-8 w-3/4 rounded-full"></div>
      <div class="skeleton-line mt-4 h-20 w-full rounded-2xl"></div>
      <div class="mt-5 grid gap-3 sm:grid-cols-2">
        <div class="skeleton-line h-16 rounded-2xl"></div>
        <div class="skeleton-line h-16 rounded-2xl"></div>
      </div>
      <div class="mt-5 flex gap-2">
        <div class="skeleton-line h-10 flex-1 rounded-xl"></div>
        <div class="skeleton-line h-10 flex-1 rounded-xl"></div>
      </div>
    </article>
  `;
}

function showToast(message, type = "info") {
  const tone = {
    info: "border-sky-300/20 bg-slate-900/90 text-slate-100",
    success: "border-emerald-300/20 bg-emerald-950/85 text-emerald-100",
    error: "border-rose-300/20 bg-rose-950/85 text-rose-100",
  };

  const toast = document.createElement("div");
  toast.className = `toast pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg ${tone[type] || tone.info}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("toast-exit");
    window.setTimeout(() => toast.remove(), 260);
  }, 2800);
}

function updateRecentSearches(mood) {
  const normalized = mood.trim();
  if (!normalized) {
    return;
  }

  state.recent = [normalized, ...state.recent.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
  saveStorage(RECENT_KEY, state.recent);
  renderRecentSearches();
}

function renderRecentSearches() {
  recentCount.textContent = String(state.recent.length);
  recentSearches.innerHTML = state.recent.length
    ? state.recent
        .map(
          (entry) => `
            <button class="chip-button" data-recent-search="${escapeHtml(entry)}">${escapeHtml(entry)}</button>
          `
        )
        .join("")
    : '<span class="text-sm text-slate-500">No recent moods yet.</span>';
}

function isFavorite(movie) {
  return state.favorites.some((entry) => getMovieKey(entry) === getMovieKey(movie));
}

function toggleFavorite(movie) {
  const exists = isFavorite(movie);

  if (exists) {
    state.favorites = state.favorites.filter((entry) => getMovieKey(entry) !== getMovieKey(movie));
    showToast(`Removed ${movie.title} from My List.`, "info");
  } else {
    state.favorites = [movie, ...state.favorites];
    showToast(`Added ${movie.title} to My List.`, "success");
  }

  saveStorage(FAVORITES_KEY, state.favorites);
  renderFavorites();
  renderResults();
  if (state.movieOfDay && getMovieKey(state.movieOfDay) === getMovieKey(movie)) {
    renderMovieOfDay(state.movieOfDay);
  }
}

function renderFavorites() {
  favoritesCount.textContent = String(state.favorites.length);
  favoritesBadge.textContent = String(state.favorites.length);
  favoritesPanel.classList.toggle("hidden", !state.favoritesVisible);

  favoritesPanel.innerHTML = state.favorites.length
    ? state.favorites
        .map((movie) => {
          const movieKey = getMovieKey(movie);

          return `
            <article class="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.24em] text-orange-200">${escapeHtml(movie.year || "Year N/A")}</p>
                  <h3 class="mt-2 text-lg font-semibold text-white">${escapeHtml(movie.title)}</h3>
                </div>
                <button class="icon-action" data-remove-favorite="${movieKey}">Remove</button>
              </div>
              <p class="mt-3 text-sm text-slate-300">${escapeHtml(movie.reason || movie.desc || "Saved for later.")}</p>
            </article>
          `;
        })
        .join("")
    : '<div class="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">Save movies you love and they will show up here.</div>';
}

function exportFavorites() {
  if (!state.favorites.length) {
    showToast("Add a few movies before exporting your favorites.", "error");
    return;
  }

  const blob = new Blob([JSON.stringify(state.favorites, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cinemind-favorites.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Favorites exported as JSON.", "success");
}

function createMovieCard(movie, options = {}) {
  const movieKey = getMovieKey(movie);
  const favoriteLabel = isFavorite(movie) ? "Saved" : "Add to Favorites";
  const castText = Array.isArray(movie.cast) && movie.cast.length ? movie.cast.join(", ") : "Not available";
  const compact = options.compact ? "compact-card" : "";

  return `
    <article class="movie-card ${compact} rounded-[1.6rem] border border-white/10 bg-slate-950/35 p-5" data-movie-key="${movieKey}">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-orange-200">${escapeHtml(movie.year || "Year N/A")} | ${escapeHtml(movie.rating || "Rating N/A")}</p>
          <h3 class="mt-3 text-2xl font-semibold text-white">${escapeHtml(movie.title || "Unknown title")}</h3>
        </div>
        <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">${escapeHtml(movie.runtime || "Runtime N/A")}</span>
      </div>

      <p class="mt-4 text-sm leading-7 text-slate-200">${escapeHtml(movie.desc || "No description available.")}</p>
      <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.22em] text-sky-200">Why it fits</p>
        <p class="mt-2 text-sm text-slate-200">${escapeHtml(movie.reason || "A strong fit for this vibe.")}</p>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Director</p>
          <p class="mt-2 text-sm text-white">${escapeHtml(movie.director || "Not available")}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Cast</p>
          <p class="mt-2 text-sm text-white">${escapeHtml(castText)}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Streaming</p>
          <p class="mt-2 text-sm text-white">${escapeHtml(movie.streaming || "Not available")}</p>
        </div>
        <button class="icon-action ${isFavorite(movie) ? "icon-action-active" : ""}" data-toggle-favorite="${movieKey}">
          ${favoriteLabel}
        </button>
      </div>

      <div class="mt-4 grid gap-2 sm:grid-cols-3">
        <button class="action-button" data-more-like-this="${escapeHtml(movie.title)}">More Like This</button>
        <button class="action-button" data-watch-trailer="${escapeHtml(movie.title)}">Watch Trailer</button>
        <button class="action-button" data-make-active="${movieKey}">Focus Card</button>
      </div>
    </article>
  `;
}

function renderResults() {
  if (!state.results.length) {
    resultsGrid.innerHTML = "";
    resultsGrid.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  resultsGrid.classList.remove("hidden");
  resultsGrid.innerHTML = state.results.map((movie) => createMovieCard(movie)).join("");
}

function renderMovieOfDay(movie) {
  state.movieOfDay = movie?.title ? movie : null;

  if (!movie?.title) {
    movieOfDayCard.innerHTML = '<div class="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">Movie of the Day is taking a coffee break. Refresh to try again.</div>';
    return;
  }

  movieOfDayCard.innerHTML = createMovieCard(movie, { compact: true });
}

function renderTrending(movies) {
  state.trending = Array.isArray(movies) ? movies : [];
  trendingGrid.innerHTML = Array.isArray(movies) && movies.length
    ? movies
        .map(
          (movie) => `
            <button class="trend-item text-left" data-trending-title="${escapeHtml(movie.title)}">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-emerald-200">${escapeHtml(movie.year || "Year N/A")}</p>
                <h3 class="mt-2 text-lg font-semibold text-white">${escapeHtml(movie.title)}</h3>
              </div>
              <p class="mt-2 text-sm text-slate-300">${escapeHtml(movie.reason || movie.desc || "Popular for the moment.")}</p>
            </button>
          `
        )
        .join("")
    : '<div class="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">Trending titles will appear here once discovery loads.</div>';
}

async function fetchJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });

  const rawText = await response.text();
  const data = safeParseJson(rawText);

  if (!data) {
    throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

async function requestRecommendations({ mood, mode = "mood", title = "" }) {
  const query = (mode === "similar" ? title : mood).trim();

  if (!query) {
    setStatus("Please enter a mood before searching.", true);
    showToast("Please enter a mood before searching.", "error");
    moodInput.focus();
    return;
  }

  setLoading(true);
  setStatus(mode === "similar" ? `Finding movies like ${title}...` : "CineMind AI is building your watchlist...");

  try {
    const movies = await fetchJson("/api/movie", {
      mood,
      mode,
      title,
      count: 4,
    });

    state.results = Array.isArray(movies) ? movies : [];
    state.activeMovieKey = state.results[0] ? getMovieKey(state.results[0]) : null;

    if (mode !== "similar") {
      updateRecentSearches(mood);
    }

    renderResults();
    renderFavorites();
    setStatus(mode === "similar" ? `Because you liked ${title}.` : `Found ${state.results.length} movies for "${mood}".`);
    showToast(mode === "similar" ? `More movies like ${title}.` : "Fresh recommendations are ready.", "success");
  } catch (error) {
    state.results = [];
    renderResults();
    setStatus(error.message || "Unable to fetch recommendations right now.", true);
    showToast(error.message || "Unable to fetch recommendations right now.", "error");
  } finally {
    setLoading(false);
  }
}

async function loadDiscovery() {
  movieOfDayCard.innerHTML = createSkeletonCard();
  trendingGrid.innerHTML = Array.from({ length: 3 }, () => '<div class="skeleton-line h-28 rounded-[1.4rem]"></div>').join("");

  try {
    const data = await fetchJson("/api/discovery", {});
    renderMovieOfDay(data.movieOfDay);
    renderTrending(data.trending);
  } catch (error) {
    renderMovieOfDay(null);
    renderTrending([]);
    showToast(error.message || "Unable to load discovery features right now.", "error");
  }
}

function chooseRandomMood() {
  const nextMood = moodPresets[Math.floor(Math.random() * moodPresets.length)];
  moodInput.value = nextMood;
  return nextMood;
}

function resetView() {
  moodInput.value = "";
  state.results = [];
  state.activeMovieKey = null;
  renderResults();
  setStatus("View reset. Try another mood, recent search, or genre chip.");
}

function buildGenreButtons() {
  genreButtons.innerHTML = genrePresets
    .map(
      (genre) => `
        <button class="chip-button" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>
      `
    )
    .join("");
}

function toggleActiveFavorite() {
  const fallbackMovie = state.results[0];
  const activeMovie = state.results.find((movie) => getMovieKey(movie) === state.activeMovieKey) || fallbackMovie;

  if (!activeMovie) {
    showToast("Search for a movie set first, then press F.", "error");
    return;
  }

  toggleFavorite(activeMovie);
}

function openTrailer(title) {
  const query = encodeURIComponent(`${title} trailer`);
  window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank", "noopener");
}

function bindGlobalEvents() {
  findMovieBtn.addEventListener("click", () => {
    requestRecommendations({ mood: moodInput.value.trim() });
  });

  surpriseBtn.addEventListener("click", () => {
    const mood = chooseRandomMood();
    showToast(`Surprise mood: ${mood}`, "info");
    requestRecommendations({ mood });
  });

  toggleFavoritesBtn.addEventListener("click", () => {
    state.favoritesVisible = !state.favoritesVisible;
    renderFavorites();
  });

  exportFavoritesBtn.addEventListener("click", exportFavorites);
  clearSearchBtn.addEventListener("click", resetView);
  refreshDiscoveryBtn.addEventListener("click", loadDiscovery);

  moodInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      requestRecommendations({ mood: moodInput.value.trim() });
    }
  });

  document.addEventListener("click", (event) => {
    const recentButton = event.target.closest("[data-recent-search]");
    if (recentButton) {
      const mood = recentButton.dataset.recentSearch;
      moodInput.value = mood;
      requestRecommendations({ mood });
      return;
    }

    const genreButton = event.target.closest("[data-genre]");
    if (genreButton) {
      const mood = `${genreButton.dataset.genre.toLowerCase()} movie night`;
      moodInput.value = mood;
      requestRecommendations({ mood });
      return;
    }

    const favoriteButton = event.target.closest("[data-toggle-favorite]");
    if (favoriteButton) {
      const movie =
        state.results.find((entry) => getMovieKey(entry) === favoriteButton.dataset.toggleFavorite) ||
        (state.movieOfDay && getMovieKey(state.movieOfDay) === favoriteButton.dataset.toggleFavorite ? state.movieOfDay : null);
      if (movie) {
        toggleFavorite(movie);
      }
      return;
    }

    const removeFavoriteButton = event.target.closest("[data-remove-favorite]");
    if (removeFavoriteButton) {
      const movie = state.favorites.find((entry) => getMovieKey(entry) === removeFavoriteButton.dataset.removeFavorite);
      if (movie) {
        toggleFavorite(movie);
      }
      return;
    }

    const moreLikeThisButton = event.target.closest("[data-more-like-this]");
    if (moreLikeThisButton) {
      const title = moreLikeThisButton.dataset.moreLikeThis;
      moodInput.value = `Movies like ${title}`;
      requestRecommendations({ mode: "similar", title, mood: `Movies like ${title}` });
      return;
    }

    const trailerButton = event.target.closest("[data-watch-trailer]");
    if (trailerButton) {
      openTrailer(trailerButton.dataset.watchTrailer);
      return;
    }

    const activeButton = event.target.closest("[data-make-active]");
    if (activeButton) {
      state.activeMovieKey = activeButton.dataset.makeActive;
      showToast("Active movie updated for keyboard favorite toggle.", "info");
      return;
    }

    const trendButton = event.target.closest("[data-trending-title]");
    if (trendButton) {
      const title = trendButton.dataset.trendingTitle;
      moodInput.value = `Movies like ${title}`;
      requestRecommendations({ mode: "similar", title, mood: `Movies like ${title}` });
    }
  });

  document.addEventListener("keydown", (event) => {
    const targetTag = document.activeElement?.tagName;
    const isTyping = targetTag === "INPUT" || targetTag === "TEXTAREA";

    if (event.key === "/") {
      event.preventDefault();
      moodInput.focus();
      return;
    }

    if (event.key === "Escape") {
      resetView();
      return;
    }

    if (isTyping) {
      return;
    }

    if (event.key.toLowerCase() === "r") {
      const mood = chooseRandomMood();
      requestRecommendations({ mood });
      return;
    }

    if (event.key.toLowerCase() === "f") {
      toggleActiveFavorite();
    }
  });
}

function init() {
  buildGenreButtons();
  renderRecentSearches();
  renderFavorites();
  renderResults();
  loadDiscovery();
  bindGlobalEvents();
  setStatus("Pick a mood, use Surprise Me, or browse discovery.");
}

init();
