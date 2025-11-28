// ---------------------------
// Basic helpers
// ---------------------------

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
    const base =
      window.location.origin + window.location.pathname;
    const url =
      `${base}?to=${encodeURIComponent(name)}#write`;

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
      writeToLine.textContent =
        `You’re writing a message for ${name}. Share from the heart.`;
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
  const inviteBanner = document.getElementById("invite-banner");
  const writeToLine = document.getElementById("write-to-line");

  if (inviteBanner) {
    inviteBanner.style.display = "block";
    inviteBanner.textContent =
      `You’ve been invited to write a message for ${name}. Scroll down to share what they mean to you.`;
  }

  if (writeToLine) {
    writeToLine.textContent =
      `You’re writing a message for ${name}. Share from the heart.`;
  }

  // Optionally scroll to the write section
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
          "Message copied. Paste it into a text, email, or DM to
