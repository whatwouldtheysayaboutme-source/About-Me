// Wrap everything so we don't leak globals
(function () {
  const API_BASE = "https://about-me-api-9m4q.onrender.com";

  let currentInviteName = null;

  // ---------------------------------------
  // Helpers
  // ---------------------------------------
  // ---------------------------------------
  // Local-only profile photo
  // ---------------------------------------

  const PROFILE_PHOTO_KEY = "aboutme_profilePhotoUrl";

  function loadProfilePhoto() {
    try {
      return localStorage.getItem(PROFILE_PHOTO_KEY) || "";
    } catch {
      return "";
    }
  }

   async function saveProfilePhoto(url) {
    // 1) Save locally so it loads fast on this device
    try {
      if (!url) {
        localStorage.removeItem(PROFILE_PHOTO_KEY);
      } else {
        localStorage.setItem(PROFILE_PHOTO_KEY, url);
      }
    } catch {}

    // 2) Also push to the backend so other people can see it
    try {
      if (currentUser && currentUser.id) {
        await fetch(`${API_BASE}/api/profile-photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.id,
            photoData: url || "",
          }),
        });
      }
    } catch (err) {
      console.error("Profile photo upload error:", err);
      // We don't show an error to the user right now; local preview still works.
    }
  }


  function updateProfilePhotoPreview(url) {
    const preview = document.getElementById("profile-photo-preview");
    const img = document.getElementById("profile-photo-img");
    if (!preview || !img) return;

    if (!url) {
      preview.style.display = "none";
      img.src = "";
      return;
    }

    preview.style.display = "flex";
    img.src = url;
  }

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

  function getToken() {
    return localStorage.getItem("aboutme_token") || null;
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

  // If logged in, show greeting in header
  if (currentUser) {
    const authLink = document.querySelector('a[href="#auth"]');
    if (authLink && currentUser.name) {
      authLink.textContent = `Hi, ${currentUser.name}`;
    }
  }

  // ---------------------------------------
  // Update top-left site label (if found)
  // ---------------------------------------

  const brandEl = document.querySelector(
    ".brand, #brand, header .logo, .site-title"
  );
  if (brandEl) brandEl.textContent = "What Would They Say About Me?";

  // =======================================
  // TERMS / WAIVER MODAL (APPLIES TO AUTH)
  // =======================================

  const termsModal = document.getElementById("termsModal");
  const agreeCheckbox = document.getElementById("agreeCheckbox");
  const agreeBtn = document.getElementById("agreeBtn");

  let pendingAuthAction = null; // function to run after agreeing

  function hasAcceptedTerms() {
    return localStorage.getItem("termsAccepted") === "true";
  }

  function showTermsModalIfNeeded() {
    if (!termsModal) return;
    if (!hasAcceptedTerms()) {
      termsModal.style.display = "flex";
    }
  }

  if (agreeCheckbox && agreeBtn && termsModal) {
    // Enable/disable Agree button based on checkbox
    agreeCheckbox.addEventListener("change", () => {
      agreeBtn.disabled = !agreeCheckbox.checked;
    });

    // When user clicks "Agree & Continue"
    agreeBtn.addEventListener("click", () => {
      if (!agreeCheckbox.checked) return;

      localStorage.setItem("termsAccepted", "true");
      termsModal.style.display = "none";

      // Resume whatever auth action was blocked
      if (pendingAuthAction) {
        const action = pendingAuthAction;
        pendingAuthAction = null;
        action();
      }
    });
  }

  // ---------------------------------------
  // Invite link generation
  // ---------------------------------------

  const shareNameInput = document.getElementById("share-name");
  // Prefill share-name with logged-in user's name if available
  if (shareNameInput && currentUser && currentUser.name) {
    shareNameInput.value = currentUser.name;
    shareNameInput.readOnly = true; // prevent changing it to something random
  }

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
  // Handle Invite Links (?to=...)
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
  const tributeFromInput = document.getElementById("tribute-from");
  const tributePublicInput = document.getElementById("tribute-public");

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
  // Save tribute  (POST /api/tributes)
  // ---------------------------------------

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
      const isPublic = tributePublicInput ? !!tributePublicInput.checked : true;

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
            isPublic,
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
  // Signup (gated by Terms)
  // ---------------------------------------

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();

      // If terms not accepted yet, show modal and remember this action
      if (!hasAcceptedTerms()) {
        pendingAuthAction = () => doSignup();
        showTermsModalIfNeeded();
        return;
      }

      doSignup();
    });
  }

  async function doSignup() {
    const nameEl = document.getElementById("username");
    const emailEl = document.getElementById("email");
    const passEl = document.getElementById("password");
    const msg = document.getElementById("signup-message");

    const name = nameEl ? nameEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim() : "";
    const password = passEl ? passEl.value : "";

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
        setStatus(msg, (data && data.error) || "Signup failed.", "salmon");
      }
    } catch {
      setStatus(document.getElementById("signup-message"), "Server error.", "salmon");
    }
  }

  // ---------------------------------------
  // Login (gated by Terms)
  // ---------------------------------------

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!hasAcceptedTerms()) {
        pendingAuthAction = () => doLogin();
        showTermsModalIfNeeded();
        return;
      }

      doLogin();
    });
  }

  async function doLogin() {
    const emailEl = document.getElementById("login-user");
    const passEl = document.getElementById("login-pass");
    const msg = document.getElementById("login-message");

    const email = emailEl ? emailEl.value.trim() : "";
    const password = passEl ? passEl.value : "";

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
        setStatus(msg, (data && data.error) || "Login failed.", "salmon");
      }
    } catch {
      setStatus(document.getElementById("login-message"), "Server error.", "salmon");
    }
  }

  // ---------------------------------------
  // My Tributes (GET /api/my-tributes)
  // ---------------------------------------

  const tributesListEl = document.getElementById("tributes-list");
  const tributesLoading = document.getElementById("tributes-loading");
  const tributesError = document.getElementById("tributes-error");

  if (tributesListEl && tributesLoading && tributesError) {
    (async function loadMyTributes() {
      tributesLoading.style.display = "block";

      const token = getToken();

      if (!currentUser || !currentUser.id) {
        tributesLoading.style.display = "none";
        tributesError.style.display = "block";
        tributesError.textContent = "Log in to see your tributes.";
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/api/my-tributes?userId=${encodeURIComponent(
            currentUser.id
          )}`,
          {
            method: "GET",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        const data = await safeJson(res);

        tributesLoading.style.display = "none";

        if (!data || !data.ok) {
          tributesError.style.display = "block";
          tributesError.textContent =
            (data && data.error) || "Could not load tributes.";
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

  const msg = document.createElement("p");
  msg.textContent = t.message;

  const meta = document.createElement("p");
  meta.className = "small-note";
  if (t.createdAt) {
    meta.textContent = new Date(t.createdAt).toLocaleString();
  }

  // Privacy label
  if (t.isPublic === false) {
    const privacy = document.createElement("p");
    privacy.className = "small-note";
    privacy.textContent = "Private tribute (only visible to you)";
    card.appendChild(privacy);
  }

  card.appendChild(fromLine);
  card.appendChild(msg);
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
  // Simple feedback button (fb-*)
  // ---------------------------------------

  const fbEmail = document.getElementById("fb-email");
  const fbMessage = document.getElementById("fb-message");
  const fbSend = document.getElementById("fb-send");
  const fbStatus = document.getElementById("fb-status");

  if (fbSend) {
    fbSend.addEventListener("click", async () => {
      const email = fbEmail ? fbEmail.value.trim() : "";
      const message = fbMessage ? fbMessage.value.trim() : "";

      if (!message) {
        fbStatus.textContent = "Please enter a message.";
        fbStatus.style.color = "salmon";
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
          fbStatus.textContent = "Thanks for your feedback!";
          fbStatus.style.color = "lightgreen";
          if (fbMessage) fbMessage.value = "";
        } else {
          fbStatus.textContent =
            (data && data.error) || "Error sending feedback.";
          fbStatus.style.color = "salmon";
        }
      } catch (err) {
        fbStatus.textContent = "Server error. Try again later.";
        fbStatus.style.color = "salmon";
      }
    });
  }

  // ---------------------------------------
  // Optional FEEDBACK FORM (feedback-form)
  // ---------------------------------------

  const feedbackForm = document.getElementById("feedback-form");
  const feedbackEmail = document.getElementById("feedback-email");
  const feedbackMessage = document.getElementById("feedback-message");
  const feedbackStatus = document.getElementById("feedback-status");

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = feedbackEmail ? feedbackEmail.value.trim() : "";
      const message = feedbackMessage ? feedbackMessage.value.trim() : "";

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
            (data && data.error) || "Could not send feedback.",
            "salmon"
          );
        }
      } catch {
        setStatus(
          feedbackStatus,
          "Server error. Try again later.",
          "salmon"
        );
      }
    });
  }

  // ---------------------------------------
  // DELETE ACCOUNT (frontend wiring)
  // ---------------------------------------

  const deleteBtn = document.getElementById("delete-account");
  const deleteStatus = document.getElementById("delete-status");

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!currentUser || !currentUser.id) {
        if (deleteStatus) {
          deleteStatus.textContent =
            "You need to be logged in to delete your account.";
          deleteStatus.style.color = "salmon";
        }
        return;
      }

      const sure = window.confirm(
        "This will delete your account and tributes written for you. This cannot be undone. Continue?"
      );
      if (!sure) return;

      try {
        const res = await fetch(`${API_BASE}/api/account`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id }),
        });

        const data = await safeJson(res);

        if (data && data.ok) {
          localStorage.removeItem("aboutme_user");
          localStorage.removeItem("aboutme_token");
          if (deleteStatus) {
            deleteStatus.textContent = "Account deleted.";
            deleteStatus.style.color = "lightgreen";
          }
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          if (deleteStatus) {
            deleteStatus.textContent =
              (data && data.error) || "Could not delete account.";
            deleteStatus.style.color = "salmon";
          }
        }
      } catch (err) {
        console.error(err);
        if (deleteStatus) {
          deleteStatus.textContent = "Server error. Try again later.";
          deleteStatus.style.color = "salmon";
        }
      }
    });
  }
    // ---------------------------------------
  // PROFILE PHOTO (local-only)
  // ---------------------------------------

  const photoInput = document.getElementById("profile-photo-url");
  const photoFileInput = document.getElementById("profile-photo-file");
  const photoSaveBtn = document.getElementById("profile-photo-save");
  const photoStatus = document.getElementById("profile-photo-status");

  // Load any existing photo on page load
  const existingPhoto = loadProfilePhoto();
  if (existingPhoto) {
    if (photoInput) photoInput.value = existingPhoto.startsWith("data:")
      ? ""
      : existingPhoto; // if it's a URL, show it; if it's a data URL, leave field blank
    updateProfilePhotoPreview(existingPhoto);
  }

  // Handle file upload
  if (photoFileInput) {
    photoFileInput.addEventListener("change", () => {
      const file = photoFileInput.files && photoFileInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setStatus(photoStatus, "Please choose an image file.", "salmon");
        photoFileInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        saveProfilePhoto(dataUrl);
        updateProfilePhotoPreview(dataUrl);
        setStatus(photoStatus, "Photo uploaded on this device.", "lightgreen");
      };
      reader.onerror = () => {
        setStatus(photoStatus, "Could not read file.", "salmon");
      };

      reader.readAsDataURL(file);
    });
  }

  // Handle manual URL save
  if (photoSaveBtn && photoInput) {
    photoSaveBtn.addEventListener("click", () => {
      const url = photoInput.value.trim();

      if (!url) {
        saveProfilePhoto("");
        updateProfilePhotoPreview("");
        setStatus(photoStatus, "Photo cleared.", "lightgreen");
        return;
      }

      saveProfilePhoto(url);
      updateProfilePhotoPreview(url);
      setStatus(photoStatus, "Photo saved on this device.", "lightgreen");
    });
  }

  // ---------------------------------------
  // LOG OUT BUTTON
  // ---------------------------------------

  const logoutBtn = document.getElementById("logout");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Clear the keys this app actually uses
      localStorage.removeItem("aboutme_user");
      localStorage.removeItem("aboutme_token");
      // (We intentionally keep termsAccepted so they don't have to re-agree)
      window.location.reload();
    });
  }

  // If you ever want to auto-show the terms on first visit, you could do:
  // if (!hasAcceptedTerms()) showTermsModalIfNeeded();
})();
