import { createInstance } from "@module-federation/runtime";

export const mfInstance = createInstance({
  name: "shell_nextjs",
  remotes: [
    {
      name: "widget_react19",
      // dev: ชี้ localhost, prod: ชี้ URL จริงของ widget-react19 บน Vercel (ตั้งเป็น env var)
      entry:
        process.env.NEXT_PUBLIC_WIDGET_REMOTE_ENTRY ??
        "http://localhost:4174/remoteEntry.js",
      type: "module", // จำเป็น — remote build ด้วย Vite ออกมาเป็น ESM ไม่ใช่ UMD/var แบบ webpack เก่า
    },
  ],
});
