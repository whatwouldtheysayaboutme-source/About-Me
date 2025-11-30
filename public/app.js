// Wrap everything so we don't leak globals or double-declare things
(function () {
  // ---------------------------
  // Basic helpers
  // ---------------------------

  // Point all API calls at the Node/Express backend
  const API_BASE = "https://about-me-api-9m4q.onrender.com";

  // Who the message is for (comes from ?to= in the URL)
  let currentInviteName = null;

  // Utility: safe JSON parsing
  async function safeJson(res) {
    try {
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // Utility: set status text + color safely
  function setStatus(el, text, color) {
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  }

  // Set footer year
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Check if user is already logged in (from previous visit)
  let currentUser = null;
  const storedUser = localStorage.getItem("aboutme_user");
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
    } catch (_) {
      currentUser = null;
    }
  }

  // If logged in, update nav button text
  if (currentUser) {
    const authLink = document.querySelector('a[href="#auth"]');
    if (authLink) {
      authLink.textContent = `Hi, ${currentUser.name}`;
    }
  }

  // Get auth token (if any)
  function getToken() {
    return localStorage.getItem("aboutme_token") || null;
  }

  // ---------------------------
  // Invite link generation
  // ---------------------------

  const shareNameInput = document.getElementById("share-name");
  const shareGenerateBtn = document.getElementById("share-generate");
  const shareResult = document.getElementById("share-result");
  const shareUrlInput = document.getElementById("share-url");
  const shareCopyBtn = document.getElementById("share-copy");
  const shareStatus = document.getElementById("share-status");

  if (shareGenerateBtn && shareNameInput) {
    shareGenerateBtn.addEventListener("click", () => {
      const name = shareNameInput.value.trim();

      if (!name) {
        setStatus(shareStatus, "Please enter your name first.", "salmon");
        return;
      }

      // Build invite link: same page, with ?to=<name>#write
      const base = window.location.origin + window.location.pathname;
      const url = `${base}?to=${encodeURIComponent(name)}#write`;

      if (shareUrlInput && shareResult) {
        shareUrlInput.value = url;
        shareResult.style.display = "flex";
      }

      setStatus(
        shareStatus,
        "Link created. Copy it and send it to friends or family.",
        "lightgreen"
      );

      // Update write section line too
      const writeToLine = document.getElementById("write-to-line");
      if (writeToLine) {
        writeToLine.textContent = `You’re writing a message for ${name}. Share from the heart.`;
      }
    });
  }

  // Copy invite link
  if (shareCopyBtn && shareUrlInput) {
    shareCopyBtn.addEventListener("click", async () => {
      const text = shareUrlInput.value;
      if (!text) return;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback
          shareUrlInput.select();
          document.execCommand("copy");
        }

        setStatus(shareStatus, "Link copied to clipboard.", "lightgreen");
      } catch (err) {
        console.error("Copy failed:", err);
        setStatus(
          shareStatus,
          "Could not copy automatically. Please copy the link manually.",
          "salmon"
        );
      }
    });
  }

  // ---------------------------
  // Handle invite links on load
  // ---------------------------

  (function handleInviteOnLoad() {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");

    if (!to) return;

    const name = decodeURIComponent(to);
    currentInviteName = name; // store who the tribute is for

    const inviteBanner = document.getElementById("invite-banner");
    const writeToLine = document.getElementById("write-to-line");

    if (inviteBanner) {
      inviteBanner.style.display = "block";
      inviteBanner.textContent = `You’ve been invited to write a message for ${name}. Scroll down to share what they mean to you.`;
    }

    if (writeToLine) {
      writeToLine.textContent = `You’re writing a message for ${name}. Share from the heart.`;
    }

    const writeSection = document.getElementById("write");
    if (writeSection) {
      writeSection.scrollIntoView({ behavior: "smooth" });
    }
  })();

  // ---------------------------
  // Copy tribute message
  // ---------------------------

  const tributeText = document.getElementById("tribute-text");
  const copyTributeBtn = document.getElementById("copy-tribute");
  const tributeStatus = document.getElementById("tribute-status");

  if (copyTributeBtn && tributeText) {
    copyTributeBtn.addEventListener("click", async () => {
      const text = tributeText.value.trim();
      if (!text) {
        setStatus(tributeStatus, "Write a message first.", "salmon");
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          tributeText.select();
          document.execCommand("copy");
        }

        setStatus(
          tributeStatus,
          "Message copied. Paste it into a text, email, or DM to share.",
          "lightgreen"
        );
      } catch (err) {
        console.error("Copy tribute failed:", err);
        setStatus(
          tributeStatus,
          "Could not copy automatically. Please copy it manually.",
          "salmon"
        );
      }
    });
  }

  // ---------------------------
  // Save tribute to server
  // ---------------------------

  const tributeFromInput = document.getElementById("tribute-from");
  const saveTributeBtn = document.getElementById("save-tribute");

  if (saveTributeBtn && tributeText) {
    saveTributeBtn.addEventListener("click", async () => {
      const message = tributeText.value.trim();
      const fromName = tributeFromInput ? tributeFromInput.value.trim() : "";

      if (!message) {
        setStatus(tributeStatus, "Write a message before saving.", "salmon");
        return;
      }

      const toName = currentInviteName || null;
      const token = getToken();

      try {
        const res = await fetch(`${API_BASE}/api/tributes`, {
          method: "POST",
          headers: Object.assign(
            { "Content-Type": "application/json" },
            token ? { Authorization: `Bearer ${token}` } : {}
          ),
          body: JSON.stringify({
            toName,
            fromName,
            message,
          }),
        });

        const data = await safeJson(res);

        if (data && data.ok) {
          setStatus(
            tributeStatus,
            "Message saved on About Me. ❤️",
            "lightgreen"
          );
          tributeText.value = "";
        } else {
          setStatus(
            tributeStatus,
            (data && data.error) ||
              "Could not save your message. Please try again.",
            "salmon"
          );
        }
      } catch (err) {
        console.error("Save tribute error:", err);
        setStatus(
          tributeStatus,
          "Server error while saving. Please try again later.",
          "salmon"
        );
      }
    });
  }

  // ---------------------------
  // SIGNUP – talks to /api/register
  // ---------------------------

  const signupForm = document.getElementById("signup-form");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById("username");
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");
      const msg = document.getElementById("signup-message");

      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!name || !email || !password) {
        setStatus(msg, "Please fill in all fields.", "salmon");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await safeJson(res);

        if (data && data.ok) {
          setStatus(msg, "Account created! Welcome.", "lightgreen");

          // If backend returns user + token on signup, store them
          if (data.user && data.token) {
            localStorage.setItem("aboutme_user", JSON.stringify(data.user));
            localStorage.setItem("aboutme_token", data.token);

            setTimeout(() => window.location.reload(), 800);
          }
        } else {
          setStatus(
            msg,
            (data && data.error) || "Signup failed.",
            "salmon"
          );
        }
      } catch (err) {
        console.error("Signup error:", err);
        setStatus(
          msg,
          "Server error. Please try again later.",
          "salmon"
        );
      }
    });
  }

  // ---------------------------
  // LOGIN – talks to /api/login
  // ---------------------------

  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const userInput = document.getElementById("login-user");
      const passInput = document.getElementById("login-pass");
      const msg = document.getElementById("login-message");

      const email = userInput ? userInput.value.trim() : "";
      const password = passInput ? passInput.value : "";

      if (!email || !password) {
        setStatus(
          msg,
          "Please enter your email (or username) and password.",
          "salmon"
        );
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await safeJson(res);
        console.log("Login response:", data);

        if (data && data.ok) {
          // Store token & user for future visits
          if (data.token) {
            localStorage.setItem("aboutme_token", data.token);
          }
          if (data.user) {
            localStorage.setItem("aboutme_user", JSON.stringify(data.user));
          }

          setStatus(
            msg,
            `Logged in as ${data.user ? data.user.name : "your account"}.`,
            "lightgreen"
          );

          // Refresh page so UI (nav text, etc.) updates
          setTimeout(() => window.location.reload(), 800);
        } else {
          setStatus(
            msg,
            (data && data.error) || "Login failed.",
            "salmon"
          );
        }
      } catch (err) {
        console.error("Login error:", err);
        setStatus(msg, "Server error. Please try again.", "salmon");
      }
    });
  }
})();
// ===========================
// Load "My tributes" section
// ===========================

