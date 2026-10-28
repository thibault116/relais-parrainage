export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(
    value instanceof Date
      ? value
      : typeof value === "number"
        ? value
        : String(value),
  );
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export function frenchDate(value: string, language = "fr-FR") {
  return new Date(value).toLocaleDateString(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}
export function elapsedLabel(
  value: string,
  now: number,
  mode: "activity" | "since",
  language = "fr-FR",
) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60000),
  );
  if (language === "en-GB") {
    if (minutes < 1)
      return mode === "activity" ? "just now" : "for a few moments";
    if (minutes >= 7 * 24 * 60)
      return `${mode === "activity" ? "on" : "since"} ${frenchDate(value, language)}`;
    const [n, unit] =
      minutes < 60
        ? [minutes, "minute"]
        : minutes < 1440
          ? [Math.floor(minutes / 60), "hour"]
          : [Math.floor(minutes / 1440), "day"];
    const duration = `${n} ${unit}${Number(n) > 1 ? "s" : ""}`;
    return mode === "activity" ? `${duration} ago` : `for ${duration}`;
  }
  if (minutes < 1)
    return mode === "activity" ? "à l’instant" : "depuis quelques instants";
  if (minutes >= 7 * 24 * 60)
    return `${mode === "activity" ? "le" : "depuis le"} ${frenchDate(value)}`;
  const [n, unit] =
    minutes < 60
      ? [minutes, "minute"]
      : minutes < 1440
        ? [Math.floor(minutes / 60), "heure"]
        : [Math.floor(minutes / 1440), "jour"];
  return `${mode === "activity" ? "il y a" : "depuis"} ${n} ${unit}${Number(n) > 1 ? "s" : ""}`;
}
