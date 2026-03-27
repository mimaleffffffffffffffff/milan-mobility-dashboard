const map = L.map("map").setView([45.4642, 9.19], 11.5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

let pointsLayer;
let hotspotsLayer;

function formatLabel(value) {
  if (value === null || value === undefined) return "-";
  return String(value).replaceAll("_", " ");
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

Promise.all([
  fetch("mobility_points_clustered.geojson").then(res => res.json()),
  fetch("hotspot_centroids.geojson").then(res => res.json())
])
  .then(([pointsData, hotspotsData]) => {
    updateKPIs(pointsData, hotspotsData);

    pointsLayer = L.geoJSON(pointsData, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 2.5,
          stroke: false,
          fillColor: "#9ca3af",
          fillOpacity: 0.28
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

    const bounds = hotspotsLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    }
  })
  .catch(error => {
    console.error("Error loading data:", error);
    alert("There was a problem loading the map data.");
  });
