# Day 4 Guide — Shared Design System (Tailwind v4) ข้าม MFE

> **กฎเดิม: ไกด์นี้มีไว้ให้คุณลงมือทำเอง — ผมจะไม่แก้โค้ดในโปรเจกต์คุณให้**
> ทุก code block คือสิ่งที่ต้อง type/run เอง

เป้าหมายวันนี้: สร้าง `packages/design-system` เป็น shared Tailwind config/tokens แบบเดียวกับที่ทำ
`@mfe/shared-types` ไปแล้วในข้อ 9.1 — คราวนี้แชร์ **design tokens** (สี, spacing, font) แทน type ให้ทั้ง
`shell-nextjs` และ `widget-react19` ใช้ร่วมกัน แล้วพิสูจน์ว่าแก้ token กลางที่เดียว ทั้ง 2 แอปเปลี่ยนตาม

**ทุกคำสั่ง/path ในไกด์นี้ผมทดสอบจริงในสภาพแวดล้อมแยกก่อนแล้ว** (Vite 8 + Tailwind v4.3 + pnpm workspace) —
ไม่ใช่เดาจาก docs เฉยๆ

---

## 0. เจอ 2 เรื่องต้องเคลียร์ก่อนเริ่ม (เช็คจากโปรเจกต์จริงของคุณ)

### 0.1 มีไฟล์ config เก่าตกค้างอยู่ — ต้องลบทิ้ง

เจอไฟล์ `apps/shell-nextjs/ tailwind.config.js` (สังเกตชื่อไฟล์มีช่องว่างนำหน้า) ที่เขียนด้วย syntax
**Tailwind v3** (`module.exports`, `theme.extend`, `require("@tailwindcss/forms")`) — แต่โปรเจกต์คุณติดตั้ง
**Tailwind v4** อยู่จริง (`"tailwindcss": "^4"` ใน package.json) ซึ่งใช้ระบบ config คนละแบบเลย (CSS-first ผ่าน
`@theme` ไม่ใช่ JS file) ไฟล์นี้ไม่ได้ถูกใช้งานจริง (v4 ไม่มองหา `tailwind.config.js` โดย default) แต่ค้างอยู่จะสับสน
แถม plugin ที่ require (`@tailwindcss/forms`, `@tailwindcss/typography`) ก็ไม่ได้ติดตั้งจริงด้วย (เช็คแล้วไม่มีใน
`node_modules/@tailwindcss/`)

```bash
rm "apps/shell-nextjs/ tailwind.config.js"
```

### 0.2 Tailwind v4 ใช้ CSS-first config — ไม่ใช่ `tailwind.config.js` แบบเดิม

