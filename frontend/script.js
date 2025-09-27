/* =====================================================================
   script.js — refatorado (modesc dinâmico) c/ Maps
   Nome no Google Maps = (tipoesc ajustado) + " " + nomesc
   Regra: se tipoesc === "CR.P.CONV" usar "CEI CONV" (apenas para Maps)
   ===================================================================== */

/* --------- Constantes & Mapa de labels ---------- */
window.fieldLabels = {
  codesc:"Código da EU", tipoesc:"Tipo", situacao:"Situação", rede:"Rede",
  nomesc:"Nome da UE", dre:"DRE", diretoria:"Diretoria", distrito:"Distrito",
  endereco:"End.", numero:"Nº", bairro:"Bairro", cep:"CEP",
  tel1:"Tel. 01", tel2:"Tel. 02", email:"Email", nomescofi:"Nome da UE Cofi",
  subpref:"Subprefeitura", coddist:"Cod Distrito", setor:"Setor",
  codinep:"Codigo Nep", cd_cie:"CD CIE", eh:"EH", dt_criacao:"Data da Criação",
  ato_criacao:"Ato da Criação", dom_criacao:"Dom. da Criação",
  dt_ini_conv:"Data inicio da Conv.", dt_ini_func:"Data inicio da Func.",
  dt_autoriza:"Data inicio da Autorização", dt_extintao:"Data da Extinção",
  nome_ant:"Nome Anterior", latitude:"Latitude", longitude:"Longitude",
  database:"Data Base", ceu:"CEU"
};

/* --------- Utils ---------- */
const $id = (id) => document.getElementById(id);
const $$  = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const up  = (s) => (s ?? "").toString().toUpperCase();

function toast(msg, type="info", opts={}) {
  const el = $id("toast"); if (!el) return;
  const COLORS={success:"#28a745", error:"#dc3545", warn:"#f39c12", info:"#0d6efd"};
  el.style.backgroundColor = COLORS[type] || COLORS.info;
  const resultsPanel = $id("results-panel");
  const anchor = opts.anchor || "auto";
  const panelVisible = !!(resultsPanel && !resultsPanel.hasAttribute("hidden"));
  if (anchor==="panel" || (anchor==="auto" && panelVisible)) {
    resultsPanel?.appendChild(el);
    el.classList.add("in-panel");
    el.classList.remove("position-fixed","bottom-0","end-0","m-3");
  } else {
    document.body.appendChild(el);
    el.classList.remove("in-panel");
    el.classList.add("position-fixed","bottom-0","end-0","m-3");
  }
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.style.display="none", Number.isFinite(opts.duration)?opts.duration:3000);
}

function copyToClipboard(text){
  navigator.clipboard.writeText(text)
    .then(()=>toast("Copiado para a área de transferência","success"))
    .catch(()=>toast("Erro ao copiar","error"));
}

function extractCodescFromText(text){
  if (!text) return "";
  const m1 = text.match(/C[oó]digo\s+da\s+E[U|U]:\s*([A-Za-z0-9._-]+)/i);
  if (m1?.[1]) return m1[1];
  const m2 = text.match(/\bcodesc\s*[:=]\s*([A-Za-z0-9._-]+)/i);
  return m2?.[1] || "";
}

/* --------- Estado derivado ---------- */
function getState(){
  return {
    token: ($id("access_token")?.value || "").trim(),
    codesc: ($id("codigo-ue-label")?.textContent || "—").trim(),
    tipobusca: ($id("mod-label")?.textContent || "—").trim(), // <- {modesc}
    anyConsulta: !!document.querySelector(".consulta-check:checked")
  };
}

function formatDateBR(s) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const m2 = String(s).match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  try {
    const d = new Date(s);
    if (!isNaN(d)) {
      const dd = String(d.getUTCDate()).padStart(2,"0");
      const mm = String(d.getUTCMonth()+1).toString().padStart(2,"0");
      const yy = d.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    }
  } catch(_) {}
  return s;
}

// pega token do input ou do localStorage (ultima atualizacao)
function getApiToken() {
  const fromInput = document.getElementById("access_token")?.value?.trim();
  if (fromInput) return fromInput;
  try { return localStorage.getItem("apilib_token") || null; } catch(_) { return null; }
}

