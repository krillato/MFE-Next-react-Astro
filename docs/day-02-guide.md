# Day 2 Guide — Module Federation พื้นฐาน (Concept Day)

Day 2 ตามแพลนเป็น **concept day** — เข้าใจหลักการให้แน่นก่อน ส่วน Day 3 ค่อยลงมือ build shell+remote จริง
เนื้อหาเต็มอยู่ที่ Interview-FE route `/micro-frontend` (สร้างไว้ตั้งแต่สัปดาห์ 1) — ไฟล์นี้คือแผนการอ่าน+แบบฝึกหัดสำหรับวันนี้

---

## ⚠️ สิ่งที่ต้องรู้ก่อน: Turbopack (default ของ Next.js 16) ไม่รองรับ webpack plugin

เช็ค docs จริงที่ติดตั้งมากับโปรเจกต์แล้ว (`node_modules/next/dist/docs/.../08-turbopack.md`) เจอบรรทัดนี้ตรงๆ:

> **Turbopack does not support webpack plugins.** This affects third-party tools that rely on webpack's plugin
> system for integration... you'll need to find Turbopack-compatible alternatives or continue using webpack.

**กระทบ Day 3 โดยตรง:** ปกติทำ Module Federation ใน Next.js ต้องใช้ `@module-federation/nextjs-mf` ซึ่งเป็น
**webpack plugin** (hook เข้า `webpack()` config ใน `next.config.js`) — Turbopack ที่เป็น default ของ `next dev`/`next build`
ในเวอร์ชันนี้ **ไม่รันมันให้** เด็ดขาด

**ทางแก้สำหรับ Day 3:** ต้องสั่งรันแบบ opt-out จาก Turbopack ก่อน:
```bash
next dev --webpack
next build --webpack
```
หรือแก้ `package.json` scripts ให้ใช้ `--webpack` เป็นค่าเริ่มต้นเฉพาะตอนทำ MFE demo — วันนี้ (Day 2) ยังไม่ต้องทำอะไร
แค่รู้ไว้ล่วงหน้ากันงงตอน Day 3

---

## วิธีเรียนวันนี้ (Method — ต่างจาก Day 1 นิดหน่อย)

Day 1 เป็น build day (อ่านแล้วลงมือเขียนโค้ดทันที) แต่ Day 2 เป็น **concept day** — เน้น:
1. อ่านทีละหัวข้อ (5-10 นาที)
2. **พูดอธิบายกลับด้วยคำพูดตัวเอง** ไม่เปิดจอดู (Feynman) — ถ้าติดคือยังไม่เข้าใจจริง
3. ทำแบบฝึกหัดเขียน (ไม่ต้องรันโค้ด) ท้ายแต่ละหัวข้อ เพื่อบังคับให้คิดเป็นภาพจริง ไม่ใช่แค่จำนิยาม

---

## ตารางวันนี้

| ช่วง | หัวข้อ | ทำอะไร |
|---|---|---|
| 09:00-10:00 | MFE คืออะไร ทำไมองค์กรใหญ่ถึงใช้ | อ่าน + เขียนข้อดี/ข้อเสีย 3 ข้อด้วยคำพูดตัวเอง |
| 10:00-11:00 | กลยุทธ์การรวมแอป 4 แบบ | อ่าน + ทำตารางเทียบเอง (build-time/iframe/web components/module federation) |
| 11:00-12:30 | สถาปัตยกรรม Host/Remote + shared deps | อ่าน + วาด diagram เอง (มือ/excalidraw ก็ได้) ของระบบ shell+2 remote |
| 13:30-14:30 | Module Federation config (webpack) | อ่านโค้ดตัวอย่างใน `/micro-frontend` ทีละบรรทัด อธิบายว่าแต่ละ key ทำอะไร |
| 14:30-15:30 | Module Federation กับ Next.js เฉพาะ | อ่าน + เข้าใจว่าทำไมต้องใช้ Pages Router (ไม่ใช่ App Router) กับ MFE จริงจัง |
| 15:30-16:30 | Shared deps — จุดพังบ่อย | อ่าน 3 เคส (hook call error, context ไม่เห็นกัน, CSS ชนกัน) + คิดว่าเจอแบบนี้จะ debug ยังไง |
| 16:30-17:30 | แบบฝึกหัดเขียน (ด้านล่าง) | ทำแบบฝึกหัดออกแบบระบบเอง |
| 17:30-18:00 | ทบทวน + self-check | เตรียมตอบคำถามทวนความเข้าใจ |

