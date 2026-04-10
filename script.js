const map = L.map("map").setView([45.4642, 9.19], 11.5);

// BASEMAPS
const lightMap = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: "abcd",
    maxZoom: 20
  }
);

const satelliteMap = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: 'Tiles &copy; Esri'
  }
);

// Default basemap
lightMap.addTo(map);

// Basemap toggle control
const baseMaps = {
  "Light map": lightMap,
  "Satellite": satelliteMap
};

L.control.layers(baseMaps, null, {
  position: "topright",
  collapsed: false
}).addTo(map);

let boundaryLayer;
let pointsLayer;
let hotspotsLayer;
let allPointsData;
let allHotspotsData;
let compositionChart = null;

const DEFAULT_TYPES = [
  "bus_stop",
  "bicycle_parking",
  "station",
  "parking",
  "other"
];

const activeTypes = new Set(DEFAULT_TYPES);

function formatLabel(value) {
  if (value === null || value === undefined) return "-";
  return String(value).replaceAll("_", " ");
}

function classifyDiversity(value) {
  const diversity = Number(value || 0);

  if (diversity <= 1) return "low";
  if (diversity <= 3) return "medium";
  return "high";
}

function getHotspotRadiusClass(nPoints) {
  const value = Number(nPoints || 0);

  if (value <= 10) return 6;
  if (value <= 30) return 9;
  if (value <= 70) return 12;
  return 16;
}

function getHotspotSizeLabel(nPoints) {
  const value = Number(nPoints || 0);

  if (value <= 10) return "Small";
  if (value <= 30) return "Medium";
  if (value <= 70) return "Large";
  return "Very large";
}

function updateKPIs(hotspotsData) {
  const totalHotspots = hotspotsData.features.length;

  const hotspotSizes = hotspotsData.features.map(
    f => Number(f.properties.n_points || 0)
  );

  const totalPoints = hotspotSizes.reduce((sum, value) => sum + value, 0);
  const largestHotspot = hotspotSizes.length ? Math.max(...hotspotSizes) : 0;
  const avgHotspot = hotspotSizes.length
    ? Math.round(totalPoints / hotspotsData.features.length)
    : 0;

  document.getElementById("kpi-total-points").textContent = totalPoints;
  document.getElementById("kpi-total-hotspots").textContent = totalHotspots;
  document.getElementById("kpi-largest-hotspot").textContent = largestHotspot;
  document.getElementById("kpi-avg-hotspot").textContent = avgHotspot;
}

function resetHotspotPanel() {
  document.getElementById("hotspot-empty").classList.remove("hidden");
  document.getElementById("hotspot-details").classList.add("hidden");

  if (compositionChart) {
    compositionChart.destroy();
    compositionChart = null;
  }
}

