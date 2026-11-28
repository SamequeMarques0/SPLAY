import { loadJSON, saveJSON, sanitizeFavs, sanitizeStations, isQuotaError } from './storage.js';

const DEFAULTS = [
  { id: '94.1', name: 'Gazeta 94.1 FM', genre: 'Tá todo mundo ligado!', emoji: '📻', url: 'https://virtues.live:8144/stream?1795306735490' },
  { id: '96', name: '96 Maceió FM', genre: 'Toda Boa', emoji: '📻', url: 'https://streaming.livespanel.com:20096/radio96fm?1795307136651' },
  { id: '99.7', name: 'O Dia 99.7 FM', genre: 'Alegria que Irradia!', emoji: '📻', url: 'https://wz7.servidoresbrasil.com:8274/stream?1795307292411' },
  { id: '89.3', name: 'Adore 89.3 FM', genre: 'Sua nova Rádio Católica', emoji: '📻', url: 'https://03.painelstreaming.com.br:27014/stream?1795307481722' },
  { id: '107.7', name: 'Educativa 107.7 FM', genre: '', emoji: '📻', url: 'https://radio.saopaulo01.com.br/9370/stream?1795307589563' },
  { id: '106.1', name: 'Francês 106.1 FM', genre: 'Só escuto ela', emoji: '📻', url: 'https://24253.live.streamtheworld.com/FRANCESFM_MACAAC.aac?dist=RadiosNet&1795307691074' },
  { id: '100.7', name: 'Jovem Pan 100.7 FM', genre: 'A radio número 1 do Brasil!', emoji: '📻', url: 'https://directradios.net/proxy/jpmaceio?mp=/stream&1795307774995' },
  { id: '102.7', name: 'Jovem Pan News 102.7 FM', genre: '', emoji: '📻', url: 'https://streaming.livespanel.com:20520/jovempanal?1795307835506' },
  { id: '97.7', name: 'Metropolitana 97.7 FM', genre: 'Tudo que você gosta acontece aqui, yes!', emoji: '📻', url: 'https://streaming.livespanel.com:8032/maceiofm?1795307896202' },
  { id: '98.3', name: 'Mix 98.3 FM', genre: 'O melhor Mix do Brasil', emoji: '📻', url: 'https://virtues.live:8184/stream?1795308092379' },
  { id: '76.1', name: 'Moral 76.1 FM', genre: 'A rádio que é Moral até no nome!', emoji: '📻', url: 'https://cast2.hoost.com.br:20052/stream?1795308273043' },
  { id: '106.5', name: 'Nova Brasil 106.5 FM', genre: 'Mais que moderna, brasileira!', emoji: '📻', url: 'https://27373.live.streamtheworld.com/NOVABRASIL_MACAAC.aac?dist=RadiosNet&1795308352914' },
  { id: '103.7', name: 'Pajuçara 103.7 FM', genre: '', emoji: '📻', url: 'https://cast3.hoost.com.br:8679/stream?1795308422475' },
  { id: '100.3', name: 'Rede Aleluia 100.3 FM', genre: 'A rede da Família!', emoji: '📻', url: 'https://station.azrmcsoftbroadcast.com.br/listen/radio_alagoas/Alagoas?1795308481203' },
];
const COLORS = ['var(--blue)', 'var(--yellow)', 'var(--green)', 'var(--pink)'];

const iconConfig = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings preview-icon"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`;
const iconStar = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star-half preview-icon"><path d="M12 18.338a2.1 2.1 0 0 0-.987.244L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16l2.309-4.679A.53.53 0 0 1 12 2"/></svg>`;
const iconStarCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star preview-icon"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`;


function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function byId(root, id) { return root.querySelector(`#${id}`); }

