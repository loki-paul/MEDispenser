// ESP32
import { sendSchedulesToESP32 } from "./esp32_sender.js";




// ------------------- Firebase Initialization -------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
auth.useDeviceLanguage();

// ------------------- Global Variables -------------------
let currentContainer = null;
let editingScheduleId = null;
let currentSettingsContainer = null;
let schedulesData = [];
let settingsData = {};
const containerColors = { 1: "#007bff", 2: "#dc3545", 3: "#ffc107", 4: "#28a745" };

// ------------------- Real-time Listeners -------------------
function setupRealtimeListeners() {
  onAuthStateChanged(auth, user => {
    if (!user) return;

    const uid = user.uid;

    // Load Schedules
    const schedulesRef = ref(db, `users/${uid}/schedules`);
    onValue(schedulesRef, snapshot => {
      const data = snapshot.val();
      schedulesData = data ? Object.values(data) : [];
      renderAllSchedules();
    });

    // Load Settings
    const settingsRef = ref(db, `users/${uid}/settings`);
    onValue(settingsRef, snapshot => {
      settingsData = snapshot.val() || {};
      if (settingsData.theme === "dark") document.body.classList.add("dark-mode");
      else document.body.classList.remove("dark-mode");
      const darkBtn = document.getElementById('toggleDarkButton');
      if (darkBtn) darkBtn.textContent = document.body.classList.contains("dark-mode") ? "Light Mode" : "Dark Mode";
    });

    // Show email
    const userEmailSpan = document.getElementById("userEmail");
    if (userEmailSpan) userEmailSpan.textContent = user.email;

    // Ensure user exists
    createUserInDB(user);
  });
}

// ------------------- RTC Clock -------------------
function updateClock() {
  const offsetRef = ref(db, ".info/serverTimeOffset");
  onValue(offsetRef, snapshot => {
    const offset = snapshot.val() || 0;
    const now = new Date(Date.now() + offset);
    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  });
}

// ------------------- Firebase Save Functions -------------------
async function saveSchedulesToServer() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const updates = {};
  schedulesData.forEach(s => updates[s.id] = s);
  await set(ref(db, `users/${uid}/schedules`), updates);
}

async function saveSettingsToServer() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  await set(ref(db, `users/${uid}/settings`), settingsData);
}

// ------------------- Helper Functions -------------------
function createUserInDB(user) {
  set(ref(db, 'users/' + user.uid + '/info'), {
    name: user.displayName || "",
    email: user.email,
    createdAt: new Date().toISOString()
  });
}

// ------------------- Schedule Dialog -------------------
function openScheduleDialog(containerId, scheduleId = null) {
  currentContainer = containerId;
  editingScheduleId = scheduleId;
  resetDialog();

  const color = containerColors[containerId] || "#007bff";
  const dialog = document.getElementById('scheduleDialog');
  dialog.querySelector('.header').style.background = color;
  dialog.querySelector('.header h2').style.color = "#fff";
  dialog.style.setProperty('--accent-color', color);

  if (editingScheduleId !== null) {
    const s = schedulesData.find(x => x.id === editingScheduleId);
    if (s) {
      document.getElementById('dialogTitle').textContent = "Edit Schedule";

      const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const everydayBtn = document.getElementById('everydayBtn');
      if (allDays.every(day => s.days.includes(day))) everydayBtn.classList.add('active');

      document.querySelectorAll('.days-grid button').forEach(btn => {
        if (s.days.includes(btn.getAttribute('data-day'))) btn.classList.add('active');
      });

      document.getElementById('pillCount').value = s.pillCount;
      updateTimeFields();
      document.querySelectorAll('.time-inputs input[type="time"]').forEach((input, idx) => {
        if (s.times[idx]) input.value = s.times[idx];
      });
    }
  } else {
    document.getElementById('dialogTitle').textContent = "Add Schedule";
  }

  document.getElementById('overlay').style.display = 'block';
  dialog.style.display = 'block';
}

function closeScheduleDialog() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('scheduleDialog').style.display = 'none';
}

function resetDialog() {
  document.getElementById('everydayBtn').classList.remove('active');
  document.querySelectorAll('.days-grid button').forEach(btn => btn.classList.remove('active'));
  document.getElementById('pillCount').value = 1;
  updateTimeFields();
}

function toggleDay(btn) { btn.classList.toggle('active'); }

