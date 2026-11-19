import { initialProfile, type ProfileInput } from "./profile";
import {
  answerLabels,
  intakeCapacity,
  intakeExperience,
  intakeQuestions,
  type IntakeAnswers,
} from "./intake";

export function intakeProfile(
  d: IntakeAnswers,
  previous?: Partial<ProfileInput> | null,
  name = "",
): ProfileInput {
  const questions = intakeQuestions(d),
    labels = (key: string) => {
      const q = questions.find((q) => q.id === key);
      return q ? answerLabels(d, q).join(" · ") : "";
    };
  const specialty = new Set<ProfileInput["specialty"][number]>();
  for (const method of d.selections.methods || []) {
    if (method === "bot") specialty.add("Bot");
    if (method === "flea") specialty.add("Brocante");
    if (method === "luxury") specialty.add("Luxe");
  }
  if (d.selections.help?.includes("sourcing")) specialty.add("Fournisseur");
  if (d.selections.help?.includes("photos")) specialty.add("Expert en photo");
  if (!specialty.size) specialty.add("Généraliste");
  const minimum = intakeExperience(d),
    upper = (
      { "6to12": 12, "1to2": 24, "2to5": 60, over5: Infinity } as Record<
        string,
        number
      >
    )[d.selections.experience?.[0] || ""];
  const experience =
    d.role === "mentor"
      ? previous?.role === "mentor" &&
        previous.experience !== undefined &&
        previous.experience >= minimum &&
        previous.experience <= upper
        ? previous.experience
        : minimum
      : previous?.experience || 0;
  return {
    ...initialProfile,
    ...previous,
    role: d.role,
    name: name || previous?.name || "",
    discord: previous?.discord || "",
    specialty: [...new Set([...(previous?.specialty || []), ...specialty])],
    experience,
    capacity: d.role === "mentor" ? intakeCapacity(d) : previous?.capacity || 1,
    availability: d.selections.availability?.includes("variable")
      ? "Flexible"
      : d.selections.availability?.includes("evening")
        ? "En soirée"
        : d.selections.availability?.includes("weekend")
          ? "Le week-end"
          : "En journée",
    bio:
      previous?.bio ||
      (d.role === "mentor"
        ? "Je partage mon expérience en achat-revente sur Mentora."
        : "Je souhaite progresser en achat-revente avec la communauté Mentora."),
    goals:
      d.role === "beginner"
        ? labels("goal")
        : "Partager mon expérience et accompagner des débutants.",
    teaching:
      d.role === "mentor"
        ? labels("help").slice(0, 500)
        : previous?.teaching || "",
    references: previous?.references || labels("platforms").slice(0, 300),
    consent: true,
  };
}
