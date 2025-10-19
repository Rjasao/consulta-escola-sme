/* adm_masks.js — máscaras para RF (999999-9) e Telefone ((99) 99999-9999)
   - Não altera cores/estilos
   - Funciona com digitação e colagem
   - Mantém os IDs: #adm-rf e #adm-telefone
*/

(function () {
  const sel = (id) => document.getElementById(id);

  // --------- Helpers ----------
  const onlyDigits = (v) => (v || "").replace(/\D+/g, "");
  const setMaxLength = (el, n) => { if (el && !el.getAttribute("maxlength")) el.setAttribute("maxlength", n); };

  // RF: até 7 dígitos, formato 999999-9
  function formatRF(raw) {
    const d = onlyDigits(raw).slice(0, 7);
    if (d.length <= 6) return d;
    return d.slice(0, 6) + "-" + d.slice(6);
  }

  // Telefone BR (mobile): 11 dígitos → (99) 99999-9999
  function formatPhone(raw) {
    const d = onlyDigits(raw).slice(0, 11);
    const len = d.length;
    if (len === 0) return "";
    if (len <= 2) return `(${d}`;
    const ddd = d.slice(0, 2);
    if (len <= 7) {
      const left = d.slice(2, len); // até 5
      return `(${ddd}) ${left}`;
    }
    const left = d.slice(2, 7);      // 5 dígitos
    const right = d.slice(7);        // até 4
    return `(${ddd}) ${left}${right ? "-" + right : ""}`;
  }

  // Aplica máscara no input alvo
  function bindMask(input, formatter, maxLen) {
    if (!input) return;
    setMaxLength(input, maxLen);

    const apply = () => {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const before = input.value;
      input.value = formatter(before);
      // mantém o cursor no fim quando formata
      const pos = Math.max(input.value.length, 0);
      input.setSelectionRange(pos, pos);
    };

    // Digitação/Colagem
    input.addEventListener("input", apply);
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text") || "";
      input.value = formatter(text);
      const pos = input.value.length;
      input.setSelectionRange(pos, pos);
    });

    // Inicial (se vier preenchido)
    apply();
  }

  function initMasks() {
    const rf = sel("adm-rf");
    const tel = sel("adm-telefone");

    if (rf) {
      rf.setAttribute("inputmode", "numeric");
      rf.setAttribute("autocomplete", "off");
      rf.setAttribute("placeholder", "RF");
      bindMask(rf, formatRF, 8); // "      - " tem 8 caracteres
    }

    if (tel) {
      tel.setAttribute("inputmode", "numeric");
      tel.setAttribute("autocomplete", "tel");
      tel.setAttribute("placeholder", "Telefone");
      bindMask(tel, formatPhone, 15); // "(  )      -    " tem 15 caracteres
    }
  }

  // Inicia quando o DOM carregar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMasks);
  } else {
    initMasks();
  }

  // Se a aba ADM for exibida dinamicamente depois, tenta re-aplicar
  const obsTarget = document.body;
  if (window.MutationObserver && obsTarget) {
    const mo = new MutationObserver(() => {
      const rf = sel("adm-rf");
      const tel = sel("adm-telefone");
      if (rf && tel && !rf.__masked && !tel.__masked) {
        initMasks();
        // marca pra não reaplicar infinitamente
        if (rf) rf.__masked = true;
        if (tel) tel.__masked = true;
      }
    });
    mo.observe(obsTarget, { childList: true, subtree: true });
  }
})();