function toggleEveryday() {
  const btn = document.getElementById('everydayBtn');
  btn.classList.toggle('active');
  if (btn.classList.contains('active'))
    document.querySelectorAll('.days-grid button').forEach(b => b.classList.remove('active'));
}

function updateTimeFields() {
  const pillCount = parseInt(document.getElementById('pillCount').value) || 1;
  const container = document.getElementById('timeInputs');
  container.innerHTML = "";
  for (let i = 1; i <= pillCount; i++) {
    const div = document.createElement('div');
    div.innerHTML = `<label>Time #${i}:</label><input type="time" value="08:00">`;
    container.appendChild(div);
  }
}

function incrementPillCount() {
  const i = parseInt(document.getElementById('pillCount').value) || 1;
  document.getElementById('pillCount').value = i + 1;
  updateTimeFields();
}

function decrementPillCount() {
  const i = parseInt(document.getElementById('pillCount').value) || 1;
  document.getElementById('pillCount').value = Math.max(i - 1, 1);
  updateTimeFields();
}

// ------------------- Save Schedule -------------------
async function saveSchedule() {
  // Handle schedule days
  let days = [];
  const everydayBtn = document.getElementById('everydayBtn');
  if (everydayBtn.classList.contains('active')) {
    days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  } else {
    document.querySelectorAll('.days-grid button.active').forEach(btn => 
      days.push(btn.getAttribute('data-day'))
    );
  }

  if (days.length === 0) {
    showWarningModal();
    return;
  }

  const pillCount = parseInt(document.getElementById('pillCount').value) || 1;
  const times = [];
  document.querySelectorAll('.time-inputs input[type="time"]').forEach(input => {
    if (input.value) times.push(formatTime12h(input.value));
  });

  if (editingScheduleId === null) {
    schedulesData.push({
      id: Date.now(),
      container: currentContainer,
      days,
      pillCount,
      times
    });
  } else {
    schedulesData = schedulesData.map(s =>
      s.id === editingScheduleId
        ? { ...s, container: currentContainer, days, pillCount, times }
        : s
    );
  }

  await saveSchedulesToServer();
  closeScheduleDialog();
  sendSchedulesToESP32(schedulesData);
}

async function deleteSchedule(id) {
  schedulesData = schedulesData.filter(s => s.id !== id);
  await saveSchedulesToServer();
}

