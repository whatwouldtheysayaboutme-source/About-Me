// ---------------------------
// Basic helpers
// ---------------------------
// Point all API calls at the Node/Express backend
const API_BASE = "https://about-me-api-9m4q.onrender.com";

// Who the message is for (comes from ?to= in the URL)
let currentInviteName = null;

// Set footer year
const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
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
      if (shareStatus) {
        shareStatus.textContent = "Please enter your name first.";
      }
      return;
    }

    // Build invite link: same page, with ?to=<name>#write
    const base = window.location.origin + window.location.pathname;
    const url = `${base}?to=${encodeURIComponent(name)}#write`;

    if (shareUrlInput && shareResult) {
      shareUrlInput.value = url;
      shareResult.style.display = "flex";
    }

    if (shareStatus) {
      shareStatus.textContent =
        "Link created. Copy it and send it to friends or family.";
    }

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

      if (shareStatus) {
        shareStatus.textContent = "Link copied to clipboard.";
      }
    } catch (err) {
      console.error("Copy failed:", err);
      if (shareStatus) {
        shareStatus.textContent =
          "Could not copy automatically. Please copy the link manually.";
      }
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
      if (tributeStatus) {
        tributeStatus.textContent = "Write a message first.";
      }
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        tributeText.select();
        document.execCommand("copy");
      }

      if (tributeStatus) {
        tributeStatus.textContent =
          "Message copied. Paste it into a text, email, or DM to share.";
      }
    } catch (err) {
      console.error("Copy tribute failed:", err);
      if (tributeStatus) {
        tributeStatus.textContent =
          "Could not copy automatically. Please copy it manually.";
      }
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
      if (tributeStatus) {
        tributeStatus.textContent = "Write a message before saving.";
      }
      return;
    }

    const toName = currentInviteName || null;

    try {
      const res = await fetch(`${API_BASE}/api/tributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toName,
          fromName,
          message,
        }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.ok) {
        if (tributeStatus) {
          tributeStatus.textContent = "Message saved on About Me. ❤️";
        }
      } else {
        if (tributeStatus) {
          tributeStatus.textContent =
            (data && data.error) ||
            "Could not save your message. Please try again.";
        }
      }
    } catch (err) {
      console.error("Save tribute error:", err);
      if (tributeStatus) {
        tributeStatus.textContent =
          "Server error while saving. Please try again later.";
      }
    }
  });
}

// ---------------------------
// REAL SIGNUP – talks to /api/register
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
      if (msg) {
        msg.textContent = "Please fill in all fields.";
        msg.style.color = "red";
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.ok) {
        if (msg) {
          msg.textContent = "Account created! Welcome.";
          msg.style.color = "lightgreen";
        }
      } else {
        if (msg) {
          msg.textContent =
            (data && data.error) || "Signup failed.";
          msg.style.color = "red";
        }
      }
    } catch (err) {
      console.error("Signup error:", err);
      if (msg) {
        msg.textContent = "Server error. Please try again later.";
        msg.style.color = "red";
      }
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
      if (msg) {
        msg.textContent = "Please enter your email and password.";
        msg.style.color = "red";
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }), // server expects "email"
      });

      const data = await res.json().catch(() => null);
      console.log("Login response:", data);

      if (data && data.ok) {
        if (msg) {
          msg.textContent = `Logged in as ${data.user.name}.`;
          msg.style.color = "lightgreen";
        }

        // TEMP: make it super obvious it worked
        
        // Optional: refresh the page so future features can show logged-in state
        // setTimeout(() => window.location.reload(), 800);
      } else {
        if (msg) {
          msg.textContent = (data && data.error) || "Login failed.";
          msg.style.color = "red";
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      if (msg) {
        msg.textContent = "Server error. Please try again.";
        msg.style.color = "red";
      }
    }
  });
}
