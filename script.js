var map = L.map('map').setView([45.4642, 9.19], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// points
fetch("mobility_points_clustered.geojson")
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 3,
                    color: "#999",
                    fillOpacity: 0.4
                });
            }
        }).addTo(map);
    });

// hotspots
fetch("hotspot_centroids.geojson")
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 8,
                    color: "red",
                    fillOpacity: 0.9
                });
            },
            onEachFeature: function (feature, layer) {
                let p = feature.properties;

                layer.bindPopup(`
                    <b>${p.hotspot_label}</b><br>
                    Points: ${p.n_points}<br>
                    Type: ${p.hotspot_type}
                `);
            }
        }).addTo(map);
    });
