// frontend/maps/maps.js
// Módulo MapsApp agora inclui o NOME da escola na query do Google Maps.
(function () {
  const MapsApp = {
    _lat: null,
    _lon: null,
    _name: null, // novo 

    setSelected(lat, lon, name) {
      const toNum = (v) => {
        if (v === null || v === undefined) return null;
        const s = ("" + v).trim().replace(",", ".");
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      };
      const toName = (n) => {
        if (n == null) return null;
        const s = ("" + n).trim();
        return s || null;
      };
      this._lat = toNum(lat);
      this._lon = toNum(lon);
      this._name = toName(name);
    },

    open() {
      if (this._lat == null || this._lon == null) {
        if (typeof window.toast === "function") {
          toast("Latitude/Longitude ausentes para o item selecionado.", "warn");
        } else {
          alert("Latitude/Longitude ausentes para o item selecionado.");
        }
        return;
      }
      // Se houver nome, prioriza a busca "Nome (lat, lon)"
      const query = this._name
        ? `${this._name} (${this._lat}, ${this._lon})`
        : `${this._lat}, ${this._lon}`;
      const url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
      window.open(url, "_blank", "noopener");
    },

    // getter opcional pode devolver { lat, lon, name }
    bindButton(buttonEl, getData) {
      if (!buttonEl) return;
      buttonEl.addEventListener("click", () => {
        if (typeof getData === "function") {
          const { lat, lon, name } = getData() || {};
          this.setSelected(lat, lon, name);
        }
        this.open();
      });
    }
  };

  window.MapsApp = MapsApp;
})();