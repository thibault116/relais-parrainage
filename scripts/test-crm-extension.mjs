import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const file=name=>readFileSync(new URL('../extension/mentora-vinted/'+name,import.meta.url),'utf8');
const manifest=JSON.parse(file('manifest.json'));assert.equal(manifest.manifest_version,3);assert(!manifest.permissions.includes('cookies'));assert(!manifest.host_permissions.includes('<all_urls>'));
const storage={},tabs=[],listeners={};let created=0,alarm=false,posts=0,mode='';
const chrome={runtime:{id:'a'.repeat(32),getURL:path=>'chrome-extension://'+'a'.repeat(32)+'/'+path,onMessage:{addListener:fn=>listeners.message=fn},onInstalled:{addListener:fn=>listeners.installed=fn},onStartup:{addListener:fn=>listeners.startup=fn}},storage:{local:{get:async()=>({...storage}),set:async v=>Object.assign(storage,v),clear:async()=>{for(const k of Object.keys(storage))delete storage[k];},setAccessLevel:async v=>mode=v.accessLevel}},alarms:{create:async()=>{alarm=true;},clear:async()=>{alarm=false;},onAlarm:{addListener:fn=>listeners.alarm=fn}},tabs:{query:async()=>tabs,create:async v=>{created++;assert.equal(v.active,false);const t={...v,id:created,status:'complete'};tabs.push(t);return t;},update:async(id,v)=>{Object.assign(tabs.find(t=>t.id===id),v);},sendMessage:async()=>({ok:true}),onUpdated:{addListener:fn=>listeners.updated=fn}}};
const context=vm.createContext({chrome,URL,AbortSignal,fetch:async()=>{posts++;return {ok:true};},console});vm.runInContext(file('background.js'),context);
const send=(message,sender={id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')})=>new Promise(resolve=>listeners.message(message,sender,resolve));
await listeners.installed();await send({type:'status'});assert.equal(mode,'TRUSTED_CONTEXTS');
const token='a'.repeat(64);assert((await send({type:'configure',token,ordersUrl:'https://evil.example',accountKey:'123'})).error);
assert.equal((await send({type:'configure',token,ordersUrl:'https://www.vinted.fr/orders?type=sold',accountKey:'123'})).ok,true);
await Promise.all([send({type:'start'}),send({type:'start'}),send({type:'start'})]);assert.equal(created,1);assert.equal(alarm,true);assert.equal((await send({type:'status'})).token,undefined);
const url=tabs[0].url,sender={id:chrome.runtime.id,tab:{id:1},url};
await send({type:'result',payload:{accountKey:'123',sales:[],status:'complete',page:url.split('#')[0]}},{...sender,tab:{id:99}});assert.equal(posts,0);
await send({type:'result',payload:{accountKey:'123',sales:[],status:'unsupported',message:'Unknown layout',page:url.split('#')[0]}},sender);assert.equal(posts,1);assert.equal(storage.enabled,false);assert.equal(alarm,false);
await send({type:'start'});await listeners.startup();await send({type:'status'});assert.equal(created,1);
await send({type:'pause'});await listeners.alarm({name:'mentora-sales'});await send({type:'status'});assert.equal(storage.enabled,false);assert.equal(created,1);
const parser=vm.createContext({URL,console});vm.runInContext(file('reader.js'),parser);const reader=parser.MentoraReader;
assert.equal(reader.parseAmount('1 234,56 €'),123456);assert.equal(reader.parseAmount('Total 12 €'),null);assert.equal(reader.parseDate('31/02/2026'),null);assert.equal(reader.parseDate('hier'),null);assert.equal(reader.parseDate('2026-04-01'), '2026-04-01');
assert.equal(reader.read({body:{innerText:'Verify you are human'}},'123','https://www.vinted.fr/orders').payload.status,'login_required');
const result=reader.read({body:{innerText:'Mes ventes'},querySelectorAll:()=>[]},'123','https://www.vinted.fr/orders');assert.equal(result.payload.status,'unsupported');assert.equal(result.payload.sales.length,0);
console.log('Extension: one inactive tab, restart reuse, pause, private storage, sender isolation, unsupported-layout stop, date/price parsing passed. Live Vinted compatibility NOT tested.');

const optionsSender={id:chrome.runtime.id,url:chrome.runtime.getURL('options.html'),tab:{id:42}};
await send({type:'forget'});
assert.equal((await send({type:'configure',token,ordersUrl:'https://www.vinted.fr/orders?type=sold',accountKey:'123'},optionsSender)).hasToken,true);
assert.equal((await send({type:'status'},optionsSender)).hasToken,true);
assert.equal((await send({type:'configure',token:'',ordersUrl:'https://www.vinted.fr/orders?type=sold',accountKey:'123'},optionsSender)).ok,true);
assert.equal(storage.token,token);
assert.equal((await send({type:'start'})).ok,true);
assert.equal((await send({type:'configure',token:'b'.repeat(64),ordersUrl:'https://www.vinted.fr/orders',accountKey:'123'},{id:chrome.runtime.id,tab:{id:1},url:'https://www.vinted.fr/orders'})).ignored,true);
assert.equal(storage.token,token);
console.log('Regression: options page with sender.tab saves key, reopening retains it, empty field preserves it, popup starts, Vinted content cannot configure.');

// Account menus may be rendered outside header, and unrelated selected navigation may precede Ventes.
function fixture({id='123',menu=true,label='',origin='https://www.vinted.fr'}={}) {
 const profile={href:`${origin}/member/${id}-seller`,innerText:label,closest:()=>menu?{}:null,getAttribute:()=>null};
 const price={innerText:'25,00 €'}, title={innerText:'Pull laine'},date={getAttribute:()=> '2026-10-30'};
 const row={innerText:'Vente terminée',querySelector:s=>s.includes('item-title')?title:s.includes('item-price')?price:s.includes('sold-date')?date:null};
 const order={href:'https://www.vinted.fr/orders/456',closest:()=>row};
 return {body:{innerText:'Mes commandes'},querySelector:()=>null,querySelectorAll:s=>s==='a[href*="/member/"]'?[profile]:s.includes('aria-selected')?[{innerText:'Accueil'},{innerText:'Ventes'}]:s.includes('main h1')?[]:s.includes('/orders/')?[order]:[]};
}
assert.equal(reader.read(fixture(),'123','https://www.vinted.fr/orders').payload.sales.length,1);
assert.equal(reader.read(fixture({menu:false,label:'Mon profil'}),'123','https://www.vinted.fr/orders').payload.sales.length,1);
assert.equal(reader.read(fixture({id:'999'}),'123','https://www.vinted.fr/orders').reason,'account_mismatch');
assert.equal(reader.read(fixture({menu:false,label:'Acheteur'}),'123','https://www.vinted.fr/orders').reason,'account_missing');
assert.equal(reader.read(fixture({origin:'https://evil.example'}),'123','https://www.vinted.fr/orders').reason,'account_missing');
assert.equal((await send({type:'retry'},{id:chrome.runtime.id,tab:{id:999},url:tabs[0].url})).ignored,true);
console.log('Reader regression: portalled menu, own-profile label, multiple navigation selections, account mismatch and unrelated links verified.');
