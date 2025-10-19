// pesquisaue.js  Tabs + Autocomplete (sem tocar em script.js)
// Dropdown em duas linhas:
//   linha 1: "tipoesc nomesc"
//   linha 2: endereco
// Selecao + box abaixo: "tipoesc nomesc - rua/endereco, numero - bairro / dre"
// Botoes "Apagar" e "Apagar tudo":
//   - Desktop: na mesma linha, a direita do input
//   - Mobile (<=640px): acima do input
// Novidades:
//   1) Caixas abaixo sao clicaveis: ao clicar, ficam verdes (active). Clique novamente para voltar ao normal.
//   2) Se houver alguma caixa verde, novas selecoes do dropdown sao ACUMULADAS abaixo (ate 4 no maximo).
// const sel   = document.getElementById("pu-selected");  // <- comente se nao quiser usar


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
    populateAdmUserSelect(document.getElementById("pu-usuario-select"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  btnPrincipal?.addEventListener("click", showPrincipal);
  btnPesquisa?.addEventListener("click", showPesquisa);

  let admUsersCache = [];
  let admUsersLoading = false;

  async function fetchAdmUsers() {
    if (admUsersCache.length) return admUsersCache;
    if (admUsersLoading) return admUsersCache;
    admUsersLoading = true;
    try {
      const resp = await fetch('/api/adm/list', { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json().catch(() => ({}));
      const items = Array.isArray(data.items) ? data.items : [];
      admUsersCache = items
        .map((item) => ({
          id: (item.id || '').toString().trim(),
          nome: (item.nome || '').toString().trim(),
          rf: (item.rf || '').toString().trim(),
          telefone: (item.telefone || '').toString().trim(),
        }))
        .filter((item) => item.nome);
    } catch (error) {
      console.error('[pesquisaue] falha ao carregar usuarios ADM', error);
      admUsersCache = [];
    } finally {
      admUsersLoading = false;
    }
    return admUsersCache;
  }

  function fillAdmUserFields(userId) {
    const rfField = document.getElementById('pu-usuario-rf');
    const telField = document.getElementById('pu-usuario-telefone');
    const selected = admUsersCache.find((item) => item.id === userId);
    if (rfField) rfField.value = selected?.rf || '';
    if (telField) telField.value = selected?.telefone || '';
  }

  async function populateAdmUserSelect(selectEl) {
    if (!selectEl) return;
    const previous = selectEl.value;
    const items = await fetchAdmUsers();

    selectEl.innerHTML = '<option value="">Selecione</option>';
    items.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.nome;
      opt.dataset.id = item.id;
      opt.dataset.rf = item.rf || '';
      opt.dataset.tel = item.telefone || '';
      selectEl.appendChild(opt);
    });

    if (previous && items.some((item) => item.id === previous)) {
      selectEl.value = previous;
    } else {
      selectEl.value = '';
    }
    fillAdmUserFields(selectEl.value || '');
  }

  // --- Autocomplete Pesquisa UE ---
  function getToken() {
    const el = document.getElementById("access_token");
    return (el && el.value) ? el.value.trim() : "";
  }

  const MIN = 1;
  const MAX_RESULTS = 25;

  const input = document.getElementById("pu-school-input");
  const dd    = document.getElementById("pu-school-dd");
  const sel   = document.getElementById("pu-selected");
  const elTipo= document.getElementById("pu-sel-tipoesc");
  const elNome= document.getElementById("pu-sel-nomesc");
  const elCod = document.getElementById("pu-sel-codesc");
  const elDre = document.getElementById("pu-sel-dre");

  if (!input || !dd) return;

  // Estado
  let items = [];
  let active = -1;
  let cadCache = [];
  let cadLoading = false;

  // Utils
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function showLoading(){ dd.innerHTML = '<div class="pu-dd-item loading">Carregando</div>'; dd.hidden = false; }
  function showEmpty(){ dd.innerHTML = '<div class="pu-dd-item disabled">Nenhuma UE encontrada</div>'; dd.hidden = false; }

  // --- CSS responsivo + estilos dos cartoes ---

  
  // --- Botoes: Apagar & Apagar tudo (inline direita no desktop, acima no mobile) ---
  function setupButtons(){
    const wrap = document.querySelector(".pu-autocomplete-wrapper");
    if (!wrap) return;
    wrap.classList.add("pu-autocomplete-wrapper-js");
    // evita duplicacao
    if (document.getElementById("pu-btn-clear-all")) return;

    const parent = wrap.parentElement;
    if (!parent) return;

    // Linha em flex com wrapper + acoes a direita
    const row = document.createElement("div");
    row.className = "pu-row-inline";
    parent.insertBefore(row, wrap);
    row.appendChild(wrap);

    // wrapper ocupa o espaco e mantem dropdown relativo
    wrap.classList.add("pu-autocomplete-wrapper-js");

    const actions = document.createElement("div");
    actions.id = "pu-actions";

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
      if (elTipo) elTipo.textContent = "-";
      if (elNome) elNome.textContent = "-";
      if (elCod)  elCod.textContent  = "-";
      if (elDre)  elDre.textContent  = "-";
      const select = document.getElementById('pu-usuario-select');
      if (select) select.value = "";
      fillAdmUserFields("");
      ['data-saida','hora-saida','hora-retorno'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field) field.value = "";
      });
      input.focus();
    });

    actions.appendChild(btnClearAll);
    row.appendChild(actions);

    const select = document.getElementById('pu-usuario-select');
    if (select) {
      populateAdmUserSelect(select);
      select.addEventListener('focus', () => populateAdmUserSelect(select));
      select.addEventListener('change', () => fillAdmUserFields(select.value));
    }
  }
  
  function applyCardData(card, data){
    if (!card) return;
    const info = data || {};
    card.dataset.schoolNome = (info.nomesc || info.nome || "").trim();
    card.dataset.schoolEndereco = (info.endereco || "").trim();
    card.dataset.schoolTipo = (info.tipoesc || "").trim();
    card.dataset.schoolRede = (info.rede || "").trim();
    card.dataset.schoolDre = (info.dre || "").trim();
    card.dataset.schoolCodesc = (info.codesc || "").trim();
  }
  
  function moveCard(card, delta){
    if (!card) return;
    const parent = card.parentElement;
    if (!parent) return;
    const cards = Array.from(parent.querySelectorAll(".pu-card"));
    const index = cards.indexOf(card);
    if (index === -1) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= cards.length) return;
    const referenceNode = delta > 0 ? cards[targetIndex].nextSibling : cards[targetIndex];
    parent.insertBefore(card, referenceNode);
  }
  
  function createCard(text, data){
    const card = document.createElement("div");
    card.className = "pu-card";

    const content = document.createElement("div");
    content.className = "pu-card-text";
    content.textContent = text;
    applyCardData(card, data);

    const actions = document.createElement("div");
    actions.className = "pu-card-actions";

    const btnUp = document.createElement("button");
    btnUp.type = "button";
    btnUp.className = "pu-card-move";
    btnUp.setAttribute("aria-label", "Mover para cima");
    btnUp.textContent = "\u25B2";
    btnUp.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      moveCard(card, -1);
    });

    const btnDown = document.createElement("button");
    btnDown.type = "button";
    btnDown.className = "pu-card-move";
    btnDown.setAttribute("aria-label", "Mover para baixo");
    btnDown.textContent = "\u25BC";
    btnDown.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      moveCard(card, 1);
    });

    const btnClose = document.createElement("button");
    btnClose.className = "pu-card-close";
    btnClose.type = "button";
    btnClose.setAttribute("aria-label", "Remover");
    btnClose.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 16 16" fill="none">
        <path d="M4.2 4.2L11.8 11.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M11.8 4.2L4.2 11.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
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
  function normalizeField(value){
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  const ACCENTS_RE = /[\u0300-\u036f]/g;
  const HAS_NORMALIZE = typeof "".normalize === "function";

  function normalizeForSearch(value){
    const text = normalizeField(value);
    if (!text) return "";
    const lower = HAS_NORMALIZE ? text.normalize("NFD").replace(ACCENTS_RE, "").toLowerCase() : text.toLowerCase();
    return lower;
  }

  async function ensureCadData(){
    if (cadCache.length || cadLoading) return cadCache;
    cadLoading = true;
    try{
      const resp = await fetch("/backend/dados/CadUE.json", { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      cadCache = Array.isArray(data) ? data.map(mapRow).filter(Boolean) : [];
    }catch(err){
      console.error("[pesquisaue] falha ao carregar CadUE.json", err);
      cadCache = [];
    }finally{
      cadLoading = false;
    }
    return cadCache;
  }

  function filterCadData(query){
    if (!cadCache.length) return [];
    const term = normalizeForSearch(query);
    if (!term) return [];
    const results = [];
    for (const row of cadCache){
      if (!row?.search) continue;
      if (row.search.includes(term)){
        results.push(row);
        if (results.length >= MAX_RESULTS) break;
      }
    }
    return results;
  }

  function mapRow(row){
    if (!row || typeof row !== "object") return null;
    const keys = Object.keys(row);
    const g = (key) => {
      if (!key) return undefined;
      if (key in row) return row[key];
      const lower = typeof key === "string" ? key.toLowerCase() : key;
      const match = keys.find(k => typeof k === "string" && k.toLowerCase() === lower);
      return match ? row[match] : undefined;
    };

    const tipoesc = (g("tipoesc") || g("tipo") || "").toString().trim();
    const rede    = (g("rede")    || "").toString().trim();
    const nomesc  = (g("nomesc")  || g("nome") || "").toString().trim();
    const dre     = (g("dre")     || g("dres") || "").toString().trim();

    // Endereco
    const rua    = (g("rua") || g("logradouro") || g("endereco") || g("address") || "").toString().trim();
    const numero = (g("numero") || g("num") || g("nro") || "").toString().trim();
    const bairro = (g("bairro") || "").toString().trim();
    const cep    = (g("cep") || "").toString().trim();

    const ruaNome = rua || cep; // fallback para CEP

    // Linha completa usada no box abaixo
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

    const codescRaw = g("codesc") || g("cod_ue") || g("Codigo") || "";
    const codesc = codescRaw != null ? codescRaw.toString().trim() : "";

    // Endereco para segunda linha do dropdown
    let endereco = "";
    if (ruaNome) endereco = ruaNome;
    if (numero)  endereco += (endereco ? ", " : "") + numero;
    if (bairro)  endereco += (endereco ? " - " : "") + bairro;
    if (dre) {
      const drePart = `/ ${dre}`;
      endereco = endereco ? `${endereco} / ${dre}` : drePart;
    }

    const searchTokens = [
      fullLine,
      header,
      tipoesc,
      rede,
      nomesc,
      dre,
      endereco,
      enderecoPrincipal,
      bairroDre,
      codesc
    ].map(normalizeForSearch).filter(Boolean);

    return {
      tipoesc,
      rede,
      nomesc,
      dre,
      endereco,
      fullLine,
      codesc,
      search: searchTokens.join(" "),
      row
    };
  }

  // DROPDOWN: duas linhas (tipoesc nomesc) e, abaixo, o endereco
  function render(list){
    dd.innerHTML = "";
    if (!list || !list.length){ showEmpty(); return; }

    list.forEach((it, i)=>{
      const div = document.createElement("div");
      div.className = "pu-dd-item" + (i===active ? " active" : "");

      const l1 = document.createElement("div");
      l1.className = "pu-main";
      const headerParts = [it.tipoesc, it.rede, it.nomesc].filter(Boolean).map(str => typeof str === "string" ? str.trim() : str);
      l1.textContent = headerParts.join(" ").trim();

      const l2 = document.createElement("div");
      l2.className = "pu-sub";
      l2.textContent = it.endereco ? it.endereco : "";

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

// --- helper: atualiza o texto visivel de um cartao existente
function updateCardText(card, txt, data){
  const t = card?.querySelector(".pu-card-text");
  if (t) t.textContent = txt;
  applyCardData(card, data);
}



function select(i){
  const it = items[i]; if (!it) return;

  // monta a linha que vai no cartao/label
  const headerParts = [(it.tipoesc||"").trim(), (it.rede||"").trim(), (it.nomesc||"").trim()].filter(Boolean);
  const headerText = headerParts.join(" ").replace(/\s+/g, " ").trim();
  const suffixParts = [];
  const enderecoTxt = (it.endereco || "").trim();
  if (enderecoTxt) suffixParts.push(enderecoTxt);
  const dreTxt = (it.dre || "").trim();
  if (dreTxt) {
    const dreFormatted = dreTxt.startsWith("/") ? dreTxt : `/ ${dreTxt}`;
    const hasDre = suffixParts.some(part => part.includes(dreTxt));
    if (!hasDre) suffixParts.push(dreFormatted);
  }
  let fallbackLine = headerText;
  if (suffixParts.length) fallbackLine = headerText ? `${headerText} - ${suffixParts.join(" - ")}` : suffixParts.join(" - ");
  fallbackLine = fallbackLine.replace(/\s+/g, " ").replace(/ -\s*$/, "").trim();

  const txt = (it.fullLine || fallbackLine)
    .replace(/\s+/g," ").trim();
  const schoolData = {
    nomesc: (it.nomesc || "").trim(),
    nome: (it.nomesc || "").trim(),
    endereco: (it.endereco || "").trim(),
    tipoesc: (it.tipoesc || "").trim(),
    rede: (it.rede || "").trim(),
    dre: (it.dre || "").trim(),
    codesc: (it.codesc || "").trim()
  };

  // limpa o input e fecha dropdown
  input.value = "";
  dd.innerHTML = "";
  dd.hidden = true;
  active = -1;

  // === NOVA REGRA DAS LABELS (esquerda) ===
  if (sel){
    sel.hidden = false;

    // pega todos os cartoes atuais
    const cards = Array.from(sel.querySelectorAll(".pu-card"));
    const firstNonActive = cards.find(c => !c.classList.contains("active"));
    const allSelected    = cards.length > 0 && cards.every(c => c.classList.contains("active"));
    const MAX = 4;

    if (firstNonActive){
      // 1) existe pelo menos uma label nao selecionada ? substituir esta
      updateCardText(firstNonActive, txt, schoolData);
      // (mantem o estado visual da label substituida  continua nao ativa)
    } else if (allSelected || cards.length === 0){
      // 2) so acrescenta nova label se NAO ha nenhuma ou se TODAS estiverem ativas
      if (cards.length >= MAX){
        // limite atingido
        if (typeof toast === "function") {
          toast("Limite de 4 escolas atingido.", "warn");
        } else {
          console.warn("Limite de 4 escolas atingido.");
        }
      } else {
        sel.appendChild(createCard(txt, schoolData));
      }
    } else {
      // 3) fallback raro: tem cartoes e nenhum e nao-ativo, mas tambem nao sao "todos ativos"
      // (nao deve acontecer). Por seguranca, substitui o primeiro.
      if (cards[0]) updateCardText(cards[0], txt, schoolData);
    }
  }

  // spans legadas (se existirem)
  if (elTipo) elTipo.textContent = it.tipoesc || "";
  if (elNome) elNome.textContent = it.nomesc  || "";
  if (elCod)  elCod.textContent  = it.codesc  || "";
  if (elDre)  elDre.textContent  = it.dre     || "";
}


async function fetchSuggest(q){
    await ensureCadData();
    return filterCadData(q);
  }

  function getSelectedSchoolCards(){
    if (!sel) return [];
    const cards = Array.from(sel.querySelectorAll(".pu-card"));
    if (!cards.length) return [];
    const active = cards.filter(c => c.classList.contains("active"));
    const chosen = active.length ? active : cards;
    return chosen
      .map((card) => {
        const nome = (card.dataset.schoolNome || card.querySelector(".pu-card-text")?.textContent || "").trim();
        return {
          nome,
          endereco: (card.dataset.schoolEndereco || "").trim(),
          tipo: (card.dataset.schoolTipo || "").trim(),
          dre: (card.dataset.schoolDre || "").trim(),
          codesc: (card.dataset.schoolCodesc || "").trim()
        };
      })
      .filter((item) => item.nome);
  }

  function getSelectedUsers(){
    const box = document.getElementById("pu-user-tags");
    if (!box) return [];
    const tags = Array.from(box.querySelectorAll(".pu-user-tag"));
    if (!tags.length) return [];
    const active = tags.filter(tag => tag.classList.contains("active"));
    const chosen = active.length ? active : tags;
    return chosen
      .map((tag) => {
        const nome = (tag.dataset.userNome || tag.querySelector(".pu-user-label")?.textContent || "").trim();
        return {
          nome,
          rf: (tag.dataset.userRf || "").trim(),
          telefone: (tag.dataset.userTelefone || "").trim()
        };
      })
      .filter((item) => item.nome);
  }

  function getTripSelection(){
    const options = Array.from(document.querySelectorAll(".pu-trip-option"));
    const checked = options.filter(opt => opt.checked && (opt.value || opt.id));
    const values = checked.map(opt => (opt.value || opt.id || "").trim());
    return {
      principal: values[0] || "",
      selecionados: values
    };
  }

  function buildPdfPayload(){
    const escolas = getSelectedSchoolCards();
    const usuarios = getSelectedUsers();
    const trip = getTripSelection();
    const dataSaida = ((document.getElementById("data-saida")?.value) || "").trim();
    const horaSaida = ((document.getElementById("hora-saida")?.value) || "").trim();
    const horaRetorno = ((document.getElementById("hora-retorno")?.value) || "").trim();
    return {
      gerado_em: new Date().toISOString(),
      unidades: escolas,
      usuarios,
      data_saida: dataSaida,
      hora_saida: horaSaida,
      hora_retorno: horaRetorno,
      percurso: trip.principal,
      percurso_lista: trip.selecionados,
      justificativa: ((document.getElementById("pu-justificativa")?.value) || "").trim(),
      observacoes: ((document.getElementById("pu-observacoes")?.value) || "").trim()
    };
  }

  async function handleSavePdfClick(event){
    event?.preventDefault();
    const btn = event?.currentTarget;
    const payload = buildPdfPayload();
    if (!payload.unidades.length){
      if (typeof toast === "function") toast("Selecione pelo menos uma Unidade Escolar.", "warn", { anchor: "panel" });
      else console.warn("Nenhuma unidade selecionada.");
      return;
    }

    payload.pdf_save_path = "";

    if (btn && !btn.dataset.originalText){
      btn.dataset.originalText = btn.textContent;
    }
    if (btn){
      btn.disabled = true;
      btn.textContent = "Salvando...";
      btn.dataset.loading = "1";
    }

    try{
      const resp = await fetch("/api/export/pdf-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.ok === false){
        const errMsg = data?.error || `Falha ao salvar (HTTP ${resp.status})`;
        throw new Error(errMsg);
      }
      if (typeof toast === "function") {
        const message = data?.message || (data?.pdf ? `PDF gerado: ${data.pdf}` : "Informacoes salvas em pdf.json.");
        toast(message, "success", { anchor: "panel", duration: 6000 });
      }
      console.info("[Salvar PDF] payload armazenado em pdf.json");
    }catch(err){
      const msg = err?.message || "Erro ao salvar pdf.json.";
      if (typeof toast === "function") toast(msg, "error", { anchor: "panel" });
      else console.error(msg);
    }finally{
      if (btn){
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || "Salvar em PDF";
        delete btn.dataset.loading;
      }
    }
  }

  const saveBtn = document.getElementById("btn-save-pdf");
  if (saveBtn && !saveBtn.dataset.bound){
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", handleSavePdfClick);
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

  // Inicializa botoes no fim, com DOM pronto
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
