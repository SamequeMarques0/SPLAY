const MAX_IMAGE_DATA_URL_LENGTH = 350000; // ~350KB string guard

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    console.warn('Falha ao salvar no localStorage', key, err);
    return { ok: false, error: err };
  }
}

export function sanitizeStation(raw, defaults = {}) {
  const id = typeof raw?.id === 'string' && raw.id ? raw.id : defaults.id;
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  const url = typeof raw?.url === 'string' ? raw.url.trim() : '';
  const genre = typeof raw?.genre === 'string' ? raw.genre.trim() : '';
  const emoji = typeof raw?.emoji === 'string' && raw.emoji ? raw.emoji : (defaults.emoji || '📻');
  const rawImage = typeof raw?.image === 'string' ? raw.image.trim() : '';
  const image = (rawImage.startsWith('data:image/') && rawImage.length <= MAX_IMAGE_DATA_URL_LENGTH) || /^https?:\/\//i.test(rawImage)
    ? rawImage
    : null;
  if (!id || !name || !/^https?:\/\//i.test(url)) return null;
  return { id, name, url, genre, emoji, image };
}

export function sanitizeStations(list, defaults = []) {
  const byId = new Map();
  for (const s of defaults) {
    const clean = sanitizeStation(s, s);
    if (clean) byId.set(clean.id, clean);
  }
  if (Array.isArray(list)) {
    for (const raw of list) {
      const clean = sanitizeStation(raw, raw);
      if (clean) byId.set(clean.id, clean);
    }
  }
  return [...byId.values()];
}

export function sanitizeFavs(favs, stations) {
  const ids = new Set(stations.map((s) => s.id));
  if (!Array.isArray(favs)) return [];
  return [...new Set(favs.filter((id) => typeof id === 'string' && ids.has(id)))];
}

export function isQuotaError(err) {
  return err && (err.name === 'QuotaExceededError' || err.code === 22);
}
