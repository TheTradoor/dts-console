// Host-side review policy only. This is not the pending on-device policy parser.
// No private key input, network RPC, or transaction broadcast is implemented.
import {hashBytes, verifySignature} from './crypto.mjs';
export const UPSTREAM = 'a7cbac2ed7093a3cd994c4b7f1109396cd1d2faf';
export const TEST_PUBLIC_HEX = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
export const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const SYSTEM = new Uint8Array(32);
export const SYSVAR = 'SysvarRecentB1ockHashes11111111111111111111';
const te = new TextEncoder();
const MAX64 = (1n << 64n) - 1n;
function requireThat(condition, reason) { if (!condition) throw new Error(reason); }
export function hex(bytes) { return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join(''); }
export function unhex(value, length) {
  requireThat(typeof value === 'string' && value.length % 2 === 0 && /^[a-fA-F0-9]*$/.test(value), 'Invalid hexadecimal data.');
  requireThat(value.length <= 8192, 'Hexadecimal input exceeds the size limit.');
  const out = Uint8Array.from(value.match(/../g) || [], b => parseInt(b, 16));
  if (length !== undefined) requireThat(out.length === length, 'Unexpected byte length.');
  return out;
}
export function equal(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }
export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0; for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
export function b58encode(bytes) {
  let number = 0n; for (const byte of bytes) number = number * 256n + BigInt(byte);
  let result = ''; while (number) { result = ALPHABET[Number(number % 58n)] + result; number /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
  return result;
}
export function b58decode(text, length = 32) {
  requireThat(typeof text === 'string' && text.length > 0 && text.length <= 100, 'Enter a valid base58 address.');
  let number = 0n;
  for (const char of text) {
    const index = ALPHABET.indexOf(char); requireThat(index >= 0, 'Address contains an invalid base58 character.');
    number = number * 58n + BigInt(index);
  }
  const bytes = []; while (number) { bytes.unshift(Number(number & 255n)); number >>= 8n; }
  for (const char of text) { if (char !== '1') break; bytes.unshift(0); }
  const result = Uint8Array.from(bytes);
  requireThat(result.length === length && b58encode(result) === text, 'Address must encode exactly ' + length + ' bytes.');
  return result;
}
export const TEST_ADDRESS = b58encode(unhex(TEST_PUBLIC_HEX, 32));
export function amountToLamports(value) {
  requireThat(typeof value === 'string' && /^(0|[1-9][0-9]*)(\.[0-9]{1,9})?$/.test(value), 'Use a positive SOL amount with at most 9 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 1000000000n + BigInt(fraction.padEnd(9, '0'));
  requireThat(amount > 0n && amount <= MAX64, 'Amount must be positive and fit an unsigned 64-bit integer.');
  return amount;
}
export function formatSol(lamports) {
  const n = BigInt(lamports); const fraction = (n % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '');
  return (n / 1000000000n).toString() + (fraction ? '.' + fraction : '');
}
export function shortvec(number) {
  requireThat(Number.isInteger(number) && number >= 0 && number <= 65535, 'Invalid compact-u16.');
  const result = []; do { const byte = number & 127; number >>>= 7; result.push(byte | (number ? 128 : 0)); } while (number);
  return Uint8Array.from(result);
}
function le64(number) {
  requireThat(number > 0n && number <= MAX64, 'Invalid transfer amount.');
  const bytes = new Uint8Array(8); new DataView(bytes.buffer).setBigUint64(0, number, true); return bytes;
}
function instruction(program, accounts, data) {
  return concat(Uint8Array.of(program), shortvec(accounts.length), Uint8Array.from(accounts), shortvec(data.length), data);
}
export function buildMessage({recipient, lamports, blockhash, nonceAccount = null}) {
  const from = unhex(TEST_PUBLIC_HEX, 32), to = b58decode(recipient);
  const recent = b58decode(blockhash), nonce = nonceAccount ? b58decode(nonceAccount) : null;
  const keys = nonce ? [from, nonce, to, b58decode(SYSVAR), SYSTEM] : [from, to, SYSTEM];
  requireThat(new Set(keys.map(hex)).size === keys.length, 'All account addresses must be distinct.');
  const transfer = concat(Uint8Array.of(2, 0, 0, 0), le64(BigInt(lamports)));
  const ixs = nonce
    ? [instruction(4, [1, 3, 0], Uint8Array.of(4, 0, 0, 0)), instruction(4, [0, 2], transfer)]
    : [instruction(2, [0, 1], transfer)];
  return concat(Uint8Array.of(1, 0, nonce ? 2 : 1), shortvec(keys.length), ...keys, recent, shortvec(ixs.length), ...ixs);
}
export function parseMessage(bytes) {
  requireThat(bytes instanceof Uint8Array && bytes.length <= 1167, 'Unsupported legacy message size.');
  let offset = 0;
  const take = count => {
    requireThat(offset + count <= bytes.length, 'Truncated message.');
    const result = bytes.slice(offset, offset + count); offset += count; return result;
  };
  const compact = () => {
    const start = offset; let n = 0;
    for (let i = 0; i < 3; i++) {
      const b = take(1)[0]; n += (b & 127) * 2 ** (7 * i);
      requireThat(n <= 65535, 'Compact-u16 overflow.');
      if (!(b & 128)) {
        requireThat(equal(bytes.slice(start, offset), shortvec(n)), 'Noncanonical compact-u16.');
        return n;
      }
    }
    throw new Error('Invalid compact-u16.');
  };
  const header = take(3);
  requireThat(header[0] === 1 && header[1] === 0, 'Only one-signer legacy transfers are supported.');
  const keyCount = compact();
  requireThat(keyCount === 3 || keyCount === 5, 'Unsupported account layout.');
  const keys = Array.from({length: keyCount}, () => take(32));
  requireThat(new Set(keys.map(hex)).size === keys.length, 'Duplicate account addresses.');
  requireThat(hex(keys[0]) === TEST_PUBLIC_HEX, 'This build accepts only its published test signer.');
  const blockhash = take(32), count = compact();
  requireThat(count === (keyCount === 5 ? 2 : 1), 'Unsupported instruction count.');
  const ixs = Array.from({length: count}, () => {
    const program = take(1)[0], accountCount = compact();
    requireThat(accountCount <= 5, 'Too many instruction accounts.');
    const accounts = take(accountCount), dataLength = compact();
    requireThat(dataLength <= 12, 'Unsupported instruction data length.');
    return {program, accounts, data: take(dataLength)};
  });
  requireThat(offset === bytes.length, 'Trailing bytes are not allowed.');
  const nonce = keyCount === 5;
  requireThat(header[2] === (nonce ? 2 : 1), 'Incorrect account permissions.');
  requireThat(equal(keys[keyCount - 1], SYSTEM), 'Only the System Program is allowed.');
  if (nonce) {
    requireThat(equal(keys[3], b58decode(SYSVAR)), 'Incorrect nonce sysvar.');
    requireThat(ixs[0].program === 4 && equal(ixs[0].accounts, Uint8Array.of(1, 3, 0)) &&
      equal(ixs[0].data, Uint8Array.of(4, 0, 0, 0)), 'Invalid nonce-advance instruction.');
  }
  const transfer = ixs.at(-1);
  requireThat(transfer.program === (nonce ? 4 : 2) &&
    equal(transfer.accounts, Uint8Array.of(0, nonce ? 2 : 1)) &&
    transfer.data.length === 12 && equal(transfer.data.slice(0, 4), Uint8Array.of(2, 0, 0, 0)), 'Unsupported transfer instruction.');
  const lamports = new DataView(transfer.data.buffer, transfer.data.byteOffset + 4, 8).getBigUint64(0, true);
  requireThat(lamports > 0n, 'Zero-value transfers are not supported.');
  return Object.freeze({kind: nonce ? 'durable-nonce-transfer' : 'legacy-transfer', from: b58encode(keys[0]),
    recipient: b58encode(keys[nonce ? 2 : 1]), lamports: lamports.toString(), amountSol: formatSol(lamports),
    blockhash: b58encode(blockhash), nonceAccount: nonce ? b58encode(keys[1]) : null, messageBytes: bytes.length});
}
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function envelope(message) {
  const body = concat(te.encode('DTS02IN1'), Uint8Array.of(0, 0, message.length & 255, message.length >> 8),
    unhex(TEST_PUBLIC_HEX, 32), message);
  const checksum = new Uint8Array(4); new DataView(checksum.buffer).setUint32(0, crc32(body), true);
  return concat(body, checksum);
}
export async function digest(name, bytes) { return hex(hashBytes(name, bytes)); }
export async function makePacket(fields) {
  const message = buildMessage(fields), review = parseMessage(message);
  return Object.freeze({
    schema: 'dts-console-session-v1', network: 'fixture-only', upstreamCommit: UPSTREAM,
    profile: 0, expectedPublicKeyHex: TEST_PUBLIC_HEX, messageHex: hex(message),
    messageSha256: await digest('SHA-256', message), messageSha512: await digest('SHA-512', message),
    envelopeHex: hex(envelope(message)), review
  });
}
export async function validatePacket(packet) {
  requireThat(packet && packet.schema === 'dts-console-session-v1' && packet.network === 'fixture-only', 'Unsupported session format or network.');
  requireThat(packet.profile === 0 && packet.expectedPublicKeyHex === TEST_PUBLIC_HEX, 'Only public test profile 0 is enabled.');
  requireThat(packet.upstreamCommit === UPSTREAM, 'Unsupported upstream version.');
  const message = unhex(packet.messageHex), review = parseMessage(message);
  requireThat(packet.messageSha256 === await digest('SHA-256', message), 'Session digest does not match the message.');
  requireThat(packet.messageSha512 === await digest('SHA-512', message), 'Session SHA-512 does not match the message.');
  requireThat(packet.envelopeHex === hex(envelope(message)), 'Envelope does not match the frozen message.');
  requireThat(packet.review && Object.keys(packet.review).length === Object.keys(review).length, 'Review metadata is incomplete.');
  for (const [key, value] of Object.entries(review)) requireThat(packet.review[key] === value, 'Review metadata does not match the message: ' + key);
  return {message, review};
}
export function readRecord(record) {
  requireThat(record.length === 256, 'The DTS result must contain exactly 256 bytes.');
  requireThat(equal(record.slice(0, 8), te.encode('DTS02OUT')), 'Invalid DTS result magic.');
  requireThat(record[8] === 1 && record[9] === 0, 'Unsupported result version or profile.');
  requireThat(record.slice(176).every(x => x === 0), 'Reserved result bytes must be zero.');
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
  requireThat(view.getUint32(172, true) === crc32(record.slice(0, 172)), 'Result CRC does not match.');
  return {length: view.getUint16(10, true), publicKey: record.slice(12, 44),
    signature: record.slice(44, 108), sha512: hex(record.slice(108, 172))};
}
export async function verifyResult(packet, result) {
  const {message, review} = await validatePacket(packet);
  requireThat(result && result.schema === 'dts-console-result-v1', 'Unsupported result format.');
  requireThat(result.sessionSha256 === packet.messageSha256, 'This result belongs to a different session.');
  const recordBytes = unhex(result.recordHex, 256), record = readRecord(recordBytes);
  requireThat(record.length === message.length && hex(record.publicKey) === TEST_PUBLIC_HEX, 'Result key or message length does not match.');
  requireThat(record.sha512 === packet.messageSha512, 'Result is bound to different message bytes.');
  requireThat(await verifySignature(record.publicKey, message, record.signature), 'Ed25519 signature verification failed.');
  return {verified: true, review, signatureHex: hex(record.signature), recordCrc32: crc32(recordBytes.slice(0, 172)).toString(16).padStart(8, '0'),
    messageSha256: packet.messageSha256, messageSha512: packet.messageSha512, publicKey: TEST_ADDRESS};
}
export function reviewPages(packet) {
  const r = packet.review;
  const fields = [
    {id: '01', title: 'Source address', bytes: b58decode(r.from)},
    {id: '02', title: 'Recipient address', bytes: b58decode(r.recipient)},
    {id: '03', title: 'Amount · integer lamports', bytes: le64(BigInt(r.lamports))}
  ];
  if (r.nonceAccount) fields.push({id: '04', title: 'Nonce account', bytes: b58decode(r.nonceAccount)});
  fields.push({id: '05', title: 'Message SHA-512', bytes: unhex(packet.messageSha512, 64)});
  const pages = [];
  for (const f of fields) for (let offset = 0; offset < f.bytes.length; offset += 8) {
    pages.push({field: f.id, title: f.title, page: offset / 8 + 1, total: Math.ceil(f.bytes.length / 8),
      headerHex: 'f1' + f.id + (offset / 8).toString(16).padStart(2, '0') + Math.ceil(f.bytes.length / 8).toString(16).padStart(2, '0'),
      dataHex: hex(f.bytes.slice(offset, offset + 8))});
  }
  return pages;
}
