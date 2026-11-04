import type { Metadata } from "next";
import { Suspense } from "react";

import { CreateExperience } from "@/components/create-experience";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "未完成のものを眠らせる" : "Lay something to rest" };
}

export default async function CreatePage() {
  const locale = await getServerLocale();
  return (
    <Suspense fallback={<div className="wide-page map-loading">{locale === "ja" ? "空いている場所を用意しています…" : "Preparing an open place…"}</div>}>
      <CreateExperience />
    </Suspense>
  );
}
