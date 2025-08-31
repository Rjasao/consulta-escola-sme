// inicio - script.js
document.addEventListener("DOMContentLoaded", () => {
    const btnConnect = document.getElementById("btn-connect");
    const btnServer = document.getElementById("btn-server");
    const btnSearch = document.getElementById("btn-search");
    const btnClearSearch = document.getElementById("btn-clear-search");
    const toast = document.getElementById("toast");
    const resultsDiv = document.getElementById("results");

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

    btnConnect.addEventListener("click", async () => {
        const consumerKey = document.getElementById("consumer_key").value;
        const consumerSecret = document.getElementById("consumer_secret").value;
        if (!consumerKey || !consumerSecret) { showToast("Preencha consumer key e segredo"); return; }
        try {
            const res = await fetch("/api/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({consumer_key:consumerKey,consumer_secret:consumerSecret,base_url:"http://localhost:5000"})
            });
            const data = await res.json();
            if (data.ok) {
                document.getElementById("access_token").value = data.token;
                btnConnect.textContent = "Conectado";
                btnConnect.classList.add("connected");
                showToast("Conexão bem-sucedida", true);
            } else { showToast("Erro: "+data.error); }
        } catch (err) { showToast("Erro de conexão: "+err.message); }
    });

    btnServer.addEventListener("click", async () => {
        if (btnServer.textContent.includes("OFF")) {
            btnServer.textContent = "Servidor: ON";
            showToast("Servidor ativo (verifique backend)", true);
        } else {
            try {
                const res = await fetch("/api/server/shutdown", { method: "POST" });
                const data = await res.json();
                if (data.ok) { btnServer.textContent = "Servidor: OFF"; showToast("Servidor encerrado", true); }
                else { showToast("Erro ao desligar servidor: "+data.error); }
            } catch (err) { showToast("Erro ao desligar servidor: "+err.message); }
        }
    });

    btnSearch.addEventListener("click", async () => {
        const token = document.getElementById("access_token").value;
        const query = document.getElementById("school_name").value;
        if (!token || !query) { showToast("Preencha token e nome da escola"); return; }
        try {
            const res = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, base_url:"http://localhost:5000", query })
            });
            const data = await res.json();
            if (data.ok && data.results) {
                resultsDiv.innerHTML = "";
                const match = data.results.match;
                if (match) {
                    const box = document.createElement("div"); box.className="result-box";
                    ["nome","endereco","numero","dre"].forEach(f=>{
                        const div=document.createElement("div"); div.className="field"; div.innerHTML=`<span class="label">${f.toUpperCase()}:</span> ${match[f]||"-"}`; box.appendChild(div);
                    });
                    const copyIcon = document.createElement("span"); copyIcon.className="copy-icon"; copyIcon.innerHTML="📋";
                    copyIcon.addEventListener("click",()=>copyToClipboard(JSON.stringify(match)));
                    box.appendChild(copyIcon); resultsDiv.appendChild(box);
                } else showToast("Nenhuma correspondência encontrada");
            } else showToast("Erro na busca: "+(data.error||"Desconhecido"));
        } catch(err){ showToast("Erro na busca: "+err.message); }
    });

    btnClearSearch.addEventListener("click",()=>{ document.getElementById("school_name").value=""; resultsDiv.innerHTML=""; });

    document.querySelectorAll(".clear-btn").forEach(btn=>{
        btn.addEventListener("click",()=>{
            const targetId = btn.getAttribute("data-target");
            if(targetId) document.getElementById(targetId).value="";
        });
    });

});
// final
