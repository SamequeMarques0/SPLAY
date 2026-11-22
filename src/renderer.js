const $ = (s) => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Navegação ---------- */
document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
  document.querySelectorAll('.tab,.view').forEach((e) => e.classList.remove('active'));
  t.classList.add('active'); $('#view-' + t.dataset.view).classList.add('active');
});

/* ---------- Rádio ---------- */
const DEFAULTS = [
  /* { id: '', name: '', genre: '', emoji: '', url: '' }, */
  { id: '94.1', name: 'Gazeta 94.1 FM', genre: 'Tá todo mundo ligado!', emoji: '', url: 'https://virtues.live:8144/stream?1795306735490' },
  { id: '96', name: '96 Maceió FM', genre: 'Toda Boa', emoji: '', url: 'https://streaming.livespanel.com:20096/radio96fm?1795307136651' },
  { id: '99.7', name: 'O Dia 99.7 FM', genre: 'Alegria que Irradia!', emoji: '', url: 'https://wz7.servidoresbrasil.com:8274/stream?1795307292411' },
  { id: '89.3', name: 'Adore 89.3 FM', genre: 'Sua nova Rádio Católica', emoji: '', url: 'https://03.painelstreaming.com.br:27014/stream?1795307481722' },
  { id: '107.7', name: 'Educativa 107.7 FM', genre: '', emoji: '', url: 'https://radio.saopaulo01.com.br/9370/stream?1795307589563' },
  { id: '106.1', name: 'Francês 106.1 FM', genre: 'Só escuto ela', emoji: '', url: 'https://24253.live.streamtheworld.com/FRANCESFM_MACAAC.aac?dist=RadiosNet&1795307691074'},
  { id: '100.7', name: 'Jovem Pan 100.7 FM', genre: 'A radio número 1 do Brasil!', emoji: '', url: 'https://directradios.net/proxy/jpmaceio?mp=/stream&1795307774995' },
  { id: '102.7', name: 'Jovem Pan News 102.7 FM', genre: '', emoji: '', url: 'https://streaming.livespanel.com:20520/jovempanal?1795307835506' },
  { id: '97.7', name: 'Metropolitana 97.7 FM', genre: 'Tudo que você gosta acontece aqui, yes!', emoji: '', url: 'https://streaming.livespanel.com:8032/maceiofm?1795307896202'},
  { id: '98.3', name: 'Mix 98.3 FM', genre: 'O melhor Mix do Brasil', emoji: '', url: 'https://virtues.live:8184/stream?1795308092379' },
  { id: '76.1', name: 'Moral 76.1 FM', genre: 'A rádio que é Moral até no nome!', emoji: '', url: 'https://cast2.hoost.com.br:20052/stream?1795308273043' },
  { id: '106.5', name: 'Nova Brasil 106.5 FM', genre: 'Mais que moderna, brasileira!', emoji: '', url: 'https://27373.live.streamtheworld.com/NOVABRASIL_MACAAC.aac?dist=RadiosNet&1795308352914' },
  { id: '103.7', name: 'Pajuçara 103.7 FM', genre: '', emoji: '', url: 'https://cast3.hoost.com.br:8679/stream?1795308422475' },
  { id: '100.3', name: 'Rede Aleluia 100.3 FM', genre: 'A rede da Família!', emoji: '', url: 'https://station.azrmcsoftbroadcast.com.br/listen/radio_alagoas/Alagoas?1795308481203' },
];
const COLORS = ['var(--blue)', 'var(--yellow)', 'var(--green)', 'var(--pink)'];
// todas as rádios (inclusive as padrão) ficam editáveis; migra as personalizadas antigas
let stations = load('stations', null) ?? [...DEFAULTS, ...load('customStations', [])];
let favs = new Set(load('favs', []));
let current = null;
const audio = new Audio();
audio.volume = 0.8;
const saveStations = () => save('stations', stations);
const artHTML = (s) => s.image ? `<img src="${s.image}" alt="">` : (s.emoji || '📻');

function renderGrid() {
  const q = $('#search').value.toLowerCase();
  const list = stations.filter((s) => (s.name + (s.genre || '')).toLowerCase().includes(q));
  $('#grid').innerHTML = list.map((s, i) => `
    <div class="card ${current?.id === s.id && !audio.paused ? 'playing' : ''}" data-id="${s.id}">
      <div class="acts"><button data-fav="${s.id}" title="Favoritar">${favs.has(s.id) ? '❤️' : '🤍'}</button><button data-edit="${s.id}" title="Editar">✏️</button></div>
      <div class="top"><div class="art">${artHTML(s)}</div><h4>${esc(s.name)}</h4><small>${esc(s.genre || 'Rádio')}</small></div>
      <div class="strip" style="background:${COLORS[i % 4]}"><span>Ao vivo</span><span class="eq"><i></i><i></i><i></i></span></div>
    </div>`).join('') + '<div class="card add" id="addCard">+</div>';
  renderFavs();
}

function renderFavs() {
  const list = stations.filter((s) => favs.has(s.id));
  $('#favs').innerHTML = list.length
    ? list.map((s, i) => `<li data-id="${s.id}">${esc(s.name)}<b>${i + 1}</b></li>`).join('')
    : '<p class="empty">Toque no ❤️ de uma rádio para fixar aqui.</p>';
}

function showNow() {
  $('#nowName').textContent = current ? current.name : 'Escolha uma rádio';
  $('#disc').innerHTML = current ? artHTML(current) : '<span>📻</span>';
}

function setStatus(text, playing) {
  $('#nowStatus').textContent = text;
  $('#btnPlay').textContent = playing ? '⏸' : '▶';
  $('#disc').classList.toggle('spin', playing);
  renderGrid();
}

