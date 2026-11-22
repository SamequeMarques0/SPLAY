const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// yt-dlp e ffmpeg ficam em ./bin (ou em resources/bin quando empacotado)
const exe = process.platform === 'win32' ? '.exe' : '';
const binDir = app.isPackaged ? path.join(process.resourcesPath, 'bin') : path.join(__dirname, 'bin');
const YTDLP = path.join(binDir, 'yt-dlp' + exe);
const FFMPEG = path.join(binDir, 'ffmpeg' + exe);

const jobs = new Map();
const ALLOWED_FORMATS = new Set(['mp3', 'm4a', 'opus']);

function isHttpUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeDir(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return path.resolve(trimmed);
}

function safeSend(sender, channel, payload) {
  if (sender && !sender.isDestroyed()) sender.send(channel, payload);
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1240, height: 800, minWidth: 980, minHeight: 640,
    frame: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('default-folder', () => app.getPath('music'));
ipcMain.handle('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

ipcMain.handle('open-folder', async (_e, folderPath) => {
  const target = normalizeDir(folderPath);
  if (!target) return { ok: false, message: 'Pasta inválida.' };
  try {
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      return { ok: false, message: 'Pasta não encontrada.' };
    }
    const err = await shell.openPath(target);
    return err ? { ok: false, message: err } : { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || 'Falha ao abrir pasta.' };
  }
});

ipcMain.handle('bin:status', () => ({
  binDir,
  ytdlp: fs.existsSync(YTDLP),
  ffmpeg: fs.existsSync(FFMPEG),
}));

ipcMain.handle('download:start', (e, payload = {}) => {
  const { id, url, format, dir } = payload;
  const sender = e.sender;
  const send = (data) => safeSend(sender, 'download:progress', { id, ...data });

  if (typeof id !== 'string' || !id.trim()) return { ok: false, message: 'ID de download inválido.' };
  if (jobs.has(id)) return { ok: false, message: 'Já existe um download com esse ID.' };
  if (!isHttpUrl(url)) {
    send({ status: 'error', message: 'URL inválida. Use http/https.' });
    return { ok: false, message: 'URL inválida. Use http/https.' };
  }

  const safeFormat = ALLOWED_FORMATS.has(format) ? format : 'mp3';
  const targetDir = normalizeDir(dir);
  if (!targetDir) {
    send({ status: 'error', message: 'Pasta de destino inválida.' });
    return { ok: false, message: 'Pasta de destino inválida.' };
  }

  for (const bin of [YTDLP, FFMPEG]) {
    if (!fs.existsSync(bin)) {
      const message = `Binário não encontrado: ${path.basename(bin)}. Coloque em ${binDir}.`;
      send({ status: 'error', message });
      return { ok: false, message };
    }
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    const message = `Não foi possível acessar a pasta de destino: ${err?.message || err}`;
    send({ status: 'error', message });
    return { ok: false, message };
  }

  const args = [
    '--no-playlist',
    '--newline',
    '--no-warnings',
    '-x', '--audio-format', safeFormat, '--audio-quality', '0',
    '--embed-metadata',
    '--ffmpeg-location', binDir,
    '-o', path.join(targetDir, '%(title)s [%(id)s].%(ext)s'),
    '--', url
  ];

  let proc;
  try {
    proc = spawn(YTDLP, args, { windowsHide: true });
  } catch (err) {
    const message = err?.message || 'Falha ao iniciar yt-dlp.';
    send({ status: 'error', message });
    return { ok: false, message };
  }

  jobs.set(id, proc);
  send({ status: 'running', percent: 0, message: 'Iniciando download...' });

  let lastErr = '';
  const onData = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      if (!line) continue;
      const pct = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (pct) send({ status: 'running', percent: parseFloat(pct[1]), message: 'Baixando...' });
      const dest = line.match(/\[download\] Destination: (.+)$/);
      if (dest) send({ status: 'running', title: path.parse(dest[1]).name });
      const already = line.match(/\[download\]\s+(.+)\s+has already been downloaded/);
      if (already) send({ status: 'running', title: path.parse(already[1]).name });
      if (line.includes('[ExtractAudio]') || line.includes('[Merger]')) {
        send({ status: 'running', percent: 99, converting: true, message: 'Convertendo áudio...' });
      }
      if (/^ERROR[:\s]/i.test(line)) lastErr = line.replace(/^ERROR:\s*/i, '').trim();
    }
  };

  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  proc.on('error', (err) => {
    jobs.delete(id);
    send({ status: 'error', message: err.message || 'Erro ao executar yt-dlp.' });
  });
  proc.on('close', (code, signal) => {
    jobs.delete(id);
    if (signal) return send({ status: 'canceled', message: 'Download cancelado.' });
    if (code === 0) return send({ status: 'done', percent: 100, message: 'Concluído.' });
    send({ status: 'error', message: lastErr || `yt-dlp saiu com código ${code}` });
  });

  return { ok: true };
});

ipcMain.handle('download:cancel', (_e, id) => {
  if (typeof id !== 'string') return { ok: false };
  const proc = jobs.get(id);
  if (!proc) return { ok: false, message: 'Download não encontrado.' };
  try {
    proc.kill();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || 'Falha ao cancelar.' };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { jobs.forEach((p) => { try { p.kill(); } catch {} }); app.quit(); });
