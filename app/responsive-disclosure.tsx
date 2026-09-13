"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

type ResponsiveDisclosureProps = {
  storageKey: string;
  title: ReactNode;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  mobileDefaultOpen?: boolean;
};

const MOBILE_QUERY = "(max-width: 600px)";

export default function ResponsiveDisclosure({
  storageKey,
  title,
  summary,
  children,
  className = "",
  mobileDefaultOpen = false,
}: ResponsiveDisclosureProps) {
  const bodyId = useId();
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const applyViewport = (matches: boolean) => {
      setMobile(matches);
      if (!matches) {
        setOpen(true);
        return;
      }
      const stored = window.sessionStorage.getItem(`adnd-responsive-section:${storageKey}`);
      setOpen(stored === null ? mobileDefaultOpen : stored === "open");
    };
    applyViewport(query.matches);
    const handleChange = (event: MediaQueryListEvent) => applyViewport(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, [mobileDefaultOpen, storageKey]);

  function toggle() {
    if (!mobile) return;
    setOpen((current) => {
      const next = !current;
      window.sessionStorage.setItem(`adnd-responsive-section:${storageKey}`, next ? "open" : "closed");
      return next;
    });
  }

  return (
    <section className={`responsive-disclosure ${open ? "is-open" : "is-collapsed"} ${className}`.trim()}>
      <button
        type="button"
        className="responsive-disclosure-summary"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <strong>{title}</strong>
        <span>{summary}</span>
        <b aria-hidden>{open ? "▾" : "▸"}</b>
      </button>
      <div id={bodyId} className="responsive-disclosure-body" hidden={mobile && !open}>
        {children}
      </div>
    </section>
  );
}