// atualiza só a label do topo (não altera grid nem buscador)
async function carregarUltimaAtualizacaoSimples() {
  const label = document.getElementById("ultima-atualizacao");
  if (!label) return;
  const token = getApiToken();
  if (!token) { label.textContent = "Última atualização: conecte-se para consultar"; return; }
  label.textContent = "Última atualização: carregando...";
  try {
    const r = await fetch(
      "https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1/api/dtatualizacao/",
      { headers: { "Authorization": "Bearer " + token, "Accept": "application/json" }, cache: "no-store" }
    );
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    const dt = data?.dt_atualizacao || data?.results?.[0]?.dt_atualizacao || null;
    label.textContent = "Última atualização: " + (dt ? formatDateBR(dt) : "/");
    try { localStorage.setItem("SME.dt_atualizacao", dt || ""); } catch(_) {}
  } catch (e) {
    label.textContent = "Última atualização: indisponível";
    console.warn("dtatualizacao falhou:", e);
  }
}

/* ---- helper: título atual "Nome da UE — Código: XXX" ---- */
function getUETitle() {
  const code = (document.getElementById("codigo-ue-label")?.textContent || "—").trim();
  const sel = document.querySelector("#results .result-text.result-selected, #results .result-box.result-selected");
  if (sel) {
    const firstLine = (sel.innerText || "").split("\n").map(s => s.trim()).filter(Boolean)[0] || "";
    const nome = firstLine.replace(/^.*?:\s*/, "") || "—";
    return `${nome} — Código: ${code}`;
  }
  const modeTitle = document.querySelector("#mode-panel .mode-title")?.textContent?.trim();
  if (modeTitle) return modeTitle;
  return `Nome da UE — Código: ${code}`;
}

/* --------- Seletor & labels de topo (Código UE / Modo) ---------- */
function setCodigoUeLabel(v){
  const el=$id("codigo-ue-label"); if(!el) return;
  el.textContent = (v && v.trim()) ? v.trim() : "—";
}
function setModLabel(v){
  const el=$id("mod-label"); if(!el) return;
  el.textContent = (v && v.trim()) ? v.trim() : "—";
}

/* --------- Persistência de CK/CS ---------- */
async function loadSavedKeys() {
  try {
    let encoded = localStorage.getItem("cripto_keys");
    if (!encoded) {
      try {
        const resp = await fetch("cripto.txt");
        if (resp.ok) encoded = (await resp.text()).trim();
      } catch {}
    }
    if (!encoded) return;
    const json = JSON.parse(atob(encoded));
    if (json?.consumer_key) $id("consumer_key").value = json.consumer_key;
    if (json?.consumer_secret) $id("consumer_secret").value = json.consumer_secret;
  } catch {}
}

