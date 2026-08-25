"use client";

/* `app/RemoteWidgetSection.tsx` — ห่อด้วย 
`next/dynamic({ ssr: false })` 
(เหตุผลในข้อ 3.5 — **`React.lazy` เฉยๆ ไม่พอ**): */
import dynamic from "next/dynamic";

const RemoteWidgetIsolated = dynamic(() => import("./RemoteWidgetIsolated"), {
  ssr: false,
});

export default function RemoteWidgetSection() {
  return <RemoteWidgetIsolated />;
}
