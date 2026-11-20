// Fixed scenes for screenshots: ?shot=editor shows the editor with a photo
// loaded, ?shot=cover shows the cover alone, filling the window.
//
// Query params (all optional, with the defaults shown):
//   layout=poster|triptych|single   (poster)
//   grade=sunset|neon|dusk          (sunset)
//   caption=<words>                 (Sunset Heist)
//   subline=<words>                 (Neon Boulevard)
//   photo=<sample>                  pier or boulevard, used in every panel
//   photo1/photo2/photo3=<sample>   one sample per panel, beats photo
//   ox1/oy1, ox2/oy2, ox3/oy3       per-panel photo offsets (-0.6..0.6)
//   exportW/exportH=<pixels>        preview size for the editor shot
// window.__shotReady is set once the scene has painted, so a screenshot
// runner knows when to take the picture.
export async function runShot(shot, query, apply) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const pick = (i) => query.get(`photo${i + 1}`) ?? query.get('photo') ?? 'pier';
  const shift = (i, axis) => {
    const value = Number(query.get(`${axis}${i + 1}`) ?? 0);
    return Number.isFinite(value) ? Math.max(-0.6, Math.min(0.6, value)) : 0;
  };
  const scene = {
    layout: query.get('layout') ?? 'poster',
    grade: query.get('grade') ?? 'sunset',
    caption: query.get('caption') ?? 'Sunset Heist',
    subline: query.get('subline') ?? 'Neon Boulevard',
    photos: [pick(0), pick(1), pick(2)],
    offsets: [0, 1, 2].map((i) => ({ ox: shift(i, 'ox'), oy: shift(i, 'oy') })),
    exportW: Number(query.get('exportW') ?? 0) || null,
    exportH: Number(query.get('exportH') ?? 0) || null,
  };
  await apply(scene);
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  window.__shotReady = true;
}