/* --------- Planilha (fora do #results-panel) ---------- */
const Grid = (()=> {
  let created = false;
  function ensure() {
    if (created) return $id("grid-panel");
    const anchor = $id("results-panel"); if (!anchor) return null;
    const panel = document.createElement("div");
    panel.id = "grid-panel";
    panel.style.marginTop     = "12px";
    panel.style.padding       = "8px";
    panel.style.background    = "#fff";
    panel.style.border        = "1px solid #e5e5e5";
    panel.style.borderRadius  = "6px";
    panel.style.boxSizing     = "border-box";
    panel.style.display       = "flex";
    panel.style.flexDirection = "column";
    panel.hidden = true;
    panel.style.overflow = "auto";
    panel.innerHTML = `
      <div id="grid-header" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div id="grid-title" style="font-weight:700;">Planilha de resultados</div>
        <button id="grid-download" class="btn btn-sm btn-outline-secondary" type="button">Baixar CSV</button>
        <div id="grid-count" class="text-muted" style="margin-left:auto;font-size:12px;"></div>
      </div>
      <div id="grid-scroll"></div>
    `;
    anchor.insertAdjacentElement("afterend", panel);
    created = true;
    syncSize();
    return panel;
  }
  function syncSize(){
    const rp = $id("results-panel");
    const gp = $id("grid-panel");
    if (!rp || !gp) return;
    const w = rp.offsetWidth; if (w) gp.style.width = w + "px";
    const h = rp.offsetHeight; if (h) gp.style.maxHeight = Math.max(220, h) + "px";
  }
  function toCSV(rows, headers){
    const esc = (v) => {
      const s = v==null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const head = headers.map(h=>esc(h.label)).join(";");
    const body = rows.map(r=>headers.map(h=>esc(r[h.key])).join(";")).join("\n");
    return head+"\n"+body;
  }
  function downloadCSV(filename, csv){
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=(filename||"planilha")+".csv";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},0);
  }
  function render(items, opts={}){
    const panel = ensure(); if (!panel) return;
    const { anyConsulta } = getState();
    panel.hidden = !anyConsulta;
    if (panel.hidden) return;
    const box   = $id("grid-scroll");
    const title = $id("grid-title");
    const count = $id("grid-count");
    const btnDL = $id("grid-download");
    const rows = Array.isArray(items) ? items : [];
    if (title) title.textContent = opts.title || "Planilha de resultados";
    if (count) count.textContent = `${rows.length} linha(s)`;
    box.innerHTML = "";
    if (!rows.length) {
      box.innerHTML = "<div class='p-2 text-muted'>Nenhum dado para exibir.</div>";
      return;
    }
    let keys;
    if (rows[0] && ("descserie" in rows[0] || "turno" in rows[0] || "total_alunos" in rows[0])) {
      const base=["descserie","turno","total_alunos"];
      const real=Object.keys(rows[0]); keys=[...base, ...real.filter(k=>!base.includes(k))];
    } else {
      const pref=["nomesc","tipoesc","dre","codesc","situacao","rede","endereco","numero","bairro","distrito","subpref","cep","coddist","setor","codinep","cd_cie","eh","database"];
      const set=new Set(); rows.forEach(r=>Object.keys(r||{}).forEach(k=>set.add(k)));
      const real=[...set]; keys=[...pref.filter(k=>real.includes(k)), ...real.filter(k=>!pref.includes(k))];
    }
    const headers = keys.map(k=>({key:k, label:(window.fieldLabels?.[k]||k)}));
    const table=document.createElement("table");
    table.className="table table-sm table-bordered table-striped";
    table.style.margin="0";
    table.style.display   = "block";
    table.style.boxSizing = "border-box";
    table.style.width     = "calc(100% - 10px)";
    const thead=document.createElement("thead");
    thead.style.position="sticky"; thead.style.top="0"; thead.style.zIndex="1";
    thead.style.background="#f6f6f6";
    const thr=document.createElement("tr");
    headers.forEach(h=>{ const th=document.createElement("th"); th.textContent=h.label; th.style.whiteSpace="nowrap"; thr.appendChild(th);});
    thead.appendChild(thr);
    table.appendChild(thead);
    const tbody=document.createElement("tbody");
    rows.forEach(r=>{
      const tr=document.createElement("tr");
      headers.forEach(h=>{
        const td=document.createElement("td");
        let v=r ? r[h.key] : "";
        if (h.key==="descserie" && (v==null)) v="—";
        td.textContent = (v==null?"":v)+"";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(table);
    if (window.Grid?.applyTo) { Grid.applyTo(table); }
    if (btnDL) btnDL.onclick=()=>downloadCSV(opts.filename||"planilha-resultados", toCSV(rows,headers));
    purgeTablesInsidePanels();
  }
  function purgeTablesInsidePanels(){
    $id("results-panel")?.querySelectorAll("table").forEach(tb=>tb.remove());
    $id("mode-panel")?.querySelectorAll("#mode-scroll table").forEach(tb=>tb.remove());
  }
  return { ensure, render, syncSize, purgeTablesInsidePanels };
})();

/* --------- Fetch bus ---------- */
const FetchBus = (()=> {
  const listeners = [];
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init={})=>{
    const res = await origFetch(input, init);
    try {
      const url   = (typeof input==="string") ? input : input?.url || "";
      const meth  = (init?.method || "GET").toUpperCase();
      const clone = res.clone();
      const data  = await clone.json().catch(()=>null);
      listeners.forEach(fn => fn({url, meth, data, res}));
    } catch {}
    return res;
  };
  function on(fn){ listeners.push(fn); }
  return { on };
})();

/* --------- Pós-fetch: render fora, modo dinâmico ---------- */
FetchBus.on(({url, meth, data})=>{
  if (url.includes("/api/schools") && meth==="POST") {
    const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.items) ? data.items : []);
    if (items.length) Grid.render(items, { title:"Planilha de escolas", filename:"escolas" });
  }
  if (/\/sme\/EscolaAberta\/v1\/api\//i.test(url) && meth==="GET") {
    const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    if (items.length) {
      const modeNow = (getState().tipobusca || "").toLowerCase();
      Grid.render(items, { title: getUETitle(), filename: modeNow || "consulta" });
    }
  }
});

