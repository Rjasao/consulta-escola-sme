self.addEventListener("install", event => {
  console.log("📦 Service Worker instalado.");
});

self.addEventListener("fetch", event => {
  // Aqui você pode adicionar cache se quiser que funcione offline no futuro
});
