README_MAPS.txt

MapsApp — módulo simples para abrir o Google Maps com a coordenada do item ativo.

Arquivos:
- frontend/maps/maps.js

Como integrar:
1) No seu index.html, após <script src="script.js"></script>, inclua:
   <script src="maps/maps.js"> </script>

2) Ao renderizar cada item no results/mode-panel, grave os dados como dataset:
   pre.dataset.latitude  = item.latitude;
   pre.dataset.longitude = item.longitude;

3) Adicione o botão "Maps" ao lado do "Copia End." e vincule assim:
   MapsApp.bindButton(mapsBtn, () => ({
     lat: pre.dataset.latitude ?? item.latitude,
     lon: pre.dataset.longitude ?? item.longitude
   }));

4) Quando o usuário selecionar/clicar um item, atualize a seleção atual:
   MapsApp.setSelected(pre.dataset.latitude, pre.dataset.longitude);

Observações:
- O módulo não altera token, gráficos, cores ou outros fluxos existentes.
- O botão "Maps" abre uma nova aba com o Google Maps para a coordenada informada.
- Se as coordenadas não estiverem presentes, mostra um aviso via toast/alert.