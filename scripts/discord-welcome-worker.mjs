// Runs on a dedicated always-on host. No HTTP port or public bot token.
import {createHash} from 'node:crypto';
const token=process.env.DISCORD_TICKET_BOT_TOKEN;
const guild=process.env.DISCORD_WELCOME_GUILD_ID||'1563252744738050100';
const endpoint='https://mentora-resell.vercel.app/api/discord/member-events';
if(!token||!/^\d{15,22}$/.test(guild))throw Error('Configure le token du bot et le serveur dans les variables sécurisées de l’hébergeur.');
let socket,session='',sequence=null,resumeUrl='',heartbeat,acked=true,stopping=false,reconnectTimer,backoff=1000;
const pending=new Map();
function send(op,d){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({op,d}));}
async function forward(d){
 if(d.guild_id!==guild||!d.user?.id||!d.joined_at)return;
 const id=createHash('sha256').update(`${guild}:${d.user.id}:${d.joined_at}`).digest('hex');if(pending.has(id))return;
 const event={id,guild,user:d.user.id,joined:d.joined_at};pending.set(id,event);
 for(let attempt=0;attempt<8&&!stopping;attempt++){
  try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(event),signal:AbortSignal.timeout(15000),redirect:'error'});if(r.ok){console.log('WELCOME_CONFIRMED');break;}if([400,401,403].includes(r.status)){console.error('WELCOME_REJECTED',r.status);break;}}
  catch{console.error('WELCOME_RETRY');}
  await new Promise(r=>setTimeout(r,Math.min(1000*2**attempt,30000)));
 }
 pending.delete(id);
}
function reconnect(delay=backoff){clearInterval(heartbeat);if(stopping)return;clearTimeout(reconnectTimer);backoff=Math.min(backoff*2,60000);reconnectTimer=setTimeout(connect,delay+Math.random()*1000);}
function connect(){
 socket=new WebSocket(`${session&&resumeUrl?resumeUrl:'wss://gateway.discord.gg'}/?v=10&encoding=json`);
 socket.onmessage=({data})=>{try{
  const p=JSON.parse(String(data));if(p.s!==null&&p.s!==undefined)sequence=p.s;
  if(p.op===10){acked=true;const beat=()=>{if(!acked){socket.close();return;}acked=false;send(1,sequence);};heartbeat=setInterval(beat,p.d.heartbeat_interval);setTimeout(beat,Math.random()*p.d.heartbeat_interval);if(session)send(6,{token,session_id:session,seq:sequence});else send(2,{token,intents:3,properties:{os:'linux',browser:'Mentora',device:'Mentora'}});}
  else if(p.op===11)acked=true;
  else if(p.op===1){send(1,sequence);}
  else if(p.op===7)socket.close();
  else if(p.op===9){if(!p.d){session='';resumeUrl='';sequence=null;}socket.close();}
  else if(p.op===0&&p.t==='READY'){session=p.d.session_id;resumeUrl=p.d.resume_gateway_url;backoff=1000;console.log('MENTORA_GATEWAY_READY');}
  else if(p.op===0&&p.t==='RESUMED'){backoff=1000;console.log('MENTORA_GATEWAY_RESUMED');}
  else if(p.op===0&&p.t==='GUILD_MEMBER_ADD')void forward(p.d);
 }catch{console.error('GATEWAY_EVENT_FAILED');}};
 socket.onclose=e=>{clearInterval(heartbeat);if([4004,4013,4014].includes(e.code)){console.error('GATEWAY_CONFIGURATION_REQUIRED',e.code);stopping=true;process.exitCode=1;return;}if([4007,4009].includes(e.code)){session='';sequence=null;resumeUrl='';}reconnect();};
 socket.onerror=()=>{console.error('GATEWAY_CONNECTION_ERROR');socket.close();};
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;clearTimeout(reconnectTimer);clearInterval(heartbeat);socket?.close();});
connect();
