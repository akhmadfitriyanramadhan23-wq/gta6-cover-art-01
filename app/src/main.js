// Vice Cover — the editor.
//
// Owns the cover state (layout, grade, words, one photo per panel) and
// wires it to the controls, the live preview and the exports. Photos are
// read on this machine and never leave it: an upload stays a local object
// URL, and the two sample photos are files under app/samples/.
//
// A `?shot=` query sets up a fixed scene for a screenshot instead
// (./shots.js): the editor shot keeps the controls, the cover shot hides
// them and fills the window with the cover.
import { drawCover, layoutRects, panelAt, panelCount, renderCover } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = { pier: 'samples/pier.jpg', boulevard: 'samples/boulevard.jpg' };
const EXPORT_SIZES = [
  { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

const canvas = document.getElementById('preview');
const status = document.getElementById('status');
const $ = (id) => document.getElementById(id);

// The cover being edited. Panels are kept one per layout slot; switching
// layout carries the photos across by slot, extras dropped, gaps left empty.
const state = {
  layout: 'poster',
  grade: 'sunset',
  caption: 'Sunset Heist',
  subline: 'Neon Boulevard',
  exportW: 1080,
  exportH: 1080,
  panels: [],
};
let selected = 0;

function blankPanel() {
  return { photo: null, zoom: 1, ox: 0, oy: 0, name: 'empty' };
}

function fitPanelsToLayout() {
  const keep = state.panels.slice(0, panelCount(state.layout));
  while (keep.length < panelCount(state.layout)) keep.push(blankPanel());
  state.panels = keep;
  selected = Math.min(selected, state.panels.length - 1);
}

function redraw() {
  drawCover(canvas, state);
  syncPanelControls();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function putSampleInPanel(name, index) {
  const photo = await loadImage(SAMPLES[name]);
  state.panels[index] = { ...state.panels[index], photo, name };
  redraw();
}

async function putUploadInPanel(file, index) {
  const photo = await loadImage(URL.createObjectURL(file));
  state.panels[index] = { ...state.panels[index], photo, name: file.name };
  redraw();
}

// --- preview size ----------------------------------------------------------
// The preview canvas follows the chosen export size (scaled to fit 900 px on
// its long side), so what you see is the cover you will get. In cover-shot
// mode it fills the window instead, for a full-frame screenshot.
function fitCanvas() {
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot === 'cover') {
    canvas.width = Math.min(1920, window.innerWidth);
    canvas.height = Math.min(1920, window.innerHeight);
    return;
  }
  const scale = Math.min(1, 900 / Math.max(state.exportW, state.exportH));
  canvas.width = Math.round(state.exportW * scale);
  canvas.height = Math.round(state.exportH * scale);
}

function setExportSize(w, h) {
  state.exportW = w;
  state.exportH = h;
  document.querySelectorAll('[data-size]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.w) === w && Number(button.dataset.h) === h);
  });
  fitCanvas();
  redraw();
}

// --- panel controls --------------------------------------------------------
const panelTabs = document.getElementById('panel-tabs');

function syncPanelControls() {
  panelTabs.querySelectorAll('button').forEach((button, i) => {
    button.classList.toggle('active', i === selected);
    button.disabled = i >= state.panels.length;
    const panel = state.panels[i];
    button.textContent = `Panel ${i + 1}${panel?.name && panel.name !== 'empty' ? ` · ${panel.name}` : ''}`;
  });
  const panel = state.panels[selected];
  if (!panel) return;
  $('zoom').value = panel.zoom;
  $('shift-x').value = panel.ox;
  $('shift-y').value = panel.oy;
  $('zoom-value').textContent = `${panel.zoom.toFixed(2)}×`;
}

function rebuildPanelTabs() {
  panelTabs.innerHTML = '';
  for (let i = 0; i < panelCount(state.layout); i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      selected = i;
      redraw();
    });
    panelTabs.appendChild(button);
  }
  syncPanelControls();
}

