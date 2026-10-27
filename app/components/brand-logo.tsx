import Image from "next/image";

/** The supplied Mentora emblem, shared by every navigation layout. */
export function BrandLogo() {
  return <Image className="brand-emblem" src="/mentora-logo.png" alt="" width={48} height={48} sizes="48px" />;
}
