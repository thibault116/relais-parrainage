import {after} from "next/server";
import {runPushWorker} from "../push";
export function scheduleServicePush(){
 try{after(async()=>{try{await runPushWorker();}catch{console.error("SERVICE_PUSH_PENDING");}});}catch{/* Unit tests have no Next request context. Durable jobs remain queued. */}
}