/* --------- Busca DINÂMICA do modo selecionado ---------- */
async function fetchModeIfNeeded(){
  const { tipobusca, codesc, token } = getState();
  const mode = (tipobusca||"").trim();
  if (!mode || mode==="—") return;
  if (!codesc || codesc==="—" || !token) return;
  const modePanel = $id("mode-panel");
  if (modePanel) modePanel.hidden = false;
  const box = $id("mode-scroll");
  if (box) box.innerHTML = "<div class='p-2 small text-muted'>Carregando…</div>";
  const base = "https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1/api";
  const url1 = `${base}/${encodeURIComponent(mode)}/${encodeURIComponent(codesc)}/`;
  const url2 = `${base}/${encodeURIComponent(mode)}/${encodeURIComponent(codesc)}`;
  async function doFetch(u){
    const resp = await fetch(u, { method:"GET", headers:{ accept:"application/json", Authorization:`Bearer ${token}` } });
    return resp;
  }
  try {
    let r = await doFetch(url1);
    if (r.status===404) r = await doFetch(url2);
    if (!r.ok) {
      const txt = await r.text().catch(()=> "");
      if (box) box.innerHTML = `<div class='p-2 text-danger'>Erro ${r.status}: ${txt || "Falha na consulta"}</div>`;
      return;
    }
    if (box) box.innerHTML = "";
  } catch {
    if (box) box.innerHTML = "<div class='p-2 text-danger'>Erro de rede na consulta.</div>";
  }
}

/* ==== Observa mudança do label "Código da UE" ==== */
(function () {
  function byId(id){ return document.getElementById(id); }
  function fireActiveConsulta() {
    const active = document.querySelector('.consulta-check:checked');
    if (!active) return;
    setModLabel(active.value || "—");
    fetchModeIfNeeded();
  }
  document.addEventListener('DOMContentLoaded', function () {
    const lbl = byId('codigo-ue-label');
    if (!lbl || !window.MutationObserver) return;
    let last = (lbl.textContent || '').trim();
    const obs = new MutationObserver(() => {
      const current = (lbl.textContent || '').trim();
      if (current === last) return;
      last = current;
      setTimeout(fireActiveConsulta, 0);
    });
    obs.observe(lbl, { childList: true, characterData: true, subtree: true });
    carregarUltimaAtualizacaoSimples();
  });
})();

/* ==== NOVO: Observa mudança do label "Mod:" para disparar planilha ==== */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const mod = document.getElementById('mod-label');
    if (!mod || !window.MutationObserver) return;

    let last = (mod.textContent || '').trim();
    const obs = new MutationObserver(() => {
      const current = (mod.textContent || '').trim();
      if (current === last) return;
      last = current;

      // Só dispara se houver checkbox selecionado e código válido
      const { anyConsulta, codesc, token, tipobusca } = getState();
      if (anyConsulta && codesc && codesc !== "—" && token && tipobusca && tipobusca !== "—") {
        fetchModeIfNeeded();
      }

      // Se ninguém selecionado, esconde planilha e painel de modo
      if (!anyConsulta) {
        const gp = document.getElementById('grid-panel');
        if (gp) gp.hidden = true;
        const mp = document.getElementById('mode-panel');
        if (mp) mp.hidden = true;
        const ms = document.getElementById('mode-scroll');
        if (ms) ms.innerHTML = "";
      }
    });
    obs.observe(mod, { childList: true, characterData: true, subtree: true });
  });
})();


