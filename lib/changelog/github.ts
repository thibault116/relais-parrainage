import { repository, shaSchema, emptySections, type Sections, description } from "./shared";

type Release = { id: string; notes: string[] };
type Commit = { sha: string };
type Comparison = { status: string; total_commits: number; commits: Commit[]; files?: { filename: string }[] };

async function github(path: string, raw = false) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(process.env.CHANGELOG_GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.CHANGELOG_GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(12000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 403 || response.status === 429
    ? "GitHub limite temporairement les lectures. Réessaie plus tard."
    : "Impossible de lire cette version dans le dépôt GitHub de Mentora.");
  return response;
}

// Parse the small, versioned release manifest as data. Never execute repository code.
export function parseRelease(source: string): Release {
  const id = /\bid:\s*("(?:[^"\\]|\\.)*")/.exec(source);
  const block = /\bnotes:\s*\[([\s\S]*?)\]/.exec(source);
  if (!id || !block) throw new Error("Le format des notes membres doit être vérifié.");
  const notes = block[1].match(/"(?:[^"\\]|\\.)*"/g)?.map((note) => JSON.parse(note)) || [];
  const releaseId = JSON.parse(id[1]);
  if (typeof releaseId !== "string" || notes.some((note) => typeof note !== "string"))
    throw new Error("Notes membres invalides.");
  return { id: releaseId, notes };
}

async function releaseAt(sha: string) {
  const response = await github(`contents/lib/member-release.ts?ref=${shaSchema.parse(sha)}`, true);
  const source = await response.text();
  if (source.length > 32000) throw new Error("Notes membres trop volumineuses.");
  return parseRelease(source);
}

export async function verifyCommit(sha: string) {
  const response = await github(`commits/${shaSchema.parse(sha)}`);
  const commit = await response.json();
  if (commit.sha !== sha) throw new Error("Commit introuvable.");
}

export async function analyzeChanges(base: string, target: string) {
  const startedAt = Date.now();
  shaSchema.parse(base);
  shaSchema.parse(target);
  const response = await github(`compare/${base}...${target}`);
  const comparison: Comparison = await response.json();
  if (!["ahead", "identical"].includes(comparison.status))
    throw new Error("La production n’est pas dans la continuité du point de départ. Vérifie le suivi.");
  if (comparison.total_commits > 30)
    throw new Error("Plus de 30 commits à examiner. Choisis un point de départ plus récent ou prépare un brouillon manuel.");
  const sections: Sections = { ...emptySections, nouveautés: [], améliorations: [], corrections: [] };
  const evidence: { sha: string; release: string; notes: string[] }[] = [];
  const baseline = await releaseAt(base);
  if (!comparison.files?.some((file) => file.filename === "lib/member-release.ts")) {
    return { sections, evidence, commits: comparison.total_commits, comparisonUrl: `https://github.com/${repository}/compare/${base}...${target}` };
  }
  const revisions: { sha: string; release: Release }[] = [];
  for (let index = 0; index < comparison.commits.length; index += 4) {
    if (Date.now() - startedAt > 20000)
      throw new Error("GitHub répond trop lentement pour terminer l’analyse. Réessaie plus tard.");
    const batch = await Promise.all(comparison.commits.slice(index, index + 4).map(async (commit) =>
      ({ sha: commit.sha, release: await releaseAt(commit.sha) })));
    revisions.push(...batch);
  }
  let previous = baseline.id;
  const known = new Set(baseline.notes);
  for (const { sha, release } of revisions) {
    if (release.id === previous) continue;
    previous = release.id;
    const notes = release.notes.filter((note) => !known.has(note));
    evidence.push({ sha, release: release.id, notes });
    for (const raw of notes) {
      known.add(raw);
      const note = raw.replace(/\s+/g, " ").trim();
      if (!note || note.length > 350) throw new Error("Une note membre doit être raccourcie avant publication.");
      const key = /corrig|bug|erreur|répar|déborde|chevauche|bloqu/i.test(note)
        ? "corrections" : /amélior|plus |désormais|fluid|simplif|rapide|optimis|regroup|harmonis/i.test(note)
          ? "améliorations" : "nouveautés";
      sections[key].push(note);
    }
  }
  if (description(sections).length > 2000 || Object.values(sections).some((notes) => notes.length > 8))
    throw new Error("Les notes dépassent la taille d’une annonce. Prépare un résumé manuel.");
  return {
    sections,
    evidence,
    commits: comparison.total_commits,
    comparisonUrl: `https://github.com/${repository}/compare/${base}...${target}`,
  };
}
