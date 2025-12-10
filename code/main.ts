declare const L: any;

let isTouching: boolean = false;
let xPos: number = 0;
let yPos: number = 0;
let deltaX: number = 0;
let deltaY: number = 0;
const MAP_VELOCITY: number = 2; // pixels/ms to map movement ratio
const PLANE_ROTATION_OFFSET: number = 90; // degrees to align image orientation (adjust if image points another direction)
let lastTimestamp: number = 0;
// Smoothing / physics
let velX: number = 0;
let velY: number = 0;
const ACCEL_SMOOTH: number = 0.18; // how quickly velocity approaches target while touching (0-1)
const DECEL_SMOOTH: number = 0.08; // how quickly velocity decays to zero after release
const ROTATION_SMOOTH: number = 0.18; // how quickly plane rotation eases to target (0-1)
let currentRotationDeg: number = 0; // smoothed rotation

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

function createSpeedOverlay() {
    if (!document.getElementById('speed-overlay')) {
        const el = document.createElement('div');
        el.id = 'speed-overlay';
        el.style.position = 'fixed';
        el.style.left = '10px';
        el.style.top = '10px';
        el.style.padding = '6px 10px';
        el.style.background = 'rgba(0,0,0,0.5)';
        el.style.color = '#fff';
        el.style.fontFamily = 'monospace';
        el.style.zIndex = '9999';
        el.textContent = 'Speed: 0.00';
        document.body.appendChild(el);
    }
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
    map.panBy([-velX, -velY], { animate: false, duration: 0 });
}

function updateSpeedOverlay() {
    const speedEl = document.getElementById('speed-overlay');
    if (speedEl) {
        const speed = Math.sqrt(velX * velX + velY * velY);
        speedEl.textContent = `Speed: ${speed.toFixed(2)}`;
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
        updateSpeedOverlay();
        updatePlaneRotation(magnitude);
    }

    requestAnimationFrame(update);
}


function main() {

    initMap();

    disableMobileMapInteractions();

    setEventListeners();

    requestAnimationFrame(update);
}

main();

