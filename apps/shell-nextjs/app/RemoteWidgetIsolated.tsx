"use client";

import { useEffect, useRef } from "react";
import { mfInstance } from "@/lib/mf";

type MountFn = (el: HTMLElement) => { unmount: () => void };

export default function RemoteWidgetIsolated() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let root: { unmount: () => void } | undefined;
    let cancelled = false;

    mfInstance
      .loadRemote<{ mount: MountFn }>("widget_react19/mount")
      .then((mod) => {
        if (cancelled || !ref.current || !mod) return;
        root = mod.mount(ref.current);
      });

    return () => {
      cancelled = true;
      root?.unmount();
    };
  }, []);

  return <div ref={ref}>กำลังโหลด widget จาก remote...</div>;
}
