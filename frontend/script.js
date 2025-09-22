/* =====================================================================
   script.js — refatorado
   ✦ Mantém fluxo de token e gráficos
   ✦ Consolidado, sem gambiarras, sem fetch duplo
   ✦ Planilha fora do #results-panel (sem duplicação)
   ✦ alunosserieturno fetch quando .consulta-check = "alunosserieturno"
   ✦ Mode title = "Nome da UE — Código: xxx"
   ✦ Ao clicar Buscar, desmarca .consulta-check
   ✦ #mod-panel NUNCA dentro do #results-panel
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
    tipobusca: ($id("mod-label")?.textContent || "—").trim(),
    anyConsulta: !!document.querySelector(".consulta-check:checked")
  };
}


/* ---- helper: título atual "Nome da UE — Código: XXX" ---- */
function getUETitle() {
  const code = (document.getElementById("codigo-ue-label")?.textContent || "—").trim();
  // tenta pegar o nome da UE do item selecionado nos resultados
  const sel = document.querySelector("#results .result-text.result-selected, #results .result-box.result-selected");
  if (sel) {
    const firstLine = (sel.innerText || "").split("\n").map(s => s.trim()).filter(Boolean)[0] || "";
    const nome = firstLine.replace(/^.*?:\s*/, "") || "—";
    return `${nome} — Código: ${code}`;
  }
  // fallback: se não houver seleção, tenta deduzir pelo mode-title (se existir)
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

/* --------- Título do mode-panel: Nome da UE — Código ---------- */
function updateModePanelTitleFromSelected(){
  const selected = $id("results")?.querySelector(".result-text.result-selected, .result-box.result-selected");
  const modePanel = $id("mode-panel"); if (!modePanel) return;
  let titleEl = modePanel.querySelector(".mode-title");
  if (!titleEl) {
    titleEl = document.createElement("div");
    titleEl.className = "mode-title";
    titleEl.style.fontWeight = "600";
    titleEl.style.fontSize = "16px";
    titleEl.style.marginBottom = "6px";
    modePanel.prepend(titleEl);
  }
  let nome = "—", code = "—";
  if (selected) {
    const txt = selected.innerText || "";
    const first = txt.split("\n").map(s=>s.trim()).filter(Boolean)[0] || "";
    nome = first.replace(/^.*?:\s*/, "") || "—";
    code = selected.dataset?.codesc || extractCodescFromText(txt) || "—";
  } else {
    code = ($id("codigo-ue-label")?.textContent||"—").trim();
  }
  titleEl.textContent = `${nome} — Código: ${code}`;
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
        panel.hidden = true; // visível só com consulta-check marcada

        panel.style.overflow = "auto"; // scrollbox no próprio grid-panel

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
        syncSize(); // ajusta altura inicialmente
        return panel;
        }




        function syncSize(){
        const rp = $id("results-panel");
        const gp = $id("grid-panel");
        if (!rp || !gp) return;

        const w = rp.offsetWidth;
        if (w) gp.style.width = w + "px";

        const h = rp.offsetHeight;
        // altura máxima do grid-panel segue a do results-panel
        if (h) gp.style.maxHeight = Math.max(220, h) + "px";
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

    // colunas
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

    // tabela
    const table=document.createElement("table");
    table.className="table table-sm table-bordered table-striped";
    table.style.margin="0";
    table.style.display   = "block";
    table.style.boxSizing = "border-box";
    table.style.width     = "calc(100% - 10px)"; // 10px mais estreita

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

    if (btnDL) btnDL.onclick=()=>downloadCSV(opts.filename||"planilha-resultados", toCSV(rows,headers));

    // garante que nenhuma tabela fique dentro de results/mode
    purgeTablesInsidePanels();
  }
  function purgeTablesInsidePanels(){
    $id("results-panel")?.querySelectorAll("table").forEach(tb=>tb.remove());
    $id("mode-panel")?.querySelectorAll("#mode-scroll table").forEach(tb=>tb.remove());
  }
  return { ensure, render, syncSize, purgeTablesInsidePanels };
})();


/* --------- Fetch bus (um único hook) ---------- */
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
    } catch {} // silencioso
    return res;
  };
  function on(fn){ listeners.push(fn); }
  return { on };
})();

