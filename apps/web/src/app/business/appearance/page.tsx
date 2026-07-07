"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { usePortal } from "../portal-provider";
import { AppearanceStudio } from "./appearance-studio";

/** Appearance — per-venue color theme + menu layout, with a live customer preview. */
export default function AppearancePage() {
  const { restaurant, canManage } = usePortal();
  const { t } = useI18n();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!canManage) router.replace("/business/orders");
  }, [canManage, router]);

  useEffect(() => {
    void getSupabase()
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order")
      .overrideTypes<Category[], { merge: false }>()
      .then(({ data }) => setCategories(data ?? []));
  }, [restaurant.id]);

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="px-6 pt-5 pb-3.5 flex flex-col gap-1">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.portal.appearance.title}</h1>
        <p className="text-sm text-muted">{t.portal.appearance.subtitle}</p>
      </div>
      <div className="px-6 pb-8">
        <AppearanceStudio restaurant={restaurant} categories={categories} />
      </div>
    </div>
  );
}
