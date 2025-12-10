"use strict";
function initMap() {
    // create a map container if it's not present (index.html includes styles for #map)
    if (!document.getElementById('map')) {
        const mapDiv = document.createElement('div');
        mapDiv.id = 'map';
        document.body.prepend(mapDiv);
    }
    // Center over Europe (approximate centroid) with a zoom that shows most of Europe
    const map = L.map('map').setView([47.447915, 8.562177], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    // expose for future navigation/control code
    window.appMap = map;
    console.log('Map initialized (Europe view)', map);
}
initMap();