// ------------------- Render Schedules -------------------
function renderAllSchedules() {
  for (let c = 1; c <= 4; c++) {
    const tableBody = document.querySelector(`#container${c}-table tbody`);
    if (tableBody) tableBody.innerHTML = "";
  }

  if (!Array.isArray(schedulesData)) return;

  schedulesData.forEach(sch => {
    const container = sch.container || 1;
    const days = Array.isArray(sch.days) ? sch.days : [];
    const pillCount = sch.pillCount || 1;
    const times = Array.isArray(sch.times) ? sch.times : [];
    const tableBody = document.querySelector(`#container${container}-table tbody`);
    if (!tableBody) return;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${days.join(', ')}</td>
      <td>${pillCount}</td>
      <td>${times.join(', ')}</td>
      <td style="position:relative;"><span class="gear-icon">⚙</span></td>
    `;

    const gearIcon = row.querySelector(".gear-icon");
    gearIcon.onclick = (e) => {
      e.stopPropagation();
      toggleMenu(sch.id, e);
    };

    const menuDiv = document.createElement('div');
    menuDiv.className = 'gear-menu';
    menuDiv.id = `menu-${sch.id}`;

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => {
      openScheduleDialog(container, sch.id);
      toggleMenu(sch.id);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      deleteSchedule(sch.id);
      toggleMenu(sch.id);
    };

    menuDiv.appendChild(editBtn);
    menuDiv.appendChild(deleteBtn);
    document.body.appendChild(menuDiv);
    tableBody.appendChild(row);
  });
}

function formatTime12h(time24) {
  if (!time24) return '';
  const [hourStr, min] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${min} ${ampm}`;
}


// ------------------- Gear Menu -------------------
function toggleMenu(scheduleId, event) {
  const menu = document.getElementById(`menu-${scheduleId}`);
  if (!menu) return;
  closeAllMenus(scheduleId);
  if (menu.style.display === 'block') menu.style.display = 'none';
  else {
    menu.style.display = 'block';
    if (event) {
      const gearRect = event.target.getBoundingClientRect();
      menu.style.left = `${gearRect.left + window.scrollX - 15}px`;
      menu.style.top = `${gearRect.bottom + window.scrollY}px`;
    }
  }
}
function closeAllMenus(exceptId = null) {
  document.querySelectorAll('.gear-menu').forEach(m => {
    if (m.id !== `menu-${exceptId}`) m.style.display = 'none';
  });
}
function closeAllMenusOnOutsideClick(e) {
  if (e.target.closest('.gear-menu') || e.target.closest('.gear-icon')) return;
  closeAllMenus();
}

// ------------------- Settings Dialog -------------------
function openSettingsDialog(containerId) {
  currentSettingsContainer = containerId;
  let saved = settingsData[containerId] || {};

  const triggerThresholdSlider = document.getElementById('triggerThreshold');

  triggerThresholdSlider.value = saved.triggerThreshold !== undefined ? saved.triggerThreshold : 1500;
  document.getElementById('triggerThresholdValue').textContent = triggerThresholdSlider.value;

  const color = containerColors[containerId] || "#007bff";
  const dialog = document.getElementById('settingsDialog');

  dialog.style.borderTopColor = color;
  dialog.querySelector('h2').style.color = color;
  document.getElementById('settingsDialogTitle').textContent = `Container ${containerId} Settings`;

 
  document.getElementById('CancelSettingsBtn').style.backgroundColor = color;
  document.getElementById('saveSettingsBtn').style.backgroundColor = color;

  triggerThresholdSlider.style.accentColor = color;

  document.getElementById('overlay').style.display = 'block';
  dialog.style.display = 'block';

  closeAllMenus();
}

function closeSettingsDialog() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('settingsDialog').style.display = 'none';
}

async function saveSettings() {
  const triggerThreshold = parseInt(document.getElementById('triggerThreshold').value);

  settingsData[currentSettingsContainer] = { triggerThreshold };
  await saveSettingsToServer();
  closeSettingsDialog();
}

function testSchedule() {
  fetch('/testSchedule')
    .then(res => res.text())
    .then(data => alert("Test Schedule initiated: " + data))
    .catch(() => alert("Error initiating test schedule"));
}


// ------------------- UI Functions -------------------
function toggleSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  const header = document.querySelector('.collapsible-header');

  if (panel.style.display === "flex") {
    panel.style.display = "none";
    header.textContent = "Settings ▾";
  } else {
    panel.style.display = "flex";
    header.textContent = "Settings ▴";
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  settingsData.theme = isDark ? "dark" : "light";

  const darkBtn = document.getElementById('toggleDarkButton');
  if (darkBtn) darkBtn.textContent = isDark ? "Light Mode" : "Dark Mode";

  saveSettingsToServer();
}

// ------------------- Expose to HTML -------------------
window.openScheduleDialog = openScheduleDialog;
window.openSettingsDialog = openSettingsDialog;
window.toggleSettingsPanel = toggleSettingsPanel;
window.toggleDarkMode = toggleDarkMode;
window.saveSchedule = saveSchedule;
window.deleteSchedule = deleteSchedule;
window.closeScheduleDialog = closeScheduleDialog;
window.resetDialog = resetDialog;
window.toggleDay = toggleDay;
window.toggleEveryday = toggleEveryday;
window.incrementPillCount = incrementPillCount;
window.decrementPillCount = decrementPillCount;
window.saveSettings = saveSettings;
window.closeSettingsDialog = closeSettingsDialog;
window.testSchedule = testSchedule;

// ------------------- Page Initialization -------------------
window.onload = function () {
  setupRealtimeListeners();
  document.addEventListener('click', closeAllMenusOnOutsideClick);

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`container${i}-block`).style.borderTopColor = containerColors[i];
    document.querySelector(`#container${i}-block .container-header`).style.backgroundColor = containerColors[i];
  }


  updateTimeFields();
  updateClock();
  setInterval(updateClock, 1000);
};

