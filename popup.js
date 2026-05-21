const dot        = document.getElementById('dot');
const statusText = document.getElementById('status-text');
const btnConnect    = document.getElementById('btn-connect');
const btnCheck      = document.getElementById('btn-check');
const btnDisconnect = document.getElementById('btn-disconnect');

function setStatus(state, text) {
  dot.className = `dot ${state}`;
  statusText.textContent = text;
}

function send(type) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type }, resolve));
}

async function refresh() {
  setStatus('yellow', 'Checking…');
  const { signedIn } = await send('get-status');

  if (signedIn) {
    setStatus('green', 'Connected — checking every minute');
    btnConnect.style.display    = 'none';
    btnCheck.style.display      = 'block';
    btnDisconnect.style.display = 'block';
  } else {
    setStatus('red', 'Not connected to Google Calendar');
    btnConnect.style.display    = 'block';
    btnCheck.style.display      = 'none';
    btnDisconnect.style.display = 'none';
  }
}

btnConnect.addEventListener('click', async () => {
  btnConnect.disabled = true;
  setStatus('yellow', 'Signing in…');
  const result = await send('sign-in');
  if (result?.ok) {
    await refresh();
    send('check-now');
  } else {
    setStatus('red', result?.error || 'Sign-in failed');
    btnConnect.disabled = false;
  }
});

btnCheck.addEventListener('click', async () => {
  btnCheck.disabled = true;
  btnCheck.textContent = 'Checking…';
  await send('check-now');
  btnCheck.disabled = false;
  btnCheck.textContent = 'Check now';
});

btnDisconnect.addEventListener('click', async () => {
  await send('sign-out');
  await refresh();
});

document.getElementById('options-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById('reset-link').addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.storage.local.remove('meetingState');
  statusText.textContent = 'Meeting state reset.';
  setTimeout(refresh, 1500);
});

refresh();
