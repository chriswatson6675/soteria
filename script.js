function el(id) { return document.getElementById(id); }
function set(id, val) { el(id).textContent = val; }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function switchTab(tab) {
  el('tab-map').classList.remove('active');
  el('tab-places').classList.remove('active');
  el('tab-docs').classList.remove('active');
  el('tab-emergency').classList.remove('active');
  el('tab-currency').classList.remove('active');
  el('tabBtnMap').classList.remove('active');
  el('tabBtnPlaces').classList.remove('active');
  el('tabBtnDocs').classList.remove('active');
  el('tabBtnEmergency').classList.remove('active');
  el('tabBtnCurrency').classList.remove('active');
  el('tab-' + tab).classList.add('active');
  el('tabBtn' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  if (tab === 'map' && map) setTimeout(function () { map.invalidateSize(); }, 50);
}

var DESCS = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Foggy',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Light showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
var ICONS  = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'❄️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};

var map, placeMarker, startMarker, endMarker, routingControl, gpsMarker, gpsCircle;
var routeMode = false, routeStart = null, routeEnd = null;
var currentLoc = { lat: 51.4816, lng: -3.1791, name: 'Llandudno' };
var places = JSON.parse(localStorage.getItem('hta_places') || '[]');
var presets = JSON.parse(localStorage.getItem('hta_presets') || JSON.stringify([
  {id:1,name:'Venice',lat:45.4408,lng:12.3155},
  {id:2,name:'Rome',lat:41.9028,lng:12.4964},
  {id:3,name:'Barcelona',lat:41.3851,lng:2.1734},
  {id:4,name:'Paris',lat:48.8566,lng:2.3522},
  {id:5,name:'Lisbon',lat:38.7223,lng:-9.1393},
  {id:6,name:'Amsterdam',lat:52.3676,lng:4.9041}
]));
var forecastPayload = null;
var searchPayload = [];
var docs = JSON.parse(localStorage.getItem('hta_docs_meta') || '[]');
var emergencyContacts = JSON.parse(localStorage.getItem('hta_emergency') || '{}');
var exchangeRates = JSON.parse(localStorage.getItem('hta_rates') || '{}');
var accommodations = JSON.parse(localStorage.getItem('hta_accommodations') || '{}');
var GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1MAxzyWg5Ysuw1Yr1ZW6qOkC9pROu4tfr';

// Track online/offline status
var isOnline = navigator.onLine;
window.addEventListener('online', function () {
  isOnline = true;
  showOfflineNotice();
  fetchWeather(currentLoc);
  fetchExchangeRates();
});
window.addEventListener('offline', function () {
  isOnline = false;
  showOfflineNotice();
});

function showOfflineNotice() {
  var notice = el('offlineNotice');
  if (!isOnline) {
    notice.style.display = 'flex';
    notice.innerHTML = '📡 You\'re offline — features limited, but core app works';
  } else {
    notice.style.display = 'none';
  }
}

window.addEventListener('load', function () {
  // Show offline notice on load
  showOfflineNotice();
  
  // Initialize map first
  map = L.map('map').setView([currentLoc.lat, currentLoc.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    attribution: '© OpenStreetMap', 
    maxZoom: 19,
    // Enable caching for offline use
    crossOrigin: true,
    errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  }).addTo(map);
  map.on('click', onMapClick);
  setTimeout(function () { map.invalidateSize(); }, 250);

  // Try GPS first
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      currentLoc = { lat: lat, lng: lng, name: 'Your location' };
      map.setView([lat, lng], 13);
      fetchWeather(currentLoc);
      renderTransport(currentLoc);
    }, function () {
      // GPS failed, use default
      fetchWeather(currentLoc);
      renderTransport(currentLoc);
    }, { enableHighAccuracy: false, timeout: 5000 });
  } else {
    fetchWeather(currentLoc);
    renderTransport(currentLoc);
  }

  renderPresets();
  renderDocList();
  renderEmergencyContactsList();
  fetchExchangeRates();

  var dz = el('dropZone');
  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('drag-over'); });
  dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
  el('fileInput').addEventListener('change', function () { handleFiles(this.files); });
  
  // Close modal when clicking outside it
  el('accomModal').addEventListener('click', function (e) {
    if (e.target === this) closeAccomModal();
  });
});

