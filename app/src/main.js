/* Night Drive Cover Studio — editor UI.
 * Wires the controls to cover.js, keeps undo/redo history, loads photos
 * (samples, files, drag-and-drop), pans/zooms per panel, exports PNGs.
 * Written fresh for gta6-cover-art-01 entry v3c. */

import { LAYOUTS, GRADES, EXPORT_SIZES, layoutPanels, renderCover } from './cover.js';

const $ = (sel) => document.querySelector(sel);
const preview = $('#preview');
const pctx = preview.getContext('2d');

const SAMPLES = [
  { id: 0, name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { id: 1, name: 'Pier', src: 'samples/pier.jpg' },
];

function freshPanels() {
  return Array.from({ length: 9 }, () => ({ photo: -1, zoom: 1, dx: 0, dy: 0 }));
}

function defaultState() {
  return {
    layout: 'grid',
    grade: 'sunset',
    title: 'NIGHT DRIVE',
    subtitle: 'Leonida after dark',
    badge: 'VICE CITY',
    stars: 4,
    grain: true,
    vignette: true,
    halftone: true,
    panels: freshPanels(),
  };
}

let state = defaultState();
let images = new Map(); // photoId -> HTMLImageElement
let nextPhotoId = 2;
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];
let renderQueued = false;

function snapshot() {
  return JSON.stringify({ ...state, panels: state.panels.map((p) => ({ ...p })) });
}

function restore(json) {
  const s = JSON.parse(json);
  state = s;
  syncControls();
  render();
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('#undoBtn').disabled = !undoStack.length;
  $('#redoBtn').disabled = !redoStack.length;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + src));
    img.src = src;
  });
}

async function addPhoto(src, name) {
  const id = nextPhotoId++;
  const img = await loadImage(src);
  images.set(id, img);
  const label = name || ('Photo ' + id);
  const tray = $('#tray');
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.type = 'button';
  chip.textContent = label;
  chip.title = 'Click to put this photo in the selected panel';
  chip.addEventListener('click', () => {
    pushHistory();
    state.panels[selectedPanel].photo = id;
    state.panels[selectedPanel].zoom = 1;
    state.panels[selectedPanel].dx = 0;
    state.panels[selectedPanel].dy = 0;
    render();
  });
  tray.appendChild(chip);
  return id;
}

async function loadSample(id) {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s || images.has(id)) return id;
  const img = await loadImage(s.src);
  images.set(id, img);
  return id;
}

function fillAllWith(photoId) {
  pushHistory();
  const n = layoutPanels(state.layout, 1080, 1080).length;
  for (let i = 0; i < n; i++) {
    state.panels[i].photo = photoId;
    state.panels[i].zoom = 1;
    state.panels[i].dx = 0;
    state.panels[i].dy = 0;
  }
  render();
}

function spreadPhotos() {
  // One photo per panel, cycling through the loaded photos.
  const ids = [...images.keys()];
  if (!ids.length) return;
  pushHistory();
  const n = layoutPanels(state.layout, 1080, 1080).length;
  for (let i = 0; i < n; i++) {
    state.panels[i].photo = ids[i % ids.length];
    state.panels[i].zoom = 1;
    state.panels[i].dx = 0;
    state.panels[i].dy = 0;
  }
  render();
}

function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const rect = preview.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.round((w * 3) / 4);
    preview.width = w;
    preview.height = h;
    const canvas = renderCover(w, h, state, images);
    pctx.drawImage(canvas, 0, 0);
    renderSizeStrip();
    updatePanelEditor();
  });
}

function renderSizeStrip() {
  // Small live thumbnails of the three main post sizes.
  document.querySelectorAll('#sizesStrip .size-thumb').forEach((el) => {
    const size = EXPORT_SIZES.find((s) => s.id === el.dataset.size);
    if (!size) return;
    const tw = 150;
    const th = Math.round((tw * size.h) / size.w);
    const small = renderCover(tw, th, state, images);
    const c = el.querySelector('canvas');
    c.width = tw;
    c.height = th;
    c.getContext('2d').drawImage(small, 0, 0);
    el.querySelector('.size-label').textContent = size.label;
  });
}

