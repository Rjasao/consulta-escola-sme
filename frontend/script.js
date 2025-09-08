// inicio - consulta_escola_sme/consulta-escola-sme/frontend/script.js
// script.js

// Mapeamento entre os campos retornados pela API e seus rótulos legíveis
const fieldLabels = {
    codesc:      "Código da EU",
    tipoesc:     "Tipo",
    situacao:    "Situação",
    rede:        "Rede",
    nomesc:      "Nome da UE",
    dre:         "DRE",
    diretoria:   "Diretoria",
    distrito:    "Distrito",
    endereco:    "End.",
    numero:      "Nº",
    bairro:      "Bairro",
    cep:         "CEP",
    tel1:        "Tel. 01",
    tel2:        "Tel. 02",
    email:       "Email",
    nomescofi:   "Nome da UE Cofi",
    subpref:     "Subprefeitura",
    coddist:     "Cod Distrito",
    setor:       "Setor",
    codinep:     "Codigo Nep",
    cd_cie:      "CD CIE",
    eh:          "EH",
    dt_criacao:  "Data da Criação",
    ato_criacao: "Ato da Criação",
    dom_criacao: "Dom. da Criação",
    dt_ini_conv: "Data inicio da Conv.",
    dt_ini_func: "Data inicio da Func.",
    dt_autoriza: "Data inicio da Autorização",
    dt_extintao: "Data da Extinção",
    nome_ant:    "Nome Anterior",
    latitude:    "Latitude",
    longitude:   "Longitude",
    database:    "Data Base",
    ceu:         "CEU"
};

