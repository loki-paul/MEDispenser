// ------------------- Global Variables -------------------
export let currentContainer = null;
export let editingScheduleId = null;
export let currentSettingsContainer = null;
export let schedulesData = [];
export let settingsData = {};
export const containerColors = {1:"#007bff",2:"#dc3545",3:"#ffc107",4:"#28a745"};

// ------------------- Schedule Dialog Helper Functions -------------------
export function toggleDay(btn) { btn.classList.toggle('active'); }

export function toggleEveryday() {
  const btn = document.getElementById('everydayBtn');
  btn.classList.toggle('active');
  if(btn.classList.contains('active')) document.querySelectorAll('.days-grid button').forEach(b => b.classList.remove('active'));
}

export function updateTimeFields() {
  const pillCount = parseInt(document.getElementById('pillCount').value) || 1;
  const container = document.getElementById('timeInputs');
  container.innerHTML = "";
  for(let i=1;i<=pillCount;i++){
    const div = document.createElement('div');
    div.innerHTML = `<label>Time #${i}:</label><input type="time" value="08:00">`;
    container.appendChild(div);
  }
}

export function incrementPillCount() { 
  const i = parseInt(document.getElementById('pillCount').value) || 1;
  document.getElementById('pillCount').value = i + 1;
  updateTimeFields();
}

export function decrementPillCount() {
  const i = parseInt(document.getElementById('pillCount').value) || 1;
  document.getElementById('pillCount').value = Math.max(i - 1, 1);
  updateTimeFields();
}

export function resetDialog() {
  document.getElementById('everydayBtn').classList.remove('active');
  document.querySelectorAll('.days-grid button').forEach(btn => btn.classList.remove('active'));
  document.getElementById('pillCount').value = 1;
  updateTimeFields();
}

function redirectTo(path) {
    // Get current URL parts
    const origin = window.location.origin;         // e.g. http://localhost:5500
    const pathname = window.location.pathname;     // e.g. /repo-name/index.html or /index.html
    
    // Detect base (for GitHub Pages with repo name)
    const segments = pathname.split("/").filter(Boolean);
    const base = (segments.length > 0 && segments[0] !== "pages") ? "/" + segments[0] : "";
    
    // Build final URL
    const redirectUrl = origin + base + path;
    
    window.location.href = redirectUrl;
}
