import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PublicKey,TransactionMessage,SystemProgram,Keypair,Message} from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import {buildSquadsDraft,squadsExample,SQUADS_PROGRAM,SQUADS_REFERENCE,reviewSquadsMessage} from '../dist/squads.mjs';
import {amountToLamports,formatSol,hex} from '../dist/protocol.mjs';

export function sdkMessage(input) {
  const multisigPda=new PublicKey(input.multisig),member=new PublicKey(input.member);
  const transactionIndex=BigInt(input.currentTransactionIndex)+1n,vaultIndex=Number(input.vaultIndex);
  const [vault]=multisig.getVaultPda({multisigPda,index:vaultIndex});
  const inner=new TransactionMessage({payerKey:vault,recentBlockhash:input.nonceValue,instructions:[
    SystemProgram.transfer({fromPubkey:vault,toPubkey:new PublicKey(input.recipient),lamports:amountToLamports(input.amountSol)})]});
  const instructions=[
    SystemProgram.nonceAdvance({noncePubkey:new PublicKey(input.nonceAccount),authorizedPubkey:member}),
    multisig.instructions.vaultTransactionCreate({multisigPda,transactionIndex,creator:member,rentPayer:member,
      vaultIndex,ephemeralSigners:0,transactionMessage:inner}),
    multisig.instructions.proposalCreate({multisigPda,transactionIndex,creator:member,rentPayer:member,isDraft:false}),
    multisig.instructions.proposalApprove({multisigPda,transactionIndex,member}),
  ];
  return new TransactionMessage({payerKey:member,recentBlockhash:input.nonceValue,instructions}).compileToLegacyMessage().serialize();
}
const seed=(label,i)=>createHash('sha256').update(`DTS Console public test ${label} ${i}`).digest();
const key=(label,i)=>Keypair.fromSeed(seed(label,i)).publicKey.toBase58();
const amounts=[1n,5000n,9007199254740993n,(1n<<64n)-1n];
const indexes=['0','127','65535','4294967296','9007199254740990'];

test('reference program and installed SDK versions are pinned',()=>{
  assert.equal(multisig.PROGRAM_ID.toBase58(),SQUADS_PROGRAM);
  const pkg=JSON.parse(readFileSync(new URL('../node_modules/@sqds/multisig/package.json',import.meta.url)));
  const web3=JSON.parse(readFileSync(new URL('../node_modules/@solana/web3.js/package.json',import.meta.url)));
  assert.equal(SQUADS_REFERENCE.sdk,`${pkg.name}@${pkg.version}`);
  assert.equal(SQUADS_REFERENCE.web3,`${web3.name}@${web3.version}`);
});
test('128 deterministic vectors match official SDK bytes and all three PDAs',()=>{
  for(let i=0;i<128;i++){
    const createKey=new PublicKey(seed('multisig',i));
    const [multisigPda]=multisig.getMultisigPda({createKey});
    const input={multisig:multisigPda.toBase58(),member:key('member',i),recipient:key('recipient',i),
      amountSol:formatSol(amounts[i%amounts.length]),nonceAccount:key('nonce-account',i),
      nonceValue:new PublicKey(seed('nonce-value',i)).toBase58(),currentTransactionIndex:indexes[i%indexes.length],vaultIndex:String(i%2?255:i)};
    const expected=sdkMessage(input),draft=buildSquadsDraft(input),index=BigInt(input.currentTransactionIndex)+1n;
    assert.equal(draft.messageHex,hex(expected),`vector ${i}: complete message`);
    assert.equal(draft.review.vault,multisig.getVaultPda({multisigPda,index:Number(input.vaultIndex)})[0].toBase58());
    assert.equal(draft.review.transaction,multisig.getTransactionPda({multisigPda,index})[0].toBase58());
    assert.equal(draft.review.proposal,multisig.getProposalPda({multisigPda,transactionIndex:index})[0].toBase58());
    assert.equal(draft.review.lamports,amounts[i%amounts.length].toString());
    assert.deepEqual(reviewSquadsMessage(expected),draft.review);
    const parsed=Message.from(expected);
    assert.equal(parsed.header.numRequiredSignatures,1);
    assert.equal(parsed.instructions.length,4);
    assert.equal(expected.length+65,552);
  }
});
test('public example matches the independently generated SDK fixture',()=>{
  const reference=JSON.parse(readFileSync(new URL('./fixtures/squads-sdk.json',import.meta.url)));
  assert.deepEqual(reference.input,squadsExample());
  assert.equal(reference.messageHex,hex(sdkMessage(reference.input)));
  assert.equal(buildSquadsDraft(reference.input).messageHex,reference.messageHex);
});