function play(s) {
  if (current?.id === s.id && !audio.paused) return audio.pause();
  const changed = current?.id !== s.id;
  current = s; showNow();
  setStatus('conectando…', false);
  if (changed || !audio.src) audio.src = s.url;
  audio.play().catch(() => setStatus('erro ao tocar', false));
}

audio.onplaying = () => setStatus('ao vivo', true);
audio.onpause = () => setStatus('pausado', false);
audio.onwaiting = () => setStatus('carregando…', false);
audio.onerror = () => setStatus('stream indisponível', false);

$('#btnPlay').onclick = () => {
  if (!current) return play(stations[0]);
  audio.paused ? audio.play() : audio.pause();
};
$('#volume').oninput = (e) => audio.volume = e.target.value;
$('#search').oninput = renderGrid;

$('#grid').onclick = (e) => {
  if (e.target.closest('#addCard')) return openDialog(null);
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const id = fav.dataset.fav;
    favs.has(id) ? favs.delete(id) : favs.add(id);
    save('favs', [...favs]); return renderGrid();
  }
  const ed = e.target.closest('[data-edit]');
  if (ed) return openDialog(stations.find((s) => s.id === ed.dataset.edit));
  const card = e.target.closest('.card[data-id]');
  if (card) play(stations.find((s) => s.id === card.dataset.id));
};
$('#favs').onclick = (e) => {
  const li = e.target.closest('li[data-id]');
  if (li) play(stations.find((s) => s.id === li.dataset.id));
};

/* --- diálogo de criar/editar --- */
let editing = null, draftImage = null;
function setThumb() { $('#thumb').innerHTML = draftImage ? `<img src="${draftImage}" alt="">` : (editing?.emoji || '📻'); }

function openDialog(s) {
  editing = s; draftImage = s?.image || null;
  $('#dlgTitle').textContent = s ? 'Editar rádio' : 'Nova rádio';
  $('#stName').value = s?.name || ''; $('#stGenre').value = s?.genre || ''; $('#stUrl').value = s?.url || '';
  $('#stDelete').style.display = s ? '' : 'none';
  setThumb(); $('#stDlg').showModal();
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256, c = document.createElement('canvas');
        c.width = c.height = size;
        const m = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
        resolve(c.toDataURL('image/webp', 0.85));
      };
      img.onerror = reject; img.src = reader.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

$('#imgBtn').onclick = () => $('#imgFile').click();
$('#imgFile').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { draftImage = await fileToDataURL(f); setThumb(); } catch {}
  e.target.value = '';
};
$('#imgClear').onclick = () => { draftImage = null; setThumb(); };
$('#stCancel').onclick = () => $('#stDlg').close();

$('#stOk').onclick = () => {
  const name = $('#stName').value.trim(), url = $('#stUrl').value.trim();
  if (!name || !/^https?:\/\//i.test(url)) return;
  const data = { name, url, genre: $('#stGenre').value.trim(), image: draftImage };
  if (editing) {
    Object.assign(editing, data);
    if (current?.id === editing.id) { showNow(); if (audio.src !== url) { audio.src = url; if (!audio.paused) audio.play(); } }
  } else {
    stations.push({ id: 'c' + Date.now(), emoji: '⭐', ...data });
  }
  saveStations(); $('#stDlg').close(); renderGrid();
};

$('#stDelete').onclick = () => {
  if (!editing) return;
  if (current?.id === editing.id) { audio.pause(); audio.removeAttribute('src'); current = null; showNow(); }
  stations = stations.filter((s) => s.id !== editing.id);
  favs.delete(editing.id); save('favs', [...favs]);
  saveStations(); $('#stDlg').close(); renderGrid();
};

/* ---------- Janela ---------- */
$('#closeBtn').onclick = () => window.api.close();

/* ---------- Downloads ---------- */
let dir = '';
const jobEls = new Map();
window.api.defaultFolder().then((d) => { dir = load('dir', d); $('#folderLabel').textContent = dir; });
$('#folderBtn').onclick = async () => {
  const d = await window.api.pickFolder();
  if (d) { dir = d; save('dir', d); $('#folderLabel').textContent = d; }
};

$('#dlBtn').onclick = () => {
  const url = $('#url').value.trim();
  if (!/^https?:\/\//i.test(url)) return $('#url').focus();
  const id = 'j' + Date.now();
  const el = document.createElement('div');
  el.className = 'job';
  el.innerHTML = `<div class="t"><span class="title">${esc(url)}</span><span><span class="pct">0%</span> <button class="cancel">✕</button></span></div><div class="bar"><i></i></div>`;
  el.querySelector('.cancel').onclick = () => {
    const st = el.dataset.status;
    st === 'done' ? window.api.openFolder(dir) : window.api.cancelDownload(id);
  };
  $('#jobs').prepend(el); jobEls.set(id, el);
  window.api.startDownload({ id, url, format: $('#format').value, dir });
  $('#url').value = '';
};

window.api.onProgress((d) => {
  const el = jobEls.get(d.id); if (!el) return;
  if (d.title) el.querySelector('.title').textContent = d.title;
  if (d.percent != null) {
    el.querySelector('.bar i').style.width = d.percent + '%';
    el.querySelector('.pct').textContent = (d.converting ? 'convertendo… ' : '') + Math.round(d.percent) + '%';
  }
  if (d.status) el.dataset.status = d.status;
  if (d.status === 'done') { el.classList.add('done'); el.querySelector('.pct').textContent = 'pronto'; el.querySelector('.cancel').textContent = '📂'; }
  if (d.status === 'error') { el.classList.add('error'); el.querySelector('.pct').textContent = d.message; el.querySelector('.bar i').style.width = '100%'; }
  if (d.status === 'canceled') { el.querySelector('.pct').textContent = 'cancelado'; }
});

renderGrid();