function fetchWeather(loc) {
  set('wLoc', loc.name.toUpperCase());
  set('wIcon', '⏳'); set('wTemp', '—'); set('wDesc', 'Loading…'); set('wHumidity', ''); set('wWind', '');
  forecastPayload = null;
  el('forecastBtn').disabled = true;
  
  // If offline, show cached message
  if (!isOnline) {
    set('wIcon', '📡');
    set('wDesc', 'Weather offline');
    set('wTemp', '—');
    return;
  }
  
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lng + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max&timezone=auto&forecast_days=8';
  fetch(url).then(function (r) { return r.json(); }).then(function (data) {
    var c = data.current, code = c.weather_code;
    set('wIcon', ICONS[code] || '⛅');
    set('wTemp', Math.round(c.temperature_2m) + '°C');
    set('wDesc', DESCS[code] || 'Variable');
    set('wHumidity', 'Humidity: ' + c.relative_humidity_2m + '%');
    set('wWind', 'Wind: ' + Math.round(c.wind_speed_10m) + ' km/h');
    forecastPayload = { daily: data.daily, loc: loc };
    el('forecastBtn').disabled = false;
  }).catch(function () { 
    set('wDesc', 'Weather unavailable'); 
    set('wIcon', '⚠️'); 
  });
}

function openForecast() {
  if (!forecastPayload) return;
  var d = forecastPayload.daily, DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], html = '';
  for (var i = 1; i <= 7; i++) {
    var date = new Date(d.time[i] + 'T12:00:00');
    var hi = Math.round(d.temperature_2m_max[i]), lo = Math.round(d.temperature_2m_min[i]);
    var rain = d.precipitation_probability_max[i] || 0, wind = Math.round(d.wind_speed_10m_max[i] || 0);
    var uv = d.uv_index_max[i] != null ? Math.round(d.uv_index_max[i]) : '?';
    var icon = ICONS[d.weather_code[i]] || '⛅', desc = DESCS[d.weather_code[i]] || 'Variable';
    var barW = Math.max(8, Math.min(100, Math.round((hi / 42) * 100)));
    var uvCol = uv < 3 ? '#4caf50' : uv < 6 ? '#ff9800' : uv < 8 ? '#f44336' : '#9c27b0';
    var dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    html += '<div class="forecast-row"><div class="forecast-day"><div class="forecast-day-name">' + DAY[date.getDay()] + '</div><div class="forecast-day-date">' + dateStr + '</div></div><div class="forecast-icon">' + icon + '</div><div class="forecast-detail"><div class="forecast-desc">' + desc + '</div><div class="temp-bar-row"><span class="temp-lo">' + lo + '°</span><div class="temp-bar-bg"><div class="temp-bar-fill" style="width:' + barW + '%"></div></div><span class="temp-hi">' + hi + '°</span></div><div class="forecast-pills"><span class="pill">💧 ' + rain + '%</span><span class="pill">💨 ' + wind + ' km/h</span><span class="pill" style="color:' + uvCol + '">UV ' + uv + '</span></div></div></div>';
  }
  set('modalLoc', forecastPayload.loc.name.toUpperCase());
  el('modalBody').innerHTML = html;
  el('forecastModal').classList.add('show');
}
function closeForecast() { el('forecastModal').classList.remove('show'); }

function quickAdd(name, lat, lng) {
  var slotNum = prompt('Save to which preset slot? (1-6)', '1');
  if (slotNum === null) return;
  slotNum = parseInt(slotNum);
  if (slotNum < 1 || slotNum > 6) { alert('Enter a number between 1 and 6'); return; }
  
  presets[slotNum - 1] = {
    id: slotNum,
    name: name,
    lat: lat,
    lng: lng
  };
  
  localStorage.setItem('hta_presets', JSON.stringify(presets));
  renderPresets();
  alert('Saved ' + name + ' to preset ' + slotNum);
}

function quickAdd(name, lat, lng) {
  var existing = places.find(function (p) { return p.name === name; });
  if (existing) { goToPlace(existing); return; }
  addAndGoToPlace({ id: Date.now(), name: name, lat: lat, lng: lng });
}