---

## หัวข้อที่ต้องอธิบายได้ (จาก `/micro-frontend`)

1. **MFE คืออะไร** — นิยาม, เมื่อไหร่ควรใช้/ไม่ควรใช้ (ทีมเดียวทำทั้งแอป → monolith ง่ายกว่า)
2. **กลยุทธ์การรวมแอป 4 แบบ** — build-time (npm package), iframe, Web Components, Module Federation — ข้อดี/ข้อเสียของแต่ละแบบ
3. **สถาปัตยกรรม Host/Remote** — Shell ทำหน้าที่อะไร, Remote ทำหน้าที่อะไร, `shared` คืออะไร
4. **Module Federation config** — `exposes`, `remotes`, `shared` + `singleton: true` ทำไมสำคัญ
5. **Module Federation + Next.js** — ทำไมโปรเจกต์ MFE จริงจังส่วนใหญ่ยังอิง Pages Router ไม่ใช่ App Router (RSC ยังใช้กับ MF ได้ไม่เต็มที่)
6. **Shared deps จุดพังบ่อย** — "Invalid hook call" เกิดจากอะไร, ทำไม Context ข้ามแอปไม่เห็นกัน, CSS ชนกันแก้ยังไง

---

## แบบฝึกหัดเขียน (ไม่ต้องรันโค้ด — ทำวันนี้เพื่อเตรียม Day 3)

ออกแบบระบบ MFE สมมติจากโปรเจกต์ `nextjs-30` ที่มีอยู่แล้ว — แตก `/posts`, `/login`+`/dashboard` ออกเป็น remote แยกกัน:

1. เขียนว่า **shell** ควรเก็บอะไรไว้บ้าง (nav, layout กลาง, อะไรที่ควรอยู่ shell ไม่ใช่ remote)
2. เขียนว่าจะแบ่งเป็นกี่ remote — `posts-remote`, `auth-remote` เหมาะไหม หรือแบ่งแบบอื่นดีกว่า เพราะอะไร
3. เขียน `shared` list ที่ควรมี (เช่น `react`, `react-dom`, อะไรอีกไหม เช่น ถ้ามี design system กลาง)
4. คิดว่า session cookie (จาก `proxy.ts`) ที่ทำไว้ Day 1 จะยังทำงานข้าม remote ได้ไหม เพราะอะไร (hint: cookie อยู่ระดับ browser ไม่ใช่ระดับ JS bundle)

ไม่มีเฉลยตายตัว — เป้าหมายคือฝึกคิดเป็นสถาปัตยกรรมก่อนลงมือ Day 3

---

## เตรียมตัวสำหรับ Day 3 (hands-on)

พรุ่งนี้จะต้อง:
- รัน dev server ด้วย `--webpack` flag (ตามที่อธิบายด้านบน)
- ติดตั้ง `@module-federation/nextjs-mf`
- สร้างโปรเจกต์ remote แยกอย่างน้อย 1 ตัว (คนละ port)

วันนี้ไม่ต้องติดตั้งอะไรก่อน — เตรียมแค่ความเข้าใจให้แน่น จะได้ debug ง่ายขึ้นตอนของจริงมีปัญหา (เพราะ MFE setup มักมีจุดพังเยอะกว่า Day 1 มาก)
