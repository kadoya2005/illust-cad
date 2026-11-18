'use strict';
// イラレCAD：当たり判定

// ================= 当たり判定 =================
function hitAnchor(p) {
  for (const it of editableItemsTopDown()) {
    for (let s = 0; s < it.subs.length; s++) {
      const ns = it.subs[s].nodes;
      for (let i = 0; i < ns.length; i++) if (vdist(ns[i], p) <= tol()) return { it, s, i };
    }
  }
  return null;
}
function pointInFill(it, p) {
  const el = art.querySelector(`[data-id="${it.id}"]`);
  try { return el ? el.isPointInFill(new DOMPoint(p.x, p.y)) : false; } catch (_) { return false; }
}
function hitItem(p) {
  for (const it of editableItemsTopDown()) {
    const nr = Geo.nearest(it, p);
    const half = it.stroke && !S.outline ? it.sw / 2 : 0;
    if (nr && nr.d <= tol() + half) return { it, kind: 'stroke', ...nr };
    if (it.fill && !S.outline && pointInFill(it, p)) return { it, kind: 'fill' };
  }
  return null;
}
// 方向線の先（ハンドル）。いちばん近いものを、少し広めの範囲（8px）で拾う
function hitHandle(sp) {
  let best = null, bd = 8;
  for (const h of S.handleHits) { const d = Math.hypot(h.x - sp.x, h.y - sp.y); if (d <= bd) { bd = d; best = h; } }
  return best;
}
function hitBBoxHandle(sp) { const h = S.bboxHits.find((b) => Math.abs(b.x - sp.x) <= 5 && Math.abs(b.y - sp.y) <= 5); return h ? h.id : null; }
function hitGuide(sp) {
  if (!S.showGuides || S.guidesLocked) return -1;
  for (let i = doc.guides.length - 1; i >= 0; i--) {
    const g = doc.guides[i];
    const d = g.axis === 'x' ? Math.abs(toScr(P(g.v, 0)).x - sp.x) : Math.abs(toScr(P(0, g.v)).y - sp.y);
    if (d <= 3) return i;
  }
  return -1;
}
