import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
// Explicit integration check: creates two disposable Auth users; sends no email.
mkdirSync('output', {recursive:true});
const env=Object.fromEntries(readFileSync('apps/web/.env.local','utf8').trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const url=env.VITE_SUPABASE_URL, key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
async function request(path, body, token, method='POST', upsert=true) {
 const r=await fetch(url+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),Prefer:(upsert?'resolution=merge-duplicates,':'')+'return=representation'},...(body?{body:JSON.stringify(body)}:{})});
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
const id=randomUUID(), now=new Date().toISOString();
const document={schemaVersion:1,id,name:'QA table',boardIds:['esp32-dev-module'],components:[{id:'board-main',kind:'board',definitionId:'esp32-dev-module'}],connections:[],logic:[],layout:{entities:{'board-main':{position:[0,0.15,0],rotation:[0.94,-0.3,0.07],scale:[1.5,1.5,1.5]}}},metadata:{createdAt:now,updatedAt:now}};
try {
 const project=await request('/rest/v1/projects',{id,name:document.name,primary_board_id:'esp32-dev-module',schema_version:1,document},a.token,'POST',false);
 if(project[0]?.id!==id||project[0]?.owner_id!==a.id)throw Error('Project creation failed');
 const ownProject=await request(`/rest/v1/projects?id=eq.${id}&select=*`,null,a.token,'GET');
 if(ownProject.length!==1)throw Error('Own project unreadable');
 const updated={...document,name:'QA table updated',metadata:{...document.metadata,updatedAt:new Date().toISOString()}};
 const updateProject=await request(`/rest/v1/projects?id=eq.${id}`,{name:updated.name,document:updated},a.token,'PATCH');
 if(updateProject[0]?.name!==updated.name)throw Error('Own project update failed');
 const otherProject=await request(`/rest/v1/projects?id=eq.${id}&select=*`,null,b.token,'GET');
 const otherUpdate=await request(`/rest/v1/projects?id=eq.${id}`,{name:'stolen'},b.token,'PATCH');
 if(otherProject.length||otherUpdate.length)throw Error('Project RLS isolation failed');
 let ownerChangeBlocked=false;
 try { await request(`/rest/v1/projects?id=eq.${id}`,{owner_id:b.id},a.token,'PATCH'); } catch { ownerChangeBlocked=true; }
 if(!ownerChangeBlocked)throw Error('Owner reassignment was accepted');
 console.log(JSON.stringify({signup:true,passwordLogin:true,profileWrite:true,profileRead:true,projectCreate:true,projectRead:true,projectUpdate:true,otherReadBlocked:true,otherUpdateBlocked:true,ownerChangeBlocked:true,userIds:accounts.map(a=>a.id)}));
} finally {
 await request(`/rest/v1/projects?id=eq.${id}`,null,a.token,'DELETE');
}
