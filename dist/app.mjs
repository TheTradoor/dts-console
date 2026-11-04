import {TEST_ADDRESS, amountToLamports, makePacket, validatePacket, verifyResult, reviewPages} from './protocol.mjs';
const $ = id => document.getElementById(id);
const titles = {prepare: 'Prepare transaction', review: 'Review session', verify: 'Verify result', readiness: 'Build readiness'};
let current = null, pages = [], pageIndex = 0, viewed = new Set(), verification = null, generation = 0;
let fixturePacket = null, fixtureResult = null, toastTimer;

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}
function show(view) {
  if (!titles[view]) return;
  for (const key of Object.keys(titles)) $(key + '-view').hidden = key !== view;
  document.querySelectorAll('.nav-item[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('breadcrumb').textContent = titles[view];
  history.replaceState(null, '', '#' + view);
  window.scrollTo({top: 0, behavior: 'instant'});
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => show(button.dataset.view)));
function download(name, object) {
  const blob = new Blob([JSON.stringify(object, null, 2) + '\n'], {type: 'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function resetVerification() {
  verification = null; $('verify-error').hidden = true; $('verify-success').hidden = true;
  $('verification-list').hidden = false;
  $('verify-state').textContent = 'AWAITING RESULT';
  $('verification-list').querySelectorAll('div').forEach(row => {
    row.className = 'pending-check'; row.firstChild.textContent = '○';
  });
}
function invalidate() {
  generation++; current = null; pages = []; viewed.clear(); resetVerification();
  $('review-content').hidden = true; $('review-empty').hidden = false;
  $('review-ack').checked = false; $('review-ack').disabled = true; $('export-session').disabled = true;
  $('form-error').hidden = true;
}
function appendField(container, label, value, big = false) {
  const dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = label; dd.textContent = value; if (big) dd.className = 'big-amount';
  container.append(dt, dd);
}
function renderPage() {
  const p = pages[pageIndex]; if (!p) return;
  if (p.field === '02') viewed.add(p.page);
  $('page-title').textContent = p.title;
  $('page-header').textContent = 'HEADER ' + p.headerHex.toUpperCase() + ' · FIELD ' + p.field;
  $('review-led').textContent = p.dataHex.match(/.{1,4}/g).join(' ');
  $('page-number').textContent = p.page + ' / ' + p.total;
  $('previous-page').disabled = pageIndex === 0;
  $('next-page').disabled = pageIndex === pages.length - 1;
  $('recipient-progress').textContent = 'Recipient review: ' + viewed.size + ' / 4 pages visited.';
  $('review-ack').disabled = viewed.size !== 4;
  $('export-session').disabled = viewed.size !== 4 || !$('review-ack').checked;
}
function adoptPacket(packet) {
  current = structuredClone(packet); Object.freeze(current.review); Object.freeze(current);
  pages = reviewPages(current); pageIndex = 0; viewed = new Set(); resetVerification();
  $('review-empty').hidden = true; $('review-content').hidden = false;
  $('session-id').textContent = current.messageSha256.slice(0, 16);
  $('message-size').textContent = current.review.messageBytes + ' MESSAGE BYTES · PROFILE 0';
  const target = $('decoded'); target.replaceChildren();
  appendField(target, 'Amount', current.review.amountSol + ' SOL', true);
  appendField(target, 'Integer lamports', current.review.lamports);
  appendField(target, 'Source · published test signer', current.review.from);
  appendField(target, 'Recipient · full address', current.review.recipient);
  appendField(target, 'Message format', current.review.kind);
  if (current.review.nonceAccount) appendField(target, 'Nonce account · fixture', current.review.nonceAccount);
  appendField(target, 'Blockhash / nonce value · fixture', current.review.blockhash);
  appendField(target, 'SHA-256 session identifier', current.messageSha256);
  $('message-hex').textContent = current.messageHex.match(/.{1,32}/g).join('\n');
  $('envelope-hex').textContent = current.envelopeHex.match(/.{1,32}/g).join('\n');
  $('review-ack').checked = false; renderPage();
}
async function readJsonFile(file) {
  if (!file || file.size > 16000) throw new Error('Choose a session/result JSON file smaller than 16 KB.');
  try { return JSON.parse(await file.text()); } catch { throw new Error('The selected file is not valid JSON.'); }
}
async function fixtures() {
  if (!fixturePacket || !fixtureResult) {
    const responses = await Promise.all([fetch('./fixture-session.json'), fetch('./fixture-result.json')]);
    if (!responses.every(r => r.ok)) throw new Error('The verified fixture could not be loaded.');
    [fixturePacket, fixtureResult] = await Promise.all(responses.map(r => r.json()));
  }
  return {packet: fixturePacket, result: fixtureResult};
}
$('source').value = TEST_ADDRESS;
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($(button.dataset.copy).value); toast('Address copied.'); }
  catch { toast('Clipboard unavailable. Select and copy the address manually.'); }
}));
$('prepare-form').addEventListener('input', () => {
  invalidate();
  try { $('lamports-preview').textContent = amountToLamports($('amount').value).toLocaleString('en-US') + ' lamports · integer precision'; }
  catch { $('lamports-preview').textContent = 'Enter a positive amount with up to 9 decimal places.'; }
});
$('prepare-form').addEventListener('submit', async event => {
  event.preventDefault(); invalidate(); const token = generation;
  $('prepare-button').disabled = true;
  try {
    const {packet: reference} = await fixtures();
    const nonce = document.querySelector('input[name=format]:checked').value === 'nonce';
    const packet = await makePacket({recipient: $('recipient').value.trim(), lamports: amountToLamports($('amount').value),
      blockhash: reference.review.blockhash, nonceAccount: nonce ? reference.fixtureNonceAccount : null});
    if (token !== generation) return;
    adoptPacket(packet); show('review');
  } catch (error) {
    if (token === generation) { $('form-error').textContent = error.message; $('form-error').hidden = false; }
  } finally { $('prepare-button').disabled = false; }
});
$('load-example').addEventListener('click', async () => {
  const token = ++generation;
  try {
    const {packet} = await fixtures(); await validatePacket(packet);
    if (token !== generation) return;
    $('recipient').value = packet.review.recipient; $('amount').value = packet.review.amountSol;
    document.querySelector('input[name=format][value=legacy]').checked = true;
    $('lamports-preview').textContent = BigInt(packet.review.lamports).toLocaleString('en-US') + ' lamports · integer precision';
    adoptPacket(packet); show('review'); toast('Recorded firmware example loaded. Review its exact bytes.');
  } catch (error) { toast(error.message); }
});
$('previous-page').addEventListener('click', () => { if (pageIndex > 0) { pageIndex--; renderPage(); } });
$('next-page').addEventListener('click', () => { if (pageIndex < pages.length - 1) { pageIndex++; renderPage(); } });
$('review-ack').addEventListener('change', () => { $('export-session').disabled = viewed.size !== 4 || !$('review-ack').checked; });
$('export-session').addEventListener('click', () => {
  if (!current || viewed.size !== 4 || !$('review-ack').checked) return;
  download('dts-session.json', current); toast('Session exported. Run the emulator bridge, then import its result.');
});
$('import-session').addEventListener('click', () => $('session-file').click());
$('session-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  invalidate(); const token = generation;
  try {
    const packet = await readJsonFile(file); await validatePacket(packet);
    if (token !== generation) return;
    adoptPacket(packet); toast('Session imported. Review it before exporting.');
  } catch (error) { if (token === generation) toast('Session rejected: ' + error.message); }
  finally { event.target.value = ''; }
});
async function performVerification(result) {
  resetVerification();
  const token = generation, packet = current;
  try {
    if (!packet) throw new Error('Prepare or import a session first.');
    const checked = await verifyResult(packet, result);
    if (token !== generation || current !== packet) return;
    verification = checked;
    $('verify-state').textContent = 'VERIFIED';
    $('verification-list').querySelectorAll('div').forEach(row => {
      row.className = 'passed-check'; row.firstChild.textContent = '✓';
    });
    $('verify-success').hidden = false;
    const target = $('verified-details'); target.replaceChildren();
    appendField(target, 'Transfer', checked.review.amountSol + ' SOL');
    appendField(target, 'Recipient', checked.review.recipient);
    appendField(target, 'Message SHA-256', checked.messageSha256);
    appendField(target, 'Signature · Ed25519', checked.signatureHex);
  } catch (error) {
    if (token !== generation) return;
    $('verify-state').textContent = 'REJECTED';
    $('verify-error').textContent = error.message; $('verify-error').hidden = false;
  }
}
$('import-result').addEventListener('click', () => $('result-file').click());
$('result-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const token = ++generation; resetVerification();
  try {
    const result = await readJsonFile(file);
    if (token !== generation) return;
    await performVerification(result);
  } catch (error) { if (token === generation) { $('verify-error').textContent = error.message; $('verify-error').hidden = false; } }
  finally { event.target.value = ''; }
});
$('verify-example').addEventListener('click', async () => {
  const token = ++generation; resetVerification();
  try {
    const {packet, result} = await fixtures();
    if (token !== generation) return;
    if (!current) { await validatePacket(packet); if (token !== generation) return; adoptPacket(packet); }
    await performVerification(result);
  } catch (error) { toast(error.message); }
});
$('download-report').addEventListener('click', () => {
  if (verification) download('dts-verification-report.json', {
    schema: 'dts-console-verification-v1', verifiedAt: new Date().toISOString(),
    environment: 'public-fixture-only', ...verification,
    limitations: ['No trusted device review or authorization', 'No physical hardware validation', 'No blockchain submission or execution check']
  });
});
async function initialize() {
  try {
    const {packet, result} = await fixtures(); await validatePacket(packet);
    if (!$('recipient').value) $('recipient').value = packet.review.recipient;
    const cycles = result.evidence.cycles;
    $('cycle-count').textContent = cycles.toLocaleString('en-US') + ' CPU cycles for this ' +
      packet.review.messageBytes + '-byte fixture. Approximately ' + (cycles / 88000 / 3600).toFixed(2) +
      ' hours at 88 kHz; ' + (cycles / 47000 / 3600).toFixed(2) + ' hours at 47 kHz.';
    const response = await fetch('./validation.json');
    if (response.ok) {
      const report = await response.json();
      $('test-count').textContent = report.passed + ' passed';
      $('test-description').textContent = report.failed + ' failed · ' + report.recordedAt.slice(0, 10);
    }
  } catch (error) { toast(error.message); $('test-description').textContent = 'Validation report unavailable'; }
}
show(location.hash.slice(1) || 'prepare');
initialize();
