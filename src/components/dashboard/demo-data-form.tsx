"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { seedDemoData, type DemoState } from "@/actions/demo";
import { useLocale } from "@/lib/i18n/locale-provider";

function Submit() {
  const { pending } = useFormStatus();
  const { t } = useLocale();
  return <button disabled={pending} className="rounded-xl bg-[#365842] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? t("fillingDemo") : t("fillDemo")}</button>;
}

export function DemoDataForm() {
  const { t } = useLocale();
  const router = useRouter();
  const [state, action] = useActionState<DemoState, FormData>(async (previous, formData) => {
    void previous; void formData;
    const result = await seedDemoData();
    if (result.success) router.refresh();
    return result;
  }, {});
  return <div className="mt-6 rounded-2xl border border-dashed border-[#cbd8c8] bg-white p-5">
    <h2 className="font-semibold">{t("demo")}</h2>
    <p className="mt-1 text-sm text-[#737c71]">{t("demoDescription")}</p>
    <form action={action} className="mt-4"><Submit /></form>
    {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
    {state.message && <p role="status" className="mt-3 text-sm text-[#45634b]">{state.message}</p>}
  </div>;
}
