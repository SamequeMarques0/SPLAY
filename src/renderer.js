import { initRadio } from './js/radio.js';
import { initDownloads } from './js/downloads.js';

const $ = (s) => document.querySelector(s);

function notify(message, type = 'info') {
  let root = $('#toastRoot');
  if (!root) return console[type === 'error' ? 'error' : 'log'](message);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 250); }, 3200);
}

// Tabs
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab,.view').forEach((e) => e.classList.remove('active'));
    tab.classList.add('active');
    const view = document.getElementById(`view-${tab.dataset.view}`);
    if (view) view.classList.add('active');
  });
});

// Window close
const closeBtn = $('#closeBtn');
if (closeBtn) closeBtn.addEventListener('click', () => window.api?.close?.());

initRadio(document, { notify });
initDownloads(document, { notify });
