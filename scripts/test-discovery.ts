import { memberScreen, workspaceMain, workspaceGroups } from "../app/components/workspace-destinations";
import { discoveryTags, discoveryValues } from "../lib/profile-discovery";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import {
  freshIntake,
  intakeQuestions,
  intakeSchema,
  reconcileIntake,
  questionError,
  type IntakeAnswers,
} from "../lib/intake";
import { proofIds } from "../lib/onboarding-schema";
import { initialProfile, publicProfile, decode } from "../lib/profile";
import { termsVersion } from "../lib/legal-versions";
import { getAuth } from "../lib/auth";
import { query, database } from "../lib/db";
import { GET as me, PUT as put } from "../app/api/me/route";
import { GET as directory } from "../app/api/profiles/route";
import { GET as follows } from "../app/api/follows/route";
if (process.env.DATABASE_URL || process.env.VERCEL)
  throw Error("Local isolated tests only");
const repo = process.cwd(),
  dir = await mkdtemp(join(tmpdir(), "mentora-intake-")),
  base = "http://localhost:3000";
const env: NodeJS.ProcessEnv = {
  ...process.env,
  TSX_TSCONFIG_PATH: join(repo, "tsconfig.json"),
};
delete env.GMAIL_APP_PASSWORD;
delete env.VAPID_PRIVATE_KEY;
const migration = spawnSync(
  process.execPath,
  [
    "--import",
    join(repo, "node_modules/tsx/dist/loader.mjs"),
    join(repo, "scripts/migrate.ts"),
  ],
  { cwd: dir, env, encoding: "utf8" },
);
if (migration.status !== 0) throw Error(migration.stderr);
process.chdir(dir);
delete process.env.GMAIL_APP_PASSWORD;
delete process.env.VAPID_PRIVATE_KEY;
function fixture(role: "beginner" | "mentor", experienced = false) {
  const d = freshIntake(role);
  d.financialGoal = 9374.5;
  d.selections[role === "mentor" ? "experience" : "level"] = [
    role === "mentor" ? "1to2" : experienced ? "sales" : "never",
  ];
  for (const q of intakeQuestions(d)) {
    if (q.options && !d.selections[q.id])
      d.selections[q.id] = [q.options[0].id];
  }
  return d;
}
const a = fixture("beginner"),
  b = fixture("beginner", true),
  m = fixture("mentor");
function req(path: string, body?: unknown, cookie = "") {
  return new Request(base + path, {
    method: body ? "PUT" : "GET",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function save(
  d: IntakeAnswers,
  cookie: string,
  extra: Record<string, unknown> = {},
) {
  const r = await put(
    req(
      "/api/me",
      {
        role: d.role,
        name: "Membre de test",
        questionnaire: d,
        termsAccepted: true,
        termsVersion,
        ...extra,
      },
      cookie,
    ),
  );
  return { status: r.status, data: await r.json() };
}
async function account(i: number) {
  const r = await getAuth().handler(
    new Request(base + "/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${i}`,
      },
      body: JSON.stringify({
        name: "Membre de test",
        email: `intake${i}@example.invalid`,
        password: "Local-intake-password-2026!",
      }),
    }),
  );
  assert.equal(r.status, 200);
  const d = await r.json();
  return {
    id: d.user.id,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
try {
  assert.deepEqual(workspaceMain.map(v=>v.screen),["home","marketplace","community","messages"]);
  assert.equal(memberScreen("discover"),"home");
  assert.equal(memberScreen("discover","1"),"marketplace");
  assert.equal(memberScreen("services"),"services");
  assert(workspaceGroups(true,true,true,true).flatMap(g=>g.items).some(i=>i.screen==="services"));
  const buyer=await account(61), mentor=await account(62), closed=await account(63);
  const novice=fixture("beginner"), expert=fixture("mentor");
  expert.selections.platforms=["vinted","ebay"];
  expert.selections.methods=["flea","manual"];
  expert.selections.help=["photos","sourcing"];
  expert.selections.availability=["weekend","evening"];
  const savedBuyer=await save(novice,buyer.cookie,{name:"Débutant découverte"});
  const savedMentor=await save(expert,mentor.cookie,{name:"Parrain sourcing"});
  const savedClosed=await save(fixture("mentor"),closed.cookie,{name:"Parrain complet"});
  assert.equal(savedBuyer.status,200);assert.equal(savedMentor.status,200);assert.equal(savedClosed.status,200);
  const [closedRow]=await query("SELECT details FROM profiles WHERE user_id=$1",[closed.id]);
  await query("UPDATE profiles SET details=$1 WHERE user_id=$2",[JSON.stringify({...JSON.parse(String(closedRow.details)),capacity:0}),closed.id]);
  async function list(q:string,cookie="") {const r=await directory(req("/api/profiles?"+q,undefined,cookie));assert.equal(r.status,200);return r.json();}
  const all=await list("role=all&discovery=social");
  assert.equal(all.total,3);
  for(const cookie of [buyer.cookie,mentor.cookie]) {
    assert.equal((await list("role=all&discovery=social",cookie)).total,3);
    assert.equal((await list("role=beginner&discovery=social",cookie)).total,1);
    assert.equal((await list("role=mentor&discovery=social",cookie)).total,2);
  }
  assert.equal((await list("role=mentor")).total,1,"legacy capacity filter preserved");
  const combined=await list("role=all&discovery=social&platform=ebay&method=flea&expertise=photos&availability=weekend&experience=1to2");
  assert.equal(combined.total,1);assert.equal(combined.profiles[0].name,"Parrain sourcing");
  assert.equal((await list("role=all&discovery=social&platform=ebay&availability=morning")).total,0);
  assert.equal((await list("role=all&discovery=social&q=Parrain%20sourcing")).total,1);
  assert.equal((await list("role=all&discovery=social&page=1")).profiles.length,0);
  const beginner=all.profiles.find((p:any)=>p.role==="beginner");
  const detail=await list("profile="+beginner.id);
  assert.equal(detail.profile.role,"beginner","old author links without role resolve both types");
  for(const p of all.profiles) {
    assert.equal(p.budget,"Non précisé");assert(!("questionnaire" in p));
    assert(!("financialGoal" in p.resell));assert(!p.resell.selections.budget);
    assert(!JSON.stringify(p).includes("9374"));
  }
  assert(discoveryTags(combined.profiles[0]).includes("Les brocantes"));
  const legacy={...combined.profiles[0],resell:{version:1,role:"mentor",platforms:"Vinted et eBay"},specialty:["Brocante","Luxe"],availability:"Le week-end",experience:18};
  assert.deepEqual(discoveryValues(legacy,"platform"),["vinted","ebay"]);
  assert.deepEqual(discoveryValues(legacy,"method"),["flea","luxury"]);
  assert.deepEqual(discoveryValues(legacy,"experience"),["1to2"]);
  await query("UPDATE profiles SET visible=0 WHERE user_id=$1",[buyer.id]);
  assert.equal((await list("role=all&discovery=social")).total,2);
  const hidden=await directory(req("/api/profiles?profile="+beginner.id));assert.equal(hidden.status,404);
  await query("INSERT INTO profile_blocks(user_id,reason,moderator_id,created_at) VALUES($1,$2,$3,$4)",[mentor.id,"Local test",closed.id,new Date().toISOString()]);
  assert.equal((await list("role=all&discovery=social")).total,1);
  console.log("Discovery: roles, combined filters, privacy, legacy routes/data, visibility and blocks passed.");
} finally {
  const db=database();if(db instanceof DatabaseSync)db.close();
  process.chdir(repo);
  await rm(dir,{recursive:true,force:true});
}