/* --------- Montagem e eventos ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const btnConnect       = $id("btn-connect");
  const btnSearchSchools = $id("btn-search-schools");
  const btnClearAll      = $id("btn-clear-all");
  const btnSaveKeys      = $id("btn-save-keys");
  const resultsDiv       = $id("results");
  const resultsPanel     = $id("results-panel");

  $$('input[type="text"]').forEach(inp=>{
    const id=inp.id||"";
    if (id==="consumer_key"||id==="consumer_secret") return;
    inp.addEventListener("input", ()=> inp.value = up(inp.value));
  });

  loadSavedKeys();

  btnConnect?.addEventListener("click", async ()=>{
    const ck = $id("consumer_key")?.value.trim();
    const cs = $id("consumer_secret")?.value.trim();
    if (!ck || !cs) { toast("Preencha consumer key e segredo","error"); return; }
    try {
      const r = await fetch("/api/connect",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ consumer_key:ck, consumer_secret:cs, base_url: "https://gateway.apilib.prefeitura.sp.gov.br/token" })
      });
      const data = await r.json();
      if (data.access_token){
        const acc = $id("access_token");
        acc.value = data.access_token;
        acc.setAttribute("readonly", true);
        btnConnect.textContent = "Conectado";
        btnConnect.classList.add("connected");
        toast("Conexão bem-sucedida","success");
        window.apiToken = data.access_token;
        try { localStorage.setItem("apilib_token", data.access_token); } catch(_) {}
        carregarUltimaAtualizacaoSimples();
      } else {
        toast("Erro: "+(data.error||"Token não retornado"),"error");
      }
    } catch(e){ toast("Erro de conexão: "+e.message,"error"); }
  });

  btnSearchSchools?.addEventListener("click", async ()=>{
    const token=($id("access_token")?.value||"").trim();
    if (!token){ toast("Preencha o token de acesso","error"); return; }
    $$(".consulta-check").forEach(c=>c.checked=false);
    setModLabel("—");
    const payload={ token };
    ["page","search","dre","tipoesc","distrito","bairro","subpref"].forEach(id=>{
      const v=$id(id)?.value.trim(); if (v) payload[id]=v;
    });
    try{
      const r = await fetch("/api/schools",{
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(payload)
      });
      const data=await r.json();
      resultsDiv.innerHTML=""; resultsDiv.classList.remove("overflowing");
      if (data.error){ toast(data.error,"error"); resultsPanel&&(resultsPanel.hidden=false); return; }
      const items = Array.isArray(data.results) ? data.results : [];
      if (!items.length){ toast("Nenhuma escola encontrada","warn"); resultsPanel&&(resultsPanel.hidden=false); return; }

      items.forEach(item=>{
        const wrap=document.createElement("div"); wrap.className="mb-3";
        const pre=document.createElement("pre");
        pre.dataset.codesc = (item.codesc ?? "");
        pre.dataset.latitude  = (item.latitude  ?? "");
        pre.dataset.longitude = (item.longitude ?? "");
        pre.dataset.nomesc    = (item.nomesc    ?? "");
        pre.dataset.tipoesc   = (item.tipoesc   ?? "");

        pre.className="form-control result-text";
        pre.style.whiteSpace="pre-wrap"; pre.style.wordBreak="break-word";
        pre.style.fontFamily="Verdana, sans-serif"; pre.style.fontSize="16px";
        pre.style.lineHeight="16px"; pre.style.height="128px";
        const lines=[];

        const cbNomesc = document.querySelector(`.field-check[data-field="nomesc"]`);
        if (cbNomesc?.checked) {
          const label=fieldLabels.nomesc||"nomesc";
          const tipo  = item.tipoesc || "";
          const nome  = item.nomesc ?? "";
          const prefix= tipo ? (tipo+" ") : "";
          const cbDre = document.querySelector(`.field-check[data-field="dre"]`);
          const dreVal= (cbDre?.checked) ? (item.dre ?? "") : "";
          const suffix= dreVal ? ` / ${dreVal}` : "";
          lines.push(`${label}: <b>${prefix}${nome}${suffix}</b>`);
        }

        const showDiret=document.querySelector(`.field-check[data-field="diretoria"]`)?.checked;
        const showDistr=document.querySelector(`.field-check[data-field="distrito"]`)?.checked;
        if (showDiret || showDistr){
          const parts=[];
          if (showDiret) parts.push(`${fieldLabels.diretoria}: <b>${item.diretoria??""}</b>`);
          if (showDistr) parts.push(`${fieldLabels.distrito}: <b>${item.distrito??""}</b>`);
          lines.push(parts.join("   "));
        }

        (()=>{
          const group=["codesc","situacao","rede"];
          const parts=[];
          group.forEach(f=>{
            const cb=document.querySelector(`.field-check[data-field="${f}"]`);
            if (cb?.checked) parts.push(`${fieldLabels[f]||f}: <b>${item[f]??""}</b>`);
          });
          if (parts.length) lines.push(parts.join("   "));
        })();

        if (lines.length>=2) lines.push("");

        (()=>{
          const hasEnd = document.querySelector(`.field-check[data-field="endereco"]`)?.checked;
          const hasNum = document.querySelector(`.field-check[data-field="numero"]`)?.checked;
          const hasBai = document.querySelector(`.field-check[data-field="bairro"]`)?.checked;
          const hasTipo= document.querySelector(`.field-check[data-field="tipoesc"]`)?.checked;
          const hasCep = document.querySelector(`.field-check[data-field="cep"]`)?.checked;
          if (!(hasEnd||hasNum||hasBai||hasTipo||hasCep)) return;
          const vEnd=hasEnd?(item.endereco??""):"";
          const vNum=hasNum?(item.numero??""):"";
          const vBai=hasBai?(item.bairro??""):"";
          const vTip=hasTipo?(item.tipoesc??""):"";
          const vCep=hasCep?(item.cep??""):"";
          let out="";
          if (vEnd) out+=`${vEnd}`;
          if (vNum) out+=(out?`, nº: ${vNum}`:`nº: ${vNum}`);
          if (vBai){ out=out.trimEnd(); out+=` - ${vBai}`; }
          if (vTip) out+=(out?` ${vTip}`:`${vTip}`);
          if (vCep) out+=(out?`, CEP: ${vCep}`:`${vCep}`);
          out += (out?`, São Paulo - SP`:`São Paulo - SP`);
          lines.push(out);
        })();

        $$('.field-check:checked').forEach(cb=>{
          const f=cb.getAttribute("data-field");
          const skip=new Set(["nomesc","dre","diretoria","distrito","codesc","situacao","rede","endereco","numero","bairro","tipoesc","cep"]);
          if (skip.has(f)) return;
          lines.push(`${fieldLabels[f]||f}: ${item[f]??""}`);
        });

        pre.innerHTML = lines.join("\n");
        pre.addEventListener("click", ()=>{
          $$('#results .result-text.result-selected, #results .result-box.result-selected')
            .forEach(el=>{ el.classList.remove("result-selected"); el.style.backgroundColor=""; });
          pre.classList.add("result-selected");
          pre.style.backgroundColor="lightgreen";
          const code = pre.dataset.codesc || extractCodescFromText(pre.innerText||"");
          setCodigoUeLabel(code);
          updateModePanelTitleFromSelected();
        });

        const copyBtn=document.createElement("button");
        copyBtn.className="btn btn-sm btn-primary copy-btn"; copyBtn.textContent="Copiar";
        copyBtn.addEventListener("click", ()=>copyToClipboard(pre.innerText));

        const copyEndBtn=document.createElement("button");
        copyEndBtn.className="btn btn-sm btn-secondary copy-btn"; copyEndBtn.textContent="Copia End.";
        copyEndBtn.style.marginLeft="6px";
        copyEndBtn.style.whiteSpace = "nowrap";
        copyEndBtn.addEventListener("click", ()=>{
          const linesArr=pre.innerText.split("\n").map(l=>l.trimEnd());
          let addrLine=linesArr.find(l=>/São Paulo - SP|CEP:\s*\S|nº:\s*\S|Nº:\s*\S/.test(l));
          if (!addrLine && linesArr.length>=4) addrLine=linesArr[3];
          if (addrLine) copyToClipboard(addrLine.trim());
          else toast("Não há linha de endereço para copiar.","warn");
        });

        const mapsBtn = document.createElement("button");
        mapsBtn.className = "btn btn-sm btn-secondary copy-btn";
        mapsBtn.textContent = "Maps";
        mapsBtn.style.marginLeft = "6px";
        mapsBtn.style.whiteSpace = "nowrap";
        if (window.MapsApp) {
          MapsApp.bindButton(mapsBtn, () => {
            let tipo = pre.dataset.tipoesc || item.tipoesc || "";
            if (tipo === "CR.P.CONV") tipo = "CEI"; // <<< regra só para Maps
            const nome = pre.dataset.nomesc || item.nomesc || "";
            return {
              lat:  pre.dataset.latitude  ?? item.latitude,
              lon:  pre.dataset.longitude ?? item.longitude,
              name: `${tipo} ${nome}`.trim()
            };
          });
        }

        wrap.appendChild(pre);
        wrap.appendChild(copyBtn);
        wrap.appendChild(copyEndBtn);
        wrap.appendChild(mapsBtn);
        resultsDiv.appendChild(wrap);
      });

      if (resultsDiv.scrollHeight > resultsDiv.clientHeight) resultsDiv.classList.add("overflowing");
      resultsPanel && (resultsPanel.hidden=false);
      toast(`Encontradas ${data.count || items.length} escola(s)`,"success");
    } catch(e){
      toast("Erro na busca: "+e.message,"error");
      resultsPanel && (resultsPanel.hidden=false);
    }
  });


  btnClearAll?.addEventListener("click", ()=>{
    ["page","search","dre","tipoesc","distrito","bairro","subpref"].forEach(id=>{ const el=$id(id); if (el) el.value=""; });
    $$(".filter-check").forEach(cb=>{
      if (cb.dataset.filter!=="search") cb.checked=false;
      const field=document.querySelector(`.filter-field[data-filter="${cb.dataset.filter}"]`);
      if (field) field.style.display = cb.checked ? "" : "none";
    });
    $id("results").innerHTML=""; $id("results").classList.remove("overflowing");
    if ($id("results-panel")) $id("results-panel").hidden=true;
    setCodigoUeLabel("—"); setModLabel("—");
    const gp = $id("grid-panel"); if (gp) gp.hidden = true;
    const mp = $id("mode-panel"); if (mp) mp.hidden = true;
    const ms = $id("mode-scroll"); if (ms) ms.innerHTML = "";
  });


  $$(".clear-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const targetId=btn.getAttribute("data-target");
      const el = targetId && $id(targetId);
      if (el) el.value="";
    });
  });


  $$(".filter-check").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const name=cb.getAttribute("data-filter"); if(!name) return;
      const field=document.querySelector(`.filter-field[data-filter="${name}"]`);
      if (field) field.style.display = cb.checked ? "" : "none";
    });
  });


  btnSaveKeys?.addEventListener("click", ()=>{
    const ck=$id("consumer_key")?.value.trim();
    const cs=$id("consumer_secret")?.value.trim();
    if (!ck||!cs){ toast("Preencha a Chave e o Segredo para salvar","error"); return; }
    try{
      localStorage.setItem("cripto_keys", btoa(JSON.stringify({consumer_key:ck, consumer_secret:cs})));
      toast("Chaves salvas com sucesso","success");
    }catch(e){ toast("Erro ao salvar as chaves: "+e.message,"error");}
  });


  (function autoConnect(){
    if (window.__autoConnectTimerStarted) return;
    window.__autoConnectTimerStarted = true;
    const PERIOD_MS=3500*1000, START_DELAY_MS=1000;
    function clickBtn(){ btnConnect?.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true})); }
    setTimeout(()=>{ clickBtn(); setInterval(clickBtn, PERIOD_MS); }, START_DELAY_MS);
  })();

  $id("results")?.addEventListener("click",(e)=>{
    const pre = e.target.closest?.(".result-text");
    const box = e.target.closest?.(".result-box");
    const el  = pre || box; if (!el) return;
    $$('#results .result-selected').forEach(x=>{ x.classList.remove("result-selected"); x.style.backgroundColor=""; });
    el.classList.add("result-selected"); el.style.backgroundColor="lightgreen";
    const code = el.dataset?.codesc || extractCodescFromText(el.innerText||"");
    setCodigoUeLabel(code);
    updateModePanelTitleFromSelected();
  }, true);
});


(function () {
  function normalize(t){ return (t||"").replace(/\s+/g," ").trim().toLowerCase(); }
  function tagCsvButton(root=document) {
    const candidates = root.querySelectorAll('button, a.btn, .btn');
    for (const el of candidates) {
      const txt = normalize(el.textContent);
      if (txt === 'baixar csv' || txt.includes('baixar csv')) {
        el.classList.add('download-csv-btn');
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => tagCsvButton());
  } else {
    tagCsvButton();
  }
  const gridPanel = document.getElementById('grid-panel') || document.body;
  if (window.MutationObserver && gridPanel) {
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) tagCsvButton(gridPanel);
      }
    });
    obs.observe(gridPanel, { childList: true, subtree: true });
  }

})();

/* ============================================================
   PATCH NÃO INTRUSIVO — HAMBÚRGUER DIREITO (.consulta-check)
   ✦ Não altera fluxo de token / requisições
   ✦ Restaura marca/desmarca visual dos checkboxes
   ✦ Seleção exclusiva (um por vez) — opcional (ver flag)
   ✦ Atualiza o label "Mod:" do topo
   ✦ Mostra/Esconde planilha conforme seleção
   ============================================================ */
