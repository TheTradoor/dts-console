import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSquadsDraft,squadsExample,validateSquadsDraft,reviewSquadsMessage,compareSquadsState} from '../dist/squads.mjs';
import {unhex,hex,concat,parseMessage} from '../dist/protocol.mjs';
const example=squadsExample(),reference=JSON.parse(readFileSync(new URL('./fixtures/squads-sdk.json',import.meta.url)));
const bytes=unhex(reference.messageHex);
const draft=()=>buildSquadsDraft(example);

test('draft exposes decoded unsigned intent and explicit limits',()=>{
  const d=draft();assert.equal(d.status,'UNSIGNED_DRAFT');
  assert.equal(d.review.messageBytes,487);assert.equal(d.review.transactionBytes,552);
  assert.equal(d.review.lamports,'5000');assert.equal(d.review.transactionIndex,'1');
  assert.equal(d.review.requiredSignatures,1);assert.equal(d.limitations.length,4);
  assert.deepEqual(validateSquadsDraft(JSON.parse(JSON.stringify(d))),d);
  assert.equal('signature' in d,false);assert.equal('envelopeHex' in d,false);
});
test('every truncation and trailing data are rejected',()=>{
  for(let i=0;i<bytes.length;i++)assert.throws(()=>reviewSquadsMessage(bytes.slice(0,i)),`length ${i}`);
  assert.throws(()=>reviewSquadsMessage(concat(bytes,Uint8Array.of(0))),/Trailing/);
});
test('versioned messages, privilege changes and noncanonical account count fail',()=>{
  for(const [index,value] of [[0,128],[0,2],[1,1],[2,2],[2,4],[3,7],[3,9]]){
    const changed=bytes.slice();changed[index]=value;assert.throws(()=>reviewSquadsMessage(changed));
  }
  const noncanonical=concat(bytes.slice(0,3),Uint8Array.of(136,0),bytes.slice(4));
  assert.throws(()=>reviewSquadsMessage(noncanonical),/Noncanonical/);
});
test('outer control accounts and derived PDAs cannot be changed independently',()=>{
  for(const index of [2,3,4,5,6,7]){
    const changed=bytes.slice();changed[4+32*index]^=1;assert.throws(()=>reviewSquadsMessage(changed),`account ${index}`);
  }
});
test('wrong program, nonce discriminator and instruction order fail',()=>{
  // Outer instructions start after header, eight keys, blockhash and count.
  for(const [index,value] of [[292,3],[293,7],[299,3],[303,5]]){
    const changed=bytes.slice();changed[index]=value;assert.throws(()=>reviewSquadsMessage(changed));
  }
});
test('tampered presentation, source pins, digest, status or added fields are rejected',()=>{
  const mutations=[d=>d.review.recipient=example.member,d=>d.review.lamports='1',d=>d.review.amountSol='1000',
    d=>d.review.transactionIndex='2',d=>d.review.vault=example.recipient,d=>d.review.instructionOrder.reverse(),
    d=>d.messageSha256='0'.repeat(64),d=>d.reference.sdk='unknown',d=>d.status='VERIFIED',
    d=>d.limitations=[],d=>d.signature='fake',d=>d.messageHex='ff'+d.messageHex.slice(2)];
  for(const mutate of mutations){const d=structuredClone(draft());mutate(d);assert.throws(()=>validateSquadsDraft(d));}
});
test('a different nonce account is decoded as a different intent, never accepted under old metadata',()=>{
  const changed=bytes.slice();changed[36]^=1;
  const review=reviewSquadsMessage(changed);assert.notEqual(review.nonceAccount,example.nonceAccount);
  const d=structuredClone(draft());d.messageHex=hex(changed);assert.throws(()=>validateSquadsDraft(d));
});
for(const [label,patch] of [
  ['zero amount',{amountSol:'0'}],['negative amount',{amountSol:'-1'}],['float syntax',{amountSol:'1e-9'}],
  ['sub-lamport',{amountSol:'0.0000000001'}],['u64 overflow',{amountSol:'18446744073.709551616'}],
  ['numeric index',{currentTransactionIndex:1}],['unsafe next index',{currentTransactionIndex:'9007199254740991'}],
  ['negative index',{currentTransactionIndex:'-1'}],['leading zero index',{currentTransactionIndex:'01'}],
  ['vault overflow',{vaultIndex:'256'}],['fractional vault',{vaultIndex:'0.5'}],
  ['invalid address',{recipient:'invalid'}],['noncanonical address',{recipient:'1'+example.recipient}],
  ['on-curve multisig',{multisig:example.member}],['account alias',{recipient:example.nonceAccount}],
  ['unknown operation',{operation:'execute'}],
])test(`input rejects ${label}`,()=>assert.throws(()=>buildSquadsDraft({...example,...patch})));
test('maximum supported amount and index retain integer precision',()=>{
  const d=buildSquadsDraft({...example,amountSol:'18446744073.709551615',currentTransactionIndex:'9007199254740990',vaultIndex:'255'});
  assert.equal(d.review.lamports,'18446744073709551615');assert.equal(d.review.transactionIndex,'9007199254740991');
});
test('changed index or nonce always requires rebuilding and matching is not chain verification',()=>{
  const d=draft();
  assert.deepEqual(compareSquadsState(d,{transactionIndex:'0',nonceValue:example.nonceValue}),
    {status:'VALUES_MATCH',indexChanged:false,nonceChanged:false,source:'manually-entered-unverified-values',onChainVerified:false});
  for(const pair of [{transactionIndex:'1',nonceValue:example.nonceValue},{transactionIndex:'0',nonceValue:example.recipient},
    {transactionIndex:'1',nonceValue:example.recipient}]) assert.equal(compareSquadsState(d,pair).status,'REBUILD_REQUIRED');
});
test('current DTS signing parser continues rejecting Squads messages',()=>assert.throws(()=>parseMessage(bytes),/Unsupported account layout/));
