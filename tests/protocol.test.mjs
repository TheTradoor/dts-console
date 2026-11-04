import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {hashBytes, verifySignature} from '../dist/crypto.mjs';
import {
  hex, unhex, equal, concat, b58encode, b58decode, TEST_ADDRESS, TEST_PUBLIC_HEX,
  amountToLamports, formatSol, shortvec, buildMessage, parseMessage, crc32, envelope,
  digest, makePacket, validatePacket, verifyResult, readRecord, reviewPages
} from '../dist/protocol.mjs';
const fixture = JSON.parse(await readFile(new URL('../dist/fixture-session.json', import.meta.url)));
const result = JSON.parse(await readFile(new URL('../dist/fixture-result.json', import.meta.url)));
const nonce = JSON.parse(await readFile(new URL('../dist/nonce-fixture-session.json', import.meta.url)));
const nonceResult = JSON.parse(await readFile(new URL('../dist/nonce-fixture-result.json', import.meta.url)));
const copy = x => structuredClone(x);
const fields = {recipient: fixture.review.recipient, lamports: 5000n, blockhash: fixture.review.blockhash};
test('base58: leading zeroes and 64 deterministic addresses round-trip', () => {
  for (let i = 0; i < 64; i++) {
    const raw = Uint8Array.from({length:32}, (_,j) => j < i % 8 ? 0 : (i*17+j*9)&255);
    assert.deepEqual(b58decode(b58encode(raw)), raw);
  }
  assert.deepEqual(b58decode('1'.repeat(32)), new Uint8Array(32));
});
test('base58: invalid alphabet, whitespace, overflow and wrong lengths rejected', () => {
  for (const address of ['', '0'.repeat(44), '1'.repeat(31), '1'.repeat(33), 'z'.repeat(100), ' '+TEST_ADDRESS, TEST_ADDRESS+'\n']) {
    assert.throws(() => b58decode(address));
  }
});
test('SOL amounts remain exact beyond Number.MAX_SAFE_INTEGER', () => {
  assert.equal(amountToLamports('0.000000001'),1n);
  assert.equal(amountToLamports('9007199.254740993'),9007199254740993n);
  assert.equal(amountToLamports('18446744073.709551615'),(1n<<64n)-1n);
  assert.equal(formatSol(9007199254740993n),'9007199.254740993');
});
test('ambiguous amounts, negatives, zero and u64 overflow are rejected', () => {
  for (const value of ['0','-1','+1','01','1e2','1.0000000001','1.',' 1','NaN','18446744073.709551616']) assert.throws(()=>amountToLamports(value));
});
test('standard CRC-32 known-answer vector', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
});
test('legacy transfer is 150 bytes and decodes all fields from the message', async () => {
  const packet = await makePacket(fields);
  assert.equal(packet.review.messageBytes,150);
  assert.equal(packet.review.lamports,'5000');
  assert.equal(packet.messageHex,fixture.messageHex);
  assert.deepEqual((await validatePacket(packet)).review, fixture.review);
});
test('durable nonce preserves exact advance, account and transfer layout', async () => {
  const packet = await makePacket({...fields, nonceAccount: nonce.review.nonceAccount});
  assert.equal(packet.messageHex,nonce.messageHex);
  assert.equal(packet.review.messageBytes,224);
  await validatePacket(packet);
});
test('all truncated prefix messages are rejected', () => {
  for (const packet of [fixture,nonce]) {
    const m = unhex(packet.messageHex);
    for (let size = 0; size < m.length; size++) assert.throws(()=>parseMessage(m.slice(0,size)));
  }
});
test('versioned, multisigner and wrong permission headers are rejected', () => {
  for (const [offset, value] of [[0,0x80],[0,2],[1,1],[2,0],[2,2]]) {
    const message=unhex(fixture.messageHex); message[offset]=value; assert.throws(()=>parseMessage(message));
  }
});
test('unknown instruction and changed System Program are rejected', () => {
  const message=unhex(fixture.messageHex);
  const unknown=message.slice(); unknown[138]=3; assert.throws(()=>parseMessage(unknown));
  const program=message.slice(); program[99]^=1; assert.throws(()=>parseMessage(program));
});
test('duplicate accounts and unexpected signer are rejected', () => {
  assert.throws(()=>buildMessage({...fields,recipient:TEST_ADDRESS}));
  const message=unhex(fixture.messageHex); message[4]^=1; assert.throws(()=>parseMessage(message));
});
test('noncanonical shortvec, length overflow, trailing bytes and oversized messages are rejected', () => {
  const message=unhex(fixture.messageHex);
  assert.throws(()=>parseMessage(concat(message.slice(0,3),Uint8Array.of(0x83,0),message.slice(4))));
  assert.throws(()=>parseMessage(concat(message.slice(0,3),Uint8Array.of(0xff,0xff,0x7f),message.slice(4))));
  assert.throws(()=>parseMessage(concat(message,Uint8Array.of(0))));
  assert.throws(()=>parseMessage(new Uint8Array(1168)));
});
test('nonce authority, sysvar, program and instruction mutations are rejected', () => {
  for (const offset of [100,133,198,201,203]) {
    const message=unhex(nonce.messageHex); message[offset]^=1; assert.throws(()=>parseMessage(message));
  }
});
test('relabelled recipient or amount metadata is rejected', async () => {
  for (const field of ['recipient','lamports','from','kind','messageBytes']) {
    const packet=copy(fixture); packet.review[field]='tampered';
    await assert.rejects(validatePacket(packet));
  }
});
test('changed message, envelope, digest, key, network, profile or upstream version is rejected', async () => {
  for (const field of ['messageHex','envelopeHex','messageSha256','messageSha512','expectedPublicKeyHex','network','profile','upstreamCommit']) {
    const packet=copy(fixture);
    packet[field]=field==='profile'?1:(field.endsWith('Hex')?(parseInt(packet[field].slice(0,2),16)^1).toString(16).padStart(2,'0')+packet[field].slice(2):'wrong');
    await assert.rejects(validatePacket(packet), undefined, field);
  }
});
test('public result CRC, version, profile, reserved fields and length are enforced', () => {
  const record=unhex(result.recordHex);
  for (const offset of [0,8,9,172,176,255]) {
    const r=record.slice();r[offset]^=1;assert.throws(()=>readRecord(r));
  }
  assert.throws(()=>readRecord(record.slice(1)));
});
test('actual 65C02 legacy signature independently verifies with WebCrypto', async () => {
  const checked=await verifyResult(fixture,result);
  assert.equal(checked.verified,true);
  assert.equal(result.evidence.doubleSign,true);
  assert.equal(result.evidence.firmwareVerify,true);
  assert.equal(result.evidence.opensslVerified,true);
  assert.equal(result.evidence.hardwareMeasured,false);
});
test('actual 65C02 durable-nonce signature independently verifies with WebCrypto', async () => {
  assert.equal((await verifyResult(nonce,nonceResult)).verified,true);
});
test('an old signature is rejected for a newly prepared amount', async () => {
  const changed=await makePacket({...fields,lamports:5001n});
  await assert.rejects(verifyResult(changed,result));
});
test('a signature alteration remains rejected after the CRC is recomputed', async () => {
  const r=copy(result), bytes=unhex(r.recordHex);bytes[44]^=1;
  new DataView(bytes.buffer).setUint32(172,crc32(bytes.slice(0,172)),true);
  r.recordHex=hex(bytes);await assert.rejects(verifyResult(fixture,r),/signature verification/);
});
test('a changed result digest remains rejected after CRC resealing', async () => {
  const r=copy(result), bytes=unhex(r.recordHex);bytes[108]^=1;
  new DataView(bytes.buffer).setUint32(172,crc32(bytes.slice(0,172)),true);
  r.recordHex=hex(bytes);await assert.rejects(verifyResult(fixture,r),/different message/);
});
test('review pages cover every recipient byte in its original order', () => {
  const pages=reviewPages(fixture), recipientPages=pages.filter(p=>p.field==='02');
  assert.equal(recipientPages.length,4);
  assert.equal(recipientPages.map(p=>p.dataHex).join(''),hex(b58decode(fixture.review.recipient)));
  assert.equal(recipientPages[0].headerHex,'f1020004');
  assert.equal(pages.find(p=>p.field==='03').dataHex,'8813000000000000');
});
test('JS serialization matches the separate Python upstream builder for both fixtures', () => {
  const upstream=process.env.DTS_UPSTREAM;
  if (!upstream) throw new Error('Set DTS_UPSTREAM to run integration checks.');
  const code='import sys,json;sys.path.insert(0,sys.argv[1]);from sim.solana import transfer_message,b58decode;p=json.loads(sys.stdin.read());r=p["review"];print(transfer_message(b58decode(r["from"]),b58decode(r["recipient"]),int(r["lamports"]),b58decode(r["blockhash"]),b58decode(r["nonceAccount"]) if r["nonceAccount"] else None).hex())';
  for (const packet of [fixture,nonce]) {
    const run=spawnSync('python3',['-c',code,upstream],{input:JSON.stringify(packet),encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),packet.messageHex);
  }
});
test('independent Python policy rejects changed review metadata before signing', () => {
  const altered=copy(fixture);altered.review.lamports='123456789';
  const code='import sys,json;from tools.sign_fixture import validate;validate(json.loads(sys.stdin.read()))';
  const run=spawnSync('python3',['-c',code],{input:JSON.stringify(altered),encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/Review metadata differs/);
});
test('independent Python decoder agrees on both exact packets', () => {
  const code='import sys,json;from tools.sign_fixture import validate;validate(json.loads(sys.stdin.read()));print("accepted")';
  for (const packet of [fixture,nonce]) {
    const run=spawnSync('python3',['-c',code],{input:JSON.stringify(packet),encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'accepted');
  }
});
test('portable SHA-256 and SHA-512 match platform implementations', async () => {
  for (const bytes of [new Uint8Array(), unhex(fixture.messageHex), unhex(nonce.messageHex)]) {
    for (const algorithm of ['SHA-256','SHA-512']) {
      assert.deepEqual(hashBytes(algorithm,bytes),new Uint8Array(await crypto.subtle.digest(algorithm,bytes)));
    }
  }
});
test('portable Ed25519 rejects S+L malleability', async () => {
  const sig=unhex(result.recordHex).slice(44,108), message=unhex(fixture.messageHex);
  const L=(1n<<252n)+27742317777372353535851937790883648493n;
  let s=0n;for(let i=63;i>=32;i--)s=(s<<8n)+BigInt(sig[i]);s+=L;
  for(let i=32;i<64;i++){sig[i]=Number(s&255n);s>>=8n;}
  assert.equal(await verifySignature(unhex(TEST_PUBLIC_HEX),message,sig),false);
});
test('portable verification works with WebCrypto unavailable', async () => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try {
    Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});
    assert.equal(await verifySignature(unhex(TEST_PUBLIC_HEX),unhex(fixture.messageHex),unhex(result.recordHex).slice(44,108)),true);
  } finally { Object.defineProperty(globalThis,'crypto',descriptor); }
});
