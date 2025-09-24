/* grid.js — controla a planilha dentro de #grid-panel
   ✦ Esconde dt_atualizacao
   ✦ Auto-largura por maior nº de dígitos/caracteres
   ✦ Observa #grid-panel e aplica sozinho sempre que a tabela mudar
*/




(function () {
  "use strict";

  const CFG = {
    target: "#grid-panel", // <= container da sua planilha
    hiddenFields: new Set(["dt_atualizacao","dtAtualizacao"]),
    hiddenHeaderTexts: new Set([
      "dt_atualizacao","dtatualizacao",
      "última atualização","ultima atualização","ultima atualizacao",
      "data de atualização","data de atualizacao"
    ]),
    size: { min: 8, max: 40, pad: 2 }
  };

  let cssInjected = false;
  function injectCSSOnce() {
    if (cssInjected) return;
    const css = `
      ${CFG.target} { overflow-x: auto; }
      ${CFG.target} table[data-gridjs] { table-layout: fixed; width: 100%; border-collapse: collapse; }
      ${CFG.target} table[data-gridjs] th, ${CFG.target} table[data-gridjs] td {
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        font-variant-numeric: tabular-nums; vertical-align: top; padding: 6px 8px;
        border-bottom: 1px solid #e9e9e9;
      }
      ${CFG.target} table[data-gridjs] thead th { position: sticky; top: 0; background: #fafafa; z-index: 1; }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-gridjs-css","true");
    style.textContent = css;
    document.head.appendChild(style);
    cssInjected = true;
  }

  const norm = s => String(s||"")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ").trim();

  function ensureColgroup(table, n){
    let cg = table.querySelector("colgroup");
    if (!cg) { cg = document.createElement("colgroup"); table.prepend(cg); }
    while (cg.children.length < n) cg.appendChild(document.createElement("col"));
    while (cg.children.length > n) cg.removeChild(cg.lastChild);
    return cg;
  }
  function textLenForSizing(s){
    const t = (s??"").toString().trim();
    if (!t) return 0;
    return /^-?[\d\s.,]+$/.test(t) ? t.replace(/\s/g,"").length : t.length;
  }

  function getHeaderRow(table){
    if (table.tHead?.rows?.length) return table.tHead.rows[0];
    const b0 = table.tBodies[0];
    if (!b0) return null;
    // fallback: primeira linha do corpo que tenha <th>
    return Array.from(b0.rows).find(r => Array.from(r.cells).some(c => c.tagName === "TH")) || null;
  }

  function columnsToHide(table){
    const hr = getHeaderRow(table);
    if (!hr) return [];
    const idx = [];
    Array.from(hr.cells).forEach((th,i)=>{
      const dataCol = th.getAttribute("data-col"); // se você usar data-col="dt_atualizacao"
      const keyNorm = dataCol ? norm(dataCol) : "";
      const labelNorm = norm(th.textContent);
      if (CFG.hiddenFields.has(keyNorm) || CFG.hiddenHeaderTexts.has(labelNorm)) idx.push(i);
    });
    return idx;
  }

  function hideByIndex(table, idxs){
    if (!idxs.length) return;
    const rows = [
      ...(table.tHead?Array.from(table.tHead.rows):[]),
      ...(table.tBodies[0]?Array.from(table.tBodies[0].rows):[]),
      ...(table.tFoot?Array.from(table.tFoot.rows):[])
    ];
    rows.forEach(tr => idxs.forEach(i => { if (tr.cells[i]) tr.cells[i].style.display = "none"; }));
  }

  function autoSizeTable(table){
    const head = table.tHead;
    const body = table.tBodies[0];
    if (!body) return;

    const colCount =
      head?.rows?.[0]?.cells?.length ||
      body.rows?.[0]?.cells?.length || 0;
    if (!colCount) return;

    const cg = ensureColgroup(table, colCount);
    const maxChars = new Array(colCount).fill(0);

    const rows = [
      ...(head ? Array.from(head.rows) : []),
      ...Array.from(body.rows)
    ];

    for (const tr of rows){
      Array.from(tr.cells).forEach((td,i)=>{
        const raw = td.getAttribute("data-raw");
        const txt = raw ?? td.textContent ?? "";
        const len = textLenForSizing(txt);
        if (len > maxChars[i]) maxChars[i] = len;
      });
    }

    for (let i=0;i<colCount;i++){
      const w = Math.max(CFG.size.min, Math.min(CFG.size.max, maxChars[i] + CFG.size.pad));
      cg.children[i].style.width = w + "ch";
    }
  }

  function tagAndPrepare(table){
    table.setAttribute("data-gridjs",""); // escopo do CSS
    // garante data-raw nas TDs para medição fiel
    const body = table.tBodies[0];
    if (body) {
      Array.from(body.rows).forEach(tr=>{
        Array.from(tr.cells).forEach(td=>{
          if (!td.hasAttribute("data-raw")) td.setAttribute("data-raw", td.textContent ?? "");
        });
      });
    }
  }

  function applyToTable(table){
    if (!table) return;
    tagAndPrepare(table);
    hideByIndex(table, columnsToHide(table));
    autoSizeTable(table);
  }

  function applyAllIn(container){
    const tables = container.matches("table") ? [container] : Array.from(container.querySelectorAll("table"));
    tables.forEach(applyToTable);
  }

  // debounce leve para múltiplas mutações
  let rafId = 0;
  function scheduleApply(container){
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(()=> applyAllIn(container));
  }

  const Grid = {
    init(opts={}){
      if (opts.target) CFG.target = opts.target;
      if (opts.hiddenFields) CFG.hiddenFields = new Set(opts.hiddenFields.map(norm));
      if (opts.hiddenHeaderTexts) opts.hiddenHeaderTexts.forEach(t=>CFG.hiddenHeaderTexts.add(norm(t)));
      if (opts.size) CFG.size = { ...CFG.size, ...opts.size };

      injectCSSOnce();

      const panel = document.querySelector(CFG.target);
      if (!panel) return;

      // aplica já (se a tabela já existir)
      scheduleApply(panel);

      // observa mudanças dentro do #grid-panel
      const mo = new MutationObserver(()=> scheduleApply(panel));
      mo.observe(panel, { childList: true, subtree: true });

      // re-aplica em resize
      window.addEventListener("resize", ()=> scheduleApply(panel));
    },

    // opcional: aplicar manualmente
    applyNow(){
      const panel = document.querySelector(CFG.target);
      if (panel) applyAllIn(panel);
    }
  };

  window.Grid = Grid;
})();
