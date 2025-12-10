declare const L: any;

let isTouching: boolean = false;
let xPos: number = 0;
let yPos: number = 0;
let deltaX: number = 0;
let deltaY: number = 0;
const MAP_VELOCITY: number = 1.3; // pixels/ms to map movement ratio
const PLANE_ROTATION_OFFSET: number = 90; // degrees to align image orientation (adjust if image points another direction)
let lastTimestamp: number = 0;
// Smoothing / physics
let velX: number = 0;
let velY: number = 0;
// accumulators to preserve fractional/sub-pixel pan amounts
let panAccumX: number = 0;
let panAccumY: number = 0;
const ACCEL_SMOOTH: number = 0.05; // how quickly velocity approaches target while touching (0-1)
const DECEL_SMOOTH: number = 0.09; // how quickly velocity decays to zero after release
const ROTATION_SMOOTH: number = 0.06; // how quickly plane rotation eases to target (0-1)
let currentRotationDeg: number = 0; // smoothed rotation

// Helsinki coordinates and proximity detection
const HELSINKI_LAT: number = 60.1699;
const HELSINKI_LON: number = 24.9384;
const PROXIMITY_THRESHOLD_KM: number = 20;
let pdfModalShown: boolean = false;

let gameWon: boolean = false;

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

function setEventListeners() {
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
}

function onTouchStart(event: TouchEvent) {
    event.preventDefault();
    storeTouchPosition(event);
    isTouching = true;
}

function onTouchEnd(event: TouchEvent) {
    event.preventDefault();
    isTouching = false;
}

function onTouchMove(event: TouchEvent) {
    event.preventDefault();
    storeTouchPosition(event);
}

function storeTouchPosition(event: TouchEvent) {
    if (event.touches.length === 0) return;
    const touch = event.touches[0];
    xPos = touch.clientX;
    yPos = touch.clientY;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    deltaX = xPos - centerX;
    deltaY = yPos - centerY;
}


function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function createPdfModal() {
    if (document.getElementById('pdf-modal')) return;

    // Remove global touch listeners
    window.removeEventListener('touchstart', onTouchStart as EventListener);
    window.removeEventListener('touchmove', onTouchMove as EventListener);
    window.removeEventListener('touchend', onTouchEnd as EventListener);

    const modal = document.createElement('div');
    modal.id = 'pdf-modal';
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        zIndex: '10000',
        pointerEvents: 'auto'
    });

    // Close modal when clicking outside container
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            setEventListeners(); // restore global touch listeners
        }
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        height: '80vh',
        borderRadius: '8px',
        backgroundImage: 'url("ressources/pictures/background.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        overflow: 'hidden'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '10px',
        backgroundColor: 'rgba(240, 240, 240, 0.8)', // slightly transparent so background shows
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    });

    const title = document.createElement('h2');
    title.textContent = '🎉 Viel Spaß in Helsinki, Zoé 🎉';
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.fontFamily = 'Arial, sans-serif';
    header.appendChild(title);

    const imgPreview = document.createElement('img');
    imgPreview.src = 'ressources/pictures/ticket.png';
    Object.assign(imgPreview.style, {
        maxHeight: '54%',
        width: 'auto',
        margin: 'auto',
        cursor: 'pointer',
        pointerEvents: 'auto'
    });

    // Open PDF on click
    imgPreview.addEventListener('click', () => {
        window.open('ressources/ticket.pdf', '_blank');
    });

    container.appendChild(header);
    container.appendChild(imgPreview);
    modal.appendChild(container);
    document.body.appendChild(modal);
}






function showPdfModal() {
    if (!pdfModalShown) {
        createPdfModal();
        pdfModalShown = true;
    }
    const modal = document.getElementById('pdf-modal');
    if (modal) modal.style.display = 'flex';
}

function closePdfModal() {
    const modal = document.getElementById('pdf-modal');
    if (modal) modal.style.display = 'none';
}

function checkProximityToHelsinki(map: any) {
    // Get the map center in lat/lon
    const center = map.getCenter();
    const distance = haversineDistance(center.lat, center.lng, HELSINKI_LAT, HELSINKI_LON);

    if (distance <= PROXIMITY_THRESHOLD_KM && !pdfModalShown) {
        winGame();
    }
}

function winGame() {
    gameWon = true;
    showPdfModal();
}

function computeTargetVelocity(magnitude: number) {
    if (isTouching && magnitude > 0.0001) {
        const normalizedX = deltaX / magnitude;
        const normalizedY = deltaY / magnitude;
        return { x: -normalizedX * MAP_VELOCITY, y: -normalizedY * MAP_VELOCITY };
    }
    return { x: 0, y: 0 };
}

function smoothVelocity(targetX: number, targetY: number) {
    const smooth = isTouching ? ACCEL_SMOOTH : DECEL_SMOOTH;
    velX += (targetX - velX) * smooth;
    velY += (targetY - velY) * smooth;
}

function applyPan(map: any) {
    // accumulate fractional movement so very small velocities aren't lost
    panAccumX += -velX;
    panAccumY += -velY;

    // only pan when we've accumulated at least 1 pixel (preserve sign)
    const intX = panAccumX > 0 ? Math.floor(panAccumX) : Math.ceil(panAccumX);
    const intY = panAccumY > 0 ? Math.floor(panAccumY) : Math.ceil(panAccumY);

    if (intX !== 0 || intY !== 0) {
        map.panBy([intX, intY], { animate: false, duration: 0 });
        panAccumX -= intX;
        panAccumY -= intY;
    }
}


function updatePlaneRotation(magnitude: number) {
    const plane = document.querySelector('.plane-image') as HTMLElement | null;
    if (!plane) return;

    let targetRotation = currentRotationDeg;
    if (magnitude > 0.0001) {
        const angleRad = Math.atan2(deltaY, deltaX);
        const angleDeg = angleRad * 180 / Math.PI;
        targetRotation = angleDeg + PLANE_ROTATION_OFFSET;
    }

    let diff = ((targetRotation - currentRotationDeg + 540) % 360) - 180;
    currentRotationDeg = currentRotationDeg + diff * ROTATION_SMOOTH;
    plane.style.transform = `rotate(${currentRotationDeg}deg)`;
}



function update(timestamp: number) {

    // requestAnimationFrame passes a high-res timestamp
    if (!timestamp) timestamp = Date.now();
    const dt = lastTimestamp ? Math.min(40, timestamp - lastTimestamp) : 16; // clamp dt (ms)
    lastTimestamp = timestamp;

    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const map = (window as any).appMap;
    if (map) {
        const target = computeTargetVelocity(magnitude);
        smoothVelocity(target.x, target.y);
        applyPan(map);
        updatePlaneRotation(magnitude);
        checkProximityToHelsinki(map);
    }

    if (gameWon) {
        return;
    }

    requestAnimationFrame(update);
}


function main() {

    initMap();

    disableMobileMapInteractions();

    setEventListeners();

    winGame();
    requestAnimationFrame(update);
}

main();

