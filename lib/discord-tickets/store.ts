import {query} from "../db";
export async function migrateDiscordTickets(){
 await query(`CREATE TABLE IF NOT EXISTS discord_ticket_config(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,panel_channel TEXT NOT NULL,category_id TEXT NOT NULL DEFAULT '',owner_id TEXT NOT NULL,bot_id TEXT NOT NULL,panel_message TEXT NOT NULL DEFAULT '',panel_state TEXT NOT NULL DEFAULT 'draft',updated_at TEXT NOT NULL)`);
 await query(`CREATE TABLE IF NOT EXISTS discord_tickets(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,user_id TEXT NOT NULL,category TEXT NOT NULL,channel_id TEXT UNIQUE,active_key TEXT UNIQUE,state TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);
 await query(`CREATE TABLE IF NOT EXISTS discord_ticket_actions(interaction_id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT NOT NULL)`);
}
export type TicketConfig={id:string;guild_id:string;panel_channel:string;category_id:string;owner_id:string;bot_id:string;panel_message:string;panel_state:string};
export type Ticket={id:string;guild_id:string;user_id:string;category:string;channel_id:string|null;state:string;created_at:string};
export const config=async()=> (await query<TicketConfig>("SELECT * FROM discord_ticket_config WHERE id='main'"))[0]||null;
export const ticket=async(id:string)=>(await query<Ticket>("SELECT * FROM discord_tickets WHERE id=$1",[id]))[0]||null;
export async function claimTicket(id:string,guild:string,user:string,category:string){
 const now=new Date().toISOString(),key=`${guild}:${user}`;
 const inserted=await query<Ticket>("INSERT INTO discord_tickets(id,guild_id,user_id,category,active_key,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'creating',$6,$6) ON CONFLICT DO NOTHING RETURNING *",[id,guild,user,category,key,now]);
 return {created:inserted.length>0,row:inserted[0]||(await query<Ticket>("SELECT * FROM discord_tickets WHERE active_key=$1 OR id=$2",[key,id]))[0]};
}
export async function recordAction(interaction:string,id:string,actor:string,action:string){return (await query("INSERT INTO discord_ticket_actions(interaction_id,ticket_id,actor_id,action,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING interaction_id",[interaction,id,actor,action,new Date().toISOString()])).length>0;}