/* --------- Regras de pós-fetch (planilha fora) ---------- */
FetchBus.on(({url, meth, data})=>{
  // /api/schools → planilha de escolas fora
  if (url.includes("/api/schools") && meth==="POST") {
    const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.items) ? data.items : []);
    if (items.length) Grid.render(items, { title:"Planilha de escolas", filename:"escolas" });
  }
if (/\/sme\/EscolaAberta\/v1\/api\/alunosserieturno\//i.test(url) && meth==="GET") {
  const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
  if (items.length) {
    Grid.render(items, { title: getUETitle(), filename: "alunosserieturno" });
  }
}
});

/* --------- Busca alunosserieturno no clique do checkbox correspondente ---------- */
async function fetchAlunosSerieTurnoIfNeeded(){
  const { tipobusca, codesc, token } = getState();
  if (!tipobusca || tipobusca.toLowerCase() !== "alunosserieturno") return;
  if (!codesc || codesc==="—" || !token) return;

  // exibe o mode-panel (sem borda especial)
  const mode = $id("mode-panel");
  if (mode) mode.hidden = false;

  const box = $id("mode-scroll");
  if (box) box.innerHTML = "<div class='p-2 small text-muted'>Carregando…</div>";

  const base = "https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1/api";
  const url1 = `${base}/${encodeURIComponent(tipobusca)}/${encodeURIComponent(codesc)}/`;
  const url2 = `${base}/${encodeURIComponent(tipobusca)}/${encodeURIComponent(codesc)}`;

  async function doFetch(u){
    const resp = await fetch(u, {
      method:"GET",
      headers:{ accept:"application/json", Authorization:`Bearer ${token}` }
    });
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
    // OBS: a planilha aparecerá FORA via FetchBus; aqui só limpamos o mode
    if (box) box.innerHTML = "";
  } catch {
    if (box) box.innerHTML = "<div class='p-2 text-danger'>Erro de rede na consulta.</div>";
  }
}

