declare const L: any;

function initMap() {
    // create a map container if it's not present (index.html includes styles for #map)
    if (!document.getElementById('map')) {
        const mapDiv = document.createElement('div');
        mapDiv.id = 'map';
        document.body.prepend(mapDiv);
    }

    // Center over Europe (approximate centroid) with a zoom that shows most of Europe
    const map = L.map('map').setView([47.447915, 8.562177], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // expose for future navigation/control code
    (window as any).appMap = map;
    console.log('Map initialized (Europe view)', map);
}

function disableMobileMapInteractions() {
    const map = (window as any).appMap;
    if (!map) return;
    try {
        if (map.dragging && map.dragging.disable) map.dragging.disable();
        if (map.touchZoom && map.touchZoom.disable) map.touchZoom.disable();
        if (map.doubleClickZoom && map.doubleClickZoom.disable) map.doubleClickZoom.disable();
        if (map.scrollWheelZoom && map.scrollWheelZoom.disable) map.scrollWheelZoom.disable();
        if (map.boxZoom && map.boxZoom.disable) map.boxZoom.disable();
        if (map.keyboard && map.keyboard.disable) map.keyboard.disable();
        if (map.tap && map.tap.disable) map.tap.disable();

        // Remove zoom control if available, otherwise hide via CSS
        try {
            if (map.zoomControl && map.removeControl) {
                map.removeControl(map.zoomControl);
            } else {
                const s = document.createElement('style');
                s.id = 'leaflet-disable-zoom-style';
                s.innerHTML = '.leaflet-control-zoom { display: none !important; }';
                document.head.appendChild(s);
            }
        } catch (e) {
            console.warn('Failed to remove zoomControl, hiding via CSS', e);
        }
    } catch (err) {
        console.warn('disableMobileMapInteractions: error', err);
    }
}

function update() {
    requestAnimationFrame(update);
}


function main() {

    initMap();

    disableMobileMapInteractions();

    
    update();
}

main();