function renderAccommodationDropdown() {}

function addAccommodation(placeId) {
  var name = prompt('Accommodation name (e.g. Hotel Milano)', '');
  if (name === null || !name.trim()) return;
  var address = prompt('Address or location', '');
  if (address === null) return;
  accommodations[placeId] = { name: name, address: address, phone: '', website: '', notes: '' };
  localStorage.setItem('hta_accommodations', JSON.stringify(accommodations));
  renderPresets();
}

function editAccommodation(placeId) {
  openAccomModal(placeId);
}

function deleteAccommodation(placeId) {
  if (confirm('Delete this accommodation?')) {
    delete accommodations[placeId];
    localStorage.setItem('hta_accommodations', JSON.stringify(accommodations));
    renderPresets();
  }
}

var currentAccomPlaceId = null;

function openAccomModal(placeId) {
  currentAccomPlaceId = placeId;
  var accom = accommodations[placeId] || {};
  el('accomName').value = accom.name || '';
  el('accomAddress').value = accom.address || '';
  el('accomPhone').value = accom.phone || '';
  el('accomWebsite').value = accom.website || '';
  el('accomNotes').value = accom.notes || '';
  
  // Show/hide action buttons
  el('phoneCallBtn').style.display = accom.phone ? 'block' : 'none';
  el('websiteBtn').style.display = accom.website ? 'block' : 'none';
  
  el('accomModal').style.display = 'flex';
}

function closeAccomModal() {
  el('accomModal').style.display = 'none';
  currentAccomPlaceId = null;
}

function saveAccomModal() {
  if (!currentAccomPlaceId) return;
  var name = el('accomName').value.trim();
  var address = el('accomAddress').value.trim();
  if (!name || !address) {
    alert('Name and address are required');
    return;
  }
  accommodations[currentAccomPlaceId] = {
    name: name,
    address: address,
    phone: el('accomPhone').value.trim(),
    website: el('accomWebsite').value.trim(),
    notes: el('accomNotes').value.trim()
  };
  localStorage.setItem('hta_accommodations', JSON.stringify(accommodations));
  closeAccomModal();
  renderPresets();
}

function deleteAccomFromModal() {
  if (!currentAccomPlaceId) return;
  if (confirm('Delete this accommodation?')) {
    delete accommodations[currentAccomPlaceId];
    localStorage.setItem('hta_accommodations', JSON.stringify(accommodations));
    closeAccomModal();
    renderPresets();
  }
}

function callPhoneFromModal() {
  var phone = el('accomPhone').value.trim();
  if (phone) window.location.href = 'tel:' + phone;
}

function openWebsiteFromModal() {
  var website = el('accomWebsite').value.trim();
  if (website) {
    window.open(website.startsWith('http') ? website : 'https://' + website, '_blank');
  }
}

function loadAccommodation() {}

