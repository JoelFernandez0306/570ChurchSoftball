"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface GcScoreboardWidgetProps {
  widgetId: string;
}

export function GcScoreboardWidget({ widgetId }: GcScoreboardWidgetProps) {
  const divId = `gc-scoreboard-widget-${widgetId.slice(0, 8)}`;
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  function initWidget() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).GC?.scoreboard?.init({
      target: `#${divId}`,
      widgetId,
      maxVerticalGamesVisible: 4,
    });

    // Hide non-live game cards once the widget renders them
    const container = document.getElementById(divId);
    if (!container) return;

    function hidePastAndFutureGames() {
      // Wait until the widget has actually rendered something
      if (container!.children.length === 0) return;

      // Find the outermost card ancestor that contains a "LIVE" text node
      const liveCards = new Set<HTMLElement>();
      container!.querySelectorAll("*").forEach((el) => {
        if (el.children.length === 0 && /^live$/i.test(el.textContent?.trim() ?? "")) {
          let node: HTMLElement | null = el as HTMLElement;
          while (node && node.parentElement && node.parentElement !== container) {
            node = node.parentElement;
          }
          if (node && node !== container) liveCards.add(node);
        }
      });

      // Show only live game cards; hide everything when none are live
      const topChildren = Array.from(container!.children) as HTMLElement[];
      topChildren.forEach((card) => {
        const isLive = liveCards.has(card) || [...liveCards].some((lc) => card.contains(lc));
        card.style.display = isLive ? "" : "none";
      });
    }

    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(hidePastAndFutureGames);
    observerRef.current.observe(container, { childList: true, subtree: true });
    hidePastAndFutureGames();
  }

  return (
    <>
      <div id={divId} className="scoreboard-widget-container" />
      <Script
        src="https://widgets.gc.com/static/js/sdk.v1.js"
        strategy="afterInteractive"
        onLoad={initWidget}
      />
    </>
  );
}
