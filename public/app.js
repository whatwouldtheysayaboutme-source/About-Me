// public/app.js
"use strict";

// Wrap everything so we don't leak globals
(function () {
  // ------------------------------------------------------------
  // API BASE
  // ------------------------------------------------------------
  // Default: same origin (best when Express serves /public and /api together)
  // If you ever split frontend/backend again, set:
  //   window.API_BASE_OVERRIDE = "https://your-api-service.onrender.com";
  const API_BASE = (window.API_BASE_OVERRIDE || window.location.origin).replace(/\/$/, "");

  // ------------------------------------------------------------
  // Tiny DOM helpers
  // ------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function show(el) {
    if (el) el.style.display = "";
  }

  function hide(el) {
    if (el) el.style.display = "none";
  }

  // ------------------------------------------------------------
  // Storage / auth (devtoken for now)
  // ------------------------------------------------------------
  const LS_TOKEN = "aboutme_token";
  const LS_USER = "aboutme_user";

  function getToken() {
    return localStorage.getItem(LS_TOKEN) || "";
  }

  function setToken(token) {
    if (token) localStorage.setItem(LS_TOKEN, token);
    else localStorage.removeItem(LS_TOKEN);
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(LS_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setUser(user) {
    if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
    else localStorage.removeItem(LS_USER);
  }

  let currentUser = getUser();

  // ------------------------------------------------------------
  // Fetch helper
  // ------------------------------------------------------------
  async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );

    // If you later implement real auth, you can attach token here.
    // For now, your server doesn't validate it, but this keeps it ready.
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { ok: false, error: "Non-JSON response from server", raw: text };
    }

    return { res, data, url };
  }

  // ------------------------------------------------------------
  // UI element IDs this script expects
  // ------------------------------------------------------------
  // Auth:
  //  - registerName, registerEmail, registerPassword, registerBtn
  //  - loginEmail, loginPassword, loginBtn
  //  - logoutBtn, headerUserPill (optional)
  //
  // Profile photo:
  //  - photoFile, photoUrl, savePhotoBtn, profilePhotoImg (optional)
  //
  // Invites:
  //  - inviteName, inviteEmail, inviteSendBtn, inviteStatus
  //  - inviteLink (optional), inviteCopyBtn (optional)
  //
  // Write tribute:
  //  - toName, fromName, message, isPublic (checkbox optional), submitTributeBtn, tributeStatus
  //
  // Lists:
  //  - publicTributesList (optional), myTributesList (optional)
  //
  // Feedback:
  //  - feedbackEmail, feedbackMessage, feedbackBtn, feedbackStatus (optional)

  // ------------------------------------------------------------
  // AUTH wiring
  // ------------------------------------------------------------
  async function handleRegister() {
    const name = (byId("registerName")?.value || "").trim();
    const email = (byId("registerEmail")?.value || "").trim();
    const password = (byId("registerPassword")?.value || "").trim();

    if (!name || !email || !password) {
      alert("Please enter name, email, and password.");
      return;
    }

    const { res, data, url } = await apiFetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok || !data?.ok) {
      console.error("Register failed:", { url, status: res.status, data });
      alert(data?.error || `Register failed (${res.status})`);
      return;
    }

    currentUser = data.user;
    setUser(currentUser);
    setToken(data.token || "");

    refreshHeaderUser();
    alert("Registered ✅");
  }

  async function handleLogin() {
    const email = (byId("loginEmail")?.value || "").trim();
    const password = (byId("loginPassword")?.value || "").trim();

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    const { res, data, url } = await apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok || !data?.ok) {
      console.error("Login failed:", { url, status: res.status, data });
      alert(data?.error || `Login failed (${res.status})`);
      return;
    }

    currentUser = data.user;
    setUser(currentUser);
    setToken(data.token || "");

    refreshHeaderUser();
    alert("Logged in ✅");
  }

  function handleLogout() {
    currentUser = null;
    setUser(null);
    setToken("");
    refreshHeaderUser();
    alert("Logged out ✅");
  }

  function refreshHeaderUser() {
    const pill = byId("headerUserPill"); // optional
    const logoutBtn = byId("logoutBtn"); // optional

    if (pill) {
      pill.textContent = currentUser?.name ? `Hi, ${currentUser.name}` : "Hi";
    }
    if (logoutBtn) {
      if (currentUser) show(logoutBtn);
      else hide(logoutBtn);
    }
  }

  // ------------------------------------------------------------
  // PROFILE PHOTO (local + optional server sync)
  // ------------------------------------------------------------
  const LS_PHOTO = "aboutme_profilePhotoUrl";

  function setProfilePhotoPreview(url) {
    const img = byId("profilePhotoImg");
    if (img && url) img.src = url;
  }

  async function handleSavePhoto() {
    const fileInput = byId("photoFile");
    const urlInput = byId("photoUrl");

    let photoData = null;

    // Prefer file if chosen
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      // Convert to base64 data URL
      photoData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else if (urlInput && urlInput.value.trim()) {
      photoData = urlInput.value.trim();
    }

    if (!photoData) {
      alert("Choose a file or paste a photo URL first.");
      return;
    }

    // Save locally so it shows instantly
    localStorage.setItem(LS_PHOTO, photoData);
    setProfilePhotoPreview(photoData);

    // If logged in, also push to server so other devices can see it
    if (currentUser?.id) {
      const { res, data, url } = await apiFetch("/api/profile-photo", {
        method: "POST",
        body: JSON.stringify({ userId: currentUser.id, photoData }),
      });

      if (!res.ok || !data?.ok) {
        console.error("Profile photo save failed:", { url, status: res.status, data });
        alert(data?.error || `Photo save failed (${res.status})`);
        return;
      }
    }

    alert("Photo saved ✅");
  }

  // ------------------------------------------------------------
  // INVITES (THIS IS THE IMPORTANT PART)
  // ------------------------------------------------------------
 // -----------------------------