เช็คจริงจาก `apps/shell-nextjs/app/globals.css` ที่ scaffold มาให้แล้วตอน `create-next-app --tailwind`:
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
```
นี่คือ syntax v4 จริง — ประกาศ design token ผ่าน `@theme { --color-xxx: ... }` ในไฟล์ CSS แล้ว Tailwind
gen utility class ให้อัตโนมัติ (เช่น `--color-brand-500` → ใช้เป็น `bg-brand-500`/`text-brand-500` ได้เลย)
วันนี้เราจะย้าย pattern นี้ไปไว้ใน shared package แทนที่จะประกาศซ้ำในแต่ละแอป

---

## 1. สร้าง `packages/design-system`

```bash
mkdir -p ~/road-map-30/mfe-workshop/packages/design-system/src
```

`packages/design-system/package.json` (**ต้องอยู่ตรงนี้ ไม่ใช่ที่ `packages/package.json`** — จำจากบทเรียน
ที่เจอตอนทำ `@mfe/shared-types` ผิดตำแหน่งมาแล้ว):
```json
{
  "name": "@mfe/design-system",
  "version": "0.0.0",
  "private": true
}
```

`packages/design-system/src/theme.css`:
```css
@theme {
  --color-brand-50: #eef7ff;
  --color-brand-500: #0ea5e9;
  --color-brand-600: #0284c7;
  --color-brand-900: #0c4a6e;
  --color-danger-500: #f43f5e;

  --spacing-18: 4.5rem;
  --text-display-lg: 3.5rem;
  --text-display-lg--line-height: 1.1;
}
```

> เทียบกับไฟล์ v3 เก่าที่ลบไปในข้อ 0.1: `colors.brand.500` (JS object) → `--color-brand-500` (CSS variable),
> `spacing: { 18: ... }` → `--spacing-18`, `fontSize: { 'display-lg': [...] }` → `--text-display-lg` —
> Tailwind v4 map ชื่อ CSS variable เป็น utility class ให้อัตโนมัติตาม prefix (`--color-*`, `--spacing-*`, `--text-*`)
>
> ⚠️ **แก้จากที่เขียนไว้ตอนแรก:** เดิมผมเขียนผิดเป็น `--font-size-display-lg` — เช็คกับ source จริงของ
> `node_modules/tailwindcss/theme.css` แล้วพบว่า namespace ที่ถูกคือ **`--text-*`** ไม่ใช่ `--font-size-*`
> (เช่น Tailwind เองก็ประกาศ `--text-sm: 0.875rem; --text-sm--line-height: calc(1.25 / 0.875);` ไว้แบบนี้)
> ถ้าอยากกำหนด line-height คู่ไปด้วยให้เพิ่ม key `--text-{name}--line-height` แยกอีกบรรทัด

---

## 2. เชื่อมเข้า `shell-nextjs` (มี Tailwind v4 อยู่แล้ว)

```bash
cd ~/road-map-30/mfe-workshop/apps/shell-nextjs
```
เพิ่มใน `package.json` (`dependencies`):
```json
"@mfe/design-system": "workspace:*"
```

แก้ `app/globals.css` — เพิ่ม `@import` ชี้ไปที่ shared theme **ต่อจาก** `@import "tailwindcss"`:
```css
@import "tailwindcss";
@import "@mfe/design-system/src/theme.css";
```

> ⚠️ **ทดสอบยืนยันแล้ว — path ต้องตรงกับตำแหน่งไฟล์จริงเป๊ะ** ไม่มี shortcut อัตโนมัติ: ลองเขียน
> `@import "@mfe/design-system/theme.css"` (ไม่มี `/src/`) แล้วจะเจอ error `Can't resolve` ทันที เพราะไฟล์จริงอยู่ที่
> `src/theme.css` ไม่ใช่ root ของ package — ต้องเขียน path เต็มให้ตรงกับตำแหน่งไฟล์บนดิสก์จริงเสมอ (เหมือน import
> path ปกติ ไม่ใช่ "package name เฉยๆ" แบบ `@import "tailwindcss"` ที่มันมี entry point พิเศษกำหนดไว้ให้)

ทดสอบ: ใส่ `<div className="bg-brand-500 p-8 text-white">test</div>` ใน `app/page.tsx` แล้ว
```bash
pnpm --filter shell-nextjs build
```
ต้องผ่านไม่ error

---

## 3. เพิ่ม Tailwind v4 เข้า `widget-react19` (ยังไม่มีเลยตอนนี้)

```bash
cd ~/road-map-30/mfe-workshop/apps/widget-react19
pnpm add tailwindcss @tailwindcss/vite
pnpm add @mfe/design-system --workspace
```

