"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { SeasonHistoryOption } from "@/lib/types";

interface SeasonPickerProps {
  options: SeasonHistoryOption[];
  selectedSeasonName: string;
}

export function SeasonPicker({ options, selectedSeasonName }: SeasonPickerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onSeasonChange(nextSeasonName: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", nextSeasonName);

    startTransition(() => {
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <label className="season-picker">
      Season
      <select
        value={selectedSeasonName}
        onChange={(event) => onSeasonChange(event.target.value)}
        disabled={pending}
      >
        {options.map((option) => (
          <option key={option.seasonName} value={option.seasonName}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