function updatePanelEditor() {
  const panels = layoutPanels(state.layout, preview.width, preview.height);
  const slot = state.panels[selectedPanel] || { photo: -1, zoom: 1, dx: 0, dy: 0 };
  $('#panelLabel').textContent = `Panel ${selectedPanel + 1} of ${panels.length}`;
  $('#zoomSlider').value = slot.zoom;
  $('#zoomVal').textContent = slot.zoom.toFixed(2) + 'x';
  $('#panXSlider').value = slot.dx;
  $('#panYSlider').value = slot.dy;
  const sel = $('#panelPhoto');
  sel.innerHTML = '<option value="-1">Empty</option>';
  for (const [id, img] of images) {
    const opt = document.createElement('option');
    opt.value = String(id);
    const sample = SAMPLES.find((s) => s.id === id);
    opt.textContent = sample ? sample.name : 'Photo ' + id;
    if (id === slot.photo) opt.selected = true;
    sel.appendChild(opt);
  }
  if (slot.photo === -1) sel.value = '-1';
}

function panelAtPoint(mx, my) {
  const panels = layoutPanels(state.layout, preview.width, preview.height);
  const rect = preview.getBoundingClientRect();
  const x = ((mx - rect.left) / rect.width) * preview.width;
  const y = ((my - rect.top) / rect.height) * preview.height;
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

function buildControls() {
  const layoutBox = $('#layoutBtns');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.dataset.layout = l.id;
    b.textContent = l.name;
    b.title = l.hint;
    b.addEventListener('click', () => {
      if (state.layout === l.id) return;
      pushHistory();
      state.layout = l.id;
      selectedPanel = 0;
      syncControls();
      render();
    });
    layoutBox.appendChild(b);
  });

  const gradeBox = $('#gradeBtns');
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.grade = g.id;
    b.textContent = g.name;
    const mid = g.stops[Math.floor(g.stops.length / 2)];
    const end = g.stops[g.stops.length - 1];
    b.style.background = `linear-gradient(135deg, rgb(${mid[1]},${mid[2]},${mid[3]}), rgb(${end[1]},${end[2]},${end[3]}))`;
    b.addEventListener('click', () => {
      if (state.grade === g.id) return;
      pushHistory();
      state.grade = g.id;
      syncControls();
      render();
    });
    gradeBox.appendChild(b);
  });
}

