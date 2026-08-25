import { useState } from "react";

export default function Widget() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ border: "2px dashed #6366f1", padding: 16, borderRadius: 8 }}>
      <p>👋 นี่คือ React 19 remote widget (โหลดมาจากคนละโปรเจกต์คนละ deploy)</p>
      <button onClick={() => setCount((c) => c + 1)}>คลิกแล้ว: {count}</button>
    </div>
  );
}
