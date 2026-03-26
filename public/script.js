const moodInput = document.getElementById("moodInput");
const findMovieBtn = document.getElementById("findMovieBtn");
const surpriseBtn = document.getElementById("surpriseBtn");
const loading = document.getElementById("loading");
const skeletonGrid = document.getElementById("skeletonGrid");
const statusMessage = document.getElementById("statusMessage");
const resultsGrid = document.getElementById("resultsGrid");
const emptyState = document.getElementById("emptyState");
const resultsEyebrow = document.getElementById("resultsEyebrow");
const resultsHeading = document.getElementById("resultsHeading");
const genreButtons = document.getElementById("genreButtons");
const recentSearches = document.getElementById("recentSearches");
const recentCount = document.getElementById("recentCount");
const movieFavoritesCount = document.getElementById("movieFavoritesCount");
const seriesFavoritesCount = document.getElementById("seriesFavoritesCount");
const favoritesPanel = document.getElementById("favoritesPanel");
const favoritesBadge = document.getElementById("favoritesBadge");
const toggleFavoritesBtn = document.getElementById("toggleFavoritesBtn");
const exportFavoritesBtn = document.getElementById("exportFavoritesBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const movieOfDayCard = document.getElementById("movieOfDayCard");
const seriesOfDayCard = document.getElementById("seriesOfDayCard");
const trendingMoviesGrid = document.getElementById("trendingMoviesGrid");
const trendingSeriesGrid = document.getElementById("trendingSeriesGrid");
const refreshDiscoveryBtn = document.getElementById("refreshDiscoveryBtn");
const toastContainer = document.getElementById("toastContainer");

const MOVIE_MODE_BTN = document.getElementById("movieModeBtn");
const SERIES_MODE_BTN = document.getElementById("seriesModeBtn");
const FAVORITES_MOVIE_TAB = document.getElementById("favoritesMovieTab");
const FAVORITES_SERIES_TAB = document.getElementById("favoritesSeriesTab");

const FAVORITES_KEY = "cinemind-favorites-v2";
const RECENT_KEY = "cinemind-recent-searches-v2";

const moodPresets = {
  movie: [
    "cozy rainy evening",
    "late-night thriller energy",
    "feel-good family night",
    "romantic city lights vibe",
    "adrenaline-fueled action binge",
    "thought-provoking sci-fi mood",
  ],
  series: [
    "weekend binge mode",
    "slow-burn mystery marathon",
    "comfort show rewatch energy",
    "dark prestige drama mood",
    "light funny background vibe",
    "edge-of-your-seat episodic suspense",
  ],
};

const genrePresets = {
  movie: ["Sci-Fi", "Thriller", "Romance", "Comedy", "Animation", "Action", "Drama", "Fantasy"],
  series: ["Crime", "Mystery", "Sitcom", "Anime", "Fantasy", "Sci-Fi", "Drama", "Reality"],
};

const defaultFavorites = {
  movie: [],
  series: [],
};

const state = {
  mediaType: "movie",
  favoritesView: "movie",
  favoritesVisible: true,
  results: [],
  recent: loadStorage(RECENT_KEY, []),
  favorites: normalizeFavorites(loadStorage(FAVORITES_KEY, defaultFavorites)),
  activeItemKey: null,
  discovery: {
    movieOfDay: null,
    seriesOfDay: null,
    trendingMovies: [],
    trendingSeries: [],
  },
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

function normalizeFavorites(value) {
  const safe = value && typeof value === "object" ? value : {};
  return {
    movie: Array.isArray(safe.movie) ? safe.movie : [],
    series: Array.isArray(safe.series) ? safe.series : [],
  };
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMediaType(item) {
  return item?.mediaType === "series" ? "series" : "movie";
}

function getItemKey(item) {
  const mediaType = getMediaType(item);
  const suffix = mediaType === "series" ? item.seasons || item.status || "" : item.year || "";
  return `${mediaType}::${item.title || "unknown"}::${suffix}`.toLowerCase();
}

function getFavoritesBucket(mediaType) {
  return state.favorites[mediaType];
}

function isFavorite(item) {
  const mediaType = getMediaType(item);
  return getFavoritesBucket(mediaType).some((entry) => getItemKey(entry) === getItemKey(item));
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = `mt-4 min-h-6 text-sm ${isError ? "text-rose-300" : "text-slate-300"}`;
}

function updateResultsHeader() {
  const label = state.mediaType === "series" ? "Series" : "Movie";
  resultsEyebrow.textContent = `${label} Results`;
  resultsHeading.textContent = state.mediaType === "series" ? "Your next binge starts here" : "Your tailored watchlist";
  findMovieBtn.textContent = state.mediaType === "series" ? "Find Series" : "Find Picks";
}

function setLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
  findMovieBtn.disabled = isLoading;
  surpriseBtn.disabled = isLoading;
  moodInput.disabled = isLoading;
  MOVIE_MODE_BTN.disabled = isLoading;
  SERIES_MODE_BTN.disabled = isLoading;

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

function updateRecentSearches(entry) {
  const normalized = entry.trim();
  if (!normalized) {
    return;
  }

  state.recent = [normalized, ...state.recent.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
  saveStorage(RECENT_KEY, state.recent);
  renderRecentSearches();
}

function renderRecentSearches() {
  recentCount.textContent = String(state.recent.length);
  recentSearches.innerHTML = state.recent.length
    ? state.recent
        .map((entry) => {
          const [mediaType, mood] = entry.includes("::") ? entry.split("::") : [state.mediaType, entry];
          return `<button class="chip-button" data-recent-search="${escapeHtml(entry)}">${escapeHtml(
            `${mediaType === "series" ? "Series" : "Movies"}: ${mood}`
          )}</button>`;
        })
        .join("")
    : '<span class="text-sm text-slate-500">No recent moods yet.</span>';
}

function toggleFavorite(item) {
  const mediaType = getMediaType(item);
  const bucket = getFavoritesBucket(mediaType);
  const exists = bucket.some((entry) => getItemKey(entry) === getItemKey(item));

  if (exists) {
    state.favorites[mediaType] = bucket.filter((entry) => getItemKey(entry) !== getItemKey(item));
    showToast(`Removed ${item.title} from ${mediaType === "series" ? "favorite series" : "favorite movies"}.`, "info");
  } else {
    state.favorites[mediaType] = [item, ...bucket];
    showToast(`Added ${item.title} to ${mediaType === "series" ? "favorite series" : "favorite movies"}.`, "success");
  }

  saveStorage(FAVORITES_KEY, state.favorites);
  renderFavorites();
  renderResults();
  renderDiscoveryCards();
}

function renderFavorites() {
  movieFavoritesCount.textContent = String(state.favorites.movie.length);
  seriesFavoritesCount.textContent = String(state.favorites.series.length);
  favoritesBadge.textContent = String(state.favorites.movie.length + state.favorites.series.length);
  favoritesPanel.classList.toggle("hidden", !state.favoritesVisible);

  const favorites = getFavoritesBucket(state.favoritesView);
  favoritesPanel.innerHTML = favorites.length
    ? favorites
        .map(
          (item) => `
            <article class="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.24em] ${getMediaType(item) === "series" ? "text-emerald-200" : "text-orange-200"}">${escapeHtml(
                    getMediaType(item) === "series" ? item.status || "Series" : item.year || "Movie"
                  )}</p>
                  <h3 class="mt-2 text-lg font-semibold text-white">${escapeHtml(item.title)}</h3>
                </div>
                <button class="icon-action" data-remove-favorite="${getItemKey(item)}">Remove</button>
              </div>
              <p class="mt-3 text-sm text-slate-300">${escapeHtml(item.reason || item.desc || "Saved for later.")}</p>
            </article>
          `
        )
        .join("")
    : `<div class="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">Save ${
        state.favoritesView === "series" ? "web series" : "movies"
      } and they will appear here.</div>`;

  FAVORITES_MOVIE_TAB.classList.toggle("favorites-tab-active", state.favoritesView === "movie");
  FAVORITES_SERIES_TAB.classList.toggle("favorites-tab-active", state.favoritesView === "series");
}

function exportFavorites() {
  if (!state.favorites.movie.length && !state.favorites.series.length) {
    showToast("Add a few favorites before exporting your list.", "error");
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

function buildMetaLine(item) {
  if (getMediaType(item) === "series") {
    return `${item.seasons || "Seasons N/A"} | ${item.episodes || "Episodes N/A"} | ${item.rating || "Rating N/A"}`;
  }

  return `${item.year || "Year N/A"} | ${item.rating || "Rating N/A"}`;
}

function buildSupportPanels(item) {
  if (getMediaType(item) === "series") {
    return `
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Cast</p>
          <p class="mt-2 text-sm text-white">${escapeHtml(item.cast?.join(", ") || "Not available")}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
          <p class="mt-2 text-sm text-white">${escapeHtml(item.status || "Not available")}</p>
        </div>
      </div>
      <div class="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Platform</p>
          <p class="mt-2 text-sm text-white">${escapeHtml(item.platform || "Not available")}</p>
        </div>
        <button class="icon-action ${isFavorite(item) ? "icon-action-active" : ""}" data-toggle-favorite="${getItemKey(item)}">
          ${isFavorite(item) ? "Saved" : "Add to Favorites"}
        </button>
      </div>
    `;
  }

  return `
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Director</p>
        <p class="mt-2 text-sm text-white">${escapeHtml(item.director || "Not available")}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Cast</p>
        <p class="mt-2 text-sm text-white">${escapeHtml(item.cast?.join(", ") || "Not available")}</p>
      </div>
    </div>
    <div class="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Streaming</p>
        <p class="mt-2 text-sm text-white">${escapeHtml(item.streaming || "Not available")}</p>
      </div>
      <button class="icon-action ${isFavorite(item) ? "icon-action-active" : ""}" data-toggle-favorite="${getItemKey(item)}">
        ${isFavorite(item) ? "Saved" : "Add to Favorites"}
      </button>
    </div>
  `;
}

function createMediaCard(item, options = {}) {
  const compact = options.compact ? "compact-card" : "";
  const tone = getMediaType(item) === "series" ? "text-emerald-200" : "text-orange-200";
  const moreLikeLabel = getMediaType(item) === "series" ? "More Like This" : "More Like This";

  return `
    <article class="movie-card ${compact} rounded-[1.6rem] border border-white/10 bg-slate-950/35 p-5" data-item-key="${getItemKey(item)}">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] ${tone}">${escapeHtml(buildMetaLine(item))}</p>
          <h3 class="mt-3 text-2xl font-semibold text-white">${escapeHtml(item.title || "Unknown title")}</h3>
        </div>
        <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">${escapeHtml(
          getMediaType(item) === "series" ? item.platform || "Platform N/A" : item.runtime || "Runtime N/A"
        )}</span>
      </div>

      <p class="mt-4 text-sm leading-7 text-slate-200">${escapeHtml(item.desc || "No description available.")}</p>
      <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.22em] ${getMediaType(item) === "series" ? "text-emerald-200" : "text-sky-200"}">Why it fits</p>
        <p class="mt-2 text-sm text-slate-200">${escapeHtml(item.reason || "A strong fit for this vibe.")}</p>
      </div>

      ${buildSupportPanels(item)}

      <div class="mt-4 grid gap-2 sm:grid-cols-3">
        <button class="action-button" data-more-like-this="${escapeHtml(item.title)}" data-more-like-type="${getMediaType(item)}">${moreLikeLabel}</button>
        <button class="action-button" data-watch-trailer="${escapeHtml(item.title)}">Watch Trailer</button>
        <button class="action-button" data-make-active="${getItemKey(item)}">Focus Card</button>
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
  resultsGrid.innerHTML = state.results.map((item) => createMediaCard(item)).join("");
}

function renderDiscoveryCards() {
  movieOfDayCard.innerHTML = state.discovery.movieOfDay?.title
    ? createMediaCard(state.discovery.movieOfDay, { compact: true })
    : '<div class="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">Movie of the Day is unavailable right now.</div>';

  seriesOfDayCard.innerHTML = state.discovery.seriesOfDay?.title
    ? createMediaCard(state.discovery.seriesOfDay, { compact: true })
    : '<div class="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">Series of the Day is unavailable right now.</div>';

  trendingMoviesGrid.innerHTML = renderTrendingList(state.discovery.trendingMovies, "movie");
  trendingSeriesGrid.innerHTML = renderTrendingList(state.discovery.trendingSeries, "series");
}

function renderTrendingList(items, mediaType) {
  return Array.isArray(items) && items.length
    ? items
        .map(
          (item) => `
            <button class="trend-item text-left" data-trending-title="${escapeHtml(item.title)}" data-trending-type="${mediaType}">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] ${mediaType === "series" ? "text-emerald-200" : "text-orange-200"}">${escapeHtml(
                  mediaType === "series" ? item.status || "Series" : item.year || "Movie"
                )}</p>
                <h3 class="mt-2 text-lg font-semibold text-white">${escapeHtml(item.title)}</h3>
              </div>
              <p class="mt-2 text-sm text-slate-300">${escapeHtml(item.reason || item.desc || "Popular for the moment.")}</p>
            </button>
          `
        )
        .join("")
    : `<div class="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">Trending ${
        mediaType === "series" ? "series" : "movies"
      } will appear here once discovery loads.</div>`;
}

async function fetchJson(url, payload, retryCount = 1) {
  try {
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
  } catch (error) {
    if (retryCount > 0) {
      return fetchJson(url, payload, retryCount - 1);
    }

    throw error;
  }
}

function getPromptDescriptor(mediaType) {
  return mediaType === "series" ? "series" : "movies";
}

async function requestRecommendations({ mood, mode = "mood", title = "", mediaType = state.mediaType }) {
  const query = (mode === "similar" ? title : mood).trim();

  if (!query) {
    setStatus("Please enter a mood before searching.", true);
    showToast("Please enter a mood before searching.", "error");
    moodInput.focus();
    return;
  }

  state.mediaType = mediaType;
  syncModeTabs();
  updateResultsHeader();
  setLoading(true);
  setStatus(
    mode === "similar"
      ? `Finding ${getPromptDescriptor(mediaType)} like ${title}...`
      : `CineMind AI is building your ${mediaType === "series" ? "binge list" : "watchlist"}...`
  );

  try {
    const items = await fetchJson("/api/movie", {
      mood,
      mode,
      title,
      count: 4,
      mediaType,
    });

    state.results = Array.isArray(items) ? items : [];
    state.activeItemKey = state.results[0] ? getItemKey(state.results[0]) : null;

    if (mode !== "similar") {
      updateRecentSearches(`${mediaType}::${mood}`);
    }

    renderResults();
    renderFavorites();
    setStatus(
      mode === "similar"
        ? `Because you liked ${title}.`
        : `Found ${state.results.length} ${mediaType === "series" ? "series" : "movies"} for "${mood}".`
    );
    showToast("Fresh recommendations are ready.", "success");
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
  seriesOfDayCard.innerHTML = createSkeletonCard();
  trendingMoviesGrid.innerHTML = Array.from({ length: 2 }, () => '<div class="skeleton-line h-28 rounded-[1.4rem]"></div>').join("");
  trendingSeriesGrid.innerHTML = Array.from({ length: 2 }, () => '<div class="skeleton-line h-28 rounded-[1.4rem]"></div>').join("");

  try {
    const data = await fetchJson("/api/discovery", {}, 1);
    state.discovery.movieOfDay = data.movieOfDay || null;
    state.discovery.seriesOfDay = data.seriesOfDay || null;
    state.discovery.trendingMovies = Array.isArray(data.trendingMovies) ? data.trendingMovies : [];
    state.discovery.trendingSeries = Array.isArray(data.trendingSeries) ? data.trendingSeries : [];
    renderDiscoveryCards();
  } catch (error) {
    state.discovery.movieOfDay = null;
    state.discovery.seriesOfDay = null;
    state.discovery.trendingMovies = [];
    state.discovery.trendingSeries = [];
    renderDiscoveryCards();
    showToast(error.message || "Unable to load discovery features right now.", "error");
  }
}

function chooseRandomMood(mediaType = state.mediaType) {
  const presets = moodPresets[mediaType];
  const nextMood = presets[Math.floor(Math.random() * presets.length)];
  moodInput.value = nextMood;
  return nextMood;
}

function resetView() {
  moodInput.value = "";
  state.results = [];
  state.activeItemKey = null;
  renderResults();
  setStatus("View reset. Try another mood, recent search, or a trending pick.");
}

function buildGenreButtons() {
  genreButtons.innerHTML = genrePresets[state.mediaType]
    .map((genre) => `<button class="chip-button" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`)
    .join("");
}

function toggleActiveFavorite() {
  const fallbackItem = state.results[0];
  const activeItem = state.results.find((item) => getItemKey(item) === state.activeItemKey) || fallbackItem;

  if (!activeItem) {
    showToast(`Search for ${state.mediaType === "series" ? "series" : "movies"} first, then press F.`, "error");
    return;
  }

  toggleFavorite(activeItem);
}

function openTrailer(title) {
  const query = encodeURIComponent(`${title} trailer`);
  window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank", "noopener");
}

function syncModeTabs() {
  MOVIE_MODE_BTN.classList.toggle("mode-tab-active", state.mediaType === "movie");
  SERIES_MODE_BTN.classList.toggle("mode-tab-active", state.mediaType === "series");
  buildGenreButtons();
}

function getDiscoveryItemByKey(itemKey) {
  const allDiscoveryItems = [
    state.discovery.movieOfDay,
    state.discovery.seriesOfDay,
    ...state.discovery.trendingMovies,
    ...state.discovery.trendingSeries,
  ].filter(Boolean);

  return allDiscoveryItems.find((item) => getItemKey(item) === itemKey) || null;
}

function bindGlobalEvents() {
  findMovieBtn.addEventListener("click", () => {
    requestRecommendations({ mood: moodInput.value.trim(), mediaType: state.mediaType });
  });

  surpriseBtn.addEventListener("click", () => {
    const mood = chooseRandomMood(state.mediaType);
    showToast(`Surprise ${state.mediaType === "series" ? "series" : "movie"} mood: ${mood}`, "info");
    requestRecommendations({ mood, mediaType: state.mediaType });
  });

  MOVIE_MODE_BTN.addEventListener("click", () => {
    state.mediaType = "movie";
    syncModeTabs();
    updateResultsHeader();
    setStatus("Movie mode enabled. Search by mood or hit Surprise Me.");
  });

  SERIES_MODE_BTN.addEventListener("click", () => {
    state.mediaType = "series";
    syncModeTabs();
    updateResultsHeader();
    setStatus("Web Series mode enabled. Search by mood or hit Surprise Me.");
  });

  FAVORITES_MOVIE_TAB.addEventListener("click", () => {
    state.favoritesView = "movie";
    renderFavorites();
  });

  FAVORITES_SERIES_TAB.addEventListener("click", () => {
    state.favoritesView = "series";
    renderFavorites();
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
      requestRecommendations({ mood: moodInput.value.trim(), mediaType: state.mediaType });
    }
  });

  document.addEventListener("click", (event) => {
    const recentButton = event.target.closest("[data-recent-search]");
    if (recentButton) {
      const [mediaType, mood] = recentButton.dataset.recentSearch.split("::");
      state.mediaType = mediaType === "series" ? "series" : "movie";
      syncModeTabs();
      updateResultsHeader();
      moodInput.value = mood;
      requestRecommendations({ mood, mediaType: state.mediaType });
      return;
    }

    const genreButton = event.target.closest("[data-genre]");
    if (genreButton) {
      const mood = `${genreButton.dataset.genre.toLowerCase()} ${state.mediaType === "series" ? "series binge" : "movie night"}`;
      moodInput.value = mood;
      requestRecommendations({ mood, mediaType: state.mediaType });
      return;
    }

    const favoriteButton = event.target.closest("[data-toggle-favorite]");
    if (favoriteButton) {
      const itemKey = favoriteButton.dataset.toggleFavorite;
      const item =
        state.results.find((entry) => getItemKey(entry) === itemKey) ||
        getDiscoveryItemByKey(itemKey);
      if (item) {
        toggleFavorite(item);
      }
      return;
    }

    const removeFavoriteButton = event.target.closest("[data-remove-favorite]");
    if (removeFavoriteButton) {
      const item =
        state.favorites.movie.find((entry) => getItemKey(entry) === removeFavoriteButton.dataset.removeFavorite) ||
        state.favorites.series.find((entry) => getItemKey(entry) === removeFavoriteButton.dataset.removeFavorite);
      if (item) {
        toggleFavorite(item);
      }
      return;
    }

    const moreLikeThisButton = event.target.closest("[data-more-like-this]");
    if (moreLikeThisButton) {
      const title = moreLikeThisButton.dataset.moreLikeThis;
      const mediaType = moreLikeThisButton.dataset.moreLikeType === "series" ? "series" : "movie";
      state.mediaType = mediaType;
      syncModeTabs();
      updateResultsHeader();
      moodInput.value = `${mediaType === "series" ? "Series" : "Movies"} like ${title}`;
      requestRecommendations({
        mode: "similar",
        title,
        mediaType,
        mood: `${mediaType === "series" ? "Series" : "Movies"} like ${title}`,
      });
      return;
    }

    const trailerButton = event.target.closest("[data-watch-trailer]");
    if (trailerButton) {
      openTrailer(trailerButton.dataset.watchTrailer);
      return;
    }

    const activeButton = event.target.closest("[data-make-active]");
    if (activeButton) {
      state.activeItemKey = activeButton.dataset.makeActive;
      showToast("Active card updated for keyboard favorite toggle.", "info");
      return;
    }

    const trendButton = event.target.closest("[data-trending-title]");
    if (trendButton) {
      const title = trendButton.dataset.trendingTitle;
      const mediaType = trendButton.dataset.trendingType === "series" ? "series" : "movie";
      state.mediaType = mediaType;
      syncModeTabs();
      updateResultsHeader();
      moodInput.value = `${mediaType === "series" ? "Series" : "Movies"} like ${title}`;
      requestRecommendations({
        mode: "similar",
        title,
        mediaType,
        mood: `${mediaType === "series" ? "Series" : "Movies"} like ${title}`,
      });
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
      const mood = chooseRandomMood(state.mediaType);
      requestRecommendations({ mood, mediaType: state.mediaType });
      return;
    }

    if (event.key.toLowerCase() === "f") {
      toggleActiveFavorite();
    }
  });
}

function init() {
  syncModeTabs();
  updateResultsHeader();
  renderRecentSearches();
  renderFavorites();
  renderResults();
  renderDiscoveryCards();
  loadDiscovery();
  bindGlobalEvents();
  setStatus("Pick Movies or Web Series, then search by mood, genre, or Surprise Me.");
}

init();