function renderCompositionChart(props) {
  const canvas = document.getElementById("composition-chart");
  if (!canvas) return;

  const labels = [
    "Bus stops",
    "Bicycle parking",
    "Stations",
    "Parking",
    "Other"
  ];

  const values = [
    Number(props.bus_stop || 0),
    Number(props.bicycle_parking || 0),
    Number(props.station || 0),
    Number(props.parking || 0),
    Number(props.other || 0)
  ];

  if (compositionChart) {
    compositionChart.destroy();
  }

  compositionChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Count",
          data: values,
          backgroundColor: [
            "rgba(239, 68, 68, 0.85)",
            "rgba(248, 113, 113, 0.85)",
            "rgba(185, 28, 28, 0.85)",
            "rgba(252, 165, 165, 0.85)",
            "rgba(203, 213, 225, 0.95)"
          ],
          borderColor: [
            "rgba(185, 28, 28, 1)",
            "rgba(220, 38, 38, 1)",
            "rgba(127, 29, 29, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(148, 163, 184, 1)"
          ],
          borderWidth: 1.2,
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.raw} services`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: "#e5e7eb"
          },
          ticks: {
            color: "#6b7280",
            precision: 0
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: "#374151",
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
}

function updateHotspotPanel(props) {
  document.getElementById("hotspot-empty").classList.add("hidden");
  document.getElementById("hotspot-details").classList.remove("hidden");

  document.getElementById("detail-label").textContent =
    props.hotspot_label || "-";

  document.getElementById("detail-type").textContent =
    formatLabel(props.hotspot_type);

  document.getElementById("detail-points").textContent =
    props.n_points ?? "-";

  document.getElementById("detail-diversity").textContent =
    props.diversity_score ?? "-";

  document.getElementById("detail-dominant").textContent =
    formatLabel(props.dominant_type);

  renderCompositionChart(props);
}

function renderBoundary(boundaryData) {
  if (boundaryLayer) {
    map.removeLayer(boundaryLayer);
  }

  boundaryLayer = L.geoJSON(boundaryData, {
    style: {
      color: "#1f2937",
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0
    }
  }).addTo(map);
}

function renderLayers(pointsData, hotspotsData) {
  if (pointsLayer) {
    map.removeLayer(pointsLayer);
  }

  if (hotspotsLayer) {
    map.removeLayer(hotspotsLayer);
  }

  pointsLayer = L.geoJSON(pointsData, {
    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 2.5,
        stroke: false,
        fillColor: "#9ca3af",
        fillOpacity: 0.18
      });
    }
  }).addTo(map);

  hotspotsLayer = L.geoJSON(hotspotsData, {
    pointToLayer: function (feature, latlng) {
      const p = feature.properties || {};
      const radius = getHotspotRadiusClass(p.n_points);

      return L.circleMarker(latlng, {
        radius: radius,
        color: "#b91c1c",
        weight: 2,
        fillColor: "#ef4444",
        fillOpacity: 0.72
      });
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      const sizeClass = getHotspotSizeLabel(p.n_points);

      const popupContent = `
        <b>${p.hotspot_label || "Hotspot"}</b><br>
        Type: ${formatLabel(p.hotspot_type)}<br>
        Points: ${p.n_points ?? "-"}<br>
        Size class: ${sizeClass}<br>
        Diversity: ${p.diversity_score ?? "-"}<br>
        Dominant type: ${formatLabel(p.dominant_type)}
      `;

      layer.bindPopup(popupContent);

      layer.on("click", function () {
        updateHotspotPanel(p);
      });
    }
  }).addTo(map);

  if (boundaryLayer) {
    boundaryLayer.bringToFront();
  }

  hotspotsLayer.bringToFront();
}

function hotspotMatchesSelectedServices(props) {
  if (activeTypes.size === 0) {
    return true;
  }

  const dominantType = props.dominant_type;
  return activeTypes.has(dominantType);
}

function applyFilters() {
  const diversityValue = document.getElementById("diversity-filter").value;

  const filteredHotspots = {
    type: "FeatureCollection",
    features: allHotspotsData.features.filter(feature => {
      const props = feature.properties || {};
      const diversityClass = classifyDiversity(props.diversity_score);

      const matchesServices = hotspotMatchesSelectedServices(props);
      const matchesDiversity =
        diversityValue === "all" || diversityClass === diversityValue;

      return matchesServices && matchesDiversity;
    })
  };

  renderLayers(allPointsData, filteredHotspots);
  updateKPIs(filteredHotspots);
  resetHotspotPanel();

  const bounds = hotspotsLayer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.2));
  }
}

function setupFilters() {
  const chips = document.querySelectorAll(".filter-chip");

  chips.forEach(chip => {
    chip.addEventListener("click", function () {
      const type = this.dataset.type;

      if (activeTypes.has(type)) {
        activeTypes.delete(type);
        this.classList.remove("active");
      } else {
        activeTypes.add(type);
        this.classList.add("active");
      }

      applyFilters();
    });
  });

  document.getElementById("diversity-filter").addEventListener("change", function () {
    applyFilters();
  });

  document.getElementById("reset-filters").addEventListener("click", function () {
    activeTypes.clear();
    DEFAULT_TYPES.forEach(type => activeTypes.add(type));

    document.querySelectorAll(".filter-chip").forEach(chip => {
      chip.classList.add("active");
    });

    document.getElementById("diversity-filter").value = "all";

    applyFilters();
  });
}

function setupMethodologyAccordion() {
  const toggleBtn = document.getElementById("methodology-toggle");
  const content = document.getElementById("methodology-content");
  const icon = document.getElementById("methodology-icon");

  if (!toggleBtn || !content || !icon) return;

  toggleBtn.addEventListener("click", function () {
    const isHidden = content.classList.contains("hidden");

    if (isHidden) {
      content.classList.remove("hidden");
      toggleBtn.setAttribute("aria-expanded", "true");
      icon.textContent = "−";
    } else {
      content.classList.add("hidden");
      toggleBtn.setAttribute("aria-expanded", "false");
      icon.textContent = "+";
    }
  });
}

Promise.all([
  fetch("milano_boundary.geojson").then(res => res.json()),
  fetch("mobility_points_clustered.geojson").then(res => res.json()),
  fetch("hotspot_centroids.geojson").then(res => res.json())
])
  .then(([boundaryData, pointsData, hotspotsData]) => {
    allPointsData = pointsData;
    allHotspotsData = hotspotsData;

    renderBoundary(boundaryData);
    renderLayers(allPointsData, allHotspotsData);
    updateKPIs(allHotspotsData);
    setupFilters();
    setupMethodologyAccordion();

    const bounds = hotspotsLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    }
  })
  .catch(error => {
    console.error("Error loading data:", error);
    alert("There was a problem loading the map data.");
  });