function renderPresets() {
  // Render to both the sidebar and the Places tab
  var containers = [el('presetsWithAccom'), el('presetsWithAccomTab')];
  
  containers.forEach(function(container) {
    if (!container) return;
    container.innerHTML = '';
    
    presets.forEach(function (p, idx) {
    // Container for place + accommodation
    var placeContainer = document.createElement('div');
    placeContainer.style.cssText = 'margin-bottom:0.5rem; border:1px solid #e8e8e8; border-radius:8px; padding:0.5rem; background:#fafafa;';
    
    // Place row with number
    var placeRow = document.createElement('div');
    placeRow.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;';
    
    var numBadge = document.createElement('div');
    numBadge.style.cssText = 'background:#0066cc; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0;';
    numBadge.textContent = (idx + 1);
    
    var nameBtn = document.createElement('button');
    nameBtn.className = 'btn';
    nameBtn.style.cssText = 'flex:1; justify-content:flex-start; font-size:12px; font-weight:600; padding:0.4rem 0.6rem;';
    nameBtn.textContent = p.name ? p.name : 'Empty slot ' + (idx + 1);
    nameBtn.addEventListener('click', function () { if (p.name && p.lat && p.lng) goToPlace(p); });
    
    var flagSpan = document.createElement('span');
    flagSpan.style.cssText = 'margin-right:0.3rem; font-size:14px;';
    if (p.lat && p.lng && p.name) {
      flagSpan.textContent = '🌍';
      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + p.lat + '&lon=' + p.lng + '&format=json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var country = data.address && data.address.country_code ? data.address.country_code.toUpperCase() : '';
          flagSpan.textContent = country ? codeToFlag(country) : '🌍';
        })
        .catch(function () {});
    }
    nameBtn.insertBefore(flagSpan, nameBtn.firstChild);
    
    placeRow.appendChild(numBadge);
    placeRow.appendChild(nameBtn);
    placeContainer.appendChild(placeRow);
    
    // Accommodation row
    var accom = accommodations[p.id] || {};
    var accomRow = document.createElement('div');
    accomRow.style.cssText = 'display:flex; align-items:center; gap:0.4rem; margin-left:36px;';
    
    if (!accom.name) {
      var addBtn = document.createElement('button');
      addBtn.className = 'btn blue';
      addBtn.style.cssText = 'flex:1; font-size:11px; padding:0.4rem;';
      addBtn.innerHTML = '<i class="fas fa-plus"></i> Add accommodation';
      addBtn.onclick = function () { addAccommodation(p.id); };
      accomRow.appendChild(addBtn);
    } else {
      var accomInfo = document.createElement('div');
      accomInfo.style.cssText = 'flex:1; background:white; padding:0.5rem; border-radius:6px; border:1px solid #b3d4f5; cursor:pointer;';
      accomInfo.title = 'Click to edit';
      accomInfo.onclick = function () { editAccommodation(p.id); };
      
      var nameDiv = document.createElement('div');
      nameDiv.style.cssText = 'font-weight:600; font-size:12px; color:#0066cc; margin-bottom:0.3rem;';
      nameDiv.innerHTML = '🏨 ' + esc(accom.name);
      accomInfo.appendChild(nameDiv);
      
      if (accom.address) {
        var addressDiv = document.createElement('div');
        addressDiv.style.cssText = 'font-size:10px; color:#666; text-decoration:underline;';
        addressDiv.innerHTML = '📍 ' + esc(accom.address);
        addressDiv.onclick = function (e) { e.stopPropagation(); window.open('https://www.google.com/maps/search/' + encodeURIComponent(accom.address), '_blank'); };
        accomInfo.appendChild(addressDiv);
      }
      
      accomRow.appendChild(accomInfo);
      
      var editBtn = document.createElement('button');
      editBtn.className = 'btn blue';
      editBtn.style.cssText = 'font-size:11px; padding:0.4rem;';
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.onclick = function () { editAccommodation(p.id); };
      accomRow.appendChild(editBtn);
      
      var delBtn = document.createElement('button');
      delBtn.className = 'btn';
      delBtn.style.cssText = 'font-size:11px; padding:0.4rem;';
      delBtn.innerHTML = '<i class="fas fa-trash"></i>';
      delBtn.onclick = function () { deleteAccommodation(p.id); };
      accomRow.appendChild(delBtn);
    }
    
    placeContainer.appendChild(accomRow);
    container.appendChild(placeContainer);
    });
  });
}

function codeToFlag(code) {
  return code.split('').map(function (c) { return String.fromCodePoint(c.charCodeAt(0) + 127397); }).join('');
}

function togglePresetEdit() {}

function goToPlace(place) {
  currentLoc = { lat: place.lat, lng: place.lng, name: place.name };
  map.setView([place.lat, place.lng], 14);
  setTimeout(function () { map.invalidateSize(); }, 100);
  if (placeMarker) map.removeLayer(placeMarker);
  placeMarker = L.marker([place.lat, place.lng]).addTo(map).bindPopup('<b>' + esc(place.name) + '</b>').openPopup();
  fetchWeather(currentLoc);
  renderTransport(place);
}

function renderTransport(place) {
  var lat = place.lat, lng = place.lng;
  var btns = el('transportBtns');
  btns.innerHTML = '';
  [['fa-bus','Bus stops','bus stops'],['fa-train','Train stations','train station'],['fa-subway','Metro / tram','metro station'],['fa-ship','Ferry terminals','ferry terminal']]
    .forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'btn full';
      b.innerHTML = '<i class="fas ' + t[0] + '"></i> ' + t[1];
      b.addEventListener('click', function () {
        window.open('https://www.google.com/maps/search/' + encodeURIComponent(t[2]) + '/@' + lat + ',' + lng + ',15z', '_blank');
      });
      btns.appendChild(b);
    });
}

