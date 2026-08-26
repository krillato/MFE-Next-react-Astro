import { useState } from "react";

export default function Widget() {
  const [count, setCount] = useState(0);
  return (
    <div className="rounded-card bg-white p-6 shadow-card">
      <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
        Remote widget
      </p>
      <h2 className="mt-1 text-2xl font-bold text-neutral-900">
        React 19 · MFE
      </h2>
      <p className="mt-2 text-sm text-neutral-500">
        โหลดมาจากคนละโปรเจกต์คนละ deploy — สไตล์ทั้งหมดมาจาก{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs">
          @mfe/design-system
        </code>
      </p>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="mt-4 rounded-button bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-dropdown transition hover:bg-brand-600"
      >
        คลิกแล้ว: {count}
      </button>
    </div>
  );
}
