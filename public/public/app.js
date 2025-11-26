const form = document.getElementById("message-form");
const statusEl = document.getElementById("form-status");
const messagesList = document.getElementById("messages-list");

async function fetchMessages() {
  messagesList.innerHTML = "<p>Loading messages...</p>";
  try {
    const res = await fetch("/api/messages");
    const data = await res.json();
    if (!Array.isArray(data)) {
      messagesList.innerHTML = "<p>Unable to load messages.</p>";
      return;
    }
    if (data.length === 0) {
      messagesList.innerHTML =
        "<p>No messages yet. Be the first to write one.</p>";
      return;
    }

    messagesList.innerHTML = "";
    data.forEach(renderMessage);
  } catch (err) {
    console.error(err);
    messagesList.innerHTML = "<p>Error loading messages.</p>";
  }
}

function renderMessage(msg) {
  const card = document.createElement("div");
  card.className = "message-card";

  const header = document.createElement("div");
  header.className = "message-header";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = msg.name;

  const rightSide = document.createElement("div");

  if (msg.relation) {
    const rel = document.createElement("div");
    rel.className = "message-relation";
    rel.textContent = msg.relation;
    rightSide.appendChild(rel);
  }

  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = new Date(msg.createdAt).toLocaleString();
  rightSide.appendChild(time);

  header.appendChild(name);
  header.appendChild(rightSide);

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = msg.text;

  card.appendChild(header);
  card.appendChild(text);

  messagesList.appendChild(card);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "status";

  const name = document.getElementById("name").value.trim();
  const relation = document.getElementById("relation").value.trim();
  const text = document.getElementById("text").value.trim();

  if (!name || !text) {
    statusEl.textContent = "Please fill in your name and message.";
    statusEl.classList.add("error");
    return;
  }

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, relation, text })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to post message.");
    }

    document.getElementById("name").value = "";
    document.getElementById("relation").value = "";
    document.getElementById("text").value = "";

    statusEl.textContent = "Message posted.";
    statusEl.classList.add("success");

    await fetchMessages();
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Error posting message.";
    statusEl.classList.add("error");
  }
});

// Initial load
fetchMessages();
