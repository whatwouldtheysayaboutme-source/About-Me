// Run once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setCurrentYear();
  setupShareLinkGenerator();
  setupInviteFlow();
  setupCopyTribute();
});

// Footer year
function setCurrentYear() {
  const span = document.getElementById('year');
  if (span) {
    span.textContent = new Date().getFullYear();
  }
}

// Generate a shareable invite link: ?to=friend&name=Bobby%20Britton
function setupShareLinkGenerator() {
  const nameInput = document.getElementById('share-name');
  const generateBtn = document.getElementById('share-generate');
  const result = document.getElementById('share-result');
  const urlInput = document.getElementById('share-url');
  const copyBtn = document.getElementById('share-copy');
  const status = document.getElementById('share-status');

  if (!nameInput || !generateBtn || !result || !urlInput || !copyBtn) return;

  generateBtn.addEventListener('click', () => {
    const rawName = nameInput.value.trim();
    if (!rawName) {
      alert('Please enter your name.');
      return;
    }

    const encodedName = encodeURIComponent(rawName);
    const base = window.location.origin + window.location.pathname;
    const link = `${base}?to=friend&name=${encodedName}`;

    urlInput.value = link;
    result.style.display = 'flex';
    if (status) status.textContent = 'Share this link with friends so they can write a message for you.';
  });

  copyBtn.addEventListener('click', () => {
    if (!urlInput.value) return;

    urlInput.select();
    urlInput.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(urlInput.value)
      .then(() => {
        if (status) status.textContent = 'Link copied – paste it into a text, email, or DM.';
      })
      .catch(() => {
        if (status) status.textContent = 'Could not copy automatically; you can copy the link manually.';
      });
  });
}

// Read ?to=friend&name=... from the URL
function parseInviteParams() {
  const params = new URLSearchParams(window.location.search);
  const to = params.get('to');
  const nameParam = params.get('name') || '';

  if (to !== 'friend') return null;

  const decoded = decodeURIComponent(nameParam);
  const safe = decoded.replace(/[<>]/g, ''); // basic XSS protection

  return safe || 'your friend';
}

// Show banner + personalize write section when visiting an invite link
function setupInviteFlow() {
  const safeName = parseInviteParams();
  if (!safeName) return;

  const banner = document.getElementById('invite-banner');
  const writeSection = document.getElementById('write');
  const writeLine = document.getElementById('write-to-line');

  if (writeLine) {
    writeLine.textContent = `You're writing a message for ${safeName}.`;
  }

  if (banner) {
    banner.innerHTML = `
      <p><strong>Hi, ${safeName}</strong> is inviting you to their About Me page.</p>
      <p>Here you can write what you would say in a eulogy – but they get to read it now.</p>
      <button id="invite-write-btn" class="btn small primary">Write your message</button>
    `;
    banner.style.display = 'block';

    const btn = document.getElementById('invite-write-btn');
    if (btn && writeSection) {
      btn.addEventListener('click', () => {
        writeSection.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }
}

// Copy the tribute text so the invitee can paste it into an email/text
function setupCopyTribute() {
  const textArea = document.getElementById('tribute-text');
  const copyBtn = document.getElementById('copy-tribute');
  const status = document.getElementById('tribute-status');

  if (!textArea || !copyBtn) return;

  copyBtn.addEventListener('click', () => {
    const value = textArea.value.trim();
    if (!value) {
      alert('Write a message first.');
      return;
    }

    textArea.select();
    textArea.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(value)
      .then(() => {
        if (status) {
          status.textContent = 'Message copied. Paste it into a text, email, or DM so they can read it.';
        }
      })
      .catch(() => {
        if (status) {
          status.textContent = 'Could not copy automatically; you can copy the text manually.';
        }
      });
  });
}