function searchKebabs() {
  // Use currentLoc (which is updated when you navigate) instead of map.getCenter()
  if (!currentLoc || !currentLoc.lat || !currentLoc.lng) {
    alert('Map not ready yet. Try again in a moment.');
    return;
  }
  var lat = currentLoc.lat;
  var lng = currentLoc.lng;
  var url = 'https://www.google.com/maps/search/kebab/@' + lat + ',' + lng + ',15z';
  window.location.href = url;
}

function searchCoffee() {
  if (!currentLoc || !currentLoc.lat || !currentLoc.lng) {
    alert('Map not ready yet. Try again in a moment.');
    return;
  }
  var lat = currentLoc.lat;
  var lng = currentLoc.lng;
  var url = 'https://www.google.com/maps/search/coffee/@' + lat + ',' + lng + ',15z';
  window.location.href = url;
}

function searchMcDonalds() {
  if (!currentLoc || !currentLoc.lat || !currentLoc.lng) {
    alert('Map not ready yet. Try again in a moment.');
    return;
  }
  var lat = currentLoc.lat;
  var lng = currentLoc.lng;
  var url = 'https://www.google.com/maps/search/mcdonalds/@' + lat + ',' + lng + ',15z';
  window.location.href = url;
}

function useGPS() {
  if (!navigator.geolocation) { alert('GPS not available'); return; }
  var btn = el('gpsBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding you…';
  btn.disabled = true;
  showStatus('Getting your GPS location…', false);
  navigator.geolocation.getCurrentPosition(function (pos) {
    var lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy;
    map.setView([lat, lng], 16);
    if (gpsMarker) map.removeLayer(gpsMarker);
    if (gpsCircle) map.removeLayer(gpsCircle);
    gpsCircle = L.circle([lat, lng], { radius: acc, color: '#0066cc', fillColor: '#0066cc', fillOpacity: 0.1, weight: 1 }).addTo(map);
    gpsMarker = L.circleMarker([lat, lng], { color: 'white', fillColor: '#0066cc', fillOpacity: 1, radius: 9, weight: 3 }).addTo(map).bindPopup('<b>You are here</b><br>±' + Math.round(acc) + ' m').openPopup();
    currentLoc = { lat: lat, lng: lng, name: 'My location' };
    if (routeMode && !routeStart) {
      routeStart = L.latLng(lat, lng);
      showStatus('Your location set as start. Now tap the map to set END.', false);
    } else {
      showStatus('Found you (±' + Math.round(acc) + ' m)', true);
    }
    fetchWeather(currentLoc);
    renderTransport({ lat: lat, lng: lng, name: 'My location' });
    btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> My location';
    btn.disabled = false;
  }, function () {
    showStatus('⚠ Could not get location', false);
    btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> My location';
    btn.disabled = false;
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

function toggleRoute() {
  routeMode = !routeMode;
  var btn = el('routeBtn');
  if (routeMode) {
    btn.classList.add('orange');
    btn.innerHTML = '<i class="fas fa-times"></i> Cancel route';
    routeStart = null; routeEnd = null;
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    el('transitPanel').classList.remove('show');
    showStatus('Tap the map to set START point', false);
  } else {
    btn.classList.remove('orange');
    btn.innerHTML = '<i class="fas fa-route"></i> Plan route';
    hideStatus();
  }
}

function onMapClick(e) {
  if (routeMode) {
    if (!routeStart) {
      routeStart = e.latlng;
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.circleMarker([e.latlng.lat, e.latlng.lng], { color: '#0066cc', radius: 9, weight: 3, fillOpacity: 0.8 }).addTo(map).bindPopup('Start').openPopup();
      showStatus('Now tap the map to set END point', false);
    } else if (!routeEnd) {
      routeEnd = e.latlng;
      if (endMarker) map.removeLayer(endMarker);
      endMarker = L.circleMarker([e.latlng.lat, e.latlng.lng], { color: '#cc2200', radius: 9, weight: 3, fillOpacity: 0.8 }).addTo(map).bindPopup('End').openPopup();
      if (routingControl) map.removeControl(routingControl);
      routingControl = L.Routing.control({
        waypoints: [routeStart, routeEnd],
        routeWhileDragging: false, show: false, addWaypoints: false,
        lineOptions: { styles: [{ color: '#0066cc', opacity: 0.75, weight: 5 }] }
      }).addTo(map);
      showStatus('✓ Route plotted — tap a button below for live directions', true);
      el('transitPanel').classList.add('show');
      routeMode = false;
      el('routeBtn').classList.remove('orange');
      el('routeBtn').innerHTML = '<i class="fas fa-route"></i> Plan route';
    }
  } else {
    var name = prompt('Save this location as:', 'Saved place');
    if (name === null) return;
    var slotNum = prompt('Save to which preset slot? (1-6)', '1');
    if (slotNum === null) return;
    slotNum = parseInt(slotNum);
    if (slotNum < 1 || slotNum > 6) { alert('Enter a number between 1 and 6'); return; }
    
    presets[slotNum - 1] = {
      id: slotNum,
      name: name,
      lat: e.latlng.lat,
      lng: e.latlng.lng
    };
    
    localStorage.setItem('hta_presets', JSON.stringify(presets));
    renderPresets();
    alert('Saved ' + name + ' to preset ' + slotNum);
  }
}

function gmaps(mode) {
  if (!routeStart || !routeEnd) { alert('Plan a route on the map first'); return; }
  window.open('https://www.google.com/maps/dir/?api=1&origin=' + routeStart.lat + ',' + routeStart.lng + '&destination=' + routeEnd.lat + ',' + routeEnd.lng + '&travelmode=' + mode, '_blank');
}

function clearAll() {
  if (routingControl) { map.removeControl(routingControl); routingControl = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
  if (placeMarker) { map.removeLayer(placeMarker); placeMarker = null; }
  routeStart = null; routeEnd = null; routeMode = false;
  el('routeBtn').classList.remove('orange');
  el('routeBtn').innerHTML = '<i class="fas fa-route"></i> Plan route';
  el('transitPanel').classList.remove('show');
  hideStatus();
}

function showStatus(msg, ok) {
  var s = el('mapStatus');
  s.textContent = msg;
  s.classList.add('show');
  if (ok) s.classList.add('ok'); else s.classList.remove('ok');
}
function hideStatus() { el('mapStatus').classList.remove('show', 'ok'); }

function openGoogleDrive() {
  window.open(GOOGLE_DRIVE_FOLDER_URL, '_blank');
}

function handleFiles(files) {
  Array.from(files).forEach(function (file) {
    var isPDF = file.type === 'application/pdf';
    var isImage = file.type.startsWith('image/');
    if (!isPDF && !isImage) { alert(file.name + ' is not a PDF or image'); return; }
    if (file.size > 4 * 1024 * 1024) { alert(file.name + ' is over 4 MB'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataURL = e.target.result;
      var id = Date.now() + Math.floor(Math.random() * 1000);
      var dataKey = 'hta_doc_data_' + id;
      try {
        localStorage.setItem(dataKey, dataURL);
      } catch (err) {
        alert('Not enough storage space.');
        return;
      }
      var meta = { id: id, name: file.name, type: file.type, size: file.size, dataKey: dataKey };
      docs.push(meta);
      localStorage.setItem('hta_docs_meta', JSON.stringify(docs));
      renderDocList();
    };
    reader.readAsDataURL(file);
  });
}

function deleteDoc(idx) {
  var doc = docs[idx];
  localStorage.removeItem(doc.dataKey);
  docs.splice(idx, 1);
  localStorage.setItem('hta_docs_meta', JSON.stringify(docs));
  renderDocList();
}

function renderDocList() {
  var list = el('docList');
  if (!docs.length) { list.innerHTML = '<div class="empty-msg">No documents yet</div>'; return; }
  list.innerHTML = '';
  docs.forEach(function (doc, idx) {
    var row = document.createElement('div');
    row.className = 'doc-item';
    var icon = doc.type === 'application/pdf' ? '📄' : '🖼️';
    var sizeStr = doc.size > 1024 * 1024 ? (doc.size / 1024 / 1024).toFixed(1) + ' MB' : Math.round(doc.size / 1024) + ' KB';
    row.innerHTML = '<span class="doc-icon">' + icon + '</span><span class="doc-name" title="' + esc(doc.name) + '">' + esc(doc.name) + '</span><span class="doc-size">' + sizeStr + '</span>';
    var del = document.createElement('button');
    del.className = 'doc-del';
    del.textContent = '✕';
    del.addEventListener('click', function (e) { e.stopPropagation(); deleteDoc(idx); });
    row.appendChild(del);
    list.appendChild(row);
  });
}

function saveEmergencyContacts() {
  emergencyContacts = {
    parent: el('contactParent').value,
    country: el('contactCountry').value,
    insurance: el('contactInsurance').value
  };
  localStorage.setItem('hta_emergency', JSON.stringify(emergencyContacts));
  renderEmergencyContactsList();
  alert('Emergency contacts saved!');
}

function updateEmergencyNumbers() {
  var c = el('contactCountry').value;
  // Just for display reference
}

function renderEmergencyContactsList() {
  var list = el('emergencyContactsList');
  if (!emergencyContacts.parent && !emergencyContacts.country && !emergencyContacts.insurance) {
    list.innerHTML = '<div class="empty-msg">No emergency contacts saved yet</div>';
    return;
  }
  list.innerHTML = '';
  if (emergencyContacts.parent) {
    var item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = '<div><div class="contact-name">Your parent/guardian</div><div class="contact-number">' + esc(emergencyContacts.parent) + '</div></div>';
    list.appendChild(item);
  }
  if (emergencyContacts.country) {
    var nums = {UK:'999',EU:'112',US:'911',AU:'000'};
    var item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = '<div><div class="contact-name">Emergency — ' + emergencyContacts.country + '</div><div class="contact-number">' + nums[emergencyContacts.country] + '</div></div>';
    list.appendChild(item);
  }
  if (emergencyContacts.insurance) {
    var item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = '<div><div class="contact-name">Insurance helpline</div><div class="contact-number">' + esc(emergencyContacts.insurance) + '</div></div>';
    list.appendChild(item);
  }
}

function fetchExchangeRates() {
  // Skip if offline
  if (!isOnline) {
    // Use cached rates if available
    if (!Object.keys(exchangeRates).length) {
      exchangeRates = {GBP:1,EUR:1.17,USD:1.27,JPY:190,AUD:1.95,CAD:1.72,CHF:1.13,SGD:1.71,HKD:9.88};
    }
    convertCurrency();
    return;
  }
  
  fetch('https://api.exchangerate-api.com/v4/latest/GBP')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      exchangeRates = data.rates || {};
      localStorage.setItem('hta_rates', JSON.stringify(exchangeRates));
      convertCurrency();
    })
    .catch(function () {
      if (!Object.keys(exchangeRates).length) {
        exchangeRates = {GBP:1,EUR:1.17,USD:1.27,JPY:190,AUD:1.95,CAD:1.72,CHF:1.13,SGD:1.71,HKD:9.88};
        localStorage.setItem('hta_rates', JSON.stringify(exchangeRates));
      }
      convertCurrency();
    });
}

function convertCurrency() {
  var amount = parseFloat(el('currencyAmount').value) || 0;
  var from = el('currencyFrom').value;
  var to = el('currencyTo').value;
  if (!amount || !from || !to) {
    el('conversionValue').textContent = '0.00';
    el('conversionLabel').textContent = 'Select currencies';
    return;
  }
  var rates = exchangeRates;
  if (!rates[from] || !rates[to]) {
    el('conversionValue').textContent = '—';
    el('conversionLabel').textContent = 'Rates not available';
    return;
  }
  var inGBP = amount / (rates[from] || 1);
  var result = inGBP * (rates[to] || 1);
  el('conversionValue').textContent = result.toFixed(2);
  el('conversionLabel').textContent = amount + ' ' + from + ' = ' + result.toFixed(2) + ' ' + to;
}