(function() {
  // ---- CONFIG: ligue/desligue seleção exclusiva aqui
  const SELECAO_EXCLUSIVA = true;

  function $id(s){ return document.getElementById(s); }
  function $qs(s, r=document){ return r.querySelector(s); }
  function $qsa(s, r=document){ return Array.from(r.querySelectorAll(s)); }

  function setText(id, value) {
    const el = $id(id);
    if (el) el.textContent = (value ?? "—");
  }

  function togglePlanilhaVisibility() {
    const any = !!$qs('.consulta-check[type="checkbox"]:checked', $id('connectSidebar'));
    const gp = $id('grid-panel');
    const mp = $id('mode-panel');
    const ms = $id('mode-scroll');
    if (!any) {
      if (gp) gp.hidden = true;
      if (mp) mp.hidden = true;
      if (ms) ms.innerHTML = "";
    }
  }

  function initRightMenuPatch() {
    const menu = $id("connectSidebar");
    if (!menu || menu.__consultaPatchApplied) return;
    menu.__consultaPatchApplied = true;

    // 1) Não deixar handlers do offcanvas “engolirem” o clique no checkbox/label
    menu.addEventListener("click", (e) => {
      const isCheckbox = e.target.matches('.consulta-check[type="checkbox"]');
      const isLabelForCheckbox = e.target.tagName === 'LABEL' && e.target.htmlFor;
      if (isCheckbox || isLabelForCheckbox) {
        e.stopPropagation();
      }
    }, true);

    // 2) Quando o estado muda, refletir visualmente e atualizar "Mod:" + visibilidade
    menu.addEventListener("change", (e) => {
      const cb = e.target;
      if (!cb.matches('.consulta-check[type="checkbox"]')) return;

      if (cb.checked) {
        if (SELECAO_EXCLUSIVA) {
          $qsa('.consulta-check[type="checkbox"]', menu).forEach(other => {
            if (other !== cb) other.checked = false;
          });
        }
        setText("mod-label", cb.value || "—"); // <- isto dispara o MutationObserver do Mod
      } else {
        // Se ninguém ficou marcado, limpa o "Mod:" e esconde planilha
        const any = $qs('.consulta-check[type="checkbox"]:checked', menu);
        if (!any) {
          setText("mod-label", "—");
          togglePlanilhaVisibility();
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRightMenuPatch);
  } else {
    initRightMenuPatch();
  }
})();

/* ===============================
   SCROLL FULL-HEIGHT FOR PLANILHA
   (Option 1): grid fills window height
   =============================== */
(function () {
  function $id(s){ return document.getElementById(s); }

  function resizeGridToViewport() {
    const panel  = $id("grid-panel");
    if (!panel) return;

    // Distance from top of viewport to top of panel
    const top    = panel.getBoundingClientRect().top;
    const vh     = window.innerHeight || document.documentElement.clientHeight || 800;
    const gap    = 16; // small breathing room at bottom
    const h      = Math.max(220, vh - top - gap);

    // Panel scroll
    panel.style.height     = h + "px";
    panel.style.maxHeight  = h + "px";
    panel.style.overflowY  = "auto";

    // Inner scroll area should consume remaining height after header
    const header = $id("grid-header");
    const scroll = $id("grid-scroll");
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const innerH  = Math.max(120, h - headerH - 8);
    if (scroll) {
      scroll.style.height     = innerH + "px";
      scroll.style.maxHeight  = innerH + "px";
      scroll.style.overflowY  = "auto";
    }
  }

  // Override/supplement Grid.syncSize without changing other logic
  if (window.Grid) {
    window.Grid.syncSize = resizeGridToViewport;
  }

  // Recompute on load and on resize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", resizeGridToViewport);
  } else {
    resizeGridToViewport();
  }
  window.addEventListener("resize", resizeGridToViewport);

  // Also recompute whenever the grid gets (re)rendered
  const moTarget = document.body;
  if (window.MutationObserver && moTarget) {
    const obs = new MutationObserver(() => resizeGridToViewport());
    obs.observe(moTarget, { childList: true, subtree: true });
  }
})();