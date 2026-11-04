// Separate JavaScript decoder used by the firmware differential test corpus.
import { readFileSync } from 'node:fs';
import { parseMessage } from '../dist/protocol.mjs';

const inputs = JSON.parse(readFileSync(0, 'utf8'));
const results = inputs.map(hex => {
  try { return { accepted: true, review: parseMessage(Uint8Array.from(Buffer.from(hex, 'hex'))) }; }
  catch { return { accepted: false }; }
});
process.stdout.write(JSON.stringify(results));
