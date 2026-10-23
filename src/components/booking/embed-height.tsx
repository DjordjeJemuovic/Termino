"use client";

import { useEffect } from "react";

export function EmbedHeight() {
  useEffect(() => {
    if (window.parent === window) return;
    const sendHeight = () => window.parent.postMessage({ type: "termino:resize", height: document.documentElement.scrollHeight }, "*");
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    sendHeight();
    return () => observer.disconnect();
  }, []);
  return null;
}
