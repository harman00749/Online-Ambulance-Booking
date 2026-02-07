
const form = document.getElementById("ambulanceForm");
const summary = document.getElementById("bookingSummary");
const notificationBox = document.getElementById("notificationBox");
const etaText = document.getElementById("etaText");
const statusText = document.getElementById("statusText");
const cancelBtn = document.getElementById("cancelRide");
const completeBtn = document.getElementById("completeRide");
const recentList = document.getElementById("recentList");

// Map setup (centered roughly near Saharanpur, UP)
const map = L.map("map").setView([29.967, 77.551], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Markers (ambulance + destination)
let ambulanceMarker = null;
let destinationMarker = null;

// Simulated route points (simple straight-line interpolation)
let routeTimer = null;
let routeProgress = 0;
let routePoints = [];
let currentBooking = null;

// Helpers
function formatTime(minutes) {
  return `${minutes} mins`;
}

function pushNotification(message) {
  const ts = new Date().toLocaleTimeString();
  notificationBox.textContent += `${ts} — ${message}\n`;
  notificationBox.scrollTop = notificationBox.scrollHeight;
}

function saveRecent(booking) {
  const list = JSON.parse(localStorage.getItem("recentBookings") || "[]");
  list.unshift(booking);
  localStorage.setItem("recentBookings", JSON.stringify(list.slice(0, 8)));
  renderRecent();
}

function renderRecent() {
  const list = JSON.parse(localStorage.getItem("recentBookings") || "[]");
  recentList.innerHTML = "";
  list.forEach((b) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div><strong>${b.name}</strong> • ${b.type.toUpperCase()}</div>
      <div class="meta">Pickup: ${b.pickup} → Hospital: ${b.hospital} • Phone: ${b.phone}</div>
      <div class="meta">Booked at: ${b.time}</div>
    `;
    recentList.appendChild(li);
  });
}

// Build a simple route between two coordinates
function buildRoute(start, end, steps = 30) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const lat = start[0] + (end[0] - start[0]) * (i / steps);
    const lng = start[1] + (end[1] - start[1]) * (i / steps);
    points.push([lat, lng]);
  }
  return points;
}

// Start simulated movement
function startTracking(start, end) {
  // Clear previous
  if (routeTimer) clearInterval(routeTimer);
  routeProgress = 0;
  routePoints = buildRoute(start, end, 40);

  // Create markers
  if (ambulanceMarker) map.removeLayer(ambulanceMarker);
  if (destinationMarker) map.removeLayer(destinationMarker);

  ambulanceMarker = L.marker(start, {
    title: "Ambulance",
    icon: L.divIcon({
      className: "custom-ambulance",
      html: "🟢",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
  }).addTo(map);

  destinationMarker = L.marker(end, {
    title: "Destination",
    icon: L.divIcon({
      className: "custom-destination",
      html: "🔴",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
  }).addTo(map);

  map.fitBounds([start, end], { padding: [40, 40] });

  // Simulate ETA decreasing
  let eta = 18; // minutes
  etaText.textContent = formatTime(eta);
  statusText.textContent = "Ambulance dispatched";

  routeTimer = setInterval(() => {
    if (routeProgress >= routePoints.length) {
      clearInterval(routeTimer);
      statusText.textContent = "Arrived at hospital";
      pushNotification("Ambulance has arrived at the destination.");
      completeBtn.disabled = true;
      cancelBtn.disabled = true;
      return;
    }

    const pos = routePoints[routeProgress];
    ambulanceMarker.setLatLng(pos);
    routeProgress++;

    // Update ETA every few steps
    if (routeProgress % 4 === 0 && eta > 0) {
      eta--;
      etaText.textContent = formatTime(eta);
    }

    // Status updates
    if (routeProgress === Math.floor(routePoints.length / 3)) {
      statusText.textContent = "En route (25%)";
    } else if (routeProgress === Math.floor(routePoints.length / 2)) {
      statusText.textContent = "En route (50%)";
    } else if (routeProgress === Math.floor((routePoints.length * 3) / 4)) {
      statusText.textContent = "En route (75%)";
    }
  }, 600);
}

// Form submit
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const pickup = document.getElementById("pickup").value.trim();
  const hospital = document.getElementById("hospital").value.trim();
  const type = document.getElementById("type").value;

  // Basic validation
  if (!name || !phone || !pickup || !hospital || !type) {
    alert("Please fill all fields correctly.");
    return;
  }

  // Show summary
  const timeStr = new Date().toLocaleString();
  summary.classList.remove("hidden");
  summary.innerHTML = `
    <strong>Booking confirmed:</strong><br/>
    Patient: ${name}<br/>
    Phone: ${phone}<br/>
    Pickup: ${pickup}<br/>
    Destination: ${hospital}<br/>
    Type: ${type.toUpperCase()}<br/>
    Time: ${timeStr}
  `;

  // Enable action buttons
  cancelBtn.disabled = false;
  completeBtn.disabled = false;

  // Save booking
  currentBooking = { name, phone, pickup, hospital, type, time: timeStr };
  saveRecent(currentBooking);

  // Notifications
  notificationBox.textContent = ""; // reset
  pushNotification(`Ambulance booked for ${name}. Driver will contact at ${phone}.`);
  pushNotification("Dispatch center notified. Preparing ambulance and paramedic team.");

  // Simulate hospital alert after a short delay
  setTimeout(() => {
    pushNotification(`Hospital "${hospital}" has been alerted. Emergency bay prepared.`);
  }, 3000);

  // Simulate coordinates:
  // - Start near pickup (randomized around Saharanpur)
  // - End near hospital (slightly different random point)
  const baseLat = 29.967, baseLng = 77.551;
  const start = [baseLat + (Math.random() - 0.5) * 0.06, baseLng + (Math.random() - 0.5) * 0.06];
  const end = [baseLat + (Math.random() - 0.5) * 0.06, baseLng + (Math.random() - 0.5) * 0.06];

  startTracking(start, end);
});

// Cancel booking
cancelBtn.addEventListener("click", () => {
  if (!currentBooking) return;
  if (confirm("Cancel this booking?")) {
    pushNotification("Booking canceled by user.");
    statusText.textContent = "Booking canceled";
    etaText.textContent = "—";
    if (routeTimer) clearInterval(routeTimer);
    if (ambulanceMarker) map.removeLayer(ambulanceMarker);
    if (destinationMarker) map.removeLayer(destinationMarker);
    cancelBtn.disabled = true;
    completeBtn.disabled = true;
    currentBooking = null;
  }
});

// Complete ride
completeBtn.addEventListener("click", () => {
  if (!currentBooking) return;
  pushNotification("Ride marked as completed. Wishing a speedy recovery.");
  statusText.textContent = "Completed";
  etaText.textContent = "0 mins";
  if (routeTimer) clearInterval(routeTimer);
  cancelBtn.disabled = true;
  completeBtn.disabled = true;
});

// Render recent on load
renderRecent();