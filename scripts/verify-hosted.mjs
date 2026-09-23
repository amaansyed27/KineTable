import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
// Explicit integration check: creates two disposable Auth users; sends no email.
mkdirSync('output', {recursive:true});
const env=Object.fromEntries(readFileSync('apps/web/.env.local','utf8').trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const url=env.VITE_SUPABASE_URL, key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
async function request(path, body, token, method='POST') {
 const r=await fetch(url+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),Prefer:'resolution=merge-duplicates,return=representation'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw new Error(JSON.stringify({status:r.status,data}));return data;
}
const settings=await request('/auth/v1/settings',null,null,'GET');
if (!settings.mailer_autoconfirm) throw Error('Confirm email is still enabled; refusing to send test mail');
console.log('Auth settings:',JSON.stringify({email:settings.external?.email,autoconfirm:settings.mailer_autoconfirm,signupDisabled:settings.disable_signup}));
let accounts=[];
for(const name of ['a','b']) {
 const email=`kinetable-qa-${name}-${randomUUID()}@gmail.com`,password=randomBytes(24).toString('base64url');
 const session=await request('/auth/v1/signup',{email,password});
 if(!session.access_token)throw Error('Signup did not return a real session');
 accounts.push({email,password,id:session.user.id,token:session.access_token});
}
writeFileSync('output/hosted-qa-accounts.json',JSON.stringify(accounts));
const [a,b]=accounts;
const saved=await request('/rest/v1/profiles',{primary_board_id:'esp32-dev-module',setup_completed:true},a.token);
if(saved[0]?.id!==a.id)throw Error('Wrong owner');
const own=await request('/rest/v1/profiles?select=*',null,a.token,'GET');
const other=await request(`/rest/v1/profiles?id=eq.${b.id}&select=*`,null,a.token,'GET');
const update=await request(`/rest/v1/profiles?id=eq.${b.id}`,{primary_board_id:'arduino-uno'},a.token,'PATCH');
if(own.length!==1||other.length||update.length)throw Error('RLS isolation failed');
const login=await request('/auth/v1/token?grant_type=password',{email:a.email,password:a.password});
if(!login.access_token)throw Error('Password login failed');
console.log(JSON.stringify({signup:true,passwordLogin:true,profileWrite:true,profileRead:true,otherReadBlocked:true,otherUpdateBlocked:true,userIds:accounts.map(a=>a.id)}));
