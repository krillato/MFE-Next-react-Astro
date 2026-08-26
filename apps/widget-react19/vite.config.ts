import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "widget_react19",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "./src/mount.tsx", // expose ฟังก์ชัน mount ไม่ใช่ Widget ตรงๆ
      },
      // หมายเหตุ: ไม่ใส่ shared: { react: ... } ตรงนี้ — อ่านเหตุผลในข้อ 2.5
    }),
  ],
  server: { port: 4174, origin: "http://localhost:4174", cors: true }, // cors:true จำเป็น ไม่งั้น host คนละ origin fetch ไม่ได้
  preview: { port: 4174, cors: true },
  build: { target: "esnext" },
});
