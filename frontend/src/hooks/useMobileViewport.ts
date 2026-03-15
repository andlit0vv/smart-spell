import { useEffect } from "react";

const KEYBOARD_OFFSET_THRESHOLD = 120;

export const useMobileViewport = () => {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const updateViewport = () => {
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      const offsetTop = window.visualViewport?.offsetTop ?? 0;
      const appHeight = Math.max(visualHeight + offsetTop, 0);

      root.style.setProperty("--app-height", `${appHeight}px`);

      const keyboardOpen = window.innerHeight - visualHeight > KEYBOARD_OFFSET_THRESHOLD;
      body.dataset.keyboardOpen = keyboardOpen ? "true" : "false";
    };

    updateViewport();

    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);
};
