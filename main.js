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
ipcMain.handle('open-folder', (_e, p) => shell.openPath(p));

ipcMain.handle('download:start', (e, { id, url, format, dir }) => {
  const send = (data) => { if (!e.sender.isDestroyed()) e.sender.send('download:progress', { id, ...data }); };
  if (!/^https?:\/\//i.test(url)) return send({ status: 'error', message: 'URL inválida' });
  if (!['mp3', 'm4a', 'opus'].includes(format)) format = 'mp3';
  for (const bin of [YTDLP, FFMPEG]) {
    if (!fs.existsSync(bin)) return send({ status: 'error', message: `Binário não encontrado: ${path.basename(bin)} (coloque em /bin)` });
  }
  fs.mkdirSync(dir, { recursive: true });

  const args = [
    '-x', '--audio-format', format, '--audio-quality', '0',
    '--embed-metadata', '--no-playlist', '--newline',
    '--ffmpeg-location', binDir,
    '-o', path.join(dir, '%(title)s.%(ext)s'),
    '--', url
  ];
  const proc = spawn(YTDLP, args, { windowsHide: true });
  jobs.set(id, proc);
  send({ status: 'running', percent: 0 });

  let lastErr = '';
  const onData = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      const pct = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (pct) send({ status: 'running', percent: parseFloat(pct[1]) });
      const dest = line.match(/\[download\] Destination: (.+)$/);
      if (dest) send({ status: 'running', title: path.parse(dest[1]).name });
      if (line.includes('[ExtractAudio]')) send({ status: 'running', percent: 99, converting: true });
      if (/^ERROR/.test(line)) lastErr = line;
    }
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  proc.on('error', (err) => send({ status: 'error', message: err.message }));
  proc.on('close', (code, signal) => {
    jobs.delete(id);
    if (signal) return send({ status: 'canceled' });
    code === 0 ? send({ status: 'done', percent: 100 }) : send({ status: 'error', message: lastErr || `yt-dlp saiu com código ${code}` });
  });
});

ipcMain.handle('download:cancel', (_e, id) => { jobs.get(id)?.kill(); });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { jobs.forEach((p) => p.kill()); app.quit(); });
