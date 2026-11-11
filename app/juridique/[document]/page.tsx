import { ownerPreviewEnabled } from "@/lib/owner-preview";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { legalPages } from "@/lib/legal-versions";
import type { LegalRequestKind } from "@/lib/legal-requests-shared";
import { LegalLinks } from "@/app/components/legal-links";
import { documents } from "./legal-content";
import { LegalRequestForm } from "./request-form";

const forms: Record<string, { title: string; kind: LegalRequestKind }> = {
  resilier: { title: "Résilier ton contrat", kind: "cancellation" },
  retractation: { title: "Renoncer à ton contrat", kind: "withdrawal" },
  signaler: { title: "Signaler un contenu illicite", kind: "report" },
};
const titles: Record<string, string> = Object.fromEntries(legalPages);
titles["conditions-test"] = "Conditions des paiements de test";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/juridique/[document]">): Promise<Metadata> {
  if (!(await ownerPreviewEnabled())) notFound();
  const { document } = await params;
  const title = Object.hasOwn(forms, document) ? forms[document].title : titles[document];
  return { title: `${typeof title === "string" ? title : "Informations légales"} · Mentora` };
}

export default async function LegalDocument({ params }: PageProps<"/juridique/[document]">) {
  if (!(await ownerPreviewEnabled())) notFound();
  const { document } = await params;
  const form = Object.hasOwn(forms, document) ? forms[document] : undefined;
  if (!form && !Object.hasOwn(documents, document)) notFound();
  return (
    <main className="wrap legal-page">
      <a className="legal-home" href="/">← Accueil Mentora</a>
      <p className="legal-note">Aperçu réservé au compte administrateur · Textes à compléter et à faire relire avant publication.</p>
      <h1>{form?.title || titles[document]}</h1>
      {form ? <LegalRequestForm kind={form.kind} /> : <article className="legal-document">{documents[document]}</article>}
      <LegalLinks />
    </main>
  );
}
