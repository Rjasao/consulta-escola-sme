// pesquisaue.js — Tabs + Autocomplete (sem tocar em script.js)
// Dropdown em duas linhas:
//   linha 1: "tipoesc nomesc"
//   linha 2: endereço
// Seleção + box abaixo: "tipoesc nomesc - rua/endereco, numero - bairro / dre"
// Botões "Apagar" e "Apagar tudo":
//   - Desktop: na mesma linha, à direita do input
//   - Mobile (<=640px): acima do input
// Novidades:
//   1) Caixas abaixo são clicáveis: ao clicar, ficam verdes (active). Clique novamente para voltar ao normal.
//   2) Se houver alguma caixa verde, novas seleções do dropdown são ACUMULADAS abaixo (até 4 no máximo).
(function () {
  // --- Tabs (single-page) ---
  const btnPrincipal  = document.getElementById("tab-btn-principal");
  const btnPesquisa   = document.getElementById("tab-btn-pesquisaue");
  const mainPanel     = document.getElementById("main-panel");
  const pesquisaPanel = document.getElementById("pesquisaue-panel");

  function showPrincipal() {
    btnPrincipal?.classList.add("active");
    btnPesquisa?.classList.remove("active");
    if (mainPanel)    mainPanel.style.display = "";
    if (pesquisaPanel)pesquisaPanel.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showPesquisa() {
    btnPesquisa?.classList.add("active");
    btnPrincipal?.classList.remove("active");
    if (mainPanel)    mainPanel.style.display = "none";
    if (pesquisaPanel)pesquisaPanel.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  btnPrincipal?.addEventListener("click", showPrincipal);
  btnPesquisa?.addEventListener("click", showPesquisa);

  // --- Autocomplete Pesquisa UE ---
  function getToken() {
    const el = document.getElementById("access_token");
    return (el && el.value) ? el.value.trim() : "";
  }

  const ENDPOINT = "https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1/api/escolas/";
  const MIN = 1;

  const input = document.getElementById("pu-school-input");
  const dd    = document.getElementById("pu-school-dd");
  const sel   = document.getElementById("pu-selected");
  const elTipo= document.getElementById("pu-sel-tipoesc");
  const elRede= document.getElementById("pu-sel-rede");
  const elNome= document.getElementById("pu-sel-nomesc");
  const elCod = document.getElementById("pu-sel-codesc");
  const elDre = document.getElementById("pu-sel-dre");

  if (!input || !dd) return;

  // Estado
  let items = [];
  let active = -1;
  let ctrl   = null;

  // Utils
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function showLoading(){ dd.innerHTML = '<div class="pu-dd-item loading">Carregando…</div>'; dd.hidden = false; }
  function showEmpty(){ dd.innerHTML = '<div class="pu-dd-item disabled">Nenhuma UE encontrada</div>'; dd.hidden = false; }

  // --- Botões: Apagar & Apagar tudo (inline direita no desktop, acima no mobile) ---
  function setupButtons(){
    const wrap = document.querySelector(".pu-autocomplete-wrapper");
    if (!wrap) return;
    ensureStyle();
    // evita duplicação
    if (document.getElementById("pu-btn-clear") || document.getElementById("pu-btn-clear-all")) return;

    const parent = wrap.parentElement;
    if (!parent) return;

    // Linha em flex com wrapper + ações à direita
    const row = document.createElement("div");
    row.className = "pu-row-inline";
    parent.insertBefore(row, wrap);
    row.appendChild(wrap);

    // wrapper ocupa o espaço e mantém dropdown relativo
    wrap.classList.add("pu-autocomplete-wrapper-js");

    const actions = document.createElement("div");
    actions.id = "pu-actions";

    const btnClear = document.createElement("button");
    btnClear.id = "pu-btn-clear";
    btnClear.type = "button";
    btnClear.textContent = "Apagar";
    btnClear.className = "btn btn-sm btn-outline-secondary";
    btnClear.addEventListener("click", () => {
      input.value = "";
      dd.innerHTML = "";
      dd.hidden = true;
      items = [];
      active = -1;
      input.focus();
    });

    const btnClearAll = document.createElement("button");
    btnClearAll.id = "pu-btn-clear-all";
    btnClearAll.type = "button";
    btnClearAll.textContent = "Apagar tudo";
    btnClearAll.className = "btn btn-sm btn-outline-danger";
    btnClearAll.addEventListener("click", () => {
      input.value = "";
      dd.innerHTML = "";
      dd.hidden = true;
      items = [];
      active = -1;
      if (sel){
        sel.hidden = true;
        sel.innerHTML = "";
      }
      if (elTipo) elTipo.textContent = "—";
      if (elNome) elNome.textContent = "—";
      if (elCod)  elCod.textContent  = "—";
      if (elDre)  elDre.textContent  = "—";
      input.focus();
    });

    actions.appendChild(btnClear);
    actions.appendChild(btnClearAll);
    row.appendChild(actions);
  }

  // cria um cartão e adiciona o toggler de seleção (verde)
  function moveCard(card, dir){
    const parent = card && card.parentElement;
    if (!parent) return;
    if (dir === -1){ // up
      const prev = card.previousElementSibling;
      if (prev && prev.classList.contains('pu-card')){
        parent.insertBefore(card, prev);
      }
    } else if (dir === 1){ // down
      const next = card.nextElementSibling;
      if (next && next.classList.contains('pu-card')){
        parent.insertBefore(next, card);
      }
    }
  }

  
  
  function createCard(text){
    const card = document.createElement("div");
    card.className = "pu-card";

    const content = document.createElement("div");
    content.className = "pu-card-text";
    content.textContent = text;

    const actions = document.createElement("div");
    actions.className = "pu-card-actions";

    const btnUp = document.createElement("button");
    btnUp.type = "button";
    btnUp.className = "pu-card-move";
    btnUp.setAttribute("aria-label", "Mover para cima");
    btnUp.textContent = "▲";
    btnUp.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      moveCard(card, -1);
    });

    const btnDown = document.createElement("button");
    btnDown.type = "button";
    btnDown.className = "pu-card-move";
    btnDown.setAttribute("aria-label", "Mover para baixo");
    btnDown.textContent = "▼";
    btnDown.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      moveCard(card, 1);
    });

    const btnClose = document.createElement("button");
    btnClose.className = "pu-card-close";
    btnClose.type = "button";
    btnClose.setAttribute("aria-label", "Remover");
    btnClose.textContent = "×";
    btnClose.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = card.parentElement;
      card.remove();
      if (parent && parent.querySelectorAll(".pu-card").length === 0){
        if (sel){
          sel.hidden = true;
          sel.innerHTML = "";
        }
      }
    });

    // Toggle verde ao clicar no corpo do card
    card.addEventListener("click", () => {
      card.classList.toggle("active");
    });

    actions.appendChild(btnUp);
    actions.appendChild(btnDown);
    actions.appendChild(btnClose);

    card.appendChild(content);
    card.appendChild(actions);
    return card;
  }
