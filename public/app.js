(function () {
  "use strict";

  // ✅ IMPORTANT: point to your backend (API) service URL
  const API_BASE = "https://about-me-api-9m4q.onrender.com";
  console.log("[AboutMe] app.js loaded. API_BASE =", API_BASE);

  // ...the rest of your existing app.js code continues here...
})();

  // public/app.js
console.log("[AboutMe] app.js loaded. API_BASE =", API_BASE);

  // -----------------------------
  // GLOBAL STATE
  // -----------------------------
  let currentUser = null;

  // -----------------------------
  // DOM HELPERS
  // -----------------------------
  const byId = (id) => document.getElementById(id);

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  // -----------------------------
  // API FETCH (returns res + data + url)
  // -----------------------------
  async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;

    const opts = {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    };

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
  // INVITES
  // -----------------------------
  function buildInviteUrl(ownerName) {
    const to = encodeURIComponent(ownerName || "");
    return `${window.location.origin}/?to=${to}#write`;
  }

  async function handleSendInvite() {
    const nameEl = byId("share-name");
    const emailEl = byId("share-email");
    const statusEl = byId("share-status");

    const ownerName = (nameEl?.value || "").trim() || (currentUser?.name || "");
    const toEmail = (emailEl?.value || "").trim();

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
    // Invite button
    const inviteBtn = byId("share-generate");
    if (inviteBtn) {
      inviteBtn.addEventListener("click", () => {
        handleSendInvite().catch((e) => {
          console.error("[Invite] Uncaught error:", e);
          const statusEl = byId("share-status");
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
