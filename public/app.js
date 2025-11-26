// app.js

function scrollToAuth() {
  const el = document.getElementById("auth");
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

function fakeSignup(e) {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const messageEl = document.getElementById("signup-message");

  if (!username) {
    messageEl.textContent = "Please add a username to continue.";
    messageEl.style.color = "#fecaca";
    return;
  }

  // This is just a front-end placeholder. Later, we’ll POST to an API.
  messageEl.textContent = `Thanks, ${username}. Your About Me page is coming soon.`;
  messageEl.style.color = "#a7f3d0";
}

document.getElementById("year").textContent = new Date().getFullYear();
