// Offline preparation only: one SOL transfer, one member, one durable nonce.
// The review decoder below is independent of the SDK's serializers.
import {ed25519} from './vendor/curves/ed25519.js';
import {b58decode, b58encode, hex, unhex, equal, concat, shortvec, amountToLamports, formatSol, TEST_ADDRESS, SYSVAR, UPSTREAM} from './protocol.mjs';
import {hashBytes} from './crypto.mjs';

export const SQUADS_PROGRAM = 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf';
const SYSTEM = '11111111111111111111111111111111';
const MAX_INDEX = BigInt(Number.MAX_SAFE_INTEGER);
const te = new TextEncoder();
const discriminator = name => hashBytes('SHA-256', te.encode('global:' + name)).slice(0, 8);
export const SQUADS_REFERENCE = Object.freeze({sdk:'@sqds/multisig@2.1.4', web3:'@solana/web3.js@1.98.4',
  programId:SQUADS_PROGRAM, sourceCommit:'af94153ff77a28b6effe46b9c94baaa93742b48c',
  idlGitBlob:'ae557d203e289cba755ff4a8f9d59fd2f5beebbe', dtsUpstream:UPSTREAM});
export const SQUADS_LIMITATIONS = Object.freeze([
  'Unsigned preparation only; no proposal, approval or transfer has occurred.',
  'Account ownership, membership, permissions, threshold, balances and nonce state have not been checked on chain.',
  'Current DTS signing profiles do not accept this Squads message.',
  'Local-validator execution and adversarial nonce/index/replay tests are pending.',
]);
function requireThat(ok, reason) { if (!ok) throw new Error(reason); }
function record(value, keys, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `Invalid ${label}.`);
  requireThat(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value,k)), `Unexpected ${label} fields.`);
}
function address(value, label) {
  requireThat(typeof value === 'string', `${label} must be a base58 address.`);
  try { b58decode(value); } catch { throw new Error(`${label} must encode exactly 32 bytes in base58.`); }
  return b58decode(value);
}
function decimal(value, max, label) {
  requireThat(typeof value === 'string' && value.length <= 20 && /^(0|[1-9][0-9]*)$/.test(value), `${label} must be a decimal integer without leading zeros.`);
  const n = BigInt(value); requireThat(n <= max, `${label} exceeds the supported range.`); return n;
}
function little(value, length) {
  let n=BigInt(value); const out=new Uint8Array(length);
  for(let i=0;i<length;i++){out[i]=Number(n&255n);n>>=8n;}
  requireThat(n===0n,'Integer serialization overflow.'); return out;
}
function onCurve(bytes) { try {ed25519.Point.fromBytes(bytes,false);return true;}catch{return false;} }
function findPda(seeds) {
  requireThat(seeds.length<16 && seeds.every(s=>s.length<=32),'Invalid PDA seeds.');
  for(let bump=255;bump>=0;bump--){
    const bytes=hashBytes('SHA-256',concat(...seeds,Uint8Array.of(bump),b58decode(SQUADS_PROGRAM),te.encode('ProgramDerivedAddress')));
    if(!onCurve(bytes))return b58encode(bytes);
  }
  throw new Error('No valid program-derived address found.');
}
function derive(multisig, index, vaultIndex) {
  const prefix=[te.encode('multisig'),b58decode(multisig)];
  return {
    vault:findPda([...prefix,te.encode('vault'),Uint8Array.of(vaultIndex)]),
    transaction:findPda([...prefix,te.encode('transaction'),little(index,8)]),
    proposal:findPda([...prefix,te.encode('transaction'),little(index,8),te.encode('proposal')]),
  };
}
function checkRoles(r) {
  requireThat(onCurve(address(r.member,'Member')), 'The member must be an Ed25519 signer address.');
  requireThat(!onCurve(address(r.multisig,'Multisig')), 'The multisig must be a program-derived address.');
  const roles = [r.member,r.multisig,r.nonceAccount,r.vault,r.transaction,r.proposal,r.recipient,SYSTEM,SYSVAR,SQUADS_PROGRAM];
  requireThat(new Set(roles).size === roles.length, 'Recipient, nonce, member and all derived/control accounts must be distinct.');
}
function normalize(input) {
  record(input,['multisig','member','recipient','amountSol','nonceAccount','nonceValue','currentTransactionIndex','vaultIndex'],'draft input');
  for (const key of ['multisig','member','recipient','nonceAccount','nonceValue']) address(input[key],key);
  requireThat(typeof input.amountSol === 'string' && input.amountSol.length <= 30,'Invalid SOL amount.');
  const lamports = amountToLamports(input.amountSol);
  const current = decimal(input.currentTransactionIndex,MAX_INDEX-1n,'Current transaction index');
  const vaultIndex = Number(decimal(input.vaultIndex,255n,'Vault index'));
  const r = {multisig:input.multisig,member:input.member,recipient:input.recipient,
    amountSol:formatSol(lamports),lamports:lamports.toString(),nonceAccount:input.nonceAccount,
    nonceValue:input.nonceValue,currentTransactionIndex:current.toString(),transactionIndex:(current+1n).toString(),vaultIndex,
    ...derive(input.multisig,current+1n,vaultIndex)};
  checkRoles(r); return r;
}
function serialize(r) {
  const transfer=concat(little(2,4),little(r.lamports,8));
  // Squads compact inner message: u8 counts, u16 instruction-data length,
  // no recent blockhash and no address lookup tables.
  const inner=concat(Uint8Array.of(1,1,1,3),b58decode(r.vault),b58decode(r.recipient),b58decode(SYSTEM),
    Uint8Array.of(1,2,2,0,1),little(transfer.length,2),transfer,Uint8Array.of(0));
  const create=concat(discriminator('vault_transaction_create'),Uint8Array.of(r.vaultIndex,0),little(inner.length,4),inner,Uint8Array.of(0));
  const proposal=concat(discriminator('proposal_create'),little(r.transactionIndex,8),Uint8Array.of(0));
  const approve=concat(discriminator('proposal_approve'),Uint8Array.of(0));
  const ix=(program,accounts,data)=>concat(Uint8Array.of(program),shortvec(accounts.length),Uint8Array.from(accounts),shortvec(data.length),data);
  const keys=[r.member,r.nonceAccount,r.multisig,r.transaction,r.proposal,SYSTEM,SYSVAR,SQUADS_PROGRAM];
  return concat(Uint8Array.of(1,0,3,8),...keys.map(k=>b58decode(k)),b58decode(r.nonceValue),Uint8Array.of(4),
    ix(5,[1,6,0],little(4,4)),ix(7,[2,3,0,0,5],create),ix(7,[2,4,0,0,5],proposal),ix(7,[2,0,4],approve));
}
class Reader {
  constructor(bytes) { this.bytes=bytes; this.offset=0; }
  take(n) {
    requireThat(Number.isInteger(n) && n>=0 && this.offset+n<=this.bytes.length,'Truncated Squads message.');
    const b=this.bytes.slice(this.offset,this.offset+n); this.offset+=n; return b;
  }
  u8() { return this.take(1)[0]; }
  uint(n) { const b=this.take(n); let v=0n; for(let i=b.length-1;i>=0;i--) v=(v<<8n)|BigInt(b[i]); return v; }
  compact() {
    const start=this.offset; let n=0;
    for(let i=0;i<3;i++) {
      const b=this.u8(); n+=(b&127)*2**(7*i); requireThat(n<=65535,'Compact-u16 overflow.');
      if(!(b&128)) { requireThat(equal(this.bytes.slice(start,this.offset),shortvec(n)),'Noncanonical compact-u16.'); return n; }
    }
    throw new Error('Invalid compact-u16.');
  }
  end() { requireThat(this.offset===this.bytes.length,'Trailing bytes are not allowed.'); }
}
function innerTransfer(bytes) {
  const p=new Reader(bytes);
  requireThat(equal(p.take(3),Uint8Array.of(1,1,1)),'Unsupported inner account permissions.');
  requireThat(p.u8()===3,'The inner transaction must have exactly three accounts.');
  const keys=Array.from({length:3},()=>b58encode(p.take(32)));
  requireThat(new Set(keys).size===3 && keys[2]===SYSTEM,'Unsupported inner account layout.');
  requireThat(p.u8()===1 && p.u8()===2 && p.u8()===2 && equal(p.take(2),Uint8Array.of(0,1)),
    'Only one vault-to-recipient System transfer is supported.');
  requireThat(p.uint(2)===12n && p.uint(4)===2n,'Invalid inner SOL transfer data.');
  const lamports=p.uint(8); requireThat(lamports>0n,'Zero-value transfers are not supported.');
  requireThat(p.u8()===0,'Address lookup tables are not supported.'); p.end();
  return {vault:keys[0],recipient:keys[1],lamports:lamports.toString(),amountSol:formatSol(lamports)};
}
export function reviewSquadsMessage(bytes) {
  requireThat(bytes instanceof Uint8Array && bytes.length<=1167,'Unsupported one-signer legacy message size.');
  const p=new Reader(bytes);
  requireThat(equal(p.take(3),Uint8Array.of(1,0,3)),'Unsupported outer account permissions or message version.');
  requireThat(p.compact()===8,'The outer transaction must have exactly eight accounts.');
  const keys=Array.from({length:8},()=>b58encode(p.take(32)));
  requireThat(new Set(keys).size===8,'Duplicate outer account addresses.');
  const nonceValue=b58encode(p.take(32)); requireThat(p.compact()===4,'Exactly four outer instructions are required.');
  const ixs=Array.from({length:4},()=>{
    const program=p.u8(), count=p.compact(); requireThat(program<8 && count<=5,'Unsupported instruction accounts.');
    const indexes=Array.from(p.take(count)); requireThat(indexes.every(i=>i<8),'Account index out of bounds.');
    const length=p.compact(); requireThat(length<=512,'Instruction data exceeds the supported limit.');
    return {programId:keys[program],accounts:indexes.map(i=>keys[i]),data:p.take(length)};
  }); p.end();
  const [advance,create,proposal,approve]=ixs;
  requireThat(advance.programId===SYSTEM && equal(advance.data,Uint8Array.of(4,0,0,0)) &&
    advance.accounts.length===3 && advance.accounts[1]===SYSVAR && advance.accounts[2]===keys[0], 'Invalid nonce advancement.');
  requireThat([create,proposal,approve].every(ix=>ix.programId===SQUADS_PROGRAM),'Only the pinned Squads program is supported.');
  const a=new Reader(create.data);
  requireThat(equal(a.take(8),discriminator('vault_transaction_create')),'Expected vault transaction creation.');
  const vaultIndex=a.u8(); requireThat(a.u8()===0,'Ephemeral signers are not supported.');
  const innerLength=Number(a.uint(4)); requireThat(innerLength<=256,'Inner transaction is too large.');
  const transfer=innerTransfer(a.take(innerLength)); requireThat(a.u8()===0,'Memos are not supported.'); a.end();
  const b=new Reader(proposal.data);
  requireThat(equal(b.take(8),discriminator('proposal_create')),'Expected proposal creation.');
  const transactionIndex=b.uint(8); requireThat(transactionIndex>0n && transactionIndex<=MAX_INDEX,'Unsupported proposal index.');
  requireThat(b.u8()===0,'The proposal must be active to allow first approval.'); b.end();
  const c=new Reader(approve.data);
  requireThat(equal(c.take(8),discriminator('proposal_approve')) && c.u8()===0,'Expected first approval without a memo.'); c.end();
  const multisig=create.accounts[0], member=keys[0], nonceAccount=advance.accounts[0];
  const derived=derive(multisig,transactionIndex,vaultIndex);
  const same=(actual,expected)=>actual.length===expected.length && actual.every((v,i)=>v===expected[i]);
  requireThat(same(create.accounts,[multisig,derived.transaction,member,member,SYSTEM]),'Vault transaction accounts or PDA mismatch.');
  requireThat(same(proposal.accounts,[multisig,derived.proposal,member,member,SYSTEM]),'Proposal accounts or PDA mismatch.');
  requireThat(same(approve.accounts,[multisig,member,derived.proposal]),'Approval accounts or PDA mismatch.');
  requireThat(transfer.vault===derived.vault,'Inner transfer does not spend from the derived vault.');
  const r={multisig,member,recipient:transfer.recipient,amountSol:transfer.amountSol,lamports:transfer.lamports,
    nonceAccount,nonceValue,currentTransactionIndex:(transactionIndex-1n).toString(),transactionIndex:transactionIndex.toString(),vaultIndex,...derived};
  checkRoles(r);
  // Reject account reordering, privilege changes and unused accounts, even when
  // the individual instructions otherwise appear to describe the same operation.
  requireThat(equal(bytes,serialize(r)),'Message is not in the supported canonical form.');
  return Object.freeze({...r,messageBytes:bytes.length,transactionBytes:bytes.length+65,
    requiredSignatures:1,instructionOrder:['Advance durable nonce','Create vault transaction','Create active proposal','Approve proposal once']});
}
function packetFromMessage(message) {
  const review=reviewSquadsMessage(message);
  return {schema:'dts-console-squads-draft-v1',status:'UNSIGNED_DRAFT',reference:{...SQUADS_REFERENCE},
    messageHex:hex(message),messageSha256:hex(hashBytes('SHA-256',message)),review,limitations:[...SQUADS_LIMITATIONS]};
}
export function buildSquadsDraft(input) {
  return packetFromMessage(serialize(normalize(input)));
}
function sameJson(a,b) {
  if(a===b) return true;
  if(!a || !b || typeof a!=='object' || typeof b!=='object' || Array.isArray(a)!==Array.isArray(b)) return false;
  const keys=Object.keys(a); return keys.length===Object.keys(b).length && keys.every(k=>Object.hasOwn(b,k)&&sameJson(a[k],b[k]));
}
export function validateSquadsDraft(packet) {
  record(packet,['schema','status','reference','messageHex','messageSha256','review','limitations'],'draft');
  requireThat(packet.schema==='dts-console-squads-draft-v1' && packet.status==='UNSIGNED_DRAFT','Unsupported Squads draft format or status.');
  const checked=packetFromMessage(unhex(packet.messageHex));
  requireThat(sameJson(packet,checked),'Draft metadata or hash does not match the decoded message.');
  return checked;
}
export function compareSquadsState(packet, values) {
  const checked=validateSquadsDraft(packet);
  record(values,['transactionIndex','nonceValue'],'comparison');
  const current=decimal(values.transactionIndex,MAX_INDEX-1n,'Comparison transaction index');
  address(values.nonceValue,'Comparison nonce value');
  const indexChanged=current.toString()!==checked.review.currentTransactionIndex;
  const nonceChanged=values.nonceValue!==checked.review.nonceValue;
  return {status:indexChanged||nonceChanged?'REBUILD_REQUIRED':'VALUES_MATCH',indexChanged,nonceChanged,
    source:'manually-entered-unverified-values',onChainVerified:false};
}
export function squadsExample() {
  const createKey=hashBytes('SHA-256',te.encode('DTS Console Squads public fixture'));
  return {multisig:findPda([te.encode('multisig'),te.encode('multisig'),createKey]),member:TEST_ADDRESS,
    recipient:'GyGKxMyg1p9SsHfm15MkNUu1u9TN2JtTspcdmrtGUdse',amountSol:'0.000005',
    nonceAccount:'EdmxWPmx2WH6WgFfTdu9xfkYf3k1g5wD1zccTVySEEh1',
    nonceValue:'4MmDg5J4tczojAmQhip5uMZ9Yug9TpTwraa7g5s7n5BT',currentTransactionIndex:'0',vaultIndex:'0'};
}