document.addEventListener("DOMContentLoaded", () => {
    // Referências a elementos da página
    const btnConnect       = document.getElementById("btn-connect");
    const btnSearch        = document.getElementById("btn-search");        // busca antiga (opcional)
    const btnClearSearch   = document.getElementById("btn-clear-search");  // busca antiga (opcional)
    const btnSearchSchools = document.getElementById("btn-search-schools");
    const btnClearAll      = document.getElementById("btn-clear-all");
    const btnSaveKeys      = document.getElementById("btn-save-keys");
    const toast            = document.getElementById("toast");
    const resultsDiv       = document.getElementById("results");
    const accessTokenInput = document.getElementById("access_token");
    const filterChecks     = document.querySelectorAll(".filter-check");

    // 1. Converte entradas de texto para maiúsculas conforme o usuário digita
    document.querySelectorAll('input[type="text"]').forEach(inp => {
        inp.addEventListener('input', () => {
            inp.value = inp.value.toUpperCase();
        });
    });

    // 2. Carrega chaves salvas (consumer_key e consumer_secret)
    async function loadSavedKeys() {
        try {
            let encoded = localStorage.getItem("cripto_keys");
            if (!encoded) {
                try {
                    const resp = await fetch("cripto.txt");
                    if (resp.ok) {
                        encoded = (await resp.text()).trim();
                    }
                } catch {}
            }
            if (!encoded) return;
            let jsonStr;
            try { jsonStr = atob(encoded); } catch { return; }
            let obj;
            try { obj = JSON.parse(jsonStr); } catch { return; }
            if (obj.consumer_key)    document.getElementById("consumer_key").value    = obj.consumer_key;
            if (obj.consumer_secret) document.getElementById("consumer_secret").value = obj.consumer_secret;
        } catch (err) {
            console.error("Erro ao carregar chaves salvas:", err);
        }
    }
    loadSavedKeys();

    // 3. Exibe mensagens de feedback (toast)
    function showToast(message, success = false) {
        toast.textContent = message;
        toast.style.backgroundColor = success ? "#4CAF50" : "#ff4d4f";
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 4000);
    }

    // 4. Copia texto para a área de transferência
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => showToast("Copiado para a área de transferência", true))
            .catch(() => showToast("Erro ao copiar", false));
    }

    // 5. Conecta à API e gera token
    btnConnect.addEventListener("click", async () => {
        const ck = document.getElementById("consumer_key").value.trim();
        const cs = document.getElementById("consumer_secret").value.trim();
        if (!ck || !cs) {
            showToast("Preencha consumer key e segredo", false);
            return;
        }
        try {
            const res = await fetch("/api/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    consumer_key: ck,
                    consumer_secret: cs,
                    base_url: "https://gateway.apilib.prefeitura.sp.gov.br/token"
                })
            });
            const data = await res.json();
            if (data.access_token) {
                accessTokenInput.value = data.access_token;
                accessTokenInput.setAttribute("readonly", true);
                btnConnect.textContent = "Conectado";
                btnConnect.classList.add("connected");
                showToast("Conexão bem-sucedida", true);
            } else {
                showToast("Erro: " + (data.error || "Token não retornado"), false);
            }
        } catch (err) {
            showToast("Erro de conexão: " + err.message, false);
        }
    });

    // 6. Busca antiga (apenas se existir)
    if (btnSearch) {
        btnSearch.addEventListener("click", async () => {
            const token = accessTokenInput.value.trim();
            const name  = document.getElementById("school_name").value.trim();
            if (!token || !name) {
                showToast("Preencha token e nome da escola", false);
                return;
            }
            try {
                const res = await fetch("/api/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, base_url: "http://localhost:5000", name })
                });
                const data = await res.json();
                resultsDiv.innerHTML = "";
                const matches = data.matches || (data.match ? [data.match] : []);
                if (matches.length > 0) {
                    matches.forEach(match => {
                        const box = document.createElement("div");
                        box.className = "result-box";
                        ["nome","endereco","numero","dre"].forEach(f => {
                            const div = document.createElement("div");
                            div.className = "field";
                            div.innerHTML = `<span class="label">${f.toUpperCase()}:</span> ${match[f] || "-"}`;
                            box.appendChild(div);
                        });
                        const copyIcon = document.createElement("span");
                        copyIcon.className = "copy-icon";
                        copyIcon.innerHTML = "📋";
                        copyIcon.addEventListener("click", () => copyToClipboard(JSON.stringify(match)));
                        box.appendChild(copyIcon);
                        resultsDiv.appendChild(box);
                    });
                } else {
                    showToast("Nenhuma correspondência encontrada", false);
                }
            } catch (err) {
                showToast("Erro na busca: " + err.message, false);
            }
        });
    }

    if (btnClearSearch) {
        btnClearSearch.addEventListener("click", () => {
            const nameField = document.getElementById("school_name");
            if (nameField) nameField.value = "";
            resultsDiv.innerHTML = "";
        });
    }

    // 7. Busca com múltiplos filtros
    if (btnSearchSchools) {
        btnSearchSchools.addEventListener("click", async () => {
            const token = accessTokenInput.value.trim();
            if (!token) {
                showToast("Preencha o token de acesso", false);
                return;
            }
            // Obtém valores dos campos de filtro
            const page     = document.getElementById("page").value.trim();
            const search   = document.getElementById("search").value.trim();
            const dre      = document.getElementById("dre").value.trim();
            const tipoesc  = document.getElementById("tipoesc").value.trim();
            const distrito = document.getElementById("distrito").value.trim();
            const bairro   = document.getElementById("bairro").value.trim();
            const subpref  = document.getElementById("subpref").value.trim();

            const payload = { token };
            if (page)     payload.page     = page;
            if (search)   payload.search   = search;
            if (dre)      payload.dre      = dre;
            if (tipoesc)  payload.tipoesc  = tipoesc;
            if (distrito) payload.distrito = distrito;
            if (bairro)   payload.bairro   = bairro;
            if (subpref)  payload.subpref  = subpref;

            try {
                const res = await fetch("/api/schools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                resultsDiv.innerHTML = "";
                resultsDiv.classList.remove("overflowing");
                if (data.error) {
                    showToast(data.error, false);
                    return;
                }
                const items = Array.isArray(data.results) ? data.results : [];
                if (items.length === 0) {
                    showToast("Nenhuma escola encontrado", false);
                    return;
                }

                // Para cada item, monta um bloco de texto
                items.forEach(item => {
                    const resultWrapper = document.createElement("div");
                    resultWrapper.className = "mb-3";

                    const pre = document.createElement("pre");
                    pre.className = "form-control result-text";
                    pre.style.whiteSpace = "pre-wrap";
                    pre.style.wordBreak = "break-word";

                    /* >>> garanta Verdana 12px inline <<< */
                    pre.style.fontFamily = "Verdana, sans-serif";
                    pre.style.fontSize = "16px";
                    pre.style.lineHeight = "16px"; // px absolutos
                    pre.style.height = "128px";    // 7 linhas fixas

                    // === INÍCIO BLOCO DE MONTAGEM DAS LINHAS ===
                    const lines = [];

                    // 1ª LINHA: Nome da UE (tipoesc antes, DRE depois com “ / ”) — valor em negrito
                    (function buildFirstLine() {
                        const cbNomesc = document.querySelector(`.field-check[data-field="nomesc"]`);
                        if (!(cbNomesc && cbNomesc.checked)) return;

                        const label = fieldLabels['nomesc'] || 'nomesc';
                        const tipoValue = item['tipoesc'] || "";
                        const nomeValue = item['nomesc'] ?? "";
                        const prefix = tipoValue ? (tipoValue + " ") : "";

                        const cbDre = document.querySelector(`.field-check[data-field="dre"]`);
                        const dreValue = (cbDre && cbDre.checked) ? (item['dre'] ?? "") : "";
                        const suffix = dreValue ? ` / ${dreValue}` : "";

                        lines.push(`${label}: <b>${prefix}${nomeValue}${suffix}</b>`);
                    })();

                    // 2ª LINHA: Diretoria e Distrito na mesma linha — valores em negrito
                    (function buildSecondLine() {
                        const cbDiretoria = document.querySelector(`.field-check[data-field="diretoria"]`);
                        const cbDistrito  = document.querySelector(`.field-check[data-field="distrito"]`);
                        const showDiret   = cbDiretoria && cbDiretoria.checked;
                        const showDistr   = cbDistrito  && cbDistrito.checked;

                        if (!showDiret && !showDistr) return;

                        const parts = [];
                        if (showDiret) {
                            const label = fieldLabels['diretoria'] || 'diretoria';
                            const value = item['diretoria'] ?? "";
                            parts.push(`${label}: <b>${value}</b>`);
                        }
                        if (showDistr) {
                            const label = fieldLabels['distrito'] || 'distrito';
                            const value = item['distrito'] ?? "";
                            parts.push(`${label}: <b>${value}</b>`);
                        }
                        lines.push(parts.join("   "));
                    })();

                    // 3ª LINHA: codesc, situacao, rede — valores em negrito
                    (function buildThirdLine() {
                        const groupFields = ['codesc', 'situacao', 'rede'];
                        const parts = [];
                        groupFields.forEach(field => {
                            const cb = document.querySelector(`.field-check[data-field="${field}"]`);
                            if (cb && cb.checked) {
                                const label = fieldLabels[field] || field;
                                const value = item[field];
                                parts.push(`${label}: <b>${value !== undefined && value !== null ? value : ""}</b>`);
                            }
                        });
                        if (parts.length > 0) lines.push(parts.join("   "));
                    })();

                    // Linha em branco entre 3ª e 4ª
                    (function addBlankLine() {
                        if (lines.length >= 2) lines.push("");
                    })();

                    // 4ª LINHA: endereço
                    // Formato: ENDERECO, nº: NUMERO -BAIRRO TIPOESC, CEP: CEP, São Paulo - SP
                    (function buildAddressLine() {
                        const cbEnd   = document.querySelector(`.field-check[data-field="endereco"]`);
                        const cbNum   = document.querySelector(`.field-check[data-field="numero"]`);
                        const cbBair  = document.querySelector(`.field-check[data-field="bairro"]`);
                        const cbTipo  = document.querySelector(`.field-check[data-field="tipoesc"]`);
                        const cbCep   = document.querySelector(`.field-check[data-field="cep"]`);

                        const hasEnd  = cbEnd  && cbEnd.checked;
                        const hasNum  = cbNum  && cbNum.checked;
                        const hasBair = cbBair && cbBair.checked;
                        const hasTipo = cbTipo && cbTipo.checked;
                        const hasCep  = cbCep  && cbCep.checked;

                        if (!(hasEnd || hasNum || hasBair || hasTipo || hasCep)) return;

                        const vEnd  = hasEnd  ? (item['endereco'] ?? "") : "";
                        const vNum  = hasNum  ? (item['numero']   ?? "") : "";
                        const vBai  = hasBair ? (item['bairro']   ?? "") : "";
                        const vTipo = hasTipo ? (item['tipoesc']  ?? "") : "";
                        const vCep  = hasCep  ? (item['cep']      ?? "") : "";

                        let out = "";

                        if (vEnd) {
                            out += `${vEnd}`;
                        }
                        if (vNum) {
                            out += (out ? `, nº: ${vNum}` : `nº: ${vNum}`);
                        }
                        if (vBai) {
                            // garante 1 espaço antes do '-' e NENHUM após o '-'
                            out = out.trimEnd();
                            out += ` - ${vBai}`;
                        }
                        if (vTipo) {
                            out += (out ? ` ${vTipo}` : `${vTipo}`);
                        }
                        if (vCep) {
                            out += (out ? `, CEP: ${vCep}` : `CEP: ${vCep}`);
                        }
                        out += (out ? `, São Paulo - SP` : `São Paulo - SP`);

                        lines.push(out);
                    })();

                    // Demais campos selecionados (exceto os já utilizados nas linhas acima)
                    document.querySelectorAll('.field-check:checked').forEach(cb => {
                        const field = cb.getAttribute('data-field');
                        const skip = new Set([
                            'nomesc', 'dre',                       // 1ª linha
                            'diretoria', 'distrito',               // 2ª linha
                            'codesc', 'situacao', 'rede',          // 3ª linha
                            'endereco', 'numero', 'bairro', 'tipoesc', 'cep' // 4ª linha
                        ]);
                        if (skip.has(field)) return;

                        const label = fieldLabels[field] || field;
                        const value = item[field];
                        lines.push(`${label}: ${value !== undefined && value !== null ? value : ""}`);
                    });

// Renderização no <pre> com bold
pre.innerHTML = lines.join("\n");

// Botão "Copiar" (copia tudo)
const copyBtn = document.createElement("button");
copyBtn.className = "btn btn-sm btn-primary copy-btn";
copyBtn.textContent = "Copiar";
copyBtn.addEventListener("click", () => {
    copyToClipboard(pre.innerText); // copia texto sem tags
});

// Botão "Copia End." (copia apenas a linha do endereço)
const copyEndBtn = document.createElement("button");
copyEndBtn.className = "btn btn-sm btn-secondary copy-btn";
copyEndBtn.textContent = "Copia End.";
copyEndBtn.style.marginLeft = "6px"; // pequeno espaço entre os botões

copyEndBtn.addEventListener("click", () => {
    const linesArr = pre.innerText.split("\n").map(l => l.trimEnd());

    // tenta identificar a linha do endereço por conteúdo
    let addrLine = linesArr.find(l =>
        /São Paulo - SP|CEP:\s*\S|nº:\s*\S|Nº:\s*\S/.test(l)
    );

    // fallback: se não achar por padrão, pega a 4ª linha (índice 3)
    if (!addrLine && linesArr.length >= 4) {
        addrLine = linesArr[3];
    }

    if (addrLine && addrLine.length) {
        copyToClipboard(addrLine.trim());
    } else {
        showToast("Não há linha de endereço para copiar.", false);
    }
});

// adiciona ao DOM (botões logo abaixo do scrollbox, sem espaço acima)
resultWrapper.appendChild(pre);
resultWrapper.appendChild(copyBtn);
resultWrapper.appendChild(copyEndBtn);
resultsDiv.appendChild(resultWrapper);
                });

                // Se houver overflow vertical (mais de 4–5 linhas), pinta o fundo rosa-claro
                if (resultsDiv.scrollHeight > resultsDiv.clientHeight) {
                    resultsDiv.classList.add("overflowing");
                }

                showToast(`Encontradas ${data.count || items.length} escola(s)`, true);
            } catch (err) {
                showToast("Erro na busca: " + err.message, false);
            }
        });
    }

    // 8. Limpa filtros e resultados
    if (btnClearAll) {
        btnClearAll.addEventListener("click", () => {
            ["page","search","dre","tipoesc","distrito","bairro","subpref"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            // Desmarca filtros de busca (apenas se houver)
            filterChecks.forEach(cb => {
                if (cb.dataset.filter !== "search") {
                    cb.checked = false;
                }
                const fieldDiv = document.querySelector(`.filter-field[data-filter="${cb.dataset.filter}"]`);
                if (fieldDiv) fieldDiv.style.display = cb.checked ? "" : "none";
            });
            resultsDiv.innerHTML = "";
            resultsDiv.classList.remove("overflowing");
        });
    }

    // 9. Botões individuais de apagar campos
    document.querySelectorAll(".clear-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) el.value = "";
            }
        });
    });

    // 10. Mostra/oculta campos de filtro de busca com base nos checkboxes
    filterChecks.forEach(cb => {
        cb.addEventListener("change", () => {
            const filterName = cb.getAttribute("data-filter");
            if (!filterName) return;
            const field = document.querySelector(`.filter-field[data-filter="${filterName}"]`);
            if (field) {
                field.style.display = cb.checked ? "" : "none";
            }
        });
    });

    // 11. Salva chaves (consumer_key e consumer_secret) no localStorage
    if (btnSaveKeys) {
        btnSaveKeys.addEventListener("click", () => {
            const ck = document.getElementById("consumer_key").value.trim();
            const cs = document.getElementById("consumer_secret").value.trim();
            if (!ck || !cs) {
                showToast("Preencha a Chave e o Segredo para salvar", false);
                return;
            }
            try {
                const encoded = btoa(JSON.stringify({ consumer_key: ck, consumer_secret: cs }));
                localStorage.setItem("cripto_keys", encoded);
                showToast("Chaves salvas com sucesso", true);
            } catch (err) {
                showToast("Erro ao salvar as chaves: " + err.message, false);
            }
        });
    }

    // 12. AUTO-CONNECT ao abrir + repetição a cada 3500s (com trava anti-duplicação)
    (function setupAutoConnect() {
        if (window.__autoConnectTimerStarted) return;
        window.__autoConnectTimerStarted = true;

        const PERIOD_MS = 3500 * 1000; // 3500s
        const START_DELAY_MS = 1000;   // pequena espera para garantir tudo pronto

        function clickBtnConnect() {
            if (!btnConnect) {
                console.warn("[auto-connect] Botão #btn-connect não encontrado.");
                return;
            }
            btnConnect.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            console.log("[auto-connect] Clique em 'Conectado' disparado.");
        }

        setTimeout(() => {
            clickBtnConnect();                    // aciona ao abrir
            setInterval(clickBtnConnect, PERIOD_MS); // repete a cada 3500s
        }, START_DELAY_MS);
    })();
});


// final
