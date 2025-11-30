// Wrap everything so we don't leak globals
(function () {
  const API_BASE = "https://about-me-api-9m4q.onrender.com";

  let currentInviteName = null;

  // ---------------------------------------
  // Helpers
  // ---------------------------------------

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  function setStatus(el, text, color) {
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  }

  // Footer year
  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // Load remembered user
  let currentUser = null;
  try {
    const stored = localStorage.getItem("aboutme_user");
    if (stored) currentUser = JSON.parse(stored);
  } catch {}

  if (currentUser) {
    const authLink = document.querySelector('a[href="#auth"]');
    if (authLink) {
      authLink.textContent = `Hi, ${currentUser.name}`;
    }
  }

  function getToken() {
    return localStorage.getItem("aboutme_token") || null;
  }

  // ---------------------------------------
  // Update top-left site label
  // ---------------------------------------

  const brandEl = document.querySelector(".brand, #brand, header .logo, .site-title");
  if (brandEl) brandEl.textContent = "What Would They Say About Me?";

  // ---------------------------------------
  // Invite link generation
  // ---------------------------------------

  const shareNameInput = document.getElementById("share-name");
  const shareGenerateBtn = document.getElementById("share-generate");
  const shareUrlInput = document.getElementById("share-url");
  const shareResult = document.getElementById("share-result");
  const shareCopyBtn = document.getElementById("share-copy");
  const shareStatus = document.getElementById("share-status");

  if (shareGenerateBtn && shareNameInput) {
    shareGenerateBtn.addEventListener("click", () => {
      const name = shareNameInput.value.trim();
      if (!name) {
        setStatus(shareStatus, "Please enter your name first.", "salmon");
        return;
      }

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

      const writeToLine = document.getElementById("write-to-line");
      if (writeToLine) {
        writeToLine.textContent = `You’re writing a message for ${name}. Share from the heart.`;
      }
    });
  }

  if (shareCopyBtn && shareUrlInput) {
    shareCopyBtn.addEventListener("click", async () => {
      const text = shareUrlInput.value;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        setStatus(shareStatus, "Link copied to clipboard.", "lightgreen");
      } catch {
        shareUrlInput.select();
        document.execCommand("copy");
        setStatus(shareStatus, "Link copied.", "lightgreen");
      }
    });
  }

  // ---------------------------------------
  // Handle Invite Links
  // ---------------------------------------

  (function handleInviteOnLoad() {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");

    if (!to) return;
    currentInviteName = decodeURIComponent(to);

    const banner = document.getElementById("invite-banner");
    const writeToLine = document.getElementById("write-to-line");
    if (banner) {
      banner.style.display = "block";
      banner.textContent = `You’ve been invited to write a message for ${currentInviteName}. Scroll down to share what they mean to you.`;
    }
    if (writeToLine) {
      writeToLine.textContent = `You’re writing a message for ${currentInviteName}. Share from the heart.`;
    }

    const writeSection = document.getElementById("write");
    if (writeSection) writeSection.scrollIntoView({ behavior: "smooth" });
  })();

  // ---------------------------------------
  // Copy tribute message
  // ---------------------------------------

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
        await navigator.clipboard.writeText(text);
        setStatus(tributeStatus, "Message copied to clipboard.", "lightgreen");
      } catch {
        tributeText.select();
        document.execCommand("copy");
        setStatus(tributeStatus, "Message copied.", "lightgreen");
      }
    });
  }

  // ---------------------------------------
  // Save tribute
  // ---------------------------------------

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

      const token = getToken();

      try {
        const res = await fetch(`${API_BASE}/api/tributes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            toName: currentInviteName,
            fromName,
            message,
          }),
        });

        const data = await safeJson(res);

        if (data && data.ok) {
          setStatus(tributeStatus, "Message saved ❤️", "lightgreen");
          tributeText.value = "";
        } else {
          setStatus(
            tributeStatus,
            (data && data.error) || "Could not save your message.",
            "salmon"
          );
        }
      } catch (err) {
        console.error(err);
        setStatus(tributeStatus, "Server error. Try again later.", "salmon");
      }
    });
  }

  // ---------------------------------------
  // Signup
  // ---------------------------------------

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const msg = document.getElementById("signup-message");

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
          localStorage.setItem("aboutme_user", JSON.stringify(data.user));
          localStorage.setItem("aboutme_token", data.token);
          setStatus(msg, "Account created!", "lightgreen");
          setTimeout(() => location.reload(), 600);
        } else {
          setStatus(msg, data.error || "Signup failed.", "salmon");
        }
      } catch {
        setStatus(msg, "Server error.", "salmon");
      }
    });
  }

  // ---------------------------------------
  // Login
  // ---------------------------------------

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-user").value.trim();
      const password = document.getElementById("login-pass").value;

      const msg = document.getElementById("login-message");

      if (!email || !password) {
        setStatus(msg, "Enter email and password.", "salmon");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await safeJson(res);

        if (data && data.ok) {
          localStorage.setItem("aboutme_token", data.token);
          localStorage.setItem("aboutme_user", JSON.stringify(data.user));
          setStatus(msg, "Logged in!", "lightgreen");
          setTimeout(() => location.reload(), 600);
        } else {
          setStatus(msg, data.error || "Login failed.", "salmon");
        }
      } catch {
        setStatus(msg, "Server error.", "salmon");
      }
    });
  }

  // ---------------------------------------
  // My Tributes
  // ---------------------------------------

  const tributesListEl = document.getElementById("tributes-list");
  const tributesLoading = document.getElementById("tributes-loading");
  const tributesError = document.getElementById("tributes-error");

  if (tributesListEl && tributesLoading && tributesError) {
    (async function loadMyTributes() {
      tributesLoading.style.display = "block";

      const token = getToken();

      try {
        const res = await fetch(`${API_BASE}/api/tributes?to=${encodeURIComponent(currentUser?.name || "")}`, {
          method: "GET",
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        });

        const data = await safeJson(res);

        tributesLoading.style.display = "none";

        if (res.status === 401) {
          tributesError.style.display = "block";
          tributesError.textContent =
            "Log in to see your tributes.";
          return;
        }

        if (!data || !data.ok) {
          tributesError.style.display = "block";
          tributesError.textContent =
            data.error || "Could not load tributes.";
          return;
        }

        const tributes = data.tributes || [];

        if (!tributes.length) {
          const p = document.createElement("p");
          p.className = "small-note";
          p.textContent =
            "You don’t have any tributes yet. Share your link and invite people to write one.";
          tributesListEl.appendChild(p);
          return;
        }

        tributes.forEach((t) => {
          const card = document.createElement("article");
          card.className = "tribute-card";

          const fromLine = document.createElement("p");
          fromLine.innerHTML = `<strong>From:</strong> ${
            t.fromName || "Someone who cares"
          }`;

          const msgLine = document.createElement("p");
          msgLine.textContent = t.message;

          const meta = document.createElement("p");
          meta.className = "small-note";
          if (t.createdAt)
            meta.textContent = new Date(t.createdAt).toLocaleString();

          card.appendChild(fromLine);
          card.appendChild(msgLine);
          if (meta.textContent) card.appendChild(meta);

          tributesListEl.appendChild(card);
        });
      } catch (err) {
        console.error(err);
        tributesLoading.style.display = "none";
        tributesError.style.display = "block";
        tributesError.textContent = "Server error.";
      }
    })();
  }

  // ---------------------------------------
  // FEEDBACK FORM (Option 3)
  // ---------------------------------------

  const feedbackForm = document.getElementById("feedback-form");
  const feedbackEmail = document.getElementById("feedback-email");
  const feedbackMessage = document.getElementById("feedback-message");
  const feedbackStatus = document.getElementById("feedback-status");

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = feedbackEmail.value.trim();
      const message = feedbackMessage.value.trim();

      if (!email || !message) {
        setStatus(feedbackStatus, "Please fill in all fields.", "salmon");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, message }),
        });

        const data = await safeJson(res);

        if (data && data.ok) {
          setStatus(
            feedbackStatus,
            "Thank you! Your feedback has been sent.",
            "lightgreen"
          );
          feedbackEmail.value = "";
          feedbackMessage.value = "";
        } else {
          setStatus(
            feedbackStatus,
            data.error || "Could not send feedback.",
            "salmon"
          );
        }
      } catch {
        setStatus(feedbackStatus, "Server error. Try again later.", "salmon");
      }
    });
  }
})();
