"use client";

import { useEffect, useState, type ReactNode } from "react";

import { fetchStartupModelEndpoint } from "@/lib/model-endpoints";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

/** Resolve the startup endpoint before assistant controls can be used. */
export function AssistantStartup({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    let active = true;
    void (async () => {
      try {
        const maya = await fetchStartupModelEndpoint(controller.signal);
        if (!active || !maya) return;
        const current = useUiPreferencesStore.getState();
        useUiPreferencesStore.setState({
          assistantEndpoint: maya.endpoint,
          assistantModel: current.assistantEndpoint === maya.endpoint && maya.models.includes(current.assistantModel)
            ? current.assistantModel : maya.models[0],
          assistantUseToken: maya.useToken,
        });
      } catch {
        // An unavailable API must not prevent offline editing or erase preferences.
      } finally {
        clearTimeout(timeout);
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return ready ? children : <p role="status" className="p-4">Checking Project Maya…</p>;
}
