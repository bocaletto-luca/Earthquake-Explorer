    // Imposta l'anno corrente nel footer
    document.getElementById("currentYear").textContent = new Date().getFullYear();
    
    /* === Toggle Tema (Day/Night) === */
    const themeToggle = document.getElementById("themeToggle");
    const themeText = document.getElementById("themeText");
    themeToggle.addEventListener("change", function() {
      if (this.checked) {
        document.body.classList.remove("day");
        document.body.classList.add("night");
        themeText.textContent = "Night";
      } else {
        document.body.classList.remove("night");
        document.body.classList.add("day");
        themeText.textContent = "Day";
      }
    });
    
    /* === Variabili Globali === */
    let quakeData = [];  // Array per gli eventi sismici
    let currentSortedData = [];  // Array ordinato in base al criterio scelto
    let quakeChart;  // Riferimento al grafico Chart.js
    let quakeMap;    // Riferimento alla mappa Leaflet
    let markers = []; // Array per i marker della mappa
    
    /* === Inizializza la Mappa (Leaflet con OpenStreetMap) === */
    function initMap() {
      quakeMap = L.map("mapContainer").setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(quakeMap);
    }
    initMap();
    
    /* === Carica i dati USGS degli eventi sismici === */
    async function loadEarthquakes() {
      const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Errore nel caricamento dei dati USGS: " + response.status);
        const data = await response.json();
        quakeData = data.features;
        // Ordinamento iniziale: per Data (dal più recente)
        sortByTime();
      } catch (error) {
        console.error(error);
        document.getElementById("quakeContainer").innerHTML =
          `<div class="alert alert-danger" role="alert">${error.message}</div>`;
      }
    }
    loadEarthquakes();
    
    /* === Funzioni di Ordinamento === */
    // Ordina per Magnitudine (dal più alto al più basso)
    function sortByMagnitude() {
      const sorted = quakeData.slice().sort((a, b) => b.properties.mag - a.properties.mag);
      updateSortedData(sorted);
    }
    
    // Ordina per Data (dal più recente al meno recente)
    function sortByTime() {
      const sorted = quakeData.slice().sort((a, b) => b.properties.time - a.properties.time);
      updateSortedData(sorted);
    }
    
    // Ordina per Profondità (dal meno profondo al più profondo)
    function sortByDepth() {
      const sorted = quakeData.slice().sort((a, b) => {
        const dA = a.geometry.coordinates[2] || 0;
        const dB = b.geometry.coordinates[2] || 0;
        return dA - dB;
      });
      updateSortedData(sorted);
    }
    
    /* === Aggiorna la Lista Ordinata, il Grafico e la Mappa === */
    function updateSortedData(sorted) {
      currentSortedData = sorted;
      displayQuakes(sorted);
      generateChart(sorted);
      updateMap(sorted);
      checkRisk(sorted);
    }
    
    /* === Visualizza la Lista degli Eventi in Card === */
    function displayQuakes(dataArray) {
      const container = document.getElementById("quakeContainer");
      container.innerHTML = "";
      if (dataArray.length === 0) {
        container.innerHTML = "<p class='text-center'>Nessun evento trovato.</p>";
        return;
      }
      dataArray.forEach(quake => {
        const { mag, place, time } = quake.properties;
        const [lon, lat, depth] = quake.geometry.coordinates;
        const dateStr = new Date(time).toLocaleString();
        let card = document.createElement("div");
        card.className = "quake-card";
        card.innerHTML = `
          <h4>${escapeHtml(place)}</h4>
          <p><strong>Magnitudine:</strong> ${mag}</p>
          <p><strong>Data/Ora:</strong> ${dateStr}</p>
          <p><strong>Profondità:</strong> ${depth} km</p>
          <p><strong>Coordinate:</strong> [${lat.toFixed(2)}, ${lon.toFixed(2)}]</p>
          <button class="btn btn-sm btn-secondary" onclick="loadQuakeDetails('${quake.id}')">Dettagli</button>
        `;
        container.appendChild(card);
      });
    }
    
    /* === Aggiorna la Mappa (Leaflet) con i Marker per ogni evento === */
    function updateMap(dataArray) {
      // Rimuove i vecchi marker
      markers.forEach(m => quakeMap.removeLayer(m));
      markers = [];
      dataArray.forEach(quake => {
        const [lon, lat, depth] = quake.geometry.coordinates;
        const { mag, place, time } = quake.properties;
        const dateStr = new Date(time).toLocaleString();
        const marker = L.marker([lat, lon]).bindPopup(
          `<strong>${escapeHtml(place)}</strong><br>Magnitudine: ${mag}<br>Data: ${dateStr}<br>Profondità: ${depth} km`
        );
        marker.addTo(quakeMap);
        markers.push(marker);
      });
      if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        quakeMap.fitBounds(group.getBounds());
      }
    }
    
    /* === Funzione per caricare i dettagli di un evento nella modale === */
    function loadQuakeDetails(quakeId) {
      const quake = quakeData.find(q => q.id === quakeId);
      if (!quake) return;
      const { mag, place, time, url } = quake.properties;
      const [lon, lat, depth] = quake.geometry.coordinates;
      const dateStr = new Date(time).toLocaleString();
      let html = `<h2>${escapeHtml(place)}</h2>`;
      html += `<p><strong>Magnitudine:</strong> ${mag}</p>`;
      html += `<p><strong>Data/Ora:</strong> ${dateStr}</p>`;
      html += `<p><strong>Profondità:</strong> ${depth} km</p>`;
      html += `<p><strong>Coordinate:</strong> [${lat.toFixed(2)}, ${lon.toFixed(2)}]</p>`;
      html += `<p><a href="${url}" target="_blank" class="btn btn-sm btn-primary">Visualizza su USGS</a></p>`;
      openDetailModal(place, html);
    }
    
    /* === Apertura della Modale === */
    function openDetailModal(title, contentHTML) {
      const modalTitle = document.getElementById("detailModalLabel");
      const modalBody = document.getElementById("modalBodyContent");
      modalTitle.textContent = title;
      modalBody.innerHTML = contentHTML;
      const modalElem = document.getElementById("detailModal");
      const modal = new bootstrap.Modal(modalElem, { backdrop: "static" });
      modal.show();
    }
    
    /* === Genera il Grafico (Top 10 per Magnitudine) === */
    function generateChart(dataArray) {
      // Ordina per magnitudine in maniera decrescente e prendi i primi 10
      const top10 = dataArray.slice().sort((a, b) => b.properties.mag - a.properties.mag).slice(0,10);
      const labels = top10.map(q => q.properties.place.substring(0,20) + "...");
      const mags   = top10.map(q => q.properties.mag);
      const ctx = document.getElementById("quakeChart").getContext("2d");
      if (quakeChart instanceof Chart) {
        quakeChart.destroy();
      }
      quakeChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Magnitudine",
            data: mags,
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }
    
    /* === Controlla Eventi Rilevanti (Alert) === */
    function checkRisk(dataArray) {
      // Definiamo "rilevante" un evento con magnitudine >= 5 o profondità < 10 km
      const risky = dataArray.filter(q => q.properties.mag >= 5 || (q.geometry.coordinates[2] && q.geometry.coordinates[2] < 10));
      const alertContainer = document.getElementById("alertContainer");
      if(risky.length > 0) {
        alertContainer.innerHTML = `<div class="alert alert-warning">
          Attenzione: Sono stati rilevati ${risky.length} eventi rilevanti (mag ≥ 5 o profondità < 10 km). 
          <a href="https://earthquake.usgs.gov/earthquakes/map/" target="_blank" class="alert-link">Visualizza mappa USGS</a>
        </div>`;
      } else {
        alertContainer.innerHTML = "";
      }
    }
    
    /* === Funzione per l'escape di caratteri HTML (per sicurezza) === */
    function escapeHtml(text) {
      if (typeof text !== "string") return text;
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    /* === Imposta i Listener per i Pulsanti di Ordinamento === */
    document.getElementById("btnMag").addEventListener("click", sortByMagnitude);
    document.getElementById("btnTime").addEventListener("click", sortByTime);
    document.getElementById("btnDepth").addEventListener("click", sortByDepth);
    
    /* === Gestione della chiusura della modale per evitare blocchi della pagina === */
    document.getElementById("detailModal").addEventListener("hidden.bs.modal", function() {
      document.getElementById("modalBodyContent").innerHTML = "";
      document.body.style.overflow = "auto";
      document.body.classList.remove("modal-open");
      const backdrops = document.querySelectorAll(".modal-backdrop");
      backdrops.forEach(elem => {
        if (elem.parentNode) {
          elem.parentNode.removeChild(elem);
        }
      });
    });
