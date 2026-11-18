'use strict';
// イラレCAD：ガイドのドラッグ・図形ツール・ツールの切り替え

// ---- ガイドを動かす・消す ----
function dragGuide(p) {
  const d = S.drag, g = doc.guides[d.i];
  if (!g) return;
  d.moved = true;
  g.v = g.axis === 'x' ? p.x : p.y;
}
function inRulerZone(sp, axis) {
  const r = stage.getBoundingClientRect();
  if (sp.x < 0 || sp.y < 0 || sp.x > r.width || sp.y > r.height) return true;
  return S.rulers && (axis === 'y' ? sp.y < RULER : sp.x < RULER);
}
function endGuideMove(sp) {
  const d = S.drag, g = doc.guides[d.i];
  if (g && inRulerZone(sp, g.axis)) { doc.guides.splice(d.i, 1); S.selGuide = null; }
  commit();
}

function shapeTool(kind) {
  return {
    down(e, p) {
      if (!layerWritable(activeLayerObj())) { toast('ロック中または非表示のレイヤーには描けません'); return; }
      const cands = buildCands();
      S.drag = { type: 'shape', start: snapPoint(p, cands).p, moved: false, id: null, cands };
    },
    move(e, p) {
      const d = S.drag;
      if (!d.moved && vdist(p, d.start) * view.z < 3) return;
      d.moved = true;
      S.snapViz = null;
      if (!e.shiftKey) { const sn = snapPoint(p, d.cands); p = sn.p; S.snapViz = sn.viz; }
      const subs = [shapeFromDrag(kind, d.start, p, e.shiftKey, e.altKey)];
      if (!d.id) { const it = newItem(subs, kind === 'line'); activeLayerObj().items.push(it); d.id = it.id; selItem(it, false); }
      else { const f = findItem(d.id); if (f) f.item.subs = subs; }
      renderArt();
    },
    up(e) {
      const d = S.drag;
      if (d.moved) { commit(); return; }
      const start = d.start, alt = e.altKey;
      S.drag = null;
      setTimeout(() => shapeDialog(kind, start, alt), 0);
    },
  };
}
function shapeFromDrag(kind, a, b, shift, alt) {
  if (kind === 'line') {
    const q = shift ? constrain45(a, b) : b;
    const s = alt ? P(2 * a.x - q.x, 2 * a.y - q.y) : a;
    return { nodes: [mkNode(s.x, s.y), mkNode(q.x, q.y)], closed: false };
  }
  let dx = b.x - a.x, dy = b.y - a.y;
  if (shift) { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
  const x0 = alt ? a.x - dx : a.x, y0 = alt ? a.y - dy : a.y, x1 = a.x + dx, y1 = a.y + dy;
  const L = Math.min(x0, x1), R = Math.max(x0, x1), T = Math.min(y0, y1), B = Math.max(y0, y1);
  return kind === 'rect' ? rectSub(L, T, R, B) : ellipseSub((L + R) / 2, (T + B) / 2, (R - L) / 2, (B - T) / 2);
}
function shapeDialog(kind, p, alt) {
  const isLine = kind === 'line';
  const v = prompt(isLine ? '長さ（pt）と角度（度）をカンマで区切って入力してください' : '幅と高さ（pt）をカンマで区切って入力してください', '100, ' + (isLine ? '0' : '100'));
  if (v == null) return;
  const [a, b] = v.split(/[,、\s]+/).map(parseFloat);
  if (!isFinite(a) || !isFinite(b)) { toast('数値を読めませんでした'); return; }
  let sb;
  if (isLine) {
    const r = (b * Math.PI) / 180, q = P(p.x + Math.cos(r) * a, p.y - Math.sin(r) * a);
    sb = alt ? { nodes: [mkNode(2 * p.x - q.x, 2 * p.y - q.y), mkNode(q.x, q.y)], closed: false } : { nodes: [mkNode(p.x, p.y), mkNode(q.x, q.y)], closed: false };
  } else {
    if (a <= 0 || b <= 0) { toast('幅と高さは 0 より大きくしてください'); return; }
    const x0 = alt ? p.x - a / 2 : p.x, y0 = alt ? p.y - b / 2 : p.y;
    sb = kind === 'rect' ? rectSub(x0, y0, x0 + a, y0 + b) : ellipseSub(x0 + a / 2, y0 + b / 2, a / 2, b / 2);
  }
  const it = newItem([sb], isLine);
  activeLayerObj().items.push(it);
  selItem(it, false); render(); commit();
}

function setTool(t) {
  if (!TOOLS_META[t]) return;
  if (S.drawing && t !== 'pen' && t !== 'hand' && t !== 'zoom') endDrawing();
  S.tool = t;
  if (SEL_TOOLS.has(t)) S.lastSelTool = t;
  if (!XF_TOOLS.has(t)) S.xfOrigin = null;
  S.hover = null; S.penHint = ''; S.snapViz = null;
  updateUI(); drawOverlay(); updateCursor();
}
// 方向線の先に重ねたときのカーソル（イラレのアンカーポイントツールの「＜」）。先端（左の角）がクリック位置
const HANDLE_CURSOR = (() => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">'
    + '<polyline points="15,4 4,12 15,20" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="miter" stroke-linecap="square"/>'
    + '<polyline points="15,4 4,12 15,20" fill="none" stroke="#000" stroke-width="1.6" stroke-linejoin="miter" stroke-linecap="square"/></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 4 12, default`;
})();
function overHandle(t) {
  if (S.drag) return S.drag.type === 'handle';
  if (!S.mouseScr) return false;
  const ok = t === 'direct' || t === 'convert' || (t === 'pen' && S.keys.alt);
  return ok && !!hitHandle(S.mouseScr);
}
function updateCursor() {
  const t = displayTool();
  let c = 'default';
  if (overHandle(t)) c = HANDLE_CURSOR;
  else if (t === 'hand') c = S.drag && S.drag.type === 'pan' ? 'grabbing' : 'grab';
  else if (t === 'zoom') c = S.keys.alt ? 'zoom-out' : 'zoom-in';
  else if (!SEL_TOOLS.has(t)) c = 'crosshair';
  stage.style.cursor = c;
}
