import Image from "next/image";

/** Theme variants retain the same Mentora emblem. */
export function BrandLogo() {
  return <>
    <Image className="brand-emblem brand-emblem-dark" src="/mentora-logo.png" alt="" width={48} height={48} />
    <Image className="brand-emblem brand-emblem-light" src="/mentora-logo-light.png" alt="" width={48} height={48} />
  </>;
}
