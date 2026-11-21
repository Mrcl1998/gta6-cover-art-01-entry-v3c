/* Night Drive Cover Studio — cover rendering engine.
 * Pure canvas rendering: layouts, gradient-map grades, title block,
 * grain / vignette / halftone. No network, no dependencies.
 * Written fresh for gta6-cover-art-01 entry v3c. */

export const LAYOUTS = [
  { id: 'grid', name: 'Nine-Panel Grid', hint: 'Classic 3 x 3 poster grid' },
  { id: 'hero', name: 'Hero + Three', hint: 'One big hero, three stacked' },
  { id: 'fullbleed', name: 'Full-Bleed', hint: 'One photo, edge to edge' },
  { id: 'stack', name: 'Tilted Stack', hint: 'Overlapping snapshots' },
];

export const GRADES = [
  {
    id: 'sunset', name: 'Vice Sunset',
    stops: [[0, 22, 11, 41], [0.28, 123, 47, 139], [0.55, 255, 94, 120], [0.8, 255, 179, 71], [1, 255, 243, 196]],
  },
  {
    id: 'neon', name: 'Neon Night',
    stops: [[0, 2, 6, 23], [0.3, 30, 27, 75], [0.55, 124, 58, 237], [0.8, 236, 72, 153], [1, 165, 243, 252]],
  },
  {
    id: 'pink', name: 'Pink Haze',
    stops: [[0, 43, 10, 46], [0.3, 162, 28, 175], [0.58, 244, 114, 182], [0.82, 251, 207, 232], [1, 255, 255, 255]],
  },
  {
    id: 'teal', name: 'Teal Haze',
    stops: [[0, 3, 24, 28], [0.3, 15, 118, 110], [0.58, 45, 212, 191], [0.82, 167, 243, 208], [1, 240, 253, 250]],
  },
  {
    id: 'golden', name: 'Golden Hour',
    stops: [[0, 28, 15, 2], [0.3, 146, 64, 14], [0.58, 245, 158, 11], [0.82, 253, 230, 138], [1, 255, 251, 235]],
  },
  {
    id: 'mono', name: 'Mono Noir',
    stops: [[0, 0, 0, 0], [0.25, 64, 64, 64], [0.5, 128, 128, 128], [0.75, 192, 192, 192], [1, 255, 255, 255]],
  },
];

/* Visible panel slots per layout. A slot is { x, y, w, h, rot } in px. */
export function layoutPanels(layoutId, W, H) {
  const gap = Math.max(4, Math.round(Math.min(W, H) * 0.008));
  const pad = Math.max(6, Math.round(Math.min(W, H) * 0.012));
  const titleH = Math.round(H * 0.21);
  const photoH = H - titleH;
  if (layoutId === 'hero') {
    const heroW = Math.round((W - pad * 2 - gap) * 0.62);
    const sideX = pad + heroW + gap;
    const sideW = W - sideX - pad;
    const cellH = Math.round((photoH - pad * 2 - gap * 2) / 3);
    return [
      { x: pad, y: pad, w: heroW, h: photoH - pad * 2, rot: 0 },
      { x: sideX, y: pad, w: sideW, h: cellH, rot: 0 },
      { x: sideX, y: pad + cellH + gap, w: sideW, h: cellH, rot: 0 },
      { x: sideX, y: pad + (cellH + gap) * 2, w: sideW, h: cellH, rot: 0 },
    ];
  }
  if (layoutId === 'fullbleed') {
    return [{ x: 0, y: 0, w: W, h: photoH, rot: 0 }];
  }
  if (layoutId === 'stack') {
    const cw = Math.round(W * 0.52);
    const ch = Math.round(photoH * 0.78);
    const cx = Math.round((W - cw) / 2);
    const cy = Math.round((photoH - ch) / 2);
    return [
      { x: cx - Math.round(W * 0.16), y: cy - 8, w: cw, h: ch, rot: -0.09 },
      { x: cx + Math.round(W * 0.14), y: cy + 6, w: cw, h: ch, rot: 0.07 },
      { x: cx - Math.round(W * 0.02), y: cy + Math.round(photoH * 0.06), w: cw, h: ch, rot: -0.02 },
      { x: cx + Math.round(W * 0.05), y: cy - Math.round(photoH * 0.05), w: Math.round(cw * 0.86), h: Math.round(ch * 0.86), rot: 0.12 },
    ];
  }
  // grid: 3 x 3
  const cellW = Math.round((W - pad * 2 - gap * 2) / 3);
  const cellH = Math.round((photoH - pad * 2 - gap * 2) / 3);
  const out = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push({ x: pad + c * (cellW + gap), y: pad + r * (cellH + gap), w: cellW, h: cellH, rot: 0 });
    }
  }
  return out;
}

