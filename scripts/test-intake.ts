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
async function account(i: number, email=`intake${i}@example.invalid`) {
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
        email,
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
  assert.equal(intakeQuestions(a).length, 10);
  assert.equal(intakeQuestions(b).length, 9);
  assert.equal(intakeQuestions(m).length, 7);
  for (const answers of [a,b,m]) assert.equal(intakeQuestions(answers)[0].id,"financialGoal");
  assert(!intakeQuestions(b).some((q) => q.id === "deadline"));
  assert(
    !intakeQuestions(b)
      .find((q) => q.id === "goal")!
      .options!.some((o) => o.id === "first_sales"),
  );
  assert(
    !intakeQuestions(b)
      .find((q) => q.id === "budget")!
      .options!.some((o) => o.id === "own_items"),
  );
  for (const d of [a, b, m]) assert(intakeSchema.safeParse(d).success);
  const changed = reconcileIntake({
    ...a,
    selections: { ...a.selections, level: ["regular"], budget: ["own_items"] },
  });
  assert(!changed.selections.deadline);
  assert(!changed.selections.goal);
  assert(!changed.selections.budget);
  assert.deepEqual(changed.selections.platforms, a.selections.platforms);
  assert.equal(changed.financialGoal, a.financialGoal);
  assert(
    !intakeSchema.safeParse({
      ...b,
      selections: { ...b.selections, deadline: ["week"] },
    }).success,
  );
  const otherBefore = {
    ...a,
    selections: { ...a.selections, goal: ["other"] },
    other: { goal: "Mon objectif personnel" },
  };
  const otherAfter = reconcileIntake(
    {
      ...otherBefore,
      selections: { ...otherBefore.selections, level: ["sales"] },
    },
    otherBefore,
  );
  assert(!otherAfter.selections.goal);
  assert(!otherAfter.other.goal);
  for (const amount of [-1, Infinity, NaN, 1e10, "500", null])
    assert(!intakeSchema.safeParse({ ...a, financialGoal: amount }).success);
  assert(intakeSchema.safeParse({ ...a, financialGoal: 25000.75 }).success);
  assert(
    !intakeSchema.safeParse({
      ...m,
      selections: { ...m.selections, experience: ["under6"] },
    }).success,
  );
  for (const [choice, n, ok] of [
    ["4to5", undefined, false],
    ["4to5", 5, true],
    ["4to5", 6, false],
    ["over5", 5, false],
    ["over5", 7, true],
    ["other", 10, true],
    ["other", 11, false],
  ] as const)
    assert.equal(
      intakeSchema.safeParse({
        ...m,
        selections: { ...m.selections, capacity: [choice] },
        capacityExact: n,
      }).success,
      ok,
    );
  assert(
    !intakeSchema.safeParse({
      ...a,
      selections: { ...a.selections, availability: ["variable", "evening"] },
    }).success,
  );
  const custom = {
    ...a,
    selections: {
      ...a.selections,
      platforms: ["vinted", "other"],
      budget: ["other"],
    },
    other: {
      platforms: "Plateforme personnelle",
      budget: "BUDGET_PRIVE_UNIQUE",
    },
  };
  assert(intakeSchema.safeParse(custom).success);
  assert(!intakeSchema.safeParse({ ...custom, other: {} }).success);
  const novice = await account(1),
    experienced = await account(2),
    mentor = await account(3),
    legacy = await account(4);
  assert.equal((await query("SELECT * FROM profiles")).length, 0);
  assert.equal(
    (await save(a, novice.cookie, { termsAccepted: false })).status,
    400,
  );
  assert.equal(
    (await save(a, novice.cookie, { termsVersion: "invalid" })).status,
    400,
  );
  const savedA = await save(custom, novice.cookie),
    savedB = await save(b, experienced.cookie),
    savedM = await save(m, mentor.cookie);
  for (const s of [savedA, savedB, savedM])
    assert.equal(s.status, 200, JSON.stringify(s.data));
  assert.equal(savedA.data.profile.discord, "");
  assert.equal(savedB.data.profile.discord, "");
  assert.equal(
    (await query("SELECT * FROM profile_terms_acceptances")).length,
    3,
  );
  const own = await (await me(req("/api/me", undefined, novice.cookie))).json();
  assert.equal(own.profile.questionnaire.financialGoal, 9374.5);
  assert.deepEqual(own.profile.questionnaire.selections.platforms, [
    "vinted",
    "other",
  ]);
  assert.equal(own.profile.questionnaire.other.budget, "BUDGET_PRIVE_UNIQUE");
  const edited = {
    ...custom,
    financialGoal: 25000.75,
    selections: { ...custom.selections, methods: ["manual", "bot"] },
  };
  assert.equal((await save(edited, novice.cookie)).status, 200);
  const readBack = await (
    await me(req("/api/me", undefined, novice.cookie))
  ).json();
  assert.equal(readBack.profile.questionnaire.financialGoal, 25000.75);
  assert.deepEqual(readBack.profile.questionnaire.selections.methods, [
    "manual",
    "bot",
  ]);
  assert.equal((await me(req("/api/me"))).status, 401);
  assert.equal(
    (await put(req("/api/me", { role: "beginner", questionnaire: a }))).status,
    401,
  );
  assert.equal(
    (
      await put(
        new Request(base + "/api/me", {
          method: "PUT",
          headers: {
            Origin: "https://bad.example",
            "Content-Type": "application/json",
            cookie: novice.cookie,
          },
          body: JSON.stringify({ questionnaire: a }),
        }),
      )
    ).status,
    403,
  );
  const wrong = await save({ ...m, role: "mentor" }, novice.cookie);
  assert.equal(wrong.status, 400);
  const observedOther = await (
    await me(req("/api/me?user_id=" + novice.id, undefined, experienced.cookie))
  ).json();
  assert.equal(observedOther.profile.id, savedB.data.profile.id);
  const legacyQ = {
    version: 1,
    role: "beginner",
    categories: ["Vintage"],
    categoryOther: "",
    experienceText: "Je réalise déjà quelques ventes par mois.",
    objectives: "Je souhaite apprendre à mieux présenter mes annonces.",
    support: ["Conseils ponctuels"],
    supportOther: "",
    blocker: "Je ne sais pas encore estimer certains articles.",
    exchange: "Appel",
    cash: 123456.78,
  };
  const old = await put(
    req(
      "/api/me",
      {
        ...initialProfile,
        name: "Profil historique",
        discord: "legacy_profile",
        bio: legacyQ.experienceText,
        goals: legacyQ.objectives,
        questionnaire: legacyQ,
      },
      legacy.cookie,
    ),
  );
  assert.equal(old.status, 200);
  const oldP = (await old.json()).profile;
  await query("DELETE FROM onboarding_confirmations WHERE user_id=$1", [
    legacy.id,
  ]);
  const oldAccess = await (
    await me(req("/api/me", undefined, legacy.cookie))
  ).json();
  assert.equal(oldAccess.requiresQuestionnaire, false);
  assert.equal(oldAccess.profile.questionnaire.version, 1);
  const editOld = await put(
    req(
      "/api/me",
      {
        ...initialProfile,
        role: "beginner",
        name: "Profil historique",
        discord: "legacy_profile",
        bio: legacyQ.experienceText,
        goals: legacyQ.objectives,
      },
      legacy.cookie,
    ),
  );
  assert.equal(
    editOld.status,
    200,
    "Existing members must not be forced to answer the new questionnaire",
  );
  assert.equal((await save(a, legacy.cookie)).status, 200);
  const migrated = await (
    await me(req("/api/me", undefined, legacy.cookie))
  ).json();
  assert.equal(migrated.profile.id, oldP.id);
  assert.equal(migrated.profile.questionnaire.legacy.cash, legacyQ.cash);
  assert.equal(migrated.profile.bio, legacyQ.experienceText);
  const proof = "12345678-1234-4234-8234-123456789abc";
  const proofList = proofIds({
    ...m,
    legacy: { version: 1, role: "mentor", flexFile: proof, months: [] } as any,
  });
  assert.deepEqual(proofList, [proof]);
  assert.equal(
    (await query("SELECT * FROM verifications")).length,
    0,
    "Onboarding must never approve a mentor",
  );
  await query(
    "INSERT INTO verifications(user_id,revision,status,dossier,feedback,submitted_at,reviewed_at,reviewer_id) VALUES($1,'historic','approved','{}','',$2,$2,'historic-reviewer')",
    [mentor.id, new Date().toISOString()],
  );
  const legacyMentor = {
    version: 1,
    role: "mentor",
    started: "2020-01",
    record: 10000,
    platforms: "Vinted et eBay",
    brands: "Marques déjà connues par ce compte",
    model: "Niche",
    audience: ["Débutants"],
    calls: true,
    flexText: "Une réussite historique à conserver",
    flexFile: proof,
    months: [],
    categories: ["Luxe"],
  };
  await query(
    "INSERT INTO verification_files(id,user_id,name,mime,size,stored_path,created_at) VALUES($1,$2,'historic.png','image/png',1,'local-test-only',$3)",
    [proof, mentor.id, new Date().toISOString()],
  );
  const oldMentor = await put(
    req(
      "/api/me",
      {
        ...initialProfile,
        role: "mentor",
        name: "Parrain historique",
        discord: "historic_mentor",
        bio: "Biographie historique du parrain.",
        goals: "Transmettre mes connaissances.",
        experience: 12,
        questionnaire: legacyMentor,
      },
      mentor.cookie,
    ),
  );
  assert.equal(oldMentor.status, 200);
  assert.equal((await save(m, mentor.cookie)).status, 200);
  const preserved = await (
    await me(req("/api/me", undefined, mentor.cookie))
  ).json();
  assert.equal(preserved.profile.questionnaire.legacy.flexFile, proof);
  assert.equal(preserved.profile.verification.reviewedAt.length > 0, true);
  assert.equal(
    (
      await query("SELECT status FROM verifications WHERE user_id=$1", [
        mentor.id,
      ])
    )[0].status,
    "approved",
  );
  assert.deepEqual(proofIds(preserved.profile.questionnaire), [proof]);
  for (const role of ["mentor", "beginner"]) {
    const publicData = await (
      await directory(req("/api/profiles?role=" + role))
    ).json();
    const text = JSON.stringify(publicData);
    for (const secret of [
      "financialGoal",
      "BUDGET_PRIVE_UNIQUE",
      "25000.75",
      "123456.78",
      '"legacy"',
      '"questionnaire"',
    ])
      assert(!text.includes(secret), secret);
    for (const p of publicData.profiles) {
      assert.equal(p.budget, "Non précisé");
      assert(!p.resell.selections.budget);
      assert(!p.resell.other.budget);
    }
  }
  const filter = await (
    await directory(req("/api/profiles?role=beginner&specialty=method:bot"))
  ).json();
  assert(filter.profiles.some((p: any) => p.id === savedA.data.profile.id));
  const detail = await (
    await directory(
      req("/api/profiles?role=beginner&profile=" + savedA.data.profile.id),
    )
  ).json();
  assert.equal(detail.profile.id, savedA.data.profile.id);
  assert(!JSON.stringify(detail).includes("25000.75"));
  assert(!JSON.stringify(detail).includes("BUDGET_PRIVE_UNIQUE"));
  const searchPrivate = await (
    await directory(req("/api/profiles?role=beginner&q=BUDGET_PRIVE_UNIQUE"))
  ).json();
  assert.equal(searchPrivate.total, 0);
  const historical = publicProfile(
    decode({
      id: "legacy",
      role: "beginner",
      name: "Legacy",
      discord: "private",
      visible: 1,
      details: JSON.stringify({
        ...initialProfile,
        budget: "500 € et plus",
        resell: legacyQ,
      }),
    }),
  );
  assert(!JSON.stringify(historical).includes("123456.78"));
  assert.equal(historical.budget, "Non précisé");
  await query(
    "INSERT INTO follows(follower_id,followed_id,created_at) VALUES($1,$2,$3)",
    [mentor.id, novice.id, new Date().toISOString()],
  );
  const publicFollows = await (
    await follows(req("/api/follows", undefined, mentor.cookie))
  ).json();
  assert(!JSON.stringify(publicFollows).includes("25000.75"));
  assert(
    questionError(
      { ...m, selections: { ...m.selections, experience: ["under6"] } },
      intakeQuestions(m).find(q=>q.id==="experience")!,
    ).includes("six mois"),
  );
  const historicalAccount=await account(5),oldMentorId=crypto.randomUUID();
  await query("INSERT INTO profiles(id,user_id,discord,role,name,details,visible,updated_at) VALUES($1,$2,'legacy_mentor_5','mentor','Parrain historique',$3,1,$4)",[oldMentorId,historicalAccount.id,JSON.stringify({...initialProfile,role:'mentor',name:'Parrain historique',specialty:['Brocante'],experience:36,bio:'Ma présentation historique de parrain.',capacity:2}),new Date().toISOString()]);
  const oldMentorRead=await(await me(req('/api/me',undefined,historicalAccount.cookie))).json();assert.equal(oldMentorRead.requiresQuestionnaire,false);assert.equal(oldMentorRead.profile.bio,'Ma présentation historique de parrain.');assert(!oldMentorRead.profile.mentorActivity);
  assert.equal((await directory(req('/api/profiles?profile='+oldMentorId))).status,200);
  const activityApi=await import("../app/api/mentor-activity/route");
  const activityModel=await import("../lib/mentor-activity");
  const activityStore=await import("../lib/mentor-activity-store");
  assert(!intakeQuestions(m).some(q=>q.id==="methods"));
  const historicalMethods={...m,selections:{...m.selections,methods:["bot","mainstream"]}};
  assert.deepEqual(intakeSchema.parse(historicalMethods).selections.methods,["bot","mainstream"]);
  const extra={...activityModel.emptyMentorActivity(),categories:["secondhand","other"],categoryOther:"Accessoires",specializations:["niche","other"],specializationOther:"Une spécialisation personnelle",methods:["manual","wholesale","other"],methodOther:"Méthode personnelle"};
  assert(activityModel.mentorActivitySchema.safeParse(extra).success);
  assert(!activityModel.mentorActivitySchema.safeParse({...extra,methodOther:""}).success);
  assert(!activityModel.mentorActivitySchema.safeParse({...extra,methods:["lots"]}).success);
  const normalized=activityModel.mentorActivitySchema.parse({...extra,categories:["books"]});assert.deepEqual(normalized.specializations,[]);assert.equal(normalized.specializationOther,"");
  assert.equal((await activityApi.GET(req("/api/mentor-activity"))).status,403);
  assert.equal((await activityApi.GET(req("/api/mentor-activity",undefined,novice.cookie))).status,403);
  const extraRequest=(body:unknown,cookie=mentor.cookie,origin=base)=>new Request(base+"/api/mentor-activity",{method:"PUT",headers:{cookie,origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
  assert.equal((await activityApi.PUT(extraRequest({activity:extra,bio:"Description facultative"},novice.cookie))).status,403);
  assert.equal((await activityApi.PUT(extraRequest({activity:extra,bio:"Description"},mentor.cookie,"https://foreign.invalid"))).status,403);
  assert.equal((await activityApi.PUT(extraRequest({activity:extra,bio:"Description",ownerId:novice.id}))).status,400);
  const oldAnswers=await query("SELECT answers FROM onboarding_answers WHERE user_id=$1",[mentor.id]);
  const result=await activityApi.PUT(extraRequest({activity:extra,bio:"Ma présentation personnalisée."}));assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
  const savedExtra=await(await activityApi.GET(req("/api/mentor-activity",undefined,mentor.cookie))).json();assert.equal(savedExtra.bio,"Ma présentation personnalisée.");assert.deepEqual(savedExtra.activity.methods,extra.methods);assert.equal(savedExtra.completed,true);
  assert.deepEqual(await query("SELECT answers FROM onboarding_answers WHERE user_id=$1",[mentor.id]),oldAnswers);
  const ownExtra=await(await me(req("/api/me",undefined,mentor.cookie))).json();assert.equal(ownExtra.profile.bio,"Ma présentation personnalisée.");assert.deepEqual(ownExtra.profile.mentorActivity.categories,extra.categories);
  const publicExtra=await(await directory(req("/api/profiles?role=mentor&profile="+ownExtra.profile.id))).json();assert.equal(publicExtra.profile.bio,"Ma présentation personnalisée.");assert.deepEqual(publicExtra.profile.mentorActivity.methods,extra.methods);assert(!JSON.stringify(publicExtra).includes("9374.5"));assert(!publicExtra.profile.questionnaire);
  await activityStore.saveMentorActivity(mentor.id,{activity:{...extra,categories:["books"]},bio:""});const clearedSpecial=await activityStore.readMentorActivity(mentor.id);assert.deepEqual(clearedSpecial.activity.specializations,[]);assert.equal(clearedSpecial.bio,"");
  await activityStore.saveMentorActivity(mentor.id,{activity:activityModel.emptyMentorActivity(),bio:""});assert.deepEqual((await activityStore.readMentorActivity(mentor.id)).activity,activityModel.emptyMentorActivity());
  await query("INSERT INTO profile_blocks(user_id,reason,created_at,moderator_id) VALUES($1,'Test',$2,$1)",[mentor.id,new Date().toISOString()]);
  await assert.rejects(()=>activityStore.saveMentorActivity(mentor.id,{activity:extra,bio:"Interdit"}));
  await query("DELETE FROM profile_blocks WHERE user_id=$1",[mentor.id]);
  console.log("PASS: optional mentor activity, exact choices, conditional cleanup, other answers, owner/role/CSRF/block guards, durable storage and public rendering, empty biography, historical methods and unchanged initial skills.");
  const {CRM_OWNER_EMAIL}=await import('../lib/crm');
  const {retireOwnerLegacyAccompaniments}=await import('../lib/legacy-retirement');
  const {currentProfileSections}=await import('../lib/profile-modern');
  const biography=await import('../app/api/admin/profile-biography/route');
  const legacyApi=await import('../app/api/accompaniments/route');
  const owner=await account(6,CRM_OWNER_EMAIL);await save(m,owner.cookie);
  assert.equal((await biography.PUT(req('/api/admin/profile-biography',{bio:'Interdit'},owner.cookie))).status,403);
  await query('INSERT INTO moderators(user_id,email) VALUES($1,$2)',[owner.id,CRM_OWNER_EMAIL]);
  const at=new Date().toISOString(),activeId=crypto.randomUUID(),pendingId=crypto.randomUUID(),otherId=crypto.randomUUID();
  for(const [id,beginnerId,mentorId,status] of [[activeId,novice.id,owner.id,'active'],[pendingId,experienced.id,owner.id,'pending'],[otherId,historicalAccount.id,mentor.id,'active']])await query('INSERT INTO accompaniments(id,beginner_id,mentor_id,status,created_at) VALUES($1,$2,$3,$4,$5)',[id,beginnerId,mentorId,status,at]);
  const expected=await query("SELECT id FROM accompaniments WHERE (mentor_id=$1 OR beginner_id=$1) AND status IN ('pending','active')",[owner.id]);
  assert.equal(await retireOwnerLegacyAccompaniments(),expected.length);assert.equal(await retireOwnerLegacyAccompaniments(),0);
  assert.equal((await query('SELECT status FROM accompaniments WHERE id=$1',[activeId]))[0].status,'cancelled');
  assert.equal((await query('SELECT status FROM accompaniments WHERE id=$1',[pendingId]))[0].status,'cancelled');
  assert.equal((await query('SELECT status FROM accompaniments WHERE id=$1',[otherId]))[0].status,'active');
  assert.equal(JSON.parse(String((await query('SELECT snapshot FROM legacy_retirements WHERE accompaniment_id=$1',[activeId]))[0].snapshot)).status,'active');
  assert.deepEqual((await(await legacyApi.GET(req('/api/accompaniments',undefined,owner.cookie))).json()).accompaniments,[]);
  assert.equal((await legacyApi.POST(new Request(base+'/api/accompaniments',{method:'POST',headers:{cookie:owner.cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({targetProfileId:savedA.data.profile.id})}))).status,410);
  assert.equal((await biography.PUT(req('/api/admin/profile-biography',{bio:'Non autorisé'},mentor.cookie))).status,403);
  assert.equal((await biography.PUT(req('/api/admin/profile-biography',{bio:'Ma bio',userId:mentor.id},owner.cookie))).status,400);
  assert.equal((await biography.PUT(req('/api/admin/profile-biography',{bio:'x'.repeat(1001)},owner.cookie))).status,400);
  assert.equal((await biography.PUT(new Request(base+'/api/admin/profile-biography',{method:'PUT',headers:{cookie:owner.cookie,Origin:'https://foreign.invalid','Content-Type':'application/json'},body:JSON.stringify({bio:'CSRF'})}))).status,403);
  for(const bio of ['Ma nouvelle biographie.', '']){assert.equal((await biography.PUT(req('/api/admin/profile-biography',{bio},owner.cookie))).status,200);assert.equal((await(await me(req('/api/me',undefined,owner.cookie))).json()).profile.bio,bio);}
  assert.equal((await query('SELECT bio FROM mentor_portfolios WHERE user_id=$1',[owner.id]))[0].bio,'');
  const clean=currentProfileSections({...initialProfile,id:'test',specialty:['Expert en photo','Vintage'],bio:'Ma bio',role:'mentor'});assert.deepEqual(clean.skills,['Photos et annonces']);assert(!JSON.stringify(clean).includes('Vintage'));assert(!JSON.stringify(clean).includes('Expert en photo'));
  const current=currentProfileSections(publicExtra.profile);assert(current.skills.length>0);assert(!JSON.stringify(current).includes('9374.5'));
  console.log('PASS: owner-only legacy retirement, archived snapshots, idempotence, untouched other pairs, biography authorization/CSRF/validation/save/clear, current profile projection without obsolete labels or finances.');
  if(process.env.MENTORA_KEEP_UI_FIXTURE){
    await activityStore.saveMentorActivity(mentor.id,{activity:extra,bio:"Je partage mes conseils en sourcing de vêtements de seconde main et en création d’annonces. ".repeat(6)});
    console.log("UI_FIXTURE="+dir);
  }
  console.log(
    "PASS: both beginner branches, mentor eligibility, conditional reconciliation, precise capacity, multiple/other answers, numeric goals, final profile creation, durable save/read/edit, private money in directory/detail/follows/search, old account/data/proof compatibility, legal version, authorization and no automatic verification. No remote data or e-mails used.",
  );
} finally {
  const db = database();
  if (db instanceof DatabaseSync) db.close();
  process.chdir(repo);
  if(!process.env.MENTORA_KEEP_UI_FIXTURE)await rm(dir, { recursive: true, force: true });
}
