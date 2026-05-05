"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface GcScoreboardWidgetProps {
  widgetId: string;
  onLiveStatusChange?: (hasLive: boolean) => void;
}

export function GcScoreboardWidget({ widgetId, onLiveStatusChange }: GcScoreboardWidgetProps) {
  const divId = `gc-scoreboard-widget-${widgetId.slice(0, 8)}`;
  const observerRef = useRef<MutationObserver | null>(null);
  const liveStatusRef = useRef<boolean | null>(null);

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

    const container = document.getElementById(divId);
    if (!container) return;

    function hidePastAndFutureGames() {
      if (container!.children.length === 0) return;

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

      const hasLive = liveCards.size > 0;

      // Notify parent only when status changes to avoid re-render loops
      if (hasLive !== liveStatusRef.current) {
        liveStatusRef.current = hasLive;
        onLiveStatusChange?.(hasLive);
      }

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