// ------------------- Sidebar -------------------
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById('sidebar');
  const burgerBtn = document.getElementById('burgerBtn');

  window.toggleSidebar = function () {
    if (!sidebar || !burgerBtn) return;

    if (sidebar.style.left === "0px") {
      sidebar.style.left = "-250px";
      burgerBtn.style.display = "block";
    } else {
      sidebar.style.left = "0px";
      burgerBtn.style.display = "none";
    }
  };

  document.addEventListener('click', (event) => {
    if (!sidebar || !burgerBtn) return;

    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickBurger = burgerBtn.contains(event.target);

    if (!isClickInsideSidebar && !isClickBurger && sidebar.style.left === "0px") {
      sidebar.style.left = "-250px";
      burgerBtn.style.display = "block";
    }
  });

  window.editProfile = function () {
    alert("Edit profile feature coming soon!");
  };

  window.openAccountSettings = function () {
    alert("Open account settings panel");
  };

  window.openAppSettings = function () {
    const collapsible = document.querySelector('.collapsible-header');
    if (collapsible) collapsible.click();
  };

  window.openContainerSettings = function () {
    alert("Open container settings dialog");
  };
});

// ------------------- Logout Modal -------------------
const logoutModal = document.getElementById('logoutModal');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
const logoutSidebarBtn = document.getElementById('logoutSidebarBtn');

// Open modal
logoutSidebarBtn.addEventListener('click', () => {
  logoutModal.style.display = 'flex';
  toggleSidebar();
});

// Cancel
cancelLogoutBtn.addEventListener('click', () => {
  logoutModal.style.display = 'none';
});

// ------------------- FIXED LOGOUT CODE (MODULAR) -------------------
confirmLogoutBtn.addEventListener('click', () => {
  logoutModal.style.display = 'none';

  signOut(auth)
    .then(() => {
      alert("Logged out successfully!");
     window.location.href = "../../index.html";
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
});

// Click outside modal
window.addEventListener('click', (e) => {
  if (e.target === logoutModal) {
    logoutModal.style.display = 'none';
  }
});

// ------------------- Display User Name -------------------
function displayUserName() {
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;
  const nameRef = ref(db, `users/${uid}/profile/name`);

  onValue(nameRef, snapshot => {
    const name = snapshot.val() || "User Name";
    const nameEl = document.getElementById("userName");
    if (nameEl) nameEl.textContent = name;
  });
}

onAuthStateChanged(auth, user => {
  if (user) displayUserName();
});


// ------------------- Load User Data (Unified for Firebase Auth or Custom Login) -------------------
function loadUserData() {
  let uid = null;
  let email = null;

  // Priority 1: Firebase Auth
  if (auth.currentUser) {
    uid = auth.currentUser.uid;
    email = auth.currentUser.email;
  }
  // Priority 2: Custom login (stored in sessionStorage)
  else {
    uid = sessionStorage.getItem("uid");
    email = sessionStorage.getItem("email");
  }

  if (!uid) return; // No user logged in

  // ---------------- Load User Info ----------------
  const userEmailSpan = document.getElementById("userEmail");
  if (userEmailSpan) userEmailSpan.textContent = email || "User Email";

  // Load profile name
  const nameRef = ref(db, `users/${uid}/profile/name`);
  onValue(nameRef, snapshot => {
    const name = snapshot.val() || "User Name";
    const nameEl = document.getElementById("userName");
    if (nameEl) nameEl.textContent = name;
  });

  // Load schedules
  const schedulesRef = ref(db, `users/${uid}/schedules`);
  onValue(schedulesRef, snapshot => {
    const data = snapshot.val();
    schedulesData = data ? Object.values(data) : [];
    renderAllSchedules();
  });

  // Load settings
  const settingsRef = ref(db, `users/${uid}/settings`);
  onValue(settingsRef, snapshot => {
    settingsData = snapshot.val() || {};
    if (settingsData.theme === "dark") document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");

    const darkBtn = document.getElementById('toggleDarkButton');
    if (darkBtn) darkBtn.textContent = document.body.classList.contains("dark-mode") ? "Light Mode" : "Dark Mode";
  });

  // Ensure user exists in DB
  createUserInDB({ uid, email });
}

// ------------------- Page Initialization -------------------
window.onload = function () {
  loadUserData(); // Unified function for both login types

  document.addEventListener('click', closeAllMenusOnOutsideClick);

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`container${i}-block`).style.borderTopColor = containerColors[i];
    document.querySelector(`#container${i}-block .container-header`).style.backgroundColor = containerColors[i];
  }

  updateTimeFields();
  updateClock();
  setInterval(updateClock, 1000);
};