function mapRow(row){

    const g = k => row?.[k] ?? row?.[k?.toUpperCase?.()] ?? row?.[k?.toLowerCase?.()];



    const tipoesc = (g("tipoesc") || g("tipo") || "").toString().trim();

    const rede = (g("rede") || "").toString().trim();

    const nomesc  = (g("nomesc")  || g("nome") || "").toString().trim();

    const dre     = (g("dres") || g("dre") || "").toString().trim();



    // Endere\u00e7o

    const rua    = (g("rua") || g("logradouro") || g("endereco") || g("address") || "").toString().trim();

    const numero = (g("numero") || g("num") || g("nro") || "").toString().trim();

    const bairro = (g("bairro") || "").toString().trim();

    const cep    = (g("cep") || "").toString().trim();



    const ruaNome = rua || cep; // fallback para CEP



    const header = [tipoesc, rede, nomesc].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    const enderecoPrincipal = [ruaNome, numero].filter(Boolean).join(", ");

    let bairroDre = "";

    if (bairro && dre) {

      bairroDre = `${bairro} / ${dre}`;

    } else if (bairro) {

      bairroDre = bairro;

    } else if (dre) {

      bairroDre = `/ ${dre}`;

    }

    const sufixo = [enderecoPrincipal, bairroDre].filter(Boolean).join(" - ");

    let fullLine = header;

    if (sufixo) fullLine = header ? `${header} - ${sufixo}` : sufixo;

    fullLine = fullLine.replace(/\s+/g, " ").replace(/ -\s*$/, "").trim();



    let endereco = "";

    if (ruaNome) endereco = ruaNome;

    if (numero)  endereco += (endereco ? ", " : "") + numero;

    if (bairro)  endereco += (endereco ? " - " : "") + bairro;

    if (dre) {\r\n    const drePart = `/ ${dre}`;\r\n    endereco = endereco ? `${endereco} / ${dre}` : drePart;\r\n  }



    return {

      tipoesc,

      rede,

      nomesc,

      dre,

      endereco,

      bairroDre,

      fullLine,

      codesc: g("codesc") || g("cod_ue") || g("Codigo") || ""

    };

  }



  // DROPDOWN: duas linhas (tipoesc rede nomesc) e, abaixo, o endereço
  function render(list){
    dd.innerHTML = "";
    if (!list || !list.length){ showEmpty(); return; }

    list.forEach((it, i)=>{
      const div = document.createElement("div");
      div.className = "pu-dd-item" + (i===active ? " active" : "");

      const l1 = document.createElement("div");
      l1.className = "pu-main";
      const headerParts = [it.tipoesc, it.rede, it.nomesc].filter(Boolean).map(str => (str || "").toString().trim());
      l1.textContent = headerParts.join(" ").trim();

      const l2 = document.createElement("div");
      l2.className = "pu-sub";
      l2.textContent = it.endereco ? it.endereco : (it.bairroDre || "-");

      div.appendChild(l1);
      div.appendChild(l2);

      div.addEventListener("mousedown", e => { e.preventDefault(); select(i); });
      dd.appendChild(div);
    });

    dd.hidden = false;
  }

  function setActive(i){
    const total = dd.children.length; if (!total) return;
    if (i < 0) i = total - 1; if (i >= total) i = 0;
    active = i;
    Array.from(dd.children).forEach((el, idx)=>el.classList.toggle("active", idx===active));
  }

  function select(i){

    const it = items[i]; if (!it) return;

    const headerParts = [(it.tipoesc||"").trim(), (it.rede||"").trim(), (it.nomesc||"").trim()].filter(Boolean);

    const headerText = headerParts.join(" ").replace(/\s+/g, " ").trim();

    const suffixParts = [];

    const enderecoTxt = (it.endereco || "").trim();

    if (enderecoTxt) suffixParts.push(enderecoTxt);

    const dreTxt = ((it.bairroDre || (it.dre ? `/ ${it.dre}` : "")) || "").trim();

    if (dreTxt) {

      const hasDre = suffixParts.some(part => part.includes(it.dre || dreTxt));

      if (!hasDre) suffixParts.push(dreTxt);

    }

    let txt = it.fullLine ? it.fullLine.trim() : headerText;

    if (!it.fullLine){

      if (suffixParts.length){

        txt = headerText ? `${headerText} - ${suffixParts.join(" - ")}` : suffixParts.join(" - ");

      }

    }

    txt = txt.replace(/\s+/g, " ").replace(/ -\s*$/, "").trim();

    input.value = txt;

    dd.hidden = true; active = -1;



    if (sel){

      sel.hidden = false;

      const hasActive = !!sel.querySelector(".pu-card.active");

      if (hasActive){

        const count = sel.querySelectorAll(".pu-card").length;

        if (count >= 4){

          try { console.warn("Limite de 4 escolas atingido."); } catch(e){}

        } else {

          sel.appendChild(createCard(txt));

        }

      } else {

        sel.innerHTML = "";

        sel.appendChild(createCard(txt));

      }

    }



    // spans legadas (se existirem)

    if (elTipo) elTipo.textContent = it.tipoesc || "-";

    if (elRede) elRede.textContent = it.rede || "-";

    if (elNome) elNome.textContent = it.nomesc || "-";

    if (elCod)  elCod.textContent  = it.codesc || "-";

    if (elDre)  elDre.textContent  = it.dre ? `/ ${it.dre}` : "-";

  }



  async function fetchSuggest(q){
    try{
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      const u = new URL(ENDPOINT);
      u.searchParams.set("search", q);
      const token = getToken();
      const headers = { "Accept": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;

      let res = await fetch(u.toString(), { signal: ctrl.signal, headers });

      if (!res.ok){
        const u2 = new URL("/api/escolas/", window.location.origin);
        u2.searchParams.set("query", q);
        res = await fetch(u2.toString(), { signal: ctrl.signal });
        if (!res.ok) return [];
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.results || data?.data || data?.items || data?.content || []);
      return list.map(r => typeof r === "string"
        ? { tipoesc:"", nomesc:r, endereco:"", dre:"", codesc:"", fullLine: (r || "").toString() }
        : mapRow(r));
    }catch{
      return [];
    }
  }

  const onInput = debounce(async () => {
    const q = (input.value || "").trim();
    if (q.length < MIN){ dd.hidden = true; return; }
    showLoading();
    items = await fetchSuggest(q);
    active = -1;
    render(items);
  }, 220);

  input.addEventListener("input", onInput);
  input.addEventListener("focus", async () => {
    const q = (input.value || "").trim();
    if (q.length >= MIN){
      showLoading();
      items = await fetchSuggest(q);
      active = -1;
      render(items);
    }
  });
  input.addEventListener("keydown", (e)=>{
    if (dd.hidden) return;
    if (e.key === "ArrowDown"){ e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp"){ e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter"){ e.preventDefault(); select(active >= 0 ? active : 0); }
    else if (e.key === "Escape"){ dd.hidden = true; }
  });
  document.addEventListener("click", (e)=>{
    if (!dd.hidden && !dd.contains(e.target) && e.target !== input){ dd.hidden = true; }
  });

  // Inicializa botões no fim, com DOM pronto
  setupButtons();
})();


// --- ADM Tab Support (non-invasive addon) ---
(function(){
  const btnPrincipal  = document.getElementById("tab-btn-principal");
  const btnPesquisa   = document.getElementById("tab-btn-pesquisaue");
  const btnAdm        = document.getElementById("tab-btn-adm");
  const mainPanel     = document.getElementById("main-panel");
  const pesquisaPanel = document.getElementById("pesquisaue-panel");
  const admPanel      = document.getElementById("adm-panel");

  if (!btnAdm || !admPanel) return;

  function activate(btn){
    [btnPrincipal, btnPesquisa, btnAdm].forEach(b=>b && b.classList.remove("active"));
    btn && btn.classList.add("active");
  }
  function hideAll(){
    if (mainPanel) mainPanel.style.display = "none";
    if (pesquisaPanel) pesquisaPanel.style.display = "none";
    if (admPanel) admPanel.style.display = "none";
  }
  function showAdm(){
    hideAll();
    if (admPanel) admPanel.style.display = "block";
    activate(btnAdm);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  btnAdm.addEventListener("click", showAdm);
})();







