"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SIDEBAR_GUIDE_STEPS } from "@/lib/user-guide";

type TargetRect = { top: number; left: number; width: number; height: number };

const GUIDE_COMPLETED_KEY = "agilecampus:sidebar-guide-completed";

export function UserGuide() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });
  const currentStep = SIDEBAR_GUIDE_STEPS[stepIndex];

  const closeGuide = useCallback(() => {
    setOpen(false);
    setTargetRect(null);
  }, []);

  const openGuide = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("guide") !== "sidebar") return;
    const timer = window.setTimeout(openGuide, 0);
    const url = new URL(window.location.href);
    url.searchParams.delete("guide");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return () => window.clearTimeout(timer);
  }, [openGuide, searchParams]);

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const frame = window.requestAnimationFrame(updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGuide();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGuide, open]);

  useEffect(() => {
    if (!open || !currentStep) return;

    let shouldScrollToTarget = true;
    const updateTarget = () => {
      const element = document.querySelector(currentStep.selector) ?? document.querySelector('[data-guide-id="sidebar"]');
      if (!element) {
        setTargetRect(null);
        return;
      }
      if (shouldScrollToTarget) {
        element.scrollIntoView({ block: "nearest" });
        shouldScrollToTarget = false;
      }
      const rect = element.getBoundingClientRect();
      setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [currentStep, open]);

  if (!open || !currentStep) {
    return (
      <button
        type="button"
        onClick={openGuide}
        aria-label="打开用户指南"
        title="打开用户指南"
        className="fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full bg-primary text-xl font-semibold text-white shadow-lg transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary-ring focus:ring-offset-2"
      >
        ?
      </button>
    );
  }

  const cardWidth = Math.min(352, viewport.width - 32);
  const cardLeft = targetRect && viewport.width >= 720
    ? Math.max(16, Math.min(viewport.width - cardWidth - 16, targetRect.left + targetRect.width + 16))
    : Math.max(16, (viewport.width - cardWidth) / 2);
  const cardTop = targetRect && viewport.width >= 720
    ? Math.max(16, Math.min(viewport.height - 300, targetRect.top - 8))
    : Math.max(16, (viewport.height - 260) / 2);

  const finishGuide = () => {
    window.localStorage.setItem(GUIDE_COMPLETED_KEY, "1");
    closeGuide();
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="user-guide-title">
      {targetRect ? (
        <>
          <button type="button" aria-label="退出用户指南" onClick={closeGuide} className="fixed left-0 top-0 z-0 w-full bg-slate-950/75" style={{ height: Math.max(0, targetRect.top - 6) }} />
          <button type="button" aria-label="退出用户指南" onClick={closeGuide} className="fixed bottom-0 left-0 z-0 w-full bg-slate-950/75" style={{ top: targetRect.top + targetRect.height + 6 }} />
          <button type="button" aria-label="退出用户指南" onClick={closeGuide} className="fixed left-0 z-0 bg-slate-950/75" style={{ top: targetRect.top - 6, left: 0, width: Math.max(0, targetRect.left - 6), height: targetRect.height + 12 }} />
          <button type="button" aria-label="退出用户指南" onClick={closeGuide} className="fixed right-0 z-0 bg-slate-950/75" style={{ top: targetRect.top - 6, left: targetRect.left + targetRect.width + 6, height: targetRect.height + 12 }} />
        </>
      ) : (
        <button
          type="button"
          aria-label="退出用户指南"
          onClick={closeGuide}
          className="absolute inset-0 h-full w-full cursor-default bg-slate-950/75"
        />
      )}
      {targetRect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[0.6rem] bg-amber-300/15 ring-4 ring-amber-300 transition-all duration-200"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.95), 0 0 28px rgba(252,211,77,0.9)",
          }}
        />
      )}
      <section
        className="absolute max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl bg-surface p-5 text-ink shadow-2xl ring-1 ring-white/20"
        style={{ top: cardTop, left: cardLeft, width: cardWidth }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-primary">侧边栏使用指南 · {stepIndex + 1}/{SIDEBAR_GUIDE_STEPS.length}</p>
            <h2 id="user-guide-title" className="mt-1 font-display text-lg font-semibold">{currentStep.title}</h2>
          </div>
          <button
            type="button"
            onClick={closeGuide}
            aria-label="关闭用户指南"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl leading-none text-ink-soft hover:bg-sunken hover:text-ink"
          >
            ×
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-soft">{currentStep.description}</p>
        <p className="mt-3 text-xs text-ink-faint">可以随时按 Esc、点击遮罩或右上角 × 退出，之后点击右下角 ? 继续查看。</p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button type="button" onClick={closeGuide} className="ac-btn-ghost">跳过引导</button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              disabled={stepIndex === 0}
              className="ac-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一步
            </button>
            {stepIndex === SIDEBAR_GUIDE_STEPS.length - 1 ? (
              <button type="button" onClick={finishGuide} className="ac-btn">完成</button>
            ) : (
              <button type="button" onClick={() => setStepIndex((index) => Math.min(SIDEBAR_GUIDE_STEPS.length - 1, index + 1))} className="ac-btn">
                下一步
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
