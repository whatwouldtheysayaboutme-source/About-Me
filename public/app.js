(function () {
  "use strict";

  // ✅ IMPORTANT: point to your backend (API) service URL
  const API_BASE = "https://about-me-api-9m4q.onrender.com";
  console.log("[AboutMe] app.js loaded. API_BASE =", API_BASE);

  // -----------------------------
  // GLOBAL STATE
  // -----------------------------
  let currentUser = null;
  let currentToken = null;

  // -----------------------------
  // DOM HELPERS
  // -----------------------------
  const byId = (id) => document.getElementById(id);

  function setText(el, text) {
    if (!el) return;
    el.textContent = text ?? "";
  }

  function show(el) {
    if (!el) return;
    el.style.display = "";
  }

  function hide(el) {
    if (!el) return;
    el.style.display = "none";
  }

  // -----------------------------
  // STORAGE
  // -----------------------------
  const LS_USER = "aboutme_user";
  const LS_TOKEN = "aboutme_token";

  function saveSession(user, token) {
    currentUser = user || null;
    currentToken = token || null;
    try {
      localStorage.setItem(LS_USER, JSON.stringify(currentUser));
      localStorage.setItem(LS_TOKEN, String(currentToken || ""));
    } catch {}
  }

  function loadSession() {
    try {
      const u = localStorage.getItem(LS_USER);
      const t = localStorage.getItem(LS_TOKEN);
      currentUser = u ? JSON.parse(u) : null;
      currentToken = t || null;
    } catch {
      currentUser = null;
      currentToken = null;
    }
  }

  function clearSession() {
    currentUser = null;
    currentToken = null;
    try {
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_TOKEN);
    } catch {}
  }

  // -----------------------------
  // API FETCH (returns res + data + url)
  // -----------------------------
  async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    // If you later add real auth, you can use this:
    if (currentToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${currentToken}`;
    }

    const opts = { ...options, headers };

    const res = await fetch(url, opts);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { res, data, url };
  }

  // -----------------------------
  // UI STATE
  // -----------------------------
  function refreshAuthUI() {
    // You can expand this later (hide signup/login when logged in, etc.)
    const logoutBtn = byId("logout");
    if (logoutBtn) {
      logoutBtn.disabled = !currentUser;
      logoutBtn.title = currentUser ? "" : "Log in first";
    }

    // Optional: if you want to auto-fill invite name when logged in
    const inviteName = byId("inviteName");
    if (inviteName && currentUser && !inviteName.value) {
      inviteName.value = currentUser.name || "";
    }
  }

  // -----------------------------
  // AUTH: SIGNUP
  // -----------------------------
  async function handleSignupSubmit(e) {
    e.preventDefault();

    const usernameEl = byId("username");
    const emailEl = byId("email");
    const passEl = byId("password");
    const msgEl = byId("signup-message");

    const name = (usernameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const password = (passEl?.value || "").trim();

    if (!name || !email || !password) {
      setText(msgEl, "Please fill out username, email, and password.");
      return;
    }

    setText(msgEl, "Creating account...");

    const { res, data } = await apiFetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok || !data?.ok) {
      setText(msgEl, data?.error || `Signup failed (${res.status})`);
      return;
    }

    saveSession(data.user, data.token);
    setText(msgEl, "Account created ✅ You are now logged in.");
    refreshAuthUI();
  }

  // -----------------------------
  // AUTH: LOGIN
  // -----------------------------
  async function handleLoginSubmit(e) {
    e.preventDefault();

    const loginUserEl = byId("login-user");
    const loginPassEl = byId("login-pass");
    const msgEl = byId("login-message");

    const loginId = (loginUserEl?.value || "").trim();
    const password = (loginPassEl?.value || "").trim();

    if (!loginId || !password) {
      setText(msgEl, "Please enter your email and password.");
      return;
    }

    setText(msgEl, "Logging in...");

    // Server currently expects { email, password } and looks up by email.
    const { res, data } = await apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: loginId, password }),
    });

    if (!res.ok || !data?.ok) {
      setText(msgEl, data?.error || `Login failed (${res.status})`);
      return;
    }

    saveSession(data.user, data.token);
    setText(msgEl, "Logged in ✅");
    refreshAuthUI();
  }

  // -----------------------------
  // AUTH: LOGOUT
  // -----------------------------
  function handleLogout() {
    clearSession();
    refreshAuthUI();

    const loginMsg = byId("login-message");
    const signupMsg = byId("signup-message");
    setText(loginMsg, "Logged out.");
    setText(signupMsg, "");
  }

  // -----------------------------
  // INVITES
  // -----------------------------
  function buildInviteUrl(ownerName) {
    const to = encodeURIComponent(ownerName || "");
    return `${window.location.origin}/?to=${to}#write`;
  }

  async function handleSendInvite() {
    const nameEl = byId("inviteName");
    const emailEl = byId("inviteEmail");
    const statusEl = byId("inviteStatus");

    if (!nameEl || !emailEl || !statusEl) {
      console.error("[Invite] Missing DOM elements", { nameEl, emailEl, statusEl });
      alert("Internal error: invite form not wired correctly.");
      return;
    }

    const ownerName =
      (nameEl.value || "").trim() ||
      (currentUser?.name || "");

    const toEmail = (emailEl.value || "").trim();

    console.log("[Invite] emailEl:", emailEl, "value:", emailEl.value, "toEmail:", toEmail);

    if (!toEmail) {
      alert("Please enter your friend's email.");
      return;
    }

    const inviteUrl = buildInviteUrl(ownerName);
    console.log("[Invite] Invite link:", inviteUrl);

    setText(statusEl, "Invitation link created. Sending email...");

    const { res, data } = await apiFetch("/api/send-invite-email", {
      method: "POST",
      body: JSON.stringify({ toEmail, ownerName, inviteUrl }),
    });

    if (!res.ok || !data?.ok) {
      console.error("[Invite] Email failed:", data);
      setText(statusEl, `Invitation link created. Email failed: ${data?.error || res.status}`);
      return;
    }

    setText(statusEl, "Email sent ✅");
    console.log("[Invite] SendGrid accepted:", data);
  }

  // -----------------------------
  // WIRE EVENTS
  // -----------------------------
  function wire() {
    loadSession();
    refreshAuthUI();

    // Signup
    const signupForm = byId("signup-form");
    if (signupForm) {
      signupForm.addEventListener("submit", (e) => {
        handleSignupSubmit(e).catch((err) => {
          console.error("[Signup] Uncaught error:", err);
          setText(byId("signup-message"), "Signup failed (unexpected error).");
        });
      });
    }

    // Login
    const loginForm = byId("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        handleLoginSubmit(e).catch((err) => {
          console.error("[Login] Uncaught error:", err);
          setText(byId("login-message"), "Login failed (unexpected error).");
        });
      });
    }

    // Logout (footer button)
    const logoutBtn = byId("logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleLogout();
      });
    }

    // Invite button
    const inviteBtn = byId("share-generate");
    if (inviteBtn) {
      inviteBtn.addEventListener("click", () => {
        handleSendInvite().catch((e) => {
          console.error("[Invite] Uncaught error:", e);
          const statusEl = byId("inviteStatus");
          setText(statusEl, "Invitation link created. Email failed (unexpected error).");
        });
      });
      console.log("[Invite] share-generate button wired");
    } else {
      console.error("[Invite] Button #share-generate not found");
    }
  }

  // -----------------------------
  // BOOT
  // -----------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
