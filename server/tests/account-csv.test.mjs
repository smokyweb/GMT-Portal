import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAccountCsv,importErrorCsv} from '../../src/lib/accountCsv.js';
test('Account CSV accepts BOM, quoted commas, escaped quotes, and multiline cells',()=>{
  const rows=parseAccountCsv('\uFEFFemail,name,role\r\nqa@example.org,"Smith, ""Jordan""",user\r\nqa2@example.org,"Two\nLines",user\r\n');
  assert.equal(rows.length,2);assert.equal(rows[0].name,'Smith, "Jordan"');assert.equal(rows[1].name,'Two\nLines');
});
test('Account CSV refuses malformed, duplicate, and sensitive headers',()=>{
  assert.throws(()=>parseAccountCsv('name\nQA'),/email column/);
  assert.throws(()=>parseAccountCsv('email,email\na,b'),/duplicate/);
  assert.throws(()=>parseAccountCsv('email,password_hash\na@example.org,hash'),/password/);
  assert.throws(()=>parseAccountCsv('email,name\na@example.org,"Unclosed'),/unclosed/);
  assert.throws(()=>parseAccountCsv('email,name\na@example.org,Name,extra'),/expected 2/);
  assert.throws(()=>parseAccountCsv('email,name\na@example.org,"Name"unexpected'),/Unexpected text/);
});
test('Account CSV preserves blank trailing fields and ignores blank lines',()=>{
  assert.deepEqual(parseAccountCsv('email,phone\nqa@example.org,\n\n'),[{email:'qa@example.org',phone:''}]);
});
test('Account CSV caps import size without truncating rows',()=>{
  assert.throws(()=>parseAccountCsv('email\n'+Array.from({length:201},(_,i)=>'qa'+i+'@example.org').join('\n')),/no more than 200/);
});
test('CSV error reports escape cells and neutralize spreadsheet formulas',()=>{
  const csv=importErrorCsv([{row:2,email:'=1+2',errors:['Bad "email"']},{row:3,email:'ok@example.org',errors:[]}]);
  assert.ok(csv.includes('"\'=1+2"'));assert.ok(csv.includes('"Bad ""email"""'));assert.ok(!csv.includes('ok@example.org'));
});
