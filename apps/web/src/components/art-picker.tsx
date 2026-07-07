"use client";

import { MENU_ART_IDS } from "@chehia/shared";
import { MenuArt } from "./menu-art";

/** Gallery to pick a default illustration for an item/category (or "Auto"). */
export function ArtPicker({
  value,
  onChange,
  autoLabel,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  autoLabel: string;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`w-11 h-11 rounded-md border-[1.5px] text-[10px] font-extrabold flex items-center justify-center text-center cursor-pointer transition-colors ${
          value == null ? "border-harissa text-harissa-pressed bg-harissa-tint" : "border-line text-muted-soft hover:border-line-strong"
        }`}
      >
        {autoLabel}
      </button>
      {MENU_ART_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-label={id}
          className={`rounded-md border-[1.5px] overflow-hidden cursor-pointer transition-colors ${value === id ? "border-harissa" : "border-line hover:border-line-strong"}`}
        >
          <MenuArt id={id} className="w-11 h-11" />
        </button>
      ))}
    </div>
  );
}
