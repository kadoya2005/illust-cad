'use strict';
// イラレCAD：クリップボード（イラレとの SVG のやりとり）

// ---- クリップボード（イラレとの SVG のやりとりもここ） ----
function copySelection(cut) {
  const tops = selectedTops();
  if (!tops.length) return;
  const nodes = tops.map((t) => t.node);
  S.clipboard = clone(nodes);
  S.clipText = exportItemsSVG(nodes);
  try { navigator.clipboard.writeText(S.clipText).catch(() => {}); } catch (_) { /* 使えない環境ではアプリ内だけ */ }
  if (cut) { nodes.forEach((n) => removeItem(n.id)); render(); commit(); }
}
document.addEventListener('paste', (e) => {
  if (isTyping()) return;
  e.preventDefault();
  if (S.pasteHandled) return;
  S.pasteHandled = true;
  const mode = S.pasteMode;
  S.pasteMode = 'center';
  const txt = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
  if (S.clipboard && txt === S.clipText) { pasteItems(S.clipboard, mode); return; }
  if (/<svg[\s>]/i.test(txt)) {
    try {
      const r = parseSVG(txt);
      const nodes = r.layers.flatMap((L) => L.items);
      if (nodes.length) {
        pasteItems(nodes, mode);
        if (r.skipped) toast(`文字や画像など ${r.skipped} 個はまだ読み込めないので飛ばしました`);
        return;
      }
    } catch (_) { /* SVG として読めなければ下へ */ }
  }
  if (S.clipboard) pasteItems(S.clipboard, mode);
});
