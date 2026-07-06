"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Toggle } from "@/components/ui";

interface Config {
  reviews_enabled: boolean;
  moderation_mode: "manual" | "auto" | "disabled";
  allow_comments: boolean;
  max_comment_len: number;
  review_window_days: number;
}

/** Platform-admin global reviews configuration. */
export function ReviewsConfig() {
  const { t } = useI18n();
  const supabase = getSupabase();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("platform_reviews_config")
      .select("reviews_enabled, moderation_mode, allow_comments, max_comment_len, review_window_days")
      .maybeSingle();
    setCfg((data as Config | null) ?? null);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (p: Partial<Config>) => setCfg((c) => (c ? { ...c, ...p } : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    await supabase.from("platform_reviews_config").update(cfg).eq("id", true);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!cfg) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-7 h-7 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const modes: { key: Config["moderation_mode"]; label: string }[] = [
    { key: "manual", label: t.admin.cfgModManual },
    { key: "auto", label: t.admin.cfgModAuto },
    { key: "disabled", label: t.admin.cfgModDisabled },
  ];

  return (
    <div className="flex flex-col gap-3 max-w-[560px]">
      <h1 className="font-display font-extrabold text-2xl text-ink">{t.admin.reviewsConfig}</h1>

      <div className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 flex-1">
            <span className="text-[13px] font-extrabold text-ink">{t.admin.cfgEnabled}</span>
            <span className="text-[11.5px] text-muted leading-relaxed">{t.admin.cfgEnabledHint}</span>
          </div>
          <Toggle checked={cfg.reviews_enabled} onChange={(v) => patch({ reviews_enabled: v })} label={t.admin.cfgEnabled} />
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-line">
          <span className="text-[13px] font-extrabold text-ink">{t.admin.cfgModeration}</span>
          <div className="flex gap-1 bg-sand-deep rounded-md p-1 self-start">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => patch({ moderation_mode: m.key })}
                className={`h-8 px-3.5 rounded-sm text-[12.5px] font-extrabold cursor-pointer transition-colors ${
                  cfg.moderation_mode === m.key ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
          <span className="text-[13px] font-extrabold text-ink">{t.admin.cfgComments}</span>
          <Toggle checked={cfg.allow_comments} onChange={(v) => patch({ allow_comments: v })} label={t.admin.cfgComments} />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
          <span className="text-[13px] font-extrabold text-ink">{t.admin.cfgMaxLen}</span>
          <input
            type="number"
            min={40}
            max={2000}
            value={cfg.max_comment_len}
            onChange={(e) => patch({ max_comment_len: Number(e.target.value) || 0 })}
            className="h-10 w-24 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-sm font-bold text-ink tabular-nums outline-none focus:border-harissa"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
          <span className="text-[13px] font-extrabold text-ink">{t.admin.cfgWindow}</span>
          <input
            type="number"
            min={1}
            max={365}
            value={cfg.review_window_days}
            onChange={(e) => patch({ review_window_days: Number(e.target.value) || 0 })}
            className="h-10 w-24 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-sm font-bold text-ink tabular-nums outline-none focus:border-harissa"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="h-11 px-6 self-start rounded-lg bg-harissa text-white font-extrabold text-sm shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:opacity-50"
      >
        {saved ? t.admin.cfgSaved : t.admin.cfgSave}
      </button>
    </div>
  );
}
