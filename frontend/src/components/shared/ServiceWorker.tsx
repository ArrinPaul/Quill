"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Registers the service worker in production and offers to reload when a new one is ready. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const offerUpdate = (worker: ServiceWorker) => {
      toast("A new version of Quill is ready.", {
        duration: Infinity,
        action: {
          label: "Update",
          onClick: () => {
            navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
            worker.postMessage("SKIP_WAITING");
          },
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            // With no controller this is the first install, not an update.
            if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
          });
        });
      })
      .catch((err) => console.error("Service worker registration failed:", err));
  }, []);

  return null;
}
