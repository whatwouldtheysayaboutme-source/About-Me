// ---------------------------
// Basic helpers
// ---------------------------

// Who the message is for (comes from ?to= in the URL)
let currentInviteName = null;

// Base URL for the Node/Express API on Render
const API_BASE = "https://about-me-api-9m4q.onrender.com";

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
      shareStatu
