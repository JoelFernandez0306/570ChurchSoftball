"use client";

import { useState } from "react";
import { GcScoreboardWidget } from "@/components/gc-scoreboard-widget";

export function LiveScoreboardCard({ widgetId }: { widgetId: string }) {
  const [hasLive, setHasLive] = useState(false);

  return (
    <aside
      className="card"
      style={{ display: hasLive ? "" : "none" }}
      aria-hidden={!hasLive}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <h3 style={{ margin: 0 }}>Live Scoreboard</h3>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.35rem",
          fontSize: "0.78rem", fontWeight: 700, color: "#155c35",
          background: "#cbeed7", borderRadius: "999px", padding: "0.2rem 0.6rem",
        }}>
          <span style={{ fontSize: "0.6rem" }}>●</span> Game Day
        </span>
      </div>
      <GcScoreboardWidget widgetId={widgetId} onLiveStatusChange={setHasLive} />
    </aside>
  );
}
