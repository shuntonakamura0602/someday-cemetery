import Link from "next/link";

import type { RuntimeConfig } from "@/components/runtime-config";

export function SiteFooter({ config }: { config: RuntimeConfig }) {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-name">Someday Cemetery</p>
        <p className="muted">A resting place for unfinished things.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/guidelines">Guidelines</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        {config.supportEmail ? <a href={`mailto:${config.supportEmail}`}>Support</a> : null}
      </nav>
    </footer>
  );
}
