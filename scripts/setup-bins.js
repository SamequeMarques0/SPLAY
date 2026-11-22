#!/usr/bin/env node
/**
 * Downloads yt-dlp and ffmpeg binaries into ./bin for the current platform.
 * Runs on npm install (postinstall) but is safe/offline-friendly:
 * - skips if binaries already exist
 * - can be disabled with SPLAY_SKIP_BIN_DOWNLOAD=1
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin');
const SKIP = process.env.SPLAY_SKIP_BIN_DOWNLOAD === '1' || process.env.SPLAY_SKIP_BIN_DOWNLOAD === 'true';

const TARGETS = {
  win32: {
    ytdlp: { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', out: 'yt-dlp.exe' },
    ffmpeg: { url: 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip', out: 'ffmpeg.exe', zipPathEndsWith: '/bin/ffmpeg.exe' },
  },
  linux: {
    ytdlp: { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', out: 'yt-dlp' },
    ffmpeg: { url: 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linux64-gpl.tar.xz', out: 'ffmpeg', tarPathEndsWith: '/bin/ffmpeg' },
  },
  darwin: {
    ytdlp: { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos', out: 'yt-dlp' },
    ffmpeg: { url: 'https://evermeet.cx/ffmpeg/getrelease/zip', out: 'ffmpeg', zipPathEndsWith: 'ffmpeg' },
  },
};

function log(msg) { console.log(`[setup-bins] ${msg}`); }
function warn(msg) { console.warn(`[setup-bins] WARN: ${msg}`); }

function exists(p) { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; } } }

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('http:') ? require('http') : https;
    const req = mod.get(url, { headers: { 'User-Agent': 'SPLAY-setup-bins' } }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return resolve(download(next, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = dest + '.tmp';
      const file = fs.createStream(tmp);
      res.pipe(file);
      file.on('finish', () => file.close(() => { fs.renameSync(tmp, dest); resolve(dest); }));
      file.on('error', (err) => { try { fs.unlinkSync(tmp); } catch {} reject(err); });
    });
    req.on('error', reject);
  });
}

function unzipExtract(zipFile, endsWith, outFile) {
  if (process.platform === 'win32') {
    const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${zipFile.replace(/'/g, "''")}'); $e=$z.Entries | Where-Object { $_.FullName -replace '\\\\','/' -like '*${endsWith}' } | Select-Object -First 1; if(-not $e){ throw 'entry not found' }; [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e,'${outFile.replace(/'/g, "''")}', $true); $z.Dispose()`;
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('PowerShell unzip failed');
    return;
  }
  // linux/mac: try unzip -p
  const r = spawnSync('bash', ['-lc', `unzip -p "${zipFile}" "$(unzip -Z1 "${zipFile}" | grep '${endsWith.replace(/'/g, "'\\''")}$' | head -n1)" > "${outFile}"`], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('unzip extraction failed');
}

function tarExtract(tarFile, endsWith, outFile) {
  // Use tar to list and extract to stdout
  const list = spawnSync('tar', ['-tJf', tarFile], { encoding: 'utf8' });
  if (list.status !== 0) throw new Error('tar list failed');
  const entry = list.stdout.split(/\r?\n/).find((l) => l.replace(/\\/g, '/').endsWith(endsWith));
  if (!entry) throw new Error(`tar entry not found: ${endsWith}`);
  const out = fs.openSync(outFile, 'w');
  const r = spawnSync('tar', ['-xJOf', tarFile, entry], { stdio: ['ignore', out, 'inherit'] });
  fs.closeSync(out);
  if (r.status !== 0) throw new Error('tar extract failed');
}

async function ensureFile(name, spec) {
  const out = path.join(BIN, spec.out);
  if (exists(out)) { log(`${spec.out} já existe, pulando.`); return; }
  log(`Baixando ${spec.out}...`);
  const tmpDir = path.join(BIN, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  if (spec.zipPathEndsWith) {
    const archive = path.join(tmpDir, `${name}.zip`);
    await download(spec.url, archive);
    unzipExtract(archive, spec.zipPathEndsWith, out);
    try { fs.unlinkSync(archive); } catch {}
  } else if (spec.tarPathEndsWith) {
    const archive = path.join(tmpDir, `${name}.tar.xz`);
    await download(spec.url, archive);
    tarExtract(archive, spec.tarPathEndsWith, out);
    try { fs.unlinkSync(archive); } catch {}
  } else {
    await download(spec.url, out);
  }
  if (process.platform !== 'win32') {
    try { fs.chmodSync(out, 0o755); } catch {}
  }
  log(`${spec.out} pronto.`);
}

async function main() {
  if (SKIP) { log('SPLAY_SKIP_BIN_DOWNLOAD=1, pulando download de binários.'); return; }
  const target = TARGETS[process.platform];
  if (!target) { warn(`Plataforma não suportada para download automático: ${process.platform}. Instale yt-dlp/ffmpeg manualmente em ./bin.`); return; }
  fs.mkdirSync(BIN, { recursive: true });
  for (const [name, spec] of Object.entries(target)) {
    try { await ensureFile(name, spec); }
    catch (err) { warn(`Falha ao obter ${spec.out}: ${err.message}. Você pode baixar manualmente em ./bin.`); }
  }
  try { fs.rmSync(path.join(BIN, '.tmp'), { recursive: true, force: true }); } catch {}
}

main().catch((err) => { warn(err.message); process.exit(0); }); // don't fail npm install
