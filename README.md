# SPLAY

Aplicativo desktop (Electron) para ouvir rádios online e baixar áudio de vídeos com `yt-dlp` + `ffmpeg`.

## Requisitos

- [Node.js](https://nodejs.org/) 18+ (recomendado LTS)
- npm
- Binários do **yt-dlp** e **ffmpeg** na pasta `bin/`

## Binários (yt-dlp e ffmpeg)

O SPLAY espera os executáveis em `bin/`:

- Windows: `bin/yt-dlp.exe` e `bin/ffmpeg.exe`
- Linux/macOS: `bin/yt-dlp` e `bin/ffmpeg`

### Download automático no `npm install`

O projeto inclui `scripts/setup-bins.js`, executado no `postinstall`:
- baixa `yt-dlp` e `ffmpeg` para a plataforma atual, se ainda não existirem em `bin/`;
- se falhar (offline/firewall), **não quebra** o `npm install` — apenas avisa;
- pode ser desativado com `SPLAY_SKIP_BIN_DOWNLOAD=1`.

Você também pode rodar manualmente:

```bash
npm run setup:bins
```

### Download manual

- [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/latest)
- [ffmpeg builds](https://ffmpeg.org/download.html) (Windows: build estática com `ffmpeg.exe`)

> A pasta `bin/` é ignorada pelo Git (binários grandes/plataforma). No build empacotado, ela é copiada como recurso extra (`extraResources`).

## Instalação

```bash
npm install
```

## Executar em desenvolvimento

```bash
npm start
```

## Build (instalador/pacote)

```bash
npm run dist
```

### Executável para Windows

Em uma máquina Windows (com os binários em `bin/` ou deixando o `postinstall` baixá-los):

```bash
npm run dist:win
```

Isso gera, em `dist/`:
- instalador **NSIS** (`.exe`)
- versão **portable** (`.exe`)

> Observação: cross-compilação para Windows a partir de Linux/macOS pode exigir ferramentas adicionais (Wine etc.). O caminho mais confiável é gerar no Windows.

## Scripts úteis

- `npm start` - inicia o app com Electron
- `npm run setup:bins` - baixa yt-dlp/ffmpeg para `bin/` (plataforma atual)
- `npm run dist` - gera build com electron-builder
- `npm run dist:win` - gera instalador NSIS + portable para Windows x64
- `npm run lint` - verifica sintaxe dos arquivos JS principais

## Estrutura

```text
.
├── bin/                 # yt-dlp/ffmpeg (não versionado)
├── src/
│   ├── index.html
│   ├── styles.css
│   ├── renderer.js      # bootstrap da UI
│   ├── js/
│   │   ├── storage.js   # persistência segura (localStorage)
│   │   ├── radio.js     # lógica de rádios/favoritos/player
│   │   └── downloads.js # lógica de downloads e progresso
│   └── icon/
├── main.js              # processo principal Electron / IPC
├── preload.js           # bridge segura para renderer
└── package.json
```

## Observações

- As rádios padrão podem ser editadas; personalizações e favoritos ficam salvos localmente.
- Imagens de estação são redimensionadas antes de salvar para reduzir uso de armazenamento.
- O download aceita apenas URLs `http/https` e formatos `mp3`, `m4a`, `opus`.
