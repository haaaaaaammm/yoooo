import Link from "next/link";

import { ADMIN_PATH } from "@/lib/posts";

type AdminMode =
  | "archivo"
  | "planned-parenthood"
  | "poemario"
  | "walter-bazar";

type ModeSwitcherProps = {
  activeMode: AdminMode;
};

const modes: { href: string; id: AdminMode; label: string }[] = [
  { href: ADMIN_PATH, id: "poemario", label: "poemario" },
  { href: `${ADMIN_PATH}?app=archivo`, id: "archivo", label: "archivo" },
  {
    href: `${ADMIN_PATH}?app=walter-bazar`,
    id: "walter-bazar",
    label: "walter bazar",
  },
  {
    href: `${ADMIN_PATH}?app=planned-parenthood`,
    id: "planned-parenthood",
    label: "planned parenthood",
  },
];

export default function ModeSwitcher({ activeMode }: ModeSwitcherProps) {
  return (
    <nav
      aria-label="Publishing mode"
      className="flex flex-wrap gap-2 border-b border-neutral-800 px-4 py-3"
    >
      {modes.map((mode) => {
        const isActive = mode.id === activeMode;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-full bg-[#ff003c]/10 px-4 py-2 text-sm text-[#ff003c]"
                : "rounded-full px-4 py-2 text-sm text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c]"
            }
            href={mode.href}
            key={mode.id}
          >
            {mode.label}
          </Link>
        );
      })}
    </nav>
  );
}