// INVITES (THIS IS THE IMPORTANT PART)
// -----------------------------
function buildInviteUrl(ownerName) {
  const to = encodeURIComponent(ownerName || "");
  return `${window.location.origin}/?to=${to}#write`;
}

async function handleSendInvite() {
  // These IDs MATCH your HTML exactly
  const inviteNameEl  = document.getElementById("share-name");
  const inviteEmailEl = document.getElementById("share-email");
  const statusEl      = document.getElementById("share-status");

  const ownerName =
    (inviteNameEl?.value || "").trim() ||
    (currentUser?.name || "");

  const toEmail = (inviteEmailEl?.value || "").trim();

  if (!toEmail) {
    alert("Please enter your friend's email.");
    return;
  }

  const inviteUrl = buildInviteUrl(ownerName);
  console.log("[Invite] Invite link:", inviteUrl);

  if (statusEl) {
    statusEl.textContent = "Invitation link created. Sending email...";
  }

  const { res, data, url } = await apiFetch("/api/send-invite-email", {
    method: "POST",
    body: JSON.stringify({ toEmail, ownerName, inviteUrl }),
  });

  if (!res.ok || !data?.ok) {
    console.error("[Invite] Email failed:", { url, status: res.status, data });
    if (statusEl) {
      statusEl.textContent =
        `Invitation link created. Email failed: ${data?.error || res.status}`;
    }
    return;
  }

  if (statusEl) statusEl.textContent = "Email sent ✅";
  console.log("[Invite] Email accepted:", data);
}

  // ------------------------------------------------------------
  // TRIBUTES
  // ------------------------------------------------------------
  async function handleSubmitTribute() {
    const toName = (byId("toName")?.value || "").trim();
    const fromName = (byId("fromName")?.value || "").trim();
    const message = (byId("message")?.value || "").trim();
    const isPublicEl = byId("isPublic");
    const isPublic = isPublicEl ? !!isPublicEl.checked : true;
    const statusEl = byId("tributeStatus");

    if (!message) {
      alert("Please write a message.");
      return;
    }

    setText(statusEl, "Submitting...");

    const hpField = ""; // honeypot placeholder; keep empty for humans

    const { res, data, url } = await apiFetch("/api/tributes", {
      method: "POST",
      body: JSON.stringify({ toName, fromName, message, isPublic, hpField }),
    });

    if (!res.ok || !data?.ok) {
      console.error("Tribute submit failed:", { url, status: res.status, data });
      setText(statusEl, data?.error || `Submit failed (${res.status})`);
      return;
    }

    setText(statusEl, "Saved ✅");
    await loadPublicTributesFromUrl();
    if (currentUser?.id) await loadMyTributes();
  }

  async function loadPublicTributesFromUrl() {
    const listEl = byId("publicTributesList");
    if (!listEl) return;

    // If URL has ?to=Name, show tributes for that name.
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");

    const path = to ? `/api/tributes?to=${encodeURIComponent(to)}` : "/api/tributes";
    const { res, data, url } = await apiFetch(path, { method: "GET", headers: {} });

    if (!res.ok || !data?.ok) {
      console.error("Load public tributes failed:", { url, status: res.status, data });
      listEl.innerHTML = `<div class="muted">Could not load tributes.</div>`;
      return;
    }

    const items = data.tributes || [];
    if (!items.length) {
      listEl.innerHTML = `<div class="muted">No messages yet.</div>`;
      return;
    }

    listEl.innerHTML = items
      .map((t) => {
        const from = t.fromName ? String(t.fromName) : "Someone";
        const msg = t.message ? String(t.message) : "";
        const when = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
        return `
          <div class="tribute-card">
            <div class="tribute-meta"><strong>${escapeHtml(from)}</strong> <span class="muted">${escapeHtml(when)}</span></div>
            <div class="tribute-msg">${escapeHtml(msg)}</div>
          </div>
        `;
      })
      .join("");
  }

  async function loadMyTributes() {
    const listEl = byId("myTributesList");
    if (!listEl || !currentUser?.id) return;

    const { res, data, url } = await apiFetch(`/api/my-tributes?userId=${encodeURIComponent(currentUser.id)}`, {
      method: "GET",
      headers: {},
    });

    if (!res.ok || !data?.ok) {
      console.error("Load my tributes failed:", { url, status: res.status, data });
      listEl.innerHTML = `<div class="muted">Could not load your messages.</div>`;
      return;
    }

    const items = data.tributes || [];
    if (!items.length) {
      listEl.innerHTML = `<div class="muted">No messages yet.</div>`;
      return;
    }

    listEl.innerHTML = items
      .map((t) => {
        const from = t.fromName ? String(t.fromName) : "Someone";
        const msg = t.message ? String(t.message) : "";
        const when = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
        const pub = t.isPublic === false ? "Private" : "Public";
        return `
          <div class="tribute-card">
            <div class="tribute-meta">
              <strong>${escapeHtml(from)}</strong>
              <span class="muted">${escapeHtml(when)} • ${pub}</span>
            </div>
            <div class="tribute-msg">${escapeHtml(msg)}</div>
          </div>
        `;
      })
      .join("");
  }

  // ------------------------------------------------------------
  // FEEDBACK
  // ------------------------------------------------------------
  async function handleFeedback() {
    const email = (byId("feedbackEmail")?.value || "").trim();
    const message = (byId("feedbackMessage")?.value || "").trim();
    const statusEl = byId("feedbackStatus");

    if (!message) {
      alert("Please write feedback.");
      return;
    }

    setText(statusEl, "Sending...");

    const { res, data, url } = await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ email, message }),
    });

    if (!res.ok || !data?.ok) {
      console.error("Feedback failed:", { url, status: res.status, data });
      setText(statusEl, data?.error || `Failed (${res.status})`);
      return;
    }

    setText(statusEl, "Thanks ✅");
    alert("Feedback sent ✅");
  }

  // ------------------------------------------------------------
  // HTML escaping (for safe rendering)
  // ------------------------------------------------------------
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ------------------------------------------------------------
  // Wire events (only if elements exist)
  // ------------------------------------------------------------
  function wire() {
    console.log("[AboutMe] app.js loaded. API_BASE =", API_BASE);

    // Auth
    byId("registerBtn")?.addEventListener("click", handleRegister);
    byId("loginBtn")?.addEventListener("click", handleLogin);
    byId("logoutBtn")?.addEventListener("click", handleLogout);

    // Photo
    byId("savePhotoBtn")?.addEventListener("click", handleSavePhoto);

    // Invite
    byId("inviteSendBtn")?.addEventListener("click", () => {
      // Run async handler and surface errors
      handleSendInvite().catch((e) => {
        console.error("[Invite] Uncaught error:", e);
        setText(byId("inviteStatus"), "Invitation link created. Email failed (unexpected error).");
      });
    });
    byId("inviteCopyBtn")?.addEventListener("click", handleCopyInviteLink);

    // Tribute
    byId("submitTributeBtn")?.addEventListener("click", () => {
      handleSubmitTribute().catch((e) => {
        console.error("Submit tribute error:", e);
        setText(byId("tributeStatus"), "Submit failed (unexpected error).");
      });
    });

    // Feedback
    byId("feedbackBtn")?.addEventListener("click", () => {
      handleFeedback().catch((e) => {
        console.error("Feedback error:", e);
        setText(byId("feedbackStatus"), "Feedback failed (unexpected error).");
      });
    });

    // Initial UI state
    refreshHeaderUser();

    // Load photo preview from local storage if present
    const savedPhoto = localStorage.getItem(LS_PHOTO);
    if (savedPhoto) setProfilePhotoPreview(savedPhoto);

    // Load tributes
    loadPublicTributesFromUrl().catch(console.error);
    if (currentUser?.id) loadMyTributes().catch(console.error);
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
  // -----------------------------
// INVITE BUTTON CLICK HANDLER
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("share-generate");

  if (!btn) {
    console.error("[Invite] Button #share-generate not found in DOM");
    return;
  }

  btn.addEventListener("click", () => {
    handleSendInvite().catch((e) => {
      console.error("[Invite] Uncaught error:", e);
      const statusEl = document.getElementById("share-status");
      if (statusEl) {
        statusEl.textContent =
          "Invitation link created. Email failed (unexpected error).";
      }
    });
  });

  console.log("[Invite] share-generate button wired");
});

})();
