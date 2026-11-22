import { loadJSON, saveJSON } from './storage.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ALLOWED_FORMATS = new Set(['mp3', 'm4a', 'opus']);

export function initDownloads(root, { notify }) {
  const api = window.api;
  if (!api) {
    notify('API do aplicativo indisponível.', 'error');
    return;
  }

  const urlInput = root.querySelector('#url');
  const formatSel = root.querySelector('#format');
  const folderBtn = root.querySelector('#folderBtn');
  const folderLabel = root.querySelector('#folderLabel');
  const dlBtn = root.querySelector('#dlBtn');
  const jobsEl = root.querySelector('#jobs');
  const binStatus = root.querySelector('#binStatus');

  let dir = '';
  let dirReady = false;
  const jobEls = new Map();

  function setDirReady(ready) {
    dirReady = ready;
    dlBtn.disabled = !ready;
    dlBtn.title = ready ? 'Baixar áudio' : 'Aguardando pasta de destino...';
  }

  setDirReady(false);
  folderLabel.textContent = 'Carregando pasta...';

  async function refreshBinStatus() {
    if (!api.binStatus) return;
    try {
      const st = await api.binStatus();
      if (!st.ytdlp || !st.ffmpeg) {
        const missing = [!st.ytdlp && 'yt-dlp', !st.ffmpeg && 'ffmpeg'].filter(Boolean).join(' e ');
        binStatus.hidden = false;
        binStatus.innerHTML = `<strong>Binários ausentes:</strong> ${esc(missing)}. Coloque em <code>${esc(st.binDir || 'bin/')}</code>. Veja o README para links.`;
      } else {
        binStatus.hidden = true;
        binStatus.textContent = '';
      }
    } catch {
      // ignore
    }
  }

  (async () => {
    try {
      const defaultDir = await api.defaultFolder();
      const saved = loadJSON('dir', null);
      dir = (typeof saved === 'string' && saved) ? saved : defaultDir;
      folderLabel.textContent = dir || 'Selecionar pasta';
      setDirReady(Boolean(dir));
    } catch (err) {
      notify('Não foi possível obter a pasta padrão de downloads.', 'error');
      folderLabel.textContent = 'Selecionar pasta';
    }
    refreshBinStatus();
  })();

  folderBtn.addEventListener('click', async () => {
    try {
      const d = await api.pickFolder();
      if (d) {
        dir = d;
        saveJSON('dir', d);
        folderLabel.textContent = d;
        setDirReady(true);
      }
    } catch {
      notify('Não foi possível selecionar a pasta.', 'error');
    }
  });

  function createJobElement(id, url) {
    const el = document.createElement('article');
    el.className = 'job';
    el.dataset.status = 'queued';
    el.innerHTML = `
      <div class="t">
        <span class="title" title="${esc(url)}">${esc(url)}</span>
        <span class="meta"><span class="pct">0%</span> <button type="button" class="cancel">Cancelar</button></span>
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <p class="msg" aria-live="polite"></p>
    `;
    el.querySelector('.cancel').addEventListener('click', () => {
      const st = el.dataset.status;
      if (st === 'done') return api.openFolder(dir);
      if (st === 'running' || st === 'queued') return api.cancelDownload(id);
      // error/canceled: remove from list
      el.remove();
      jobEls.delete(id);
    });
    jobsEl.prepend(el);
    jobEls.set(id, el);
    return el;
  }

  dlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const format = ALLOWED_FORMATS.has(formatSel.value) ? formatSel.value : 'mp3';
    if (!/^https?:\/\//i.test(url)) {
      notify('Cole uma URL válida (http/https).', 'warn');
      urlInput.focus();
      return;
    }
    if (!dirReady || !dir) {
      notify('Escolha uma pasta de destino antes de baixar.', 'warn');
      folderBtn.focus();
      return;
    }

    const id = `j${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    createJobElement(id, url);
    dlBtn.disabled = true;
    try {
      const res = await api.startDownload({ id, url, format, dir });
      if (res && res.ok === false) {
        notify(res.message || 'Não foi possível iniciar o download.', 'error');
        const el = jobEls.get(id);
        if (el) {
          el.dataset.status = 'error';
          el.classList.add('error');
          el.querySelector('.pct').textContent = 'erro';
          el.querySelector('.msg').textContent = res.message || 'Falha ao iniciar';
          el.querySelector('.cancel').textContent = 'Fechar';
          el.querySelector('.bar i').style.width = '100%';
        }
      } else {
        urlInput.value = '';
      }
    } catch (err) {
      notify(err?.message || 'Erro ao iniciar download.', 'error');
    } finally {
      setDirReady(Boolean(dir));
    }
  });

  const off = api.onProgress((d) => {
    if (!d || !d.id) return;
    const el = jobEls.get(d.id);
    if (!el) return;
    if (d.title) el.querySelector('.title').textContent = d.title;
    if (typeof d.percent === 'number') {
      const pct = Math.max(0, Math.min(100, d.percent));
      el.querySelector('.bar i').style.width = `${pct}%`;
      el.querySelector('.bar').setAttribute('aria-valuenow', String(Math.round(pct)));
      el.querySelector('.pct').textContent = `${d.converting ? 'convertendo… ' : ''}${Math.round(pct)}%`;
    }
    if (d.status) el.dataset.status = d.status;
    if (d.message) el.querySelector('.msg').textContent = d.message;

    if (d.status === 'running') {
      el.querySelector('.cancel').textContent = 'Cancelar';
    }
    if (d.status === 'done') {
      el.classList.add('done');
      el.classList.remove('error');
      el.querySelector('.pct').textContent = 'pronto';
      el.querySelector('.msg').textContent = d.message || 'Download concluído.';
      el.querySelector('.cancel').textContent = 'Abrir pasta';
      el.querySelector('.bar i').style.width = '100%';
      el.querySelector('.bar').setAttribute('aria-valuenow', '100');
    }
    if (d.status === 'error') {
      el.classList.add('error');
      el.querySelector('.pct').textContent = 'erro';
      el.querySelector('.msg').textContent = d.message || 'Falha no download.';
      el.querySelector('.cancel').textContent = 'Fechar';
      el.querySelector('.bar i').style.width = '100%';
      el.querySelector('.bar').setAttribute('aria-valuenow', '100');
    }
    if (d.status === 'canceled') {
      el.classList.remove('error');
      el.querySelector('.pct').textContent = 'cancelado';
      el.querySelector('.msg').textContent = 'Download cancelado.';
      el.querySelector('.cancel').textContent = 'Fechar';
    }
  });

  window.addEventListener('beforeunload', () => { if (typeof off === 'function') off(); });
}