/* --------- Montagem e eventos ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const btnConnect       = $id("btn-connect");
  const btnSearch        = $id("btn-search");
  const btnClearSearch   = $id("btn-clear-search");
  const btnSearchSchools = $id("btn-search-schools");
  const btnClearAll      = $id("btn-clear-all");
  const btnSaveKeys      = $id("btn-save-keys");
  const resultsDiv       = $id("results");
  const resultsPanel     = $id("results-panel");

  // inputs texto em UPPER (menos CK/CS)
  $$('input[type="text"]').forEach(inp=>{
    const id=inp.id||"";
    if (id==="consumer_key"||id==="consumer_secret") return;
    inp.addEventListener("input", ()=> inp.value = up(inp.value));
  });

  // carrega CK/CS salvos
  loadSavedKeys();

  // conectar/token
  btnConnect?.addEventListener("click", async ()=>{
    const ck = $id("consumer_key")?.value.trim();
    const cs = $id("consumer_secret")?.value.trim();
    if (!ck || !cs) { toast("Preencha consumer key e segredo","error"); return; }
    try {
      const r = await fetch("/api/connect",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ consumer_key:ck, consumer_secret:cs, base_url:"https://gateway.apilib.prefeitura.sp.gov.br/token" })
      });
      const data = await r.json();
      if (data.access_token){
        const acc = $id("access_token");
        acc.value = data.access_token;
        acc.setAttribute("readonly", true);
        btnConnect.textContent = "Conectado";
        btnConnect.classList.add("connected");
        toast("Conexão bem-sucedida","success");
      } else {
        toast("Erro: "+(data.error||"Token não retornado"),"error");
      }
    } catch(e){ toast("Erro de conexão: "+e.message,"error"); }
  });

  // busca antiga (opcional)
  btnSearch?.addEventListener("click", async ()=>{
    const token=($id("access_token")?.value||"").trim();
    const name =$id("school_name")?.value.trim();
    if (!token || !name) { toast("Preencha token e nome da escola","error"); return; }
    try {
      const r = await fetch("/api/search",{
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ token, base_url:"http://localhost:5000", name })
      });
      const data = await r.json();
      resultsDiv.innerHTML = "";
      const matches = data.matches || (data.match?[data.match]:[]);
      if (matches.length){
        matches.forEach(match=>{
          const box=document.createElement("div"); box.className="result-box";
          ["nome","endereco","numero","dre"].forEach(f=>{
            const div=document.createElement("div"); div.className="field";
            div.innerHTML = `<span class="label">${f.toUpperCase()}:</span> ${match[f] || "-"}`;
            box.appendChild(div);
          });
          const copyIcon=document.createElement("span");
          copyIcon.className="copy-icon"; copyIcon.innerHTML="📋";
          copyIcon.addEventListener("click", ()=>copyToClipboard(JSON.stringify(match)));
          box.appendChild(copyIcon);

          box.addEventListener("click", ()=>{
            $$(`#results .result-selected`).forEach(el=>el.classList.remove("result-selected"));
            box.classList.add("result-selected");
            box.style.backgroundColor="lightgreen";
            setCodigoUeLabel(extractCodescFromText(box.innerText||""));
            updateModePanelTitleFromSelected();
          });
          resultsDiv.appendChild(box);
        });
        resultsPanel && (resultsPanel.hidden=false);
      } else {
        toast("Nenhuma correspondência encontrada","warn");
        resultsPanel && (resultsPanel.hidden=false);
      }
    } catch(e){ toast("Erro na busca: "+e.message,"error"); }
  });

  // limpar busca antiga
  btnClearSearch?.addEventListener("click", ()=>{
    const nameField=$id("school_name"); if(nameField) nameField.value="";
    resultsDiv.innerHTML=""; resultsPanel && (resultsPanel.hidden=true);
    setCodigoUeLabel("—"); updateModePanelTitleFromSelected();
  });

  // busca com filtros
  btnSearchSchools?.addEventListener("click", async ()=>{
    const token=($id("access_token")?.value||"").trim();
    if (!token){ toast("Preencha o token de acesso","error"); return; }

    // ao clicar Buscar, DESMARCA “Itens a consultar”
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

      // render lista (texto) como no seu fluxo original
      items.forEach(item=>{
        const wrap=document.createElement("div"); wrap.className="mb-3";
        const pre=document.createElement("pre");
        pre.dataset.codesc = (item.codesc ?? "");
        pre.className="form-control result-text";
        pre.style.whiteSpace="pre-wrap"; pre.style.wordBreak="break-word";
        pre.style.fontFamily="Verdana, sans-serif"; pre.style.fontSize="16px";
        pre.style.lineHeight="16px"; pre.style.height="128px";
        const lines=[];

        // primeira linha (Nome da UE + Tipo + /DRE se marcados)
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

        // diretoria/distrito
        const showDiret=document.querySelector(`.field-check[data-field="diretoria"]`)?.checked;
        const showDistr=document.querySelector(`.field-check[data-field="distrito"]`)?.checked;
        if (showDiret || showDistr){
          const parts=[];
          if (showDiret) parts.push(`${fieldLabels.diretoria}: <b>${item.diretoria??""}</b>`);
          if (showDistr) parts.push(`${fieldLabels.distrito}: <b>${item.distrito??""}</b>`);
          lines.push(parts.join("   "));
        }

        // codesc/situacao/rede
        (()=>{
          const group=["codesc","situacao","rede"];
          const parts=[];
          group.forEach(f=>{
            const cb=document.querySelector(`.field-check[data-field="${f}"]`);
            if (cb?.checked) parts.push(`${fieldLabels[f]||f}: <b>${item[f]??""}</b>`);
          });
          if (parts.length) lines.push(parts.join("   "));
        })();

        // linha em branco
        if (lines.length>=2) lines.push("");

        // endereço
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
          if (vCep) out+=(out?`, CEP: ${vCep}`:`CEP: ${vCep}`);
          out += (out?`, São Paulo - SP`:`São Paulo - SP`);
          lines.push(out);
        })();

        // demais campos marcados
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
        copyEndBtn.addEventListener("click", ()=>{
          const linesArr=pre.innerText.split("\n").map(l=>l.trimEnd());
          let addrLine=linesArr.find(l=>/São Paulo - SP|CEP:\s*\S|nº:\s*\S|Nº:\s*\S/.test(l));
          if (!addrLine && linesArr.length>=4) addrLine=linesArr[3];
          if (addrLine) copyToClipboard(addrLine.trim());
          else toast("Não há linha de endereço para copiar.","warn");
        });

        wrap.appendChild(pre); wrap.appendChild(copyBtn); wrap.appendChild(copyEndBtn);
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

  // limpar tudo
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
    Grid.ensure() && ( $id("grid-panel").hidden = true );
  });

  // limpar/cancelar campos individuais
  $$(".clear-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const targetId=btn.getAttribute("data-target");
      const el = targetId && $id(targetId);
      if (el) el.value="";
    });
  });

  // mostra/oculta campos dos filtros
  $$(".filter-check").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const name=cb.getAttribute("data-filter"); if(!name) return;
      const field=document.querySelector(`.filter-field[data-filter="${name}"]`);
      if (field) field.style.display = cb.checked ? "" : "none";
    });
  });

  // salvar CK/CS
  btnSaveKeys?.addEventListener("click", ()=>{
    const ck=$id("consumer_key")?.value.trim();
    const cs=$id("consumer_secret")?.value.trim();
    if (!ck||!cs){ toast("Preencha a Chave e o Segredo para salvar","error"); return; }
    try{
      localStorage.setItem("cripto_keys", btoa(JSON.stringify({consumer_key:ck, consumer_secret:cs})));
      toast("Chaves salvas com sucesso","success");
    }catch(e){ toast("Erro ao salvar as chaves: "+e.message,"error");}
  });

  // auto-connect (mantido)
  (function autoConnect(){
    if (window.__autoConnectTimerStarted) return;
    window.__autoConnectTimerStarted = true;
    const PERIOD_MS=3500*1000, START_DELAY_MS=1000;
    function clickBtn(){ btnConnect?.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true})); }
    setTimeout(()=>{ clickBtn(); setInterval(clickBtn, PERIOD_MS); }, START_DELAY_MS);
  })();

  // seleção dentro do results
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

  // “Itens a consultar”: exclusivos e set do mod-label
  document.addEventListener("change",(e)=>{
    const chk = e.target;
    if (!chk.matches?.(".consulta-check")) return;
    // apenas um por vez
    $$(".consulta-check").forEach(o=>{ if (o!==chk) o.checked=false; });
    setModLabel(chk.checked ? chk.value : "—");
    // se for alunosserieturno, dispara fetch
    fetchAlunosSerieTurnoIfNeeded();
    // grid visível/oculto conforme marcado
    const gp = Grid.ensure(); if (gp) gp.hidden = !getState().anyConsulta;
  }, true);

  // garante que #mod-panel NÃO fique dentro do #results-panel
  (function ensureModeOutside(){
    const results = $id("results-panel"); const mod = $id("mod-panel");
    if (results && mod && results.contains(mod)) results.insertAdjacentElement("afterend", mod);
    // remove borda verde do mod-panel (se houver CSS herdado antigo)
    if (mod){ mod.style.border="none"; mod.style.background="#fff"; }
  })();

  // responsividade da planilha
  window.addEventListener("resize", Grid.syncSize);

  // inicial
  Grid.ensure();
  Grid.syncSize();
  updateModePanelTitleFromSelected();
  window.addEventListener("resize", Grid.syncSize);
  });




/* ==== APPEND-ONLY: dispara a busca quando o label "Código da UE" mudar ==== */
(function () {
  function byId(id){ return document.getElementById(id); }

  // Dispara a mesma rotina de quando o usuário marca um .consulta-check
  function fireActiveConsulta() {
    const active = document.querySelector('.consulta-check:checked');
    if (!active) return; // se nada estiver selecionado, não há o que consultar

    // dispara o 'change' no checkbox ativo (bubbles igual ao do usuário)
    active.dispatchEvent(new Event('change', { bubbles: true }));

    // reforços: se você tiver helpers expostos, tenta atualizar os painéis também
    if (window.__modePanel && typeof window.__modePanel.fetchModePanel === 'function') {
      try { window.__modePanel.fetchModePanel(); } catch {}
    }
    if (window.__gridPanel && typeof window.__gridPanel.ensure === 'function') {
      try { window.__gridPanel.ensure(); } catch {}
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const lbl = byId('codigo-ue-label');
    if (!lbl || !window.MutationObserver) return;

    let last = (lbl.textContent || '').trim();

    const obs = new MutationObserver(() => {
      const current = (lbl.textContent || '').trim();
      if (current === last) return;     // evita disparo duplo sem mudança real
      last = current;

      // aguarda um tick para outros patches atualizarem estados/labels
      setTimeout(fireActiveConsulta, 0);
    });

    // observa qualquer mudança de texto/filhos no label do topo
    obs.observe(lbl, { childList: true, characterData: true, subtree: true });
  });
})();


