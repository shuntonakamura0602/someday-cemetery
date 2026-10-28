import Link from "next/link";

import type { PublicGraveDto } from "@/domain";

export function GraveList({ graves, empty = "No graves are resting here yet." }: { graves: PublicGraveDto[]; empty?: string }) {
  if (!graves.length) return <div className="empty-state">{empty}</div>;
  return (
    <div className="grave-list">
      {graves.map((grave) => (
        <Link className="grave-list-item" href={`/g/${grave.id}`} key={grave.id}>
          <div>
            <div className="grave-list-meta">
              <span>Garden {grave.gardenOrdinal ?? 1} · Plot {grave.plotIndex + 1}</span>
              {grave.isExample ? <span className="badge badge-example">Example</span> : null}
            </div>
            <h3>{grave.title}</h3>
            {grave.epitaph ? <p>{grave.epitaph}</p> : null}
          </div>
          <span className="grave-list-arrow" aria-hidden="true">↗</span>
        </Link>
      ))}
    </div>
  );
}
