// Vice Cover — the cover renderer.
//
// A cover is a set of framed photo panels on one canvas plus a bold
// outlined caption. Every layout is defined as fractions of the canvas, so
// the same state draws at any export size: the editor preview, a square
// post, a portrait post or a wide banner all come from one drawing.
//
// State shape (built by src/main.js):
//   {
//     layout: 'poster' | 'triptych' | 'single',
//     grade:  'sunset' | 'neon' | 'dusk',
//     caption: string,          // big title, drawn in capitals
//     subline: string,          // small line above the title
//     panels: [ { photo, zoom, ox, oy } ]   // one per layout slot
//   }
// A panel's photo is an Image (or null for an empty slot). zoom multiplies
// the cover-fit scale (1 shows the whole cover-fit, 3 is punched in close).
// ox / oy slide the photo inside its frame, in fractions of the frame.

const GAP_FRACTION = 0.008; // white gutter between panels, as a share of width

/** Panel rectangles for a layout, as fractions {x, y, w, h} of the canvas. */
export const LAYOUTS = {
  // Hero photo across the top, two small photos shoulder to shoulder below.
  poster: [
    { x: 0, y: 0, w: 1, h: 0.62 },
    { x: 0, y: 0.62, w: 0.5, h: 0.38 },
    { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
  ],
  // Three tall panels side by side, the classic poster strip.
  triptych: [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ],
  // One photo filling the whole frame.
  single: [{ x: 0, y: 0, w: 1, h: 1 }],
};

/** How many photo slots a layout has. */
export function panelCount(layout) {
  return (LAYOUTS[layout] ?? LAYOUTS.poster).length;
}

/** The pixel rectangles of a layout's panels on a canvas of this size. */
export function layoutRects(layout, width, height) {
  return (LAYOUTS[layout] ?? LAYOUTS.poster).map((f) => ({
    x: f.x * width,
    y: f.y * height,
    w: f.w * width,
    h: f.h * height,
  }));
}

/** Which panel (if any) holds the point (x, y) in canvas pixels. */
export function panelAt(state, x, y) {
  const rects = layoutRects(state.layout, 1, 1);
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/**
 * Draws one photo into its frame, cover-fit: the photo always fills the
 * frame, cropped on the long side. zoom scales it up around its centre and
 * ox / oy slide it, both in fractions of the frame's width and height.
 */
function drawPanel(ctx, panel, rect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = '#241a2e';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const photo = panel?.photo;
  if (photo && photo.naturalWidth > 0) {
    const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
    const scale = base * clamp(panel.zoom ?? 1, 1, 3);
    const pw = photo.naturalWidth * scale;
    const ph = photo.naturalHeight * scale;
    const dx = rect.x + (rect.w - pw) / 2 + (panel.ox ?? 0) * rect.w;
    const dy = rect.y + (rect.h - ph) / 2 + (panel.oy ?? 0) * rect.h;
    ctx.drawImage(photo, dx, dy, pw, ph);
  }
  ctx.restore();
}

/**
 * The colour grade: a wash of tinted light over the whole cover, a warm
 * horizon glow for sunset, split neon light for neon, a cool violet dusk —
 * then a vignette that pulls the edges down so the caption pops.
 */
function paintGrade(ctx, grade, w, h) {
  if (grade === 'neon') {
    const split = ctx.createLinearGradient(0, 0, w, h);
    split.addColorStop(0, 'rgba(255, 45, 149, 0.20)');
    split.addColorStop(0.55, 'rgba(120, 40, 200, 0.10)');
    split.addColorStop(1, 'rgba(0, 229, 255, 0.20)');
    ctx.fillStyle = split;
    ctx.fillRect(0, 0, w, h);
    const pink = ctx.createRadialGradient(w * 0.15, h * 0.12, 0, w * 0.15, h * 0.12, w * 0.5);
    pink.addColorStop(0, 'rgba(255, 45, 149, 0.28)');
    pink.addColorStop(1, 'rgba(255, 45, 149, 0)');
    ctx.fillStyle = pink;
    ctx.fillRect(0, 0, w, h);
    const cyan = ctx.createRadialGradient(w * 0.9, h * 0.9, 0, w * 0.9, h * 0.9, w * 0.55);
    cyan.addColorStop(0, 'rgba(0, 229, 255, 0.26)');
    cyan.addColorStop(1, 'rgba(0, 229, 255, 0)');
    ctx.fillStyle = cyan;
    ctx.fillRect(0, 0, w, h);
  } else if (grade === 'dusk') {
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(56, 189, 248, 0.10)');
    wash.addColorStop(0.5, 'rgba(88, 28, 135, 0.16)');
    wash.addColorStop(1, 'rgba(24, 8, 54, 0.42)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
  } else {
    // sunset
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(255, 166, 77, 0.08)');
    wash.addColorStop(0.55, 'rgba(255, 120, 60, 0.10)');
    wash.addColorStop(1, 'rgba(255, 70, 120, 0.30)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, w * 0.48);
    glow.addColorStop(0, 'rgba(255, 196, 96, 0.38)');
    glow.addColorStop(1, 'rgba(255, 196, 96, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
  const shade = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
}

/**
 * The lettering: a small spaced subline, then the title in heavy capitals,
 * shrunk until it fits the frame, with a dark outline so it reads over any
 * photo. Sizes are shares of the canvas height, so exports stay in ratio.
 */
function drawCaption(ctx, caption, subline, w, h) {
  const title = (caption ?? '').trim().toUpperCase();
  const sub = (subline ?? '').trim().toUpperCase();
  const baseline = h * 0.93;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (sub) {
    const subSize = Math.max(12, h * 0.026);
    ctx.font = `700 ${subSize}px sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, subSize * 0.32)}px`; } catch { /* older canvas: no tracking */ }
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = subSize * 0.35;
    ctx.fillText(sub, w / 2, baseline - h * 0.115);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* reset */ }
  }
  if (!title) return;
  let size = h * 0.105;
  ctx.font = `900 ${size}px sans-serif`;
  while (ctx.measureText(title).width > w * 0.92 && size > 14) {
    size -= 2;
    ctx.font = `900 ${size}px sans-serif`;
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.16);
  ctx.strokeStyle = 'rgba(24, 6, 38, 0.92)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = size * 0.18;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(title, w / 2, baseline);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, w / 2, baseline);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Draws the whole cover from `state` onto `canvas` at its own size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  // Off-white board first: the gutters between panels read as a white frame.
  ctx.fillStyle = '#f5efe6';
  ctx.fillRect(0, 0, w, h);
  const gap = Math.max(4, Math.round(w * GAP_FRACTION));
  const rects = layoutRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const inset = {
      x: rect.x + gap / 2,
      y: rect.y + gap / 2,
      w: rect.w - gap,
      h: rect.h - gap,
    };
    drawPanel(ctx, state.panels[i], inset);
  });
  paintGrade(ctx, state.grade, w, h);
  drawCaption(ctx, state.caption, state.subline, w, h);
}

/** Renders the cover at an exact export size and returns the canvas. */
export function renderCover(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state);
  return canvas;
}
