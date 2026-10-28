import type { Metadata } from "next";
import { Suspense } from "react";

import { CreateExperience } from "@/components/create-experience";

export const metadata: Metadata = { title: "Lay something to rest" };

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="wide-page map-loading">Preparing an open place…</div>}>
      <CreateExperience />
    </Suspense>
  );
}