function saveMedName(containerNumber) {
  const medInput = document.getElementById(`medName${containerNumber}`);
  const medName = medInput.value.trim();
  if (!medName) return alert("Enter medicine name!");

  // Save to database based on container number
  // Example path: users/{uid}/containers/container1/medName
  const uid = sessionStorage.getItem("uid"); // current user
  const containerKey = `container${containerNumber}`;

  set(ref(db, `users/${uid}/containers/${containerKey}/medName`), medName)
    .then(() => {
      alert("Medicine name saved!");
    })
    .catch((err) => {
      console.error(err);
      alert("Failed to save: " + err.message);
    });
}

// ---------------- Notifications ----------------
let alarmAudio = null;
const medicinesCache = []; // keep track of medicines (fill from your schedule DB)
let pendingNotifications = [];

function showUINotification(medName, medTime, bgColor = '#ffcc00') {
  pendingNotifications.push({ medName, medTime, bgColor });

  const notifDiv = document.getElementById('uiNotif');
  const notifContent = document.getElementById('notifContent');

  // Update modal background color
  notifDiv.style.backgroundColor = bgColor;

  // Build list of notifications
  let listHTML = '';
  pendingNotifications.forEach(item => {
    listHTML += `<p><strong>${item.medName}</strong> — ${item.medTime}</p>`;
  });
  notifContent.innerHTML = listHTML;

  // Show modal
  notifDiv.style.display = 'block';

  // Play alarm once
  if (!alarmAudio) {
    alarmAudio = new Audio('assets/sound/notifsound.mp3');
    alarmAudio.loop = true;
    alarmAudio.play().catch(err => console.warn("Audio failed to play:", err));
  }

  // Stop button
  document.getElementById('stopNotifBtn').onclick = () => {
    // Stop sound
    if (alarmAudio) {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
      alarmAudio = null;
    }

    // Hide modal
    notifDiv.style.display = 'none';

    // Clear notifications for next round
    pendingNotifications = [];
  };
}


// ------------------- Automatic Schedule Checker -------------------
const scheduleCheckInterval = 1000; // check every 1 second
const notifiedPills = {}; // keep track of pills already notified

function startScheduleChecker() {
  setInterval(() => {
    if (!Array.isArray(schedulesData) || schedulesData.length === 0) return;

    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = formatTime12h(now.toTimeString().substring(0, 5)); // HH:MM format

    schedulesData.forEach(schedule => {

      // --- SAFETY REPAIR (prevents includes undefined error) ---
      const days = Array.isArray(schedule.days) ? schedule.days : [];
      const times = Array.isArray(schedule.times) ? schedule.times : [];

      // Skip if schedule doesn’t match today
      if (!days.includes(dayName)) return;

      // Loop through times safely
      times.forEach((time, index) => {
        const pillId = `${schedule.id}-${index}`;

        if (currentTime === time && !notifiedPills[pillId]) {

          notifiedPills[pillId] = true;

          const medName = schedule.medName || `Container ${schedule.container}`;
          showUINotification(medName, time, '#ffcc00', pillId);

          // Reset after 1 minute
          setTimeout(() => { delete notifiedPills[pillId]; }, 60000);
        }
      });

    });
  }, scheduleCheckInterval);
}


// ------------------- Start automatic checker -------------------
window.onload = function () {
  // your existing onload code
  loadUserData(); // Unified function for both login types

  document.addEventListener('click', closeAllMenusOnOutsideClick);

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`container${i}-block`).style.borderTopColor = containerColors[i];
    document.querySelector(`#container${i}-block .container-header`).style.backgroundColor = containerColors[i];
  }

  updateTimeFields();
  updateClock();
  setInterval(updateClock, 1000);

  startScheduleChecker(); // <<< start automatic notifications
};

function showWarningModal() {
  const modal = document.getElementById("warningModal");
  if (modal) modal.style.display = "flex";
}

window.closeWarningModal = function () {
  const modal = document.getElementById("warningModal");
  if (modal) modal.style.display = "none";
};

if (auth.currentUser) {
    const uid = auth.currentUser.uid;
    const schedulesRef = ref(db, `users/${uid}/schedules`);

    onValue(schedulesRef, snapshot => {
        const data = snapshot.val();
        const schedules = data ? Object.values(data) : [];

        // Update your local schedule array
        schedulesData = schedules;

        // Render schedules in the UI
        renderAllSchedules();

        // Send schedules to ESP32
        sendSchedulesToESP32(schedules);
    });
}


