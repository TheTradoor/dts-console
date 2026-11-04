import {buildSquadsDraft,validateSquadsDraft,compareSquadsState,squadsExample} from './squads.mjs';
const $=id=>document.getElementById(id);
const fields=['multisig','member','recipient','amountSol','nonceAccount','nonceValue','currentTransactionIndex','vaultIndex'];
let draft=null, stale=false, generation=0;
function clear() {
  generation++; draft=null; stale=false;
  $('squads-result').hidden=true; $('squads-empty').hidden=false;
  $('squads-error').hidden=true; $('squads-comparison').hidden=true;
  $('squads-ack').checked=false; $('squads-export').disabled=true;
}
function showError(error) { $('squads-error').textContent=error.message; $('squads-error').hidden=false; }
function values() { return Object.fromEntries(fields.map(name=>[name,$('sq-'+name).value.trim()])); }
function fill(input) { for(const name of fields) $('sq-'+name).value=String(input[name]); }
function field(target,label,value) {
  const dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=label;dd.textContent=value;target.append(dt,dd);
}
function adopt(packet) {
  draft=validateSquadsDraft(packet); stale=false;
  const r=draft.review; fill(r);
  $('squads-empty').hidden=true; $('squads-result').hidden=false;
  const target=$('squads-decoded'); target.replaceChildren();
  for(const [label,key] of [['Transfer amount (SOL)','amountSol'],['Exact lamports','lamports'],
    ['Recipient — full address','recipient'],['Source vault — derived','vault'],['Multisig address — supplied','multisig'],
    ['Member, fee payer and nonce authority','member'],['Current transaction index — supplied','currentTransactionIndex'],
    ['New transaction index','transactionIndex'],['Vault index','vaultIndex'],['Nonce account — supplied','nonceAccount'],
    ['Durable nonce value — supplied','nonceValue'],['Vault transaction PDA — derived','transaction'],['Proposal PDA — derived','proposal']]) field(target,label,String(r[key]));
  $('squads-size').textContent=`${r.messageBytes} message bytes · ${r.transactionBytes} bytes with one signature slot / 1,232 maximum`;
  $('squads-hash').textContent=draft.messageSha256;
  $('squads-hex').textContent=draft.messageHex.match(/.{1,32}/g).join('\n');
  const sequence=$('squads-instructions');sequence.replaceChildren();
  for(const name of r.instructionOrder){const li=document.createElement('li');li.textContent=name;sequence.append(li);}
  $('squads-ack').checked=false; $('squads-export').disabled=true;
  $('sq-compare-index').value=r.currentTransactionIndex; $('sq-compare-nonce').value=r.nonceValue;
  $('squads-comparison').hidden=true;
}
$('squads-form').addEventListener('input',clear);
$('squads-form').addEventListener('submit',event=>{
  event.preventDefault();clear();
  try{adopt(buildSquadsDraft(values()));}catch(error){showError(error);}
});
$('squads-example').addEventListener('click',()=>{
  clear();const input=squadsExample();fill(input);
  try{adopt(buildSquadsDraft(input));}catch(error){showError(error);}
});
$('squads-ack').addEventListener('change',()=>{$('squads-export').disabled=!draft||stale||!$('squads-ack').checked;});
$('squads-export').addEventListener('click',()=>{
  if(!draft||stale||!$('squads-ack').checked)return;
  try {
    const checked=validateSquadsDraft(draft);
    const url=URL.createObjectURL(new Blob([JSON.stringify(checked,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='dts-squads-draft.json';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){clear();showError(error);}
});
$('squads-import').addEventListener('click',()=>$('squads-file').click());
$('squads-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  clear();const token=generation;
  try{
    if(file.size>32768)throw new Error('Choose a Squads draft JSON file smaller than 32 KB.');
    let packet;try{packet=JSON.parse(await file.text());}catch{throw new Error('The selected draft is not valid JSON.');}
    if(token!==generation)return;
    adopt(packet);
  }catch(error){if(token===generation)showError(error);}
  finally{event.target.value='';}
});
$('squads-compare-form').addEventListener('input',()=>{$('squads-comparison').hidden=true;});
$('squads-compare-form').addEventListener('submit',event=>{
  event.preventDefault();if(!draft)return;
  const target=$('squads-comparison');target.hidden=false;
  try{
    const result=compareSquadsState(draft,{transactionIndex:$('sq-compare-index').value.trim(),nonceValue:$('sq-compare-nonce').value.trim()});
    if(result.status==='REBUILD_REQUIRED'){
      stale=true;$('squads-ack').checked=false;$('squads-export').disabled=true;
      target.className='error';target.textContent='REBUILD REQUIRED — '+
        [result.indexChanged?'transaction index changed':null,result.nonceChanged?'nonce value changed':null].filter(Boolean).join('; ')+
        '. Update the preparation inputs and review a new draft. Do not reuse the old message.';
    }else{
      target.className='comparison-note';target.textContent=stale?
        'A mismatch was already detected for this draft. Prepare and review a new draft before exporting.':
        'VALUES MATCH — the manually entered values match this draft. No on-chain state, membership, permissions or execution has been verified.';
    }
  }catch(error){
    stale=true;$('squads-ack').checked=false;$('squads-export').disabled=true;
    target.className='error';target.textContent=error.message+' Prepare and review a new draft before exporting.';
  }
});
