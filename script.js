const map = L.map("map").setView([45.4642, 9.19], 11.5);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: "abcd",
  maxZoom: 20
}).addTo(map);

let pointsLayer;
let hotspotsLayer;
let allPointsData;
let allHotspotsData;

const activeTypes = new Set([
  "bus_stop",
  "bicycle_parking",
  "station",
  "parking",
  "other"
]);

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

function updateKPIs(pointsData, hotspotsData) {
  const totalPoints = pointsData.features.length;
  const totalHotspots = hotspotsData.features.length;

  const hotspotSizes = hotspotsData.features.map(
    f => Number(f.properties.n_points || 0)
  );

  const largestHotspot = hotspotSizes.length ? Math.max(...hotspotSizes) : 0;
  const avgHotspot = hotspotSizes.length
    ? Math.round(hotspotSizes.reduce((a, b) => a + b, 0) / hotspotSizes.length)
    : 0;

  document.getElementById("kpi-total-points").textContent = totalPoints;
  document.getElementById("kpi-total-hotspots").textContent = totalHotspots;
  document.getElementById("kpi-largest-hotspot").textContent = largestHotspot;
  document.getElementById("kpi-avg-hotspot").textContent = avgHotspot;
}

function resetHotspotPanel() {
  document.getElementById("hotspot-empty").classList.remove("hidden");
  document.getElementById("hotspot-details").classList.add("hidden");
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

  const compositionList = document.getElementById("detail-composition");
  compositionList.innerHTML = "";

  const compositionFields = [
    ["bus_stop", "Bus stops"],
    ["bicycle_parking", "Bicycle parking"],
    ["station", "Stations"],
    ["parking", "Parking"],
    ["other", "Other"]
  ];

  compositionFields.forEach(([field, label]) => {
    const value = Number(props[field] || 0);
    if (value > 0) {
      const li = document.createElement("li");
      li.textContent = `${label}: ${value}`;
      compositionList.appendChild(li);
    }
  });

  if (!compositionList.children.length) {
    const li = document.createElement("li");
    li.textContent = "No composition data available.";
    compositionList.appendChild(li);
  }
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
      return L.circleMarker(latlng, {
        radius: 8,
        color: "#b91c1c",
        weight: 2,
        fillColor: "#ef4444",
        fillOpacity: 0.9
      });
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;

      const popupContent = `
        <b>${p.hotspot_label || "Hotspot"}</b><br>
        Type: ${formatLabel(p.hotspot_type)}<br>
        Points: ${p.n_points ?? "-"}<br>
        Diversity: ${p.diversity_score ?? "-"}<br>
        Dominant type: ${formatLabel(p.dominant_type)}
      `;

      layer.bindPopup(popupContent);

      layer.on("click", function () {
        updateHotspotPanel(p);
      });
    }
  }).addTo(map);
}

function applyFilters() {
  const diversityValue = document.getElementById("diversity-filter").value;

  const filteredHotspots = {
    type: "FeatureCollection",
    features: allHotspotsData.features.filter(feature => {
      const props = feature.properties;
      const hotspotType = props.hotspot_type;
      const diversityClass = classifyDiversity(props.diversity_score);

      const matchesType = activeTypes.has(hotspotType);
      const matchesDiversity =
        diversityValue === "all" || diversityClass === diversityValue;

      return matchesType && matchesDiversity;
    })
  };

  const filteredLabels = new Set(
    filteredHotspots.features.map(f => f.properties.hotspot_label)
  );

  const filteredPoints = {
    type: "FeatureCollection",
    features: allPointsData.features.filter(feature => {
      const props = feature.properties || {};
      const pointClusterLabel =
        props.hotspot_label ||
        props.cluster_label ||
        props.label ||
        props.cluster_id;

      if (pointClusterLabel !== undefined && pointClusterLabel !== null) {
        return filteredLabels.has(pointClusterLabel);
      }

      return true;
    })
  };

  renderLayers(filteredPoints, filteredHotspots);
  updateKPIs(filteredPoints, filteredHotspots);
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
        if (activeTypes.size > 1) {
          activeTypes.delete(type);
          this.classList.remove("active");
        }
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
    activeTypes.add("bus_stop");
    activeTypes.add("bicycle_parking");
    activeTypes.add("station");
    activeTypes.add("parking");
    activeTypes.add("other");

    document.querySelectorAll(".filter-chip").forEach(chip => {
      chip.classList.add("active");
    });

    document.getElementById("diversity-filter").value = "all";

    applyFilters();
  });
}

Promise.all([
  fetch("mobility_points_clustered.geojson").then(res => res.json()),
  fetch("hotspot_centroids.geojson").then(res => res.json())
])
  .then(([pointsData, hotspotsData]) => {
    allPointsData = pointsData;
    allHotspotsData = hotspotsData;

    renderLayers(allPointsData, allHotspotsData);
    updateKPIs(allPointsData, allHotspotsData);
    setupFilters();

    const bounds = hotspotsLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    }
  })
  .catch(error => {
    console.error("Error loading data:", error);
    alert("There was a problem loading the map data.");
  });