export function initRadio(root, { notify }) {
  const grid = byId(root, 'grid');
  const search = byId(root, 'search');
  const nowName = byId(root, 'nowName');
  const nowStatus = byId(root, 'nowStatus');
  const disc = byId(root, 'disc');
  const btnPlay = byId(root, 'btnPlay');
  const volume = byId(root, 'volume');
  const favsEl = byId(root, 'favs');
  const dlg = byId(root, 'stDlg');

  let stations = sanitizeStations(loadJSON('stations', null) ?? [...DEFAULTS, ...loadJSON('customStations', [])], DEFAULTS);
  let favs = new Set(sanitizeFavs(loadJSON('favs', []), stations));
  let current = null;
  let editing = null;
  let draftImage = null;
  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = Number(volume.value || 0.8);

  function persistStations() {
    const res = saveJSON('stations', stations);
    if (!res.ok && isQuotaError(res.error)) {
      // fallback: drop custom images to recover space
      stations = stations.map((s) => ({ ...s, image: null }));
      saveJSON('stations', stations);
      notify('Armazenamento cheio: imagens das estações foram removidas para salvar as alterações.', 'warn');
    }
  }
  function persistFavs() { saveJSON('favs', [...favs]); }

  function artHTML(s, large = false) {
    if (s?.image) return `<img src="${s.image}" alt="Logo de ${esc(s.name)}">`;
    return `<span aria-hidden="true">${esc(s?.emoji || '')}</span>`;
  }

  function renderFavs() {
    const list = stations.filter((s) => favs.has(s.id));
    favsEl.innerHTML = list.length
      ? list.map((s, i) => `<li data-id="${esc(s.id)}"><span>${esc(s.name)}</span><b aria-hidden="true">${i + 1}</b></li>`).join('')
      : '<li class="empty">Toque no coração de uma rádio para fixar aqui.</li>';
  }

  function renderGrid() {
    const q = search.value.toLowerCase().trim();
    const list = stations.filter((s) => (`${s.name} ${s.genre || ''}`).toLowerCase().includes(q));
    grid.innerHTML = list.map((s, i) => {
      const playing = current?.id === s.id && !audio.paused;
      return `
      <article class="card ${playing ? 'playing' : ''}" data-id="${esc(s.id)}">
        <div class="acts">
          <button type="button" data-fav="${esc(s.id)}" title="${favs.has(s.id) ? 'Remover dos favoritos' : 'Favoritar'}" aria-label="${favs.has(s.id) ? 'Remover dos favoritos' : 'Favoritar'} ${esc(s.name)}">${favs.has(s.id) ? iconStar : iconStarCheck }</button>
          <button type="button" data-edit="${esc(s.id)}" title="Editar rádio" aria-label="Editar ${esc(s.name)}"> ${iconConfig} </button>
        </div>
        <div class="top">
          <div class="art">${artHTML(s)}</div>
          <h4>${esc(s.name)}</h4>
          <small>${esc(s.genre || 'Rádio')}</small>
        </div>
        <div class="strip" style="background:${COLORS[i % 4]}"><span>Ao vivo</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></div>
      </article>`;
    }).join('') + '<button type="button" class="card add" id="addCard" aria-label="Adicionar rádio">+</button>';
    renderFavs();
  }

  function setStatus(text, playing) {
    nowStatus.textContent = text;
    btnPlay.textContent = playing ? '⏸' : '▶';
    btnPlay.setAttribute('aria-label', playing ? 'Pausar rádio' : 'Tocar rádio');
    disc.classList.toggle('spin', playing);
    renderGrid();
  }

  function showNow() {
    nowName.textContent = current ? current.name : 'Escolha uma rádio';
    disc.innerHTML = current ? artHTML(current, true) : '<span aria-hidden="true">📻</span>';
  }

  function playStation(s) {
    if (!s) return;
    if (current?.id === s.id && !audio.paused) { audio.pause(); return; }
    const changed = current?.id !== s.id;
    current = s;
    showNow();
    setStatus('conectando…', false);
    if (changed || !audio.src) audio.src = s.url;
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => setStatus('erro ao tocar', false));
  }

  audio.onplaying = () => setStatus('ao vivo', true);
  audio.onpause = () => setStatus(audio.src ? 'pausado' : 'parado', false);
  audio.onwaiting = () => setStatus('carregando…', false);
  audio.onerror = () => setStatus('stream indisponível', false);

  btnPlay.addEventListener('click', () => {
    if (!current) return playStation(stations[0]);
    if (audio.paused) {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => setStatus('erro ao tocar', false));
    } else {
      audio.pause();
    }
  });
  volume.addEventListener('input', (e) => { audio.volume = Number(e.target.value); });
  search.addEventListener('input', renderGrid);

  grid.addEventListener('click', (e) => {
    const add = e.target.closest('#addCard');
    if (add) { e.preventDefault(); return openDialog(null); }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); e.stopPropagation();
      const id = fav.dataset.fav;
      if (favs.has(id)) favs.delete(id); else favs.add(id);
      persistFavs();
      return renderGrid();
    }
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      e.preventDefault(); e.stopPropagation();
      return openDialog(stations.find((s) => s.id === ed.dataset.edit) || null);
    }
    const card = e.target.closest('.card[data-id]');
    if (card) playStation(stations.find((s) => s.id === card.dataset.id));
  });

  favsEl.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) playStation(stations.find((s) => s.id === li.dataset.id));
  });

  function setThumb() {
    byId(root, 'thumb').innerHTML = draftImage ? `<img src="${draftImage}" alt="Prévia da imagem">` : `<span aria-hidden="true">📻</span>`;
  }

  function openDialog(s) {
    editing = s;
    draftImage = s?.image || null;
    byId(root, 'dlgTitle').textContent = s ? 'Editar rádio' : 'Nova rádio';
    byId(root, 'stName').value = s?.name || '';
    byId(root, 'stGenre').value = s?.genre || '';
    byId(root, 'stUrl').value = s?.url || '';
    byId(root, 'stImageUrl').value = (s?.image && /^https?:\/\//i.test(s.image)) ? s.image : '';
    byId(root, 'stDelete').style.display = s ? '' : 'none';
    setThumb();
    dlg.showModal();
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler imagem'));
      reader.readAsDataURL(blob);
    });
  }

  async function imageSourceToDataURL(src, maxBytes = 2 * 1024 * 1024) {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Imagem inválida ou bloqueada por CORS'));
      el.src = src;
    });
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const m = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/webp', 0.82);
    if (dataUrl.length > 350000) throw new Error('Imagem muito grande após processamento.');
    return dataUrl;
  }

  async function fileToDataURL(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Arquivo inválido');
    if (file.size > maxBytesDefault()) throw new Error('Imagem muito grande (máx. 2MB)');
    const dataUrl = await blobToDataURL(file);
    return imageSourceToDataURL(dataUrl);
  }
  function maxBytesDefault(){ return 2 * 1024 * 1024; }

  async function fetchLogoFromUrl(url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Informe uma URL de imagem válida (http/https).');
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`Falha ao baixar imagem (HTTP ${res.status}).`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('A URL não retornou uma imagem.');
    if (blob.size > maxBytesDefault()) throw new Error('Imagem muito grande (máx. 2MB).');
    const dataUrl = await blobToDataURL(blob);
    return imageSourceToDataURL(dataUrl);
  }

  async function fetchLogoAuto() {
    const manual = byId(root, 'stImageUrl').value.trim();
    if (manual) return { dataUrl: await fetchLogoFromUrl(manual), sourceUrl: manual };

    const name = byId(root, 'stName').value.trim();
    const stream = byId(root, 'stUrl').value.trim();
    const candidates = [];

    // 1) Radio Browser API by name (public directory, often has favicon)
    if (name) {
      const endpoint = `https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(name)}?limit=5&hidebroken=true`;
      try {
        const r = await fetch(endpoint);
        if (r.ok) {
          const items = await r.json();
          for (const it of Array.isArray(items) ? items : []) {
            if (it?.favicon && /^https?:\/\//i.test(it.favicon)) candidates.push(it.favicon);
          }
        }
      } catch {}
    }

    // 2) Fallback: favicon from stream origin
    try {
      if (stream) candidates.push(`${new URL(stream).origin}/favicon.ico`);
    } catch {}

    const uniq = [...new Set(candidates)];
    let lastErr = null;
    for (const url of uniq) {
      try { return { dataUrl: await fetchLogoFromUrl(url), sourceUrl: url }; }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Não encontrei logo automaticamente. Tente colar a URL da imagem.');
  }

  byId(root, 'imgBtn').addEventListener('click', () => byId(root, 'imgFile').click());
  byId(root, 'imgFile').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { draftImage = await fileToDataURL(f); setThumb(); notify('Imagem carregada.', 'info'); }
    catch (err) { notify(err.message || 'Não foi possível carregar a imagem.', 'error'); }
    e.target.value = '';
  });

  byId(root, 'imgFetchBtn').addEventListener('click', async () => {
    const btn = byId(root, 'imgFetchBtn');
    btn.disabled = true; btn.textContent = 'Buscando...';
    try {
      const { dataUrl, sourceUrl } = await fetchLogoAuto();
      draftImage = dataUrl;
      if (/^https?:\/\//i.test(sourceUrl)) byId(root, 'stImageUrl').value = sourceUrl;
      setThumb();
      notify('Logo carregada da internet.', 'info');
    } catch (err) {
      notify(err.message || 'Não foi possível buscar a logo. Tente enviar a imagem manualmente.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🌐 Buscar logo online';
    }
  });

  byId(root, 'imgClear').addEventListener('click', () => { draftImage = null; byId(root, 'stImageUrl').value = ''; setThumb(); });
  byId(root, 'stCancel').addEventListener('click', () => dlg.close());

  byId(root, 'stOk').addEventListener('click', () => {
    const name = byId(root, 'stName').value.trim();
    const url = byId(root, 'stUrl').value.trim();
    const genre = byId(root, 'stGenre').value.trim();
    const imageUrl = byId(root, 'stImageUrl').value.trim();
    if (!name) return notify('Informe o nome da rádio.', 'warn');
    if (!/^https?:\/\//i.test(url)) return notify('Informe uma URL de stream válida (http/https).', 'warn');
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return notify('URL da imagem inválida (use http/https).', 'warn');

    // If user pasted an image URL but didn't click fetch, keep it as image (browser can load it directly).
    const image = draftImage || (imageUrl || null);
    const data = { name, url, genre, image, emoji: '📻' };
    if (editing) {
      Object.assign(editing, data);
      if (current?.id === editing.id) {
        showNow();
        if (audio.src !== url) { audio.src = url; if (!audio.paused) audio.play().catch(() => setStatus('erro ao tocar', false)); }
      }
    } else {
      stations.push({ id: `c${Date.now()}`, ...data });
    }
    persistStations();
    dlg.close();
    renderGrid();
  });

  byId(root, 'stDelete').addEventListener('click', () => {
    if (!editing) return;
    if (!confirm(`Excluir a rádio "${editing.name}"?`)) return;
    if (current?.id === editing.id) { audio.pause(); audio.removeAttribute('src'); audio.load(); current = null; showNow(); setStatus('parado', false); }
    stations = stations.filter((s) => s.id !== editing.id);
    favs.delete(editing.id);
    persistFavs();
    persistStations();
    dlg.close();
    renderGrid();
  });

  showNow();
  renderGrid();
}
