import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

// ------------------- Firebase Initialization -------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage();
const db = getDatabase(app);

// ------------------- Redirect Function -------------------
function goHome() {
  window.location.href = "https://loki-paul.github.io/MEDispenser/assets/pages/home.html";
}

// ------------------- Google Login -------------------
document.getElementById("google-btn")?.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    sessionStorage.setItem("uid", user.uid);
    sessionStorage.setItem("email", user.email);

    await ensureUserProfile(user);
  } catch (err) {
    console.error(err);
    alert("Google login failed.");
  }
});

// ------------------- Email/Password Login -------------------
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInputLogin").value.trim();
  if (!email || !password) return alert("Enter email & password!");

  try {
    const usersSnap = await get(ref(db, "users/"));
    let foundUser = null;

    usersSnap.forEach((snap) => {
      const val = snap.val();
      if (val.info?.email === email) {
        foundUser = { uid: snap.key, ...val };
      }
    });

    if (!foundUser) return alert("User not found!");

    const profileSnap = await get(ref(db, `users/${foundUser.uid}/profile`));
    if (!profileSnap.exists()) return alert("Profile incomplete!");

    if (btoa(password) !== profileSnap.val().password)
      return alert("Wrong password!");

    sessionStorage.setItem("uid", foundUser.uid);
    sessionStorage.setItem("email", foundUser.info.email);

    if (!profileSnap.val().name) {
      document.getElementById('basicInfoModal').style.display = 'flex';
      return;
    }

    alert("Login successful!");
    goHome();

  } catch (err) {
    console.error(err);
    alert("Login failed: " + err.message);
  }
});

// ------------------- Show/Hide Password -------------------
const pwdInput = document.getElementById('passwordInputLogin');
if (pwdInput) {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Show";
  toggle.style.marginTop = "5px";
  pwdInput.parentNode.insertBefore(toggle, pwdInput.nextSibling);

  toggle.addEventListener("click", () => {
    if (pwdInput.type === "password") {
      pwdInput.type = "text";
      toggle.textContent = "Hide";
    } else {
      pwdInput.type = "password";
      toggle.textContent = "Show";
    }
  });
}

// ------------------- Save Basic Info Modal -------------------
document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('nameInput').value.trim();
  const age = document.getElementById('ageInput').value.trim();
  const phone = document.getElementById('phoneInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();

  const userUid = sessionStorage.getItem("uid");
  if (!userUid) return alert("No user logged in!");
  if (!name || !age || !phone || !password) return alert("Fill all fields!");

  await set(ref(db, `users/${userUid}/profile`), {
    name,
    age,
    phone,
    password: btoa(password),
    createdAt: new Date().toISOString()
  });

  alert("Profile saved!");
  document.getElementById('basicInfoModal').style.display = 'none';
  goHome();
});

// ------------------- Helper: Ensure Google User Profile -------------------
async function ensureUserProfile(user) {
  const profileSnap = await get(ref(db, `users/${user.uid}/profile`));
  if (!profileSnap.exists() || !profileSnap.val().name) {
    document.getElementById('basicInfoModal').style.display = 'flex';
  } else {
    goHome();
  }
}