function syncControls() {
  document.querySelectorAll('#layoutBtns .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeBtns .swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  $('#titleInput').value = state.title;
  $('#subtitleInput').value = state.subtitle;
  $('#badgeInput').value = state.badge;
  $('#starsInput').value = String(state.stars);
  $('#starsVal').textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
  $('#grainToggle').checked = state.grain;
  $('#vignetteToggle').checked = state.vignette;
  $('#halftoneToggle').checked = state.halftone;
}

function bindInputs() {
  const text = (id, key) => {
    $(id).addEventListener('input', (e) => {
      state[key] = e.target.value;
      render();
    });
    $(id).addEventListener('change', () => pushHistory());
  };
  text('#titleInput', 'title');
  text('#subtitleInput', 'subtitle');
  text('#badgeInput', 'badge');

  $('#starsInput').addEventListener('input', (e) => {
    state.stars = Number(e.target.value);
    $('#starsVal').textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
    render();
  });
  $('#starsInput').addEventListener('change', () => pushHistory());

  const toggle = (id, key) => {
    $(id).addEventListener('change', (e) => {
      pushHistory();
      state[key] = e.target.checked;
      render();
    });
  };
  toggle('#grainToggle', 'grain');
  toggle('#vignetteToggle', 'vignette');
  toggle('#halftoneToggle', 'halftone');

  $('#zoomSlider').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    render();
  });
  $('#zoomSlider').addEventListener('change', () => pushHistory());
  $('#panXSlider').addEventListener('input', (e) => {
    state.panels[selectedPanel].dx = Number(e.target.value);
    render();
  });
  $('#panXSlider').addEventListener('change', () => pushHistory());
  $('#panYSlider').addEventListener('input', (e) => {
    state.panels[selectedPanel].dy = Number(e.target.value);
    render();
  });
  $('#panYSlider').addEventListener('change', () => pushHistory());

  $('#panelPhoto').addEventListener('change', (e) => {
    pushHistory();
    state.panels[selectedPanel].photo = Number(e.target.value);
    render();
  });

  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#resetBtn').addEventListener('click', () => {
    pushHistory();
    const keep = state.panels;
    state = defaultState();
    state.panels = keep;
    selectedPanel = 0;
    syncControls();
    render();
  });

  $('#fillOneBtn').addEventListener('click', () => {
    const ids = [...images.keys()];
    if (ids.length) fillAllWith(ids[ids.length - 1]);
  });
  $('#spreadBtn').addEventListener('click', spreadPhotos);
  $('#clearPhotosBtn').addEventListener('click', () => {
    pushHistory();
    state.panels = freshPanels();
    render();
  });

  $('#fileInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(f);
      try {
        await addPhoto(url, f.name.replace(/\.[^.]+$/, '').slice(0, 18));
      } catch (err) {
        console.error(err);
      }
    }
    e.target.value = '';
  });

  $('#sampleBoulevard').addEventListener('click', async () => {
    await loadSample(0);
    fillAllWith(0);
  });
  $('#samplePier').addEventListener('click', async () => {
    await loadSample(1);
    fillAllWith(1);
  });
  $('#sampleBoth').addEventListener('click', async () => {
    await loadSample(0);
    await loadSample(1);
    spreadPhotos();
  });

  // Click a panel to select it; drag to pan, wheel to zoom.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  preview.addEventListener('pointerdown', (e) => {
    const i = panelAtPoint(e.clientX, e.clientY);
    if (i < 0) return;
    selectedPanel = i;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    preview.setPointerCapture(e.pointerId);
    updatePanelEditor();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const slot = state.panels[selectedPanel];
    slot.dx += (e.clientX - lastX) / preview.width;
    slot.dy += (e.clientY - lastY) / preview.height;
    lastX = e.clientX;
    lastY = e.clientY;
    render();
  });
  preview.addEventListener('pointerup', () => {
    if (dragging) pushHistory();
    dragging = false;
  });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.panels[selectedPanel];
    slot.zoom = Math.min(3, Math.max(1, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    render();
  }, { passive: false });

  // Drag-and-drop photos onto the preview.
  preview.addEventListener('dragover', (e) => e.preventDefault());
  preview.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    for (const f of files) {
      await addPhoto(URL.createObjectURL(f), f.name.replace(/\.[^.]+$/, '').slice(0, 18));
    }
    if (files.length) {
      const id = nextPhotoId - 1;
      pushHistory();
      state.panels[selectedPanel].photo = id;
      render();
    }
  });

  $('#exportAllBtn').addEventListener('click', () => exportAll());
  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', () => exportOne(b.dataset.export));
  });
}

function download(canvas, filename) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportOne(sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId);
  if (!size) return null;
  const canvas = renderCover(size.w, size.h, state, images);
  download(canvas, `night-drive-${size.w}x${size.h}.png`);
  return canvas;
}

export function exportAll() {
  return EXPORT_SIZES.map((s) => {
    const canvas = renderCover(s.w, s.h, state, images);
    download(canvas, `night-drive-${s.w}x${s.h}.png`);
    return { id: s.id, w: s.w, h: s.h, canvas };
  });
}

async function init() {
  buildControls();
  bindInputs();
  syncControls();
  updateHistoryButtons();
  try {
    await document.fonts.load('40px Anton');
    await document.fonts.load('20px Pacifico');
  } catch (err) {
    console.warn('Font load raced, rendering anyway', err);
  }
  // Default: both sample photos loaded, spread across the grid.
  await loadSample(0);
  await loadSample(1);
  spreadPhotos();
  render();
  if (document.fonts?.ready) document.fonts.ready.then(() => render());
}

// Test/debug handle for the Playwright practice run.
window.__nightDrive = {
  get state() { return state; },
  images,
  renderCover,
  exportOne,
  exportAll,
  loadSample,
  fillAllWith,
  spreadPhotos,
};

init();
