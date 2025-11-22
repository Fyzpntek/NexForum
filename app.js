const API_BASE = "https://nexforum.wuaze.com/api/index.php";

function getToken() {
  return localStorage.getItem("nexforum_token") || null;
}
function setToken(t) {
  localStorage.setItem("nexforum_token", t);
}
function clearToken() {
  localStorage.removeItem("nexforum_token");
}

async function apiFetch(action, method = "GET", body = null, auth = true) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers["Authorization"] = token;

  const res = await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Respon tidak valid dari server");
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* redirect if no token */
function requireAuth() {
  if (!getToken()) {
    window.location.href = "auth.html";
    return false;
  }
  return true;
}

/* TIMELINE / HOME */
async function initHome() {
  if (!requireAuth()) return;

  document.getElementById("logoutBtn").onclick = () => {
    clearToken();
    window.location.href = "auth.html";
  };

  const textarea = document.getElementById("postContent");
  const postBtn = document.getElementById("postBtn");
  const list = document.getElementById("timelineList");

  async function loadTimeline() {
    list.innerHTML = "<p class='error'>Memuat...</p>";
    try {
      const data = await apiFetch("timeline");
      if (!data.length) {
        list.innerHTML = "<p class='error'>Belum ada postingan.</p>";
        return;
      }
      list.innerHTML = "";
      data.forEach((p) => list.appendChild(renderPost(p)));
    } catch (e) {
      list.innerHTML = `<p class='error'>${e.message}</p>`;
    }
  }

  postBtn.onclick = async () => {
    const content = textarea.value.trim();
    if (!content) return;
    postBtn.disabled = true;
    try {
      await apiFetch("create_post", "POST", { content });
      textarea.value = "";
      await loadTimeline();
    } catch (e) {
      alert(e.message);
    } finally {
      postBtn.disabled = false;
    }
  };

  await loadTimeline();
}

/* EXPLORE */
async function initExplore() {
  const list = document.getElementById("exploreList");
  list.innerHTML = "<p class='error'>Memuat...</p>";
  try {
    const data = await apiFetch("explore", "GET", null, false);
    if (!data.length) {
      list.innerHTML = "<p class='error'>Belum ada post.</p>";
      return;
    }
    list.innerHTML = "";
    data.forEach((p) => list.appendChild(renderPost(p)));
  } catch (e) {
    list.innerHTML = `<p class='error'>${e.message}</p>`;
  }
}

/* PROFILE */
async function initProfile() {
  if (!requireAuth()) return;

  document.getElementById("logoutBtn").onclick = () => {
    clearToken();
    window.location.href = "auth.html";
  };

  const card = document.getElementById("profileCard");
  card.innerHTML = "<p class='error'>Memuat...</p>";

  try {
    const me = await apiFetch("me");
    card.innerHTML = `
      <div class="post-card" style="flex-direction:column;text-align:center;">
        <div class="avatar" style="margin:0 auto;">
          ${me.username.slice(0, 2).toUpperCase()}
        </div>
        <h2>@${me.username}</h2>
        <p>ID: ${me.id}</p>
        <p>${me.bio || "Bio belum diisi"}</p>
      </div>`;
  } catch (e) {
    card.innerHTML = `<p class='error'>${e.message}</p>`;
  }
}

/* NOTIFICATIONS */
async function initNotifications() {
  if (!requireAuth()) return;

  document.getElementById("logoutBtn").onclick = () => {
    clearToken();
    window.location.href = "auth.html";
  };

  const list = document.getElementById("notifList");
  list.innerHTML = "<p class='error'>Memuat...</p>";

  try {
    const data = await apiFetch("notifications");
    if (!data.length) {
      list.innerHTML = "<p class='error'>Tidak ada notifikasi.</p>";
      return;
    }
    list.innerHTML = "";
    data.forEach((n) => {
      const user = n.from_username || "Seseorang";
      const el = document.createElement("div");
      el.className = "post-card";
      el.innerHTML = `
        <div class="avatar">${user.slice(0, 2).toUpperCase()}</div>
        <div class="post-main">
          <div class="post-username">@${user}</div>
          <div class="post-content">${n.type} ${n.post_id ? "di post #" + n.post_id : ""}</div>
        </div>`;
      list.appendChild(el);
    });
  } catch (e) {
    list.innerHTML = `<p class='error'>${e.message}</p>`;
  }
}

/* AUTH */
function initAuth() {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const errorEl = document.getElementById("authError");

  loginTab.onclick = () => {
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    errorEl.textContent = "";
  };

  registerTab.onclick = () => {
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    errorEl.textContent = "";
  };

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(loginForm);
    try {
      const d = await apiFetch("login", "POST", {
        username: f.get("username"),
        password: f.get("password"),
      }, false);
      setToken(d.token);
      window.location.href = "index.html";
    } catch (err) {
      errorEl.textContent = err.message;
    }
  };

  registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(registerForm);
    try {
      await apiFetch("register", "POST", {
        username: f.get("username"),
        email: f.get("email"),
        password: f.get("password"),
      }, false);
      errorEl.textContent = "Registrasi berhasil, silakan login.";
      loginTab.onclick();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  };
}

/* Component Post */
function renderPost(p) {
  const el = document.createElement("article");
  el.className = "post-card";
  const username = p.username || "user";
  el.innerHTML = `
    <div class="avatar">${username.slice(0, 2).toUpperCase()}</div>
    <div class="post-main">
      <div class="post-header">
        <span class="post-username">@${username}</span>
        <span class="post-time">${formatDate(p.created_at)}</span>
      </div>
      <div class="post-content">${p.content.replace(/</g, "&lt;")}</div>
    </div>`;
  return el;
}

/* Format tanggal */
function formatDate(t) {
  return new Date(t).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* jalankan sesuai halaman */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "explore") initExplore();
  if (page === "profile") initProfile();
  if (page === "notifications") initNotifications();
  if (page === "auth") initAuth();
});
