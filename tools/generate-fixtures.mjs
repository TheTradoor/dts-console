import {writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {makePacket} from '../dist/protocol.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = process.argv[2];
if (!upstream) throw new Error('Pass the path to the pinned upstream checkout.');
const nonce = 'EdmxWPmx2WH6WgFfTdu9xfkYf3k1g5wD1zccTVySEEh1';
const fields = {
  recipient: 'GyGKxMyg1p9SsHfm15MkNUu1u9TN2JtTspcdmrtGUdse',
  lamports: 5000n, blockhash: '4MmDg5J4tczojAmQhip5uMZ9Yug9TpTwraa7g5s7n5BT'
};
for (const [name, nonceAccount] of [['fixture', null], ['nonce-fixture', nonce]]) {
  const packet = {...await makePacket({...fields, nonceAccount}), fixtureNonceAccount: nonce};
  const session = root + 'dist/' + name + '-session.json';
  await writeFile(session, JSON.stringify(packet, null, 2) + '\n');
  const execution = spawnSync('python3', [root + 'tools/sign_fixture.py', session, '--upstream', upstream,
    '--output', root + 'dist/' + name + '-result.json'], {encoding: 'utf8', timeout: 60000});
  if (execution.status !== 0) throw new Error(execution.stderr || execution.stdout);
  process.stdout.write(execution.stdout);
}