const tributesListEl   = document.getElementById("my-tributes-list");
const tributesLoading  = document.getElementById("tributes-loading");
const tributesError    = document.getElementById("tributes-error");

if (tributesListEl && tributesLoading && tributesError) {
  (async function loadMyTributes() {
    // show loading state
    tributesLoading.style.display = "block";
    tributesLoading.textContent = "Loading your tributes...";
    tributesError.textContent = "";
    tributesListEl.innerHTML = "";

    try {
      const res = await fetch(`${API_BASE}/api/my-tributes`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // if your backend sets a cookie when you log in, this sends it
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      tributesLoading.style.display = "none";

      if (!data || !data.ok) {
        tributesError.textContent =
          (data && data.error) ||
          "We couldn't load your tributes. Try logging in again.";
        return;
      }

      const tributes = data.tributes || [];

      if (tributes.length === 0) {
        const empty = document.createElement("p");
        empty.className = "small-note";
        empty.textContent =
          "You don’t have any tributes yet. Share your About Me link and invite people to write one for you.";
        tributesListEl.appendChild(empty);
        return;
      }

      tributes.forEach((t) => {
        const card = document.createElement("article");
        card.className = "tribute-card";

        const fromLine = document.createElement("p");
        fromLine.innerHTML = `<strong>From:</strong> ${t.fromName || "Someone who cares"}`;

        const msgLine = document.createElement("p");
        msgLine.textContent = t.message || "";

        const metaLine = document.createElement("p");
        metaLine.className = "small-note";
        if (t.createdAt) {
          const d = new Date(t.createdAt);
          metaLine.textContent = d.toLocaleString();
        } else {
          metaLine.textContent = "";
        }

        card.appendChild(fromLine);
        card.appendChild(msgLine);
        if (metaLine.textContent) card.appendChild(metaLine);

        tributesListEl.appendChild(card);
      });
    } catch (err) {
      console.error("Load tributes error:", err);
      tributesLoading.style.display = "none";
      tributesError.textContent =
        "Server error while loading tributes. Please try again later.";
    }
  })();
}
