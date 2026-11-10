"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/tim-kiem", label: "Tìm kiếm", icon: "🔍" },
  { href: "/", label: "Mới nhất", icon: "⚡" }
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom" aria-label="Điều hướng chính">
      {items.map((i) => {
        const on = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={on ? "on" : ""}>
            <span aria-hidden>{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