// --- exports ---------------------------------------------------------------
function exportCover(w, h) {
  const shot = renderCover(state, w, h);
  shot.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved vice-cover-${w}x${h}.png`;
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }, 'image/png');
}

// --- wiring ----------------------------------------------------------------
$('layout').addEventListener('change', (e) => {
  state.layout = e.target.value;
  fitPanelsToLayout();
  rebuildPanelTabs();
  redraw();
});
$('grade').addEventListener('change', (e) => {
  state.grade = e.target.value;
  redraw();
});
$('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  redraw();
});
$('subline').addEventListener('input', (e) => {
  state.subline = e.target.value;
  redraw();
});
$('zoom').addEventListener('input', (e) => {
  state.panels[selected].zoom = Number(e.target.value);
  redraw();
});
$('shift-x').addEventListener('input', (e) => {
  state.panels[selected].ox = Number(e.target.value);
  redraw();
});
$('shift-y').addEventListener('input', (e) => {
  state.panels[selected].oy = Number(e.target.value);
  redraw();
});
$('use-everywhere').addEventListener('click', () => {
  const source = state.panels[selected];
  if (!source?.photo) return;
  state.panels = state.panels.map((panel) => ({ ...panel, photo: source.photo, name: source.name }));
  status.textContent = `Used ${source.name} in every panel`;
  redraw();
});
$('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await putUploadInPanel(file, selected);
    status.textContent = `Loaded ${file.name} into panel ${selected + 1}`;
  } catch {
    status.textContent = 'That file could not be read as a photo';
  }
  e.target.value = '';
});
document.querySelectorAll('[data-sample]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await putSampleInPanel(button.dataset.sample, selected);
      status.textContent = `Loaded the ${button.dataset.sample} sample into panel ${selected + 1}`;
    } catch {
      status.textContent = 'The sample photo could not be loaded';
    }
  });
});
document.querySelectorAll('[data-export]').forEach((button) => {
  button.addEventListener('click', () => exportCover(Number(button.dataset.w), Number(button.dataset.h)));
});
document.querySelectorAll('[data-size]').forEach((button) => {
  button.addEventListener('click', () => setExportSize(Number(button.dataset.w), Number(button.dataset.h)));
});

// Drag a panel's photo to move it, scroll over it to zoom it. Pointer
// coordinates are mapped from the displayed canvas back to its pixels.
let dragging = null;
canvas.addEventListener('pointerdown', (e) => {
  const box = canvas.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * canvas.width;
  const y = ((e.clientY - box.top) / box.height) * canvas.height;
  const index = panelAt(state, x / canvas.width, y / canvas.height);
  if (index < 0) return;
  selected = index;
  dragging = { index, x, y };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const box = canvas.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * canvas.width;
  const y = ((e.clientY - box.top) / box.height) * canvas.height;
  const panel = state.panels[dragging.index];
  const rect = layoutRects(state.layout, canvas.width, canvas.height)[dragging.index];
  // Drag deltas are fractions of the dragged panel, matching ox / oy.
  panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox + (x - dragging.x) / rect.w));
  panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy + (y - dragging.y) / rect.h));
  dragging.x = x;
  dragging.y = y;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selected];
  if (!panel?.photo) return;
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  redraw();
}, { passive: false });

// --- start -----------------------------------------------------------------
fitPanelsToLayout();
rebuildPanelTabs();
fitCanvas();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (scene) => {
    state.layout = scene.layout;
    state.grade = scene.grade;
    state.caption = scene.caption;
    state.subline = scene.subline;
    $('layout').value = scene.layout;
    $('grade').value = scene.grade;
    $('caption').value = scene.caption;
    $('subline').value = scene.subline;
    if (scene.exportW) setExportSize(scene.exportW, scene.exportH);
    fitPanelsToLayout();
    rebuildPanelTabs();
    for (let i = 0; i < scene.photos.length; i += 1) {
      await putSampleInPanel(scene.photos[i], i);
      state.panels[i].ox = scene.offsets[i].ox;
      state.panels[i].oy = scene.offsets[i].oy;
    }
    fitCanvas();
    redraw();
  });
} else {
  // A cover ready to look at on first open: pier in the hero, boulevard below.
  await putSampleInPanel('pier', 0);
  await putSampleInPanel('boulevard', 1);
  await putSampleInPanel('boulevard', 2);
}
