"use client";

import Script from "next/script";

interface GcScoreboardWidgetProps {
  widgetId: string;
}

export function GcScoreboardWidget({ widgetId }: GcScoreboardWidgetProps) {
  const divId = `gc-scoreboard-widget-${widgetId.slice(0, 8)}`;

  return (
    <>
      <div id={divId} className="scoreboard-widget-container" />
      <Script
        src="https://widgets.gc.com/static/js/sdk.v1.js"
        strategy="afterInteractive"
        onLoad={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).GC?.scoreboard?.init({
            target: `#${divId}`,
            widgetId,
            maxVerticalGamesVisible: 4,
          });
        }}
      />
    </>
  );
}
