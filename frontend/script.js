// inicio - script.js
// script.js

document.addEventListener("DOMContentLoaded", () => {
    const btnConnect = document.getElementById("btn-connect");
    const btnServer = document.getElementById("btn-server");
    const btnSearch = document.getElementById("btn-search");
    const btnClearSearch = document.getElementById("btn-clear-search");
    const toast = document.getElementById("toast");
    const resultsDiv = document.getElementById("results");
    const accessTokenInput = document.getElementById("access_token");

    // -------------------------
    // Funções auxiliares
    // -------------------------
    function showToast(message, success = false) {
        toast.textContent = message;
        toast.style.backgroundColor = success ? "#4CAF50" : "#ff4d4f";
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 4000);
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => showToast("Copiado para a área de transferência", true))
            .catch(() => showToast("Erro ao copiar", false));
    }

    // -------------------------
    // Conectar e gerar token
    // -------------------------
    btnConnect.addEventListener("click", async () => {
        const consumerKey = document.getElementById("consumer_key").value.trim();
        const consumerSecret = document.getElementById("consumer_secret").value.trim();

        if (!consumerKey || !consumerSecret) {
            showToast("Preencha consumer key e segredo", false);
            return;
        }

        try {
            const res = await fetch("/api/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    consumer_key: consumerKey,
                    consumer_secret: consumerSecret,
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

    // -------------------------
    // Servidor ON/OFF atualizado
    // -------------------------
    btnServer.addEventListener("click", async () => {
    if (btnServer.textContent.includes("OFF")) {
        try {
            const res = await fetch("http://localhost:5050/api/server/start", { method: "POST" });
            const data = await res.json();
            btnServer.textContent = "Servidor: ON";
            showToast(data.message, data.status !== "error");
        } catch (err) {
            showToast("Erro ao iniciar servidor: " + err.message, false);
        }
    } else {
        try {
            const res = await fetch("http://localhost:5050/api/server/shutdown", { method: "POST" });
            const data = await res.json();
            btnServer.textContent = "Servidor: OFF";
            showToast(data.message, true);
        } catch (err) {
            showToast("Erro ao desligar servidor: " + err.message, false);
        }
    }
});

    // -------------------------
    // Buscar escolas
    // -------------------------
    btnSearch.addEventListener("click", async () => {
        const token = accessTokenInput.value.trim();
        const name = document.getElementById("school_name").value.trim();

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

            if (data.match || (data.matches && data.matches.length > 0)) {
                const matches = data.matches || [data.match];

                matches.forEach(match => {
                    const box = document.createElement("div");
                    box.className = "result-box";

                    ["nome", "endereco", "numero", "dre"].forEach(f => {
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

    // -------------------------
    // Limpar busca
    // -------------------------
    btnClearSearch.addEventListener("click", () => {
        document.getElementById("school_name").value = "";
        resultsDiv.innerHTML = "";
    });

    // -------------------------
    // Botões de apagar campos
    // -------------------------
    document.querySelectorAll(".clear-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            if (targetId) document.getElementById(targetId).value = "";
        });
    });

});
// final