/* Gradient-map lookup table for a grade: 256 entries of [r, g, b]. */
export function gradeLUT(gradeId) {
  const g = GRADES.find((x) => x.id === gradeId) || GRADES[0];
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = g.stops[0];
    let b = g.stops[g.stops.length - 1];
    for (let s = 0; s < g.stops.length - 1; s++) {
      if (t >= g.stops[s][0] && t <= g.stops[s + 1][0]) { a = g.stops[s]; b = g.stops[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    lut[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  return lut;
}

function applyGrade(ctx, W, H, gradeId) {
  const lut = gradeLUT(gradeId);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Luminance with a touch of contrast, then the gradient map.
    let l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    l = Math.min(255, Math.max(0, (l - 128) * 1.12 + 128));
    const k = (l | 0) * 3;
    d[i] = lut[k]; d[i + 1] = lut[k + 1]; d[i + 2] = lut[k + 2];
  }
  ctx.putImageData(img, 0, 0);
}

/* Deterministic speckle RNG so exports are stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPhotoCover(ctx, image, panel, crop) {
  const { x, y, w, h, rot } = panel;
  const zoom = crop?.zoom ?? 1;
  const dx = crop?.dx ?? 0;
  const dy = crop?.dy ?? 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    ctx.translate(-w / 2, -h / 2);
  } else {
    ctx.translate(x, y);
  }
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (w - dw) / 2 + dx * w, (h - dh) / 2 + dy * h, dw, dh);
  ctx.restore();
}

function drawPlaceholder(ctx, panel, label) {
  const { x, y, w, h } = panel;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#3b2a63');
  g.addColorStop(1, '#14102a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.setLineDash([Math.max(6, w * 0.03), Math.max(6, w * 0.03)]);
  ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.max(11, Math.round(w * 0.055))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function drawHalftone(ctx, x, y, w, h, maxR) {
  const step = Math.max(7, maxR * 2.4);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      const fade = 1 - (xx - x) / w; // dots shrink left-to-right
      ctx.beginPath();
      ctx.arc(xx, yy, Math.max(0.6, maxR * (0.35 + 0.65 * fade)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawTitleBlock(ctx, W, H, state) {
  const titleH = Math.round(H * 0.21);
  const y0 = H - titleH;
  // Band: deep ink with a hot pink top edge.
  const band = ctx.createLinearGradient(0, y0, 0, H);
  band.addColorStop(0, '#12081f');
  band.addColorStop(1, '#2b0a33');
  ctx.fillStyle = band;
  ctx.fillRect(0, y0, W, titleH);
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(0, y0, W, Math.max(3, H * 0.006));
  if (state.halftone) drawHalftone(ctx, 0, y0 + titleH * 0.08, W, titleH * 0.5, Math.max(2, titleH * 0.035));

  const padX = Math.round(W * 0.045);
  // Badge ribbon, top-right of the band.
  const badgeText = (state.badge || '').toUpperCase();
  if (badgeText) {
    ctx.font = `700 ${Math.round(titleH * 0.17)}px Anton, sans-serif`;
    const bw = ctx.measureText(badgeText).width + titleH * 0.42;
    const bh = titleH * 0.26;
    const bx = W - padX - bw;
    const by = y0 + titleH * 0.1;
    ctx.save();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw - bh * 0.5, by + bh);
    ctx.lineTo(bx, by + bh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1c0f02';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
  }

  // Star heat meter under the badge.
  const stars = Math.max(0, Math.min(5, state.stars | 0));
  const sr = Math.max(5, titleH * 0.085);
  const gap = sr * 2.3;
  const totalW = gap * 5;
  const sx = W - padX - totalW + sr;
  const sy = y0 + titleH * 0.52;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, sx + i * gap, sy, sr, i < stars ? '#ffd23e' : 'rgba(255,255,255,0.22)');
  }

  // Main title: Anton caps, white with ink offset shadow.
  const title = (state.title || 'NIGHT DRIVE').toUpperCase();
  let size = Math.round(titleH * 0.52);
  ctx.font = `${size}px Anton, sans-serif`;
  const maxW = W - padX * 2 - (badgeText ? totalW * 0.4 : 0);
  while (size > 12 && ctx.measureText(title).width > maxW) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0d0518';
  ctx.fillText(title, padX + 4, y0 + titleH * 0.56 + 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, padX, y0 + titleH * 0.56);

  // Subtitle: Pacifico neon script, pink glow.
  const sub = state.subtitle || '';
  if (sub) {
    const subSize = Math.round(titleH * 0.26);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = Math.max(6, titleH * 0.12);
    ctx.fillStyle = '#ffd7ea';
    ctx.fillText(sub, padX + 2, y0 + titleH * 0.88);
    ctx.shadowBlur = 0;
  }
}

function drawGrain(ctx, W, H, seed) {
  const rnd = mulberry32(seed);
  const n = Math.round((W * H) / 900);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Render a cover into a fresh canvas at exactly W x H.
 * images: Map photoId -> HTMLImageElement (already loaded).
 * state: { layout, grade, title, subtitle, badge, stars, grain,
 *          vignette, halftone, panels: [{photo, zoom, dx, dy}] }
 */
export function renderCover(W, H, state, images) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Base: dusk gradient so empty areas still read as a sunset sky.
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#241536');
  base.addColorStop(0.55, '#7b2f6e');
  base.addColorStop(1, '#c65a4e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const panels = layoutPanels(state.layout, W, H);
  panels.forEach((panel, i) => {
    const slot = state.panels?.[i];
    const img = slot && slot.photo >= 0 ? images.get(slot.photo) : null;
    if (img) drawPhotoCover(ctx, img, panel, slot);
    else drawPlaceholder(ctx, panel, slot ? 'Add a photo' : `Panel ${i + 1}`);
  });

  // Grade the photo area (and base) as one unified image.
  applyGrade(ctx, W, H, state.grade);

  // Inked panel borders + outer band, drawn after the grade.
  const bw = Math.max(3, Math.round(Math.min(W, H) * 0.008));
  ctx.strokeStyle = '#0d0518';
  ctx.lineWidth = bw;
  panels.forEach((p) => {
    ctx.save();
    if (p.rot) {
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot);
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
    ctx.restore();
  });
  ctx.strokeRect(0, 0, W, H);

  drawTitleBlock(ctx, W, H, state);
  if (state.vignette) drawVignette(ctx, W, H);
  if (state.grain) drawGrain(ctx, W, H, W * 31 + H * 7 + state.title.length);

  return canvas;
}

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 x 1080', w: 1920, h: 1080 },
  { id: 'story', label: '1080 x 1920', w: 1080, h: 1920 },
];
