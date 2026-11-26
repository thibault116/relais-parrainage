import { getAuth } from "../auth";
import {json} from "../http";
import {AccountError,friendly} from "./service";
export async function actor(request: Request) {
 const s = await getAuth().api.getSession({headers:request.headers});
 return s ? {id:s.user.id,sessionId:s.session.id} : null;
}
export function failure(e:unknown){return json({error:friendly(e)},e instanceof AccountError&&e.code==="forbidden"?403:400);}
