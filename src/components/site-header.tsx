"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useRuntimeConfig } from "@/components/runtime-config";

const links = [
  ["/", "Cemetery"],
  ["/my-graves", "My graves"],
  ["/about", "About"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const config = useRuntimeConfig();

  return (
    <>
      {config.dataBackend === "demo" ? (
        <div className="demo-ribbon" role="status">
          <span className="demo-ribbon-dot" aria-hidden="true" />
          Demo — changes stay in this browser
        </div>
      ) : null}
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Someday Cemetery, home">
          <span className="wordmark-mark" aria-hidden="true">
            <span />
          </span>
          <span>Someday Cemetery</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <Link className="button button-small button-light" href="/create">
            Lay something to rest
          </Link>
        </nav>
      </header>
    </>
  );
}