แก้ `vite.config.ts` — เพิ่ม `tailwindcss()` plugin (ไม่กระทบ `federation()` plugin เดิม):
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { federation } from '@module-federation/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({ /* ...เดิม... */ }),
  ],
  // ...เดิม...
})
```

`src/index.css` (ไฟล์นี้มีอยู่แล้ว แก้เนื้อหาใหม่):
```css
@import "tailwindcss";
@import "@mfe/design-system/src/theme.css";
```

### ⚠️ จุดสำคัญที่สุดของวันนี้ — CSS ต้อง import จาก `mount.tsx` ไม่ใช่แค่ `main.tsx`

`main.tsx` (entry ของ Vite dev server เอง) import `index.css` อยู่แล้ว — **แต่ตอนโหลดผ่าน Module Federation
เข้า shell จริง โค้ดที่รันคือ `mount.tsx` เท่านั้น ไม่ใช่ `main.tsx` เลย** (`main.tsx` ไม่ได้เป็นส่วนหนึ่งของ
`exposes: { './mount': ... }`) — bundler รวมเฉพาะไฟล์ที่ถูก import จริงในสาย `mount.tsx` → `Widget.tsx` เท่านั้น
เข้า chunk ที่ federation ส่งออกไป ถ้า `mount.tsx` ไม่ import CSS เลย **CSS จะไม่ติดไปกับ remote chunk ที่ shell
โหลดเลย** (widget จะ render ไม่มีสไตล์ตอนโหลดผ่าน shell แม้ว่าตอนรัน `pnpm dev`/`pnpm preview` เดี่ยวๆ จะเห็นสไตล์
ปกติ เพราะตอนนั้นวิ่งผ่าน `main.tsx` ที่ import CSS ไว้)

แก้ `src/mount.tsx` เพิ่ม import CSS ตรงนี้ด้วย:
```tsx
import { createRoot, type Root } from 'react-dom/client'
import Widget from './Widget'
import './index.css'   // สำคัญ — ไม่งั้น CSS ไม่ติดไปกับ remote chunk ตอนโหลดผ่าน shell

export function mount(el: HTMLElement): Root {
  const root = createRoot(el)
  root.render(<Widget />)
  return root
}
```

**ทดสอบยืนยันเอง (จุดนี้ผมให้เหตุผลจาก bundler มาตรฐาน แต่ยังไม่ได้ทดสอบตรงในโปรเจกต์จริงของคุณ):**
1. ใส่ class Tailwind ใน `Widget.tsx` เช่น `className="bg-brand-500 p-4 rounded-lg text-white"`
2. `pnpm build && pnpm preview` (widget) แล้วรัน shell คู่กัน เปิด `localhost:3000`
3. เปิด DevTools → เช็คว่า widget มีพื้นหลังสีฟ้า (`brand-500`) จริงไหม ถ้าไม่มีสี (แค่ข้อความเปล่าๆ) ให้เช็คว่า
   `mount.tsx` import `./index.css` แล้วจริงหรือยัง แล้ว rebuild ใหม่

---

## 4. พิสูจน์ว่า shared design system ทำงานจริง

แก้ค่าสีใน `packages/design-system/src/theme.css`:
```css
--color-brand-500: #22c55e;  /* เปลี่ยนจากฟ้าเป็นเขียว */
```

```bash
cd ~/road-map-30/mfe-workshop
pnpm --filter shell-nextjs build
pnpm --filter widget-react19 build
```

**ต้องเห็นสีเปลี่ยนเป็นเขียวทั้ง 2 แอป** โดยที่แก้ไฟล์เดียว (`theme.css`) ไม่ได้ไปแตะโค้ดของ shell หรือ widget เลย —
นี่คือประโยชน์จริงของ design system กลางผ่าน monorepo (เหมือนกับที่พิสูจน์ type ไปแล้วในข้อ 9.1 แต่คราวนี้เป็น
visual token แทน)

---

## 5. Checklist ทวนความเข้าใจ

1. ทำไม Tailwind v4 ไม่ใช้ `tailwind.config.js` แบบเดิมแล้ว เปลี่ยนไปใช้อะไรแทน?
2. ทำไม path ตอน `@import "@mfe/design-system/src/theme.css"` ต้องมี `/src/` ด้วย ตัดออกได้ไหม?
3. ทำไมต้อง import CSS ใน `mount.tsx` ทั้งที่ `main.tsx` ก็ import อยู่แล้ว?
4. ถ้าอยากให้ `landing-astro` ใช้ design system เดียวกันด้วย ต้องทำยังไง (hint: Astro ก็รองรับ Tailwind v4 ผ่าน
   `@tailwindcss/vite` เหมือนกัน เพราะ Astro ใช้ Vite ข้างใน)

---

## Debug Log (อัปเดตเมื่อเจอปัญหาจริงระหว่างทำ)

_ยังไม่มี — เพิ่มตรงนี้เมื่อเจอปัญหาจริงระหว่างลงมือทำ ตามธรรมเนียมเดิมของ Day 3_
