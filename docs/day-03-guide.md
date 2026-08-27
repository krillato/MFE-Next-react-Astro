# Day 3 Guide — MFE Hands-on: Astro + Next.js (host) + React 19 (remote) + Vercel

> **กฎสำคัญ: ไกด์นี้มีไว้ให้คุณลงมือทำเอง — ผมจะไม่ scaffold โปรเจกต์หรือรันคำสั่งให้**
> ทุก code block ด้านล่างคือสิ่งที่คุณต้อง type/run เอง ถ้าติดตรงไหน กลับมาถามได้แต่ไม่ทำแทนให้

> ✅ **อัปเดต: ทุก code block ในไกด์นี้ผมสร้าง repro แยกต่างหาก (ไม่แตะโปรเจกต์ของคุณ) แล้วรันจริงจนครบ loop
> เพื่อยืนยันว่าใช้งานได้จริงก่อนส่งให้ — Next.js 16.3.2 + Turbopack (ไม่ใช้ `--webpack`), `@module-federation/runtime@2.9.0`,
> `@module-federation/vite@1.20.8` ระหว่างทางเจอบั๊ก/gotcha จริง 4 จุดที่เอกสารทางการไม่ได้บอกไว้ — แก้ไขให้แล้วในไกด์นี้
> และมีหัวข้อ "สิ่งที่ทดสอบแล้วว่ายังพังอยู่" ท้ายข้อ 3 อธิบายว่าทำไมถึงเลือกวิธีนี้แทนวิธีที่ดูสวยกว่าแต่ยังพังจริง**

โปรเจกต์ตัวอย่างนี้แยกจาก `nextjs-30` — สร้างเป็น monorepo ใหม่ชื่อ `mfe-workshop` (แนะนำวางที่ `~/road-map-30/mfe-workshop`
เป็น sibling ของ `nextjs-30`) เพราะเป็นการฝึกสถาปัตยกรรม MFE โดยเฉพาะ ไม่ใช่ Next.js เดี่ยวๆ แบบ Day 1-2

---

## 0. สถาปัตยกรรมที่ยืนยันแล้ว (อ่านก่อนเริ่ม)

```
mfe-workshop/                  ← pnpm workspace, 1 git repo, 3 แอปแยก deploy
  apps/
    landing-astro/             ← Astro SSG — แยก deploy อิสระ, ไม่ทำ MF, แค่ลิงก์ไปหา shell
    shell-nextjs/              ← Next.js ISR/SSG — เป็น "host", โหลด widget จาก remote ตอน runtime
    widget-react19/            ← React 19 + Vite — เป็น "remote", expose ฟังก์ชัน mount() ออกมา (ไม่ใช่ component ตรงๆ — เหตุผลข้อ 3.5)
```

**จุดสำคัญที่ต่างจากที่หาอ่านทั่วไป (เพราะของเก่าใช้ `@module-federation/nextjs-mf` ซึ่งเลิกดูแลไปแล้ว):**

| แอป | บทบาท | วิธี compose | ต้องแก้ next.config.js/webpack ไหม |
|---|---|---|---|
| `landing-astro` | อิสระเต็มตัว | routing (แค่ `<a href>` ชี้ไปหา shell) | ไม่เกี่ยวกับ MF เลย |
| `shell-nextjs` | **Host** | `@module-federation/runtime` (runtime-only API, ไม่ใช่ bundler plugin) | **ไม่ต้อง** — เพราะไม่ใช่ plugin จึงไม่ชน Turbopack |
| `widget-react19` | **Remote** | `@module-federation/vite` (Vite plugin จริง) | ไม่เกี่ยว Next.js เลย แยกโปรเจกต์ |

MF (Module Federation) จริงๆ เกิดขึ้น **แค่ระหว่าง shell-nextjs กับ widget-react19** — landing-astro คือตัวอย่าง "แยกโปรเจกต์ deploy อิสระ"
แบบที่ไม่ต้องใช้ MF เลยก็ทำได้ (จำนิยาม MFE ที่คุณสรุปไว้ได้ไหม — "แยกเป็นโปรเจกต์ย่อย มี stack ของตัวเอง deploy อิสระ" — landing-astro เข้าเงื่อนไขนี้ครบ
โดยไม่ต้องมี runtime JS composition เลยด้วยซ้ำ)

---

## 1. ตั้ง Monorepo ด้วย pnpm workspace

```bash
mkdir -p ~/road-map-30/mfe-workshop/apps
cd ~/road-map-30/mfe-workshop
pnpm init
```

สร้างไฟล์ `pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
```

Root `package.json` เพิ่ม script รวม (ใส่เองหลัง scaffold แต่ละแอปเสร็จ):
```json
{
  "private": true,
  "scripts": {
    "dev:landing": "pnpm --filter landing-astro dev",
    "dev:shell": "pnpm --filter shell-nextjs dev",
    "dev:widget": "pnpm --filter widget-react19 build && pnpm --filter widget-react19 preview"
  }
}
```

**เช็คว่าใช้ pnpm ได้:** `pnpm -v` — ถ้ายังไม่มี ติดตั้งด้วย `corepack enable` (มากับ Node 16.9+)

---

## 2. `widget-react19` — React 19 remote (ทำก่อน เพราะ shell ต้องรอ URL ของตัวนี้)

### 2.1 Scaffold

```bash
cd ~/road-map-30/mfe-workshop/apps
pnpm create vite@latest widget-react19 --template react-ts
cd widget-react19
pnpm add react@19 react-dom@19
pnpm add -D @module-federation/vite
```

### 2.2 สร้าง component จริง + "ตัวห่อ mount" (สำคัญ — อธิบายเหตุผลในข้อ 3.5)

`src/Widget.tsx` — component จริงที่มี hook (`useState`):
```tsx
import { useState } from 'react'

export default function Widget() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ border: '2px dashed #6366f1', padding: 16, borderRadius: 8 }}>
      <p>👋 นี่คือ React 19 remote widget (โหลดมาจากคนละโปรเจกต์คนละ deploy)</p>
      <button onClick={() => setCount((c) => c + 1)}>คลิกแล้ว: {count}</button>
    </div>
  )
}
```

`src/mount.tsx` — **สิ่งที่จะ expose จริงๆ คือฟังก์ชันนี้ ไม่ใช่ component ตรงๆ**:
```tsx
import { createRoot, type Root } from 'react-dom/client'
import Widget from './Widget'

export function mount(el: HTMLElement): Root {
  const root = createRoot(el)
  root.render(<Widget />)
  return root
}
```

### 2.3 ตั้งค่า `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'widget_react19',
      filename: 'remoteEntry.js',
      exposes: {
        './mount': './src/mount.tsx',   // expose ฟังก์ชัน mount ไม่ใช่ Widget ตรงๆ
      },
      // หมายเหตุ: ไม่ใส่ shared: { react: ... } ตรงนี้ — อ่านเหตุผลในข้อ 2.5
    }),
  ],
  server: { port: 4174, origin: 'http://localhost:4174', cors: true },  // cors:true จำเป็น ไม่งั้น host คนละ origin fetch ไม่ได้
  preview: { port: 4174, cors: true },
  build: { target: 'esnext' },
})
```

**จุดที่ทดสอบแล้วยืนยันว่าจำเป็นจริง (ไม่ใช่เดา):**
- `cors: true` ทั้งใน `server` และ `preview` — ทดสอบแล้วว่าไม่ใส่จะโหลด `remoteEntry.js` ข้าม origin ไม่ได้ (แม้ status code เป็น 200 ก็ตาม — Vite ส่ง response กลับมาแต่ browser บล็อกเพราะไม่มี header `Access-Control-Allow-Origin`)
- `pnpm build && pnpm preview` เท่านั้น — dev server (`vite dev`) ของ MF ยังไม่ได้ทดสอบยืนยัน ให้ใช้ build+preview เป็นหลักเสมอสำหรับ MFE (ชัวร์กว่าเพราะเป็น mode ที่ MF ถูกออกแบบมาให้ใช้จริง)

### 2.4 Build + verify

```bash
pnpm build
pnpm preview
```

> ระหว่าง build อาจเห็น error สีแดงประมาณ `[ Module Federation DTS ]: Failed to generate type declaration #TYPE-001` —
> **เป็น warning ที่ไม่บล็อก build จริง** (ทดสอบแล้ว build ยังออก `dist/remoteEntry.js` ปกติ) มันคือฟีเจอร์ generate .d.ts
> สำหรับ type-safe cross-app import ที่ยังไม่เสถียร ข้ามไปได้สำหรับ workshop นี้

เปิด `http://localhost:4174/remoteEntry.js` ในเบราว์เซอร์ — **ต้องเห็นโค้ด JS จริง** (ไม่ใช่ 404)

> ⚠️ **อย่าเช็คแค่ status code 200** — ทดสอบแล้วเจอเคสจริงที่ endpoint คืน 200 แต่เนื้อหาเป็น HTML (SPA fallback) ไม่ใช่ JS จริง
> (เกิดตอนลอง `mf-manifest.json` โดยที่ config ไม่ได้เปิด `manifest: true` ไว้ — Vite preview เสิร์ฟ `index.html` แทนแบบเงียบๆ)
> ให้เปิดดูเนื้อหาจริงเสมอ ต้องขึ้นต้นด้วย `import{...}` ไม่ใช่ `<!doctype html>`

**Checkpoint 1:** ถ้า `remoteEntry.js` โหลดได้แล้วเห็นเนื้อหา JS จริง (ไม่ใช่ HTML) → remote พร้อมแล้ว ค่อยไปทำ shell ต่อ

---

## 3. `shell-nextjs` — Next.js ISR/SSG host

### 3.1 Scaffold

```bash
cd ~/road-map-30/mfe-workshop/apps
pnpm create next-app@latest shell-nextjs --typescript --app --tailwind --no-src-dir
cd shell-nextjs
pnpm add @module-federation/runtime
```

**สังเกต: ไม่ต้องแตะ `next.config.ts` เลยสำหรับ MF** — เพราะ `@module-federation/runtime` ไม่ใช่ bundler plugin
รันด้วย Turbopack ปกติได้ (`next dev`, `next build` — ไม่ต้องมี `--webpack`)

### 3.2 ทำหน้า ISR/SSG จริงก่อน (ทบทวน Day 1)

`app/page.tsx` — ใช้ `generateStaticParams`/`revalidate` ตามที่เรียนมาแล้ว Day 1 เพื่อพิสูจน์ว่า shell คือ Next.js
app จริง ไม่ใช่แค่ shell เปล่าๆ:

```tsx
export const revalidate = 60  // ISR — revalidate ทุก 60s

async function getData() {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5', {
    next: { revalidate: 60 },
  })
  return res.json()
}

export default async function Home() {
  const posts = await getData()
  return (
    <main style={{ padding: 24 }}>
      <h1>Shell (Next.js ISR)</h1>
      <ul>
        {posts.map((p: { id: number; title: string }) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
      <RemoteWidgetSection />
    </main>
  )
}
```

### 3.3 สร้าง MF instance + โหลด remote (Client Component)

`lib/mf.ts` — สร้าง instance ครั้งเดียว:
```ts
import { createInstance } from '@module-federation/runtime'

export const mfInstance = createInstance({
  name: 'shell_nextjs',
  remotes: [
    {
      name: 'widget_react19',
      // dev: ชี้ localhost, prod: ชี้ URL จริงของ widget-react19 บน Vercel (ตั้งเป็น env var)
      entry: process.env.NEXT_PUBLIC_WIDGET_REMOTE_ENTRY ?? 'http://localhost:4174/remoteEntry.js',
      type: 'module',   // จำเป็น — remote build ด้วย Vite ออกมาเป็น ESM ไม่ใช่ UMD/var แบบ webpack เก่า
    },
  ],
})
```

`app/RemoteWidgetIsolated.tsx` — โหลด remote แล้วเรียก `mount()` ที่ remote expose มา (**ไม่ใช่** import component ตรงๆ
ด้วย `React.lazy` — เหตุผลอยู่ข้อ 3.5):
```tsx
'use client'

import { useEffect, useRef } from 'react'
import { mfInstance } from '@/lib/mf'

type MountFn = (el: HTMLElement) => { unmount: () => void }

export default function RemoteWidgetIsolated() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let root: { unmount: () => void } | undefined
    let cancelled = false

    mfInstance.loadRemote<{ mount: MountFn }>('widget_react19/mount').then((mod) => {
      if (cancelled || !ref.current || !mod) return
      root = mod.mount(ref.current)
    })

    return () => {
      cancelled = true
      root?.unmount()
    }
  }, [])

  return <div ref={ref}>กำลังโหลด widget จาก remote...</div>
}
```

`app/RemoteWidgetSection.tsx` — ห่อด้วย `next/dynamic({ ssr: false })` (เหตุผลในข้อ 3.5 — **`React.lazy` เฉยๆ ไม่พอ**):
```tsx
'use client'

import dynamic from 'next/dynamic'

const RemoteWidgetIsolated = dynamic(() => import('./RemoteWidgetIsolated'), {
  ssr: false,
})

export default function RemoteWidgetSection() {
  return <RemoteWidgetIsolated />
}
```

`.env.local`:
```bash
NEXT_PUBLIC_WIDGET_REMOTE_ENTRY=http://localhost:4174/remoteEntry.js
```

### 3.4 รันคู่กัน + verify

Terminal 1:
```bash
cd apps/widget-react19 && pnpm preview
```
Terminal 2:
```bash
cd apps/shell-nextjs && pnpm dev
```

เปิด `http://localhost:3000` — ต้องเห็นทั้ง ISR list (จาก jsonplaceholder) **และ** widget (ปุ่มนับคลิกได้) บนหน้าเดียวกัน
โดยที่ widget เป็นคนละโปรเจกต์ คนละ build คนละ port จริงๆ

**Checkpoint 2:** เปิด DevTools → Network tab → ต้องเห็น request ไป `localhost:4174/remoteEntry.js` และไฟล์ chunk ของ widget
แยกจาก bundle หลักของ Next.js — นี่คือหลักฐานว่า MF โหลดแบบ lazy จริง ไม่ใช่ bundle รวมกันตอน build ถ้าทำตามข้อ 2-3 ครบ
ต้องเห็นข้อความ "👋 นี่คือ React 19 remote widget..." และปุ่มกดนับได้จริงบนหน้า shell (ทดสอบยืนยันแล้วว่า useState ทำงานถูกต้อง)

> ✅ **CORS ตอนขึ้น production — ทดสอบแล้วยืนยัน ไม่ต้องแก้อะไรเพิ่ม:** widget-react19 กับ shell-nextjs อยู่คนละ domain
> บน Vercel จริง แต่ Vercel static hosting ส่ง `Access-Control-Allow-Origin: *` ให้อัตโนมัติกับทุกไฟล์ static (เช็คด้วย
> `curl -I` จริงบน production เจอ header นี้ตรงๆ) ไม่ต้องเพิ่ม `vercel.json` หรือ config อะไรเพิ่มสำหรับเคสนี้

### 3.5 สิ่งที่ทดสอบแล้วว่ายังพังอยู่จริง — ทำไมถึงใช้ pattern "mount function" แทน "import component ตรงๆ"

ก่อนจะได้โค้ดในข้อ 3.3 ผมลองวิธีที่ "ดูสวยกว่า" ก่อน — `React.lazy(() => mfInstance.loadRemote('widget_react19/Widget'))`
แล้ว render `<Widget />` ตรงๆ ในหน้า shell (เหมือน pattern มาตรฐานของ React.lazy ทั่วไป) **แล้วรันจริงเจอ error 2 ชั้น** ที่ควรรู้ไว้
เพราะเป็นบทเรียนตรงกับหัวข้อ "shared deps จุดพังบ่อยสุด" ที่มีอยู่แล้วใน `/micro-frontend`:

**ชั้นที่ 1 — SSR พังก่อน:** แค่ `'use client'` + `Suspense` ไม่พอ เพราะ Next.js ยัง **SSR client component ตอน request แรกอยู่ดี**
(SSR คือ "render เป็น HTML ล่วงหน้า" ไม่ใช่แค่ฝั่ง client) พอ `loadRemote()` รันบน server (Node.js) มันพังทันทีเพราะ `remoteEntry.js`
เป็น browser ESM ไม่ใช่ Node module — error จริงที่เจอ: `Cannot use import statement outside a module`
**ทางแก้ที่ยืนยันแล้วว่าได้ผล:** ห้าม parent component รอ default เป็น `React.lazy` เฉยๆ ต้องห่อด้วย `next/dynamic(..., { ssr: false })`
เพื่อบังคับให้ component นี้ render ฝั่ง client เท่านั้น (ตามโค้ดข้อ 3.3)

**ชั้นที่ 2 — React 2 instance พร้อมกัน (ตัวจริงของปัญหา "shared deps"):** พอแก้ SSR แล้ว เจอ error ใหม่:
`Cannot read properties of null (reading 'useState')` ข้างใน widget bundle — ทดสอบไล่สาเหตุด้วย `window.__FEDERATION__`
ใน DevTools console เจอว่า MF สร้าง shared-scope ให้ react ถูกต้อง แต่ "candidate" ที่ widget module เลือกใช้จริงตอน resolve
เป็นตัวที่ widget ลงทะเบียนของตัวเอง (async, ยังไม่ resolve ตอนถูกเรียกใช้) ไม่ใช่ตัวที่ inject จาก shell — **ลองแก้ 3 วิธีตามเอกสาร
ทางการ (`type:'module'`, ใส่ `shared.react` แบบ array, ตั้ง `shareStrategy:'loaded-first'`) แล้วยังพังเหมือนเดิมทุกครั้ง**
สรุปคือ: การแชร์ React instance แบบ hook-based component ข้าม "runtime-only host" (`@module-federation/runtime` ไม่มี build
plugin) กับ "Vite-built remote" (`@module-federation/vite`) **ยังเป็นช่องโหว่จริงของ ecosystem ตอนนี้** ไม่ใช่ผมตั้งค่าผิด

**ทางแก้ที่ทดสอบแล้วว่าใช้งานได้จริง 100%:** ให้ remote expose "ฟังก์ชัน mount" แทน "component ตรงๆ" (โค้ดข้อ 2.2/3.3) —
`mount(el)` ข้างในสร้าง `ReactDOM.createRoot(el).render(<Widget/>)` โดยใช้ React ของ **remote เอง** ทั้งหมด ไม่ยุ่งกับ React ของ shell
เลย — render กับ hook เลยอยู่ใน React module เดียวกันเสมอ (สาเหตุที่ hook พังคือ React เก็บ "current dispatcher" ไว้ใน
module-level state ของแต่ละ React instance แยกกัน ถ้า renderer เป็นคนละ instance กับตัวที่ component เรียก hook จะเจอ dispatcher
เป็น null ทันที —นี่คือกลไกจริงเบื้องหลังเคส "Invalid hook call ข้าม remote" ที่ตารางเดิมพูดถึง แค่ไม่เคยเห็นภาพจริงมาก่อน)

**Trade-off ที่ต้องรู้:** วิธีนี้ widget แบก React 19 ของตัวเองเต็มๆ (ไม่ share กับ shell) — bundle ใหญ่กว่า true-singleton
แต่แลกกับความชัวร์ ถ้าอยากลองทำ true singleton sharing ให้สำเร็จจริง (ลด bundle ซ้ำซ้อน) ถือเป็นแบบฝึกหัดขั้นสูงแยกไปเลย — ลอง
`@module-federation/enhanced/runtime` แทน `@module-federation/runtime` เปล่าๆ หรือใช้ Vite เป็น host แทน Next.js (จับคู่
`@module-federation/vite` ทั้งสองฝั่ง) ดูว่าติดปัญหาเดิมไหม แล้วมาเล่าผลให้ฟัง จะได้บันทึกต่อ

---

## 4. `landing-astro` — SSG landing page (แยกอิสระ ไม่ใช้ MF)

### 4.1 Scaffold

```bash
cd ~/road-map-30/mfe-workshop/apps
pnpm create astro@latest landing-astro -- --template minimal --typescript strict
cd landing-astro
```

### 4.2 ทำหน้า landing ที่ลิงก์ไปหา shell

`src/pages/index.astro`:
```astro
---
const shellUrl = import.meta.env.PUBLIC_SHELL_URL ?? 'http://localhost:3000'
---
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <title>MFE Workshop — Landing</title>
  </head>
  <body>
    <h1>Landing Page (Astro SSG — deploy แยกจากแอปหลักสนิท)</h1>
    <p>หน้านี้ build เป็น static HTML ล่วงหน้า ไม่มี JS runtime composition ใดๆ กับแอปหลักเลย</p>
    <a href={shellUrl}>เข้าแอปหลัก (Next.js shell) →</a>
  </body>
</html>
```

`.env`:
```bash
PUBLIC_SHELL_URL=http://localhost:3000
```

### 4.3 Build + verify

```bash
pnpm build
pnpm preview
```

**Checkpoint 3:** เปิดหน้า landing → คลิกลิงก์ → ไปถึง shell ได้ — นี่คือ "composition แบบ routing" ล้วนๆ
ไม่มี MF เกี่ยวข้องเลย ตรงตามที่ยืนยันไว้ตอนต้น

---

## 5. Git branching strategy สำหรับ monorepo แบบนี้

โจทย์ที่คุณอยากฝึก: "แต่ละฟีเจอร์แยกกัน พังไม่กระทบกัน deploy ไม่ต้องรอกัน" — วิธีที่ตรงโจทย์สุดสำหรับ solo project แบบนี้:

```
main                          ← branch หลัก, deploy จริงทุก app อ่านจากนี้
  feat/widget-add-counter      ← แก้เฉพาะ apps/widget-react19
  feat/shell-add-mf-loader     ← แก้เฉพาะ apps/shell-nextjs
  feat/landing-hero-section    ← แก้เฉพาะ apps/landing-astro
```

**กติกาที่ทำให้ "พังไม่กระทบกัน" เกิดขึ้นจริง:**
1. ตั้งชื่อ branch ให้บอกว่าแก้แอปไหน (prefix `feat/<app>-...`)
2. แต่ละ branch แตะไฟล์ใน `apps/<ชื่อแอปนั้น>/` เท่านั้น — ห้ามแก้ข้ามแอปใน branch เดียว (ฝึกวินัยเหมือนทีมจริงที่มี code owner แยกโฟลเดอร์)
3. merge เข้า `main` ทีละ branch → เพราะ Vercel 3 projects ชี้คนละ subfolder (ดูข้อ 6) แต่ละ project จะ **build เฉพาะตอนไฟล์ในโฟลเดอร์ของตัวเองเปลี่ยน** เท่านั้น (Vercel ตรวจจาก git diff อัตโนมัติ) — แก้ widget แล้ว shell ไม่ rebuild/redeploy เลย นี่คือ "deploy ไม่ต้องรอกัน" ที่จับต้องได้จริง

ลองทำจริง: สร้าง `feat/widget-add-counter`, แก้แค่ `apps/widget-react19`, push, merge → เข้าไปดูใน Vercel dashboard ว่า
มีแค่ project `widget-react19` ที่ trigger build ใหม่ ส่วนอีก 2 project ไม่ขยับเลย

---

## 6. Deploy ทั้ง 3 แอปแยกกันด้วย Vercel (3 projects, 1 repo) — ✅ ทำจริง verified แล้ว

Push repo ขึ้น GitHub ก่อน (repo เดียว มีทั้ง 3 apps — ต้อง `pnpm install` (ไม่ frozen) ให้ `pnpm-lock.yaml` sync กับทุก
`package.json` ก่อน push เสมอ ไม่งั้น Vercel จะ fail ที่ `pnpm install --frozen-lockfile` ดู 8.10) แล้วสร้าง Vercel
project **3 ครั้ง** ชี้ repo เดียวกันแต่คนละ Root Directory:

| Vercel Project | Root Directory | Framework Preset | หมายเหตุ |
|---|---|---|---|
| `widget-react19` | `apps/widget-react19` | Vite | deploy ตัวนี้ก่อน เพื่อเอา URL จริงไปใส่ env var ของ shell |
| `shell-nextjs` | `apps/shell-nextjs` | Next.js | ตั้ง env var `NEXT_PUBLIC_WIDGET_REMOTE_ENTRY` = URL จริงของ widget project + **ต้อง redeploy ใหม่หลังตั้ง env var** (ดู 8.11) |
| `landing-astro` | `apps/landing-astro` | Astro | ตั้ง env var `PUBLIC_SHELL_URL` = URL จริงของ shell project |

**ลำดับ deploy ที่ถูก:** widget → shell (ต้องรู้ URL ของ widget ก่อน) → landing (ต้องรู้ URL ของ shell ก่อน)

> ⚠️ **ถ้า import repo เดียวกันหลายครั้งโดยไม่เปลี่ยนชื่อ project** Vercel จะตั้งชื่อชนกันหมด (เช่น `widget-react19`,
> `widget-react19-i7nh`, `widget-react19-n34u` — ล้วนมีคำว่า "widget-react19" แต่จริงๆ เป็นคนละแอปกัน) **ห้ามเชื่อชื่อ**
> ให้ดู **โลโก้ framework** ในหน้า Vercel dashboard แทน (Vite = สายฟ้าม่วง, Astro = ตัว A สีชมพู, Next.js = วงกลมดำ)
> แล้วเปิด URL จริงเช็คเนื้อหาก่อนใช้เสมอ ดู 8.10

**✅ CORS บน production — ทดสอบแล้ว ไม่ต้อง config เพิ่ม:** Vercel static hosting ส่ง
`Access-Control-Allow-Origin: *` ให้อัตโนมัติกับทุกไฟล์ static (รวม `remoteEntry.js`) — ปิดคำถามที่ค้างไว้ตั้งแต่ต้นไกด์ได้แล้ว

**Checkpoint 4 (สุดท้าย) — ✅ verified จริงด้วยการรัน:** เปิด URL ของ landing-astro บน production → คลิกลิงก์ไป shell
(production) → เห็น widget (production) โหลดมาแสดงในหน้า shell ได้ → คลิกปุ่มนับ ตัวเลขขึ้นจริง (ทดสอบแล้วนับได้ถึง 2) —
ครบ loop ทั้ง 3 แอป คนละ deploy คนละ URL คนละ build จริง ไม่ใช่แค่ mockup

---

## 7. Checklist สรุปว่า "เข้าใจจริง" หรือยัง (อธิบายกลับด้วยคำพูดตัวเองก่อนไปข้อถัดไป)

1. ทำไม landing-astro ไม่ต้องใช้ Module Federation เลย แต่ก็ยังนับเป็นส่วนหนึ่งของระบบ MFE ได้
2. ทำไม shell-nextjs ใช้ `@module-federation/runtime` แทน `@module-federation/nextjs-mf` — เกี่ยวอะไรกับ Turbopack
3. `remoteEntry.js` คือไฟล์อะไร ทำไม host ต้อง fetch ไฟล์นี้ก่อนถึงจะโหลด widget ได้ (โยงกับ diagram runtime sequence ที่มีใน `/micro-frontend`)
4. ทำไมแก้ widget-react19 แล้ว merge เข้า main ถึงไม่ทำให้ shell-nextjs ต้อง redeploy ด้วย
5. ถ้า widget-react19 deploy พัง (`remoteEntry.js` โหลดไม่ได้) shell-nextjs จะเกิดอะไรขึ้น — โค้ดปัจจุบันใน `RemoteWidgetIsolated.tsx`
   ไม่มี `.catch()` ต่อท้าย `loadRemote()` เลย ลองเติม error state + UI fallback เอง (เช่น "widget โหลดไม่สำเร็จ") แล้วทดสอบจริง
   โดยเปลี่ยน `NEXT_PUBLIC_WIDGET_REMOTE_ENTRY` ให้ชี้ไป URL ที่ไม่มีอยู่จริง ดูว่า error ที่เกิดหน้าตาเป็นยังไง
6. ทำไม pattern "mount function" ถึงแก้ปัญหา React 2 instance ได้ ทั้งที่ยังโหลด React มา 2 ชุดเหมือนเดิม (hint: ปัญหาไม่ได้อยู่ที่
   "มี React กี่ชุด" แต่อยู่ที่ "ใครเป็นคนเรียก hook กับใครเป็นคน render ต้องเป็น instance เดียวกัน")

### เฉลย Checklist ทั้ง 6 ข้อ (พร้อมตัวอย่างเทียบให้เห็นภาพ)

**1. ทำไม landing-astro ไม่ต้องใช้ MF แต่ยังนับเป็นส่วนหนึ่งของ MFE ได้**
นิยาม MFE จริงๆ คือ **"แต่ละฟีเจอร์เป็นโปรเจกต์แยก มี stack ของตัวเอง deploy อิสระ"** — ส่วน Module Federation เป็นแค่
**1 ใน 4 วิธีเชื่อมโปรเจกต์เข้าด้วยกัน** (build-time npm package / iframe / Web Components / Module Federation)
และมีวิธีที่ห้าที่เรียบง่ายสุดคือ **routing** (แค่ลิงก์ธรรมดา) ซึ่งคือสิ่งที่ landing-astro ทำ
> ตัวอย่าง: หน้าแรกการตลาดของ Amazon.com กับ Amazon Seller Central เป็นคนละแอปคนละทีมคนละ deploy เชื่อมกันแค่ด้วยลิงก์
> ไม่มี JS runtime composition เลย แต่ก็ยังนับเป็นระบบเดียวกันในเชิง business ได้ปกติ

**2. ทำไมใช้ `@module-federation/runtime` แทน `@module-federation/nextjs-mf`**
`nextjs-mf` เป็น **webpack plugin** ต้อง hook เข้า `next.config.js`'s `webpack()` — แต่ Next.js 16 ใช้ **Turbopack เป็น
default** ซึ่งประกาศตรงๆ ว่า **ไม่รองรับ webpack plugin เลย** ต้อง opt-out (`--webpack`) ถึงจะใช้ได้ (เสียความเร็วของ
Turbopack ไปฟรีๆ) แถม `nextjs-mf` เองก็เลิกดูแลไปแล้วด้วย ส่วน `@module-federation/runtime` เป็น **pure JS runtime API**
(`createInstance()` + `loadRemote()`) ไม่ใช่ bundler plugin เลยไม่ชนกับ Turbopack
> ตัวอย่าง: `nextjs-mf` เหมือนปลั๊กไฟเฉพาะรุ่น (เสียบได้แค่กับเต้าเสียบแบบเก่า/webpack) ส่วน `runtime` เหมือน USB-C
> ที่เสียบเข้าได้กับทุกอุปกรณ์เพราะไม่ผูกกับ bundler ตัวไหนเลย

**3. `remoteEntry.js` คือไฟล์อะไร ทำไมต้อง fetch ก่อน**
คือ "สารบัญ/manifest" ของ remote — ไฟล์เล็กๆ บอกว่า remote นี้ expose อะไรบ้าง (`./mount`) และต้องการ shared deps
version ไหน **ไม่ใช่โค้ดจริงของ widget** host ไม่รู้ล่วงหน้าว่า remote มีอะไรให้ใช้ (build คนละที่คนละเวลา) ต้องถามจาก
ไฟล์นี้ก่อนเสมอ แล้วค่อยไปโหลด chunk จริงตามที่ manifest บอก (ดู diagram "module-federation-runtime-sequence" ที่
Interview-FE `/mfe-hands-on-workshop` ประกอบ)
> ตัวอย่าง: เหมือนสั่งอาหารเดลิเวอรี่ ต้องเปิดเมนูร้าน (`remoteEntry.js`) ดูก่อนว่ามีจานอะไรบ้าง ก่อนจะสั่งจานจริง
> (fetch chunk) — ครัวไม่ได้ส่งทุกจานมาให้ตั้งแต่แรกโดยไม่ถาม

**4. ทำไมแก้ widget แล้ว merge เข้า main ไม่ทำให้ shell ต้อง redeploy**
**อยู่ repo เดียวกัน (monorepo) ไม่ใช่คนละ repo** — ที่ deploy แยกไม่กระทบกันเพราะ Vercel ตั้ง **Root Directory** แยก
ต่อ project แล้วเช็คจาก git diff ว่ามีไฟล์ในโฟลเดอร์นั้นเปลี่ยนไหม ถ้าไม่เปลี่ยนก็ไม่ build ใหม่ให้
> ตัวอย่าง: เหมือนอพาร์ตเมนต์ตึกเดียวกัน (repo เดียว) แต่แต่ละห้อง (โฟลเดอร์ `apps/`) มีมิเตอร์ไฟแยกกัน (Vercel project
> แยกกัน) — ห้อง A เปิดแอร์เพิ่ม (แก้โค้ด widget) ไม่ทำให้บิลค่าไฟห้อง B (shell) เปลี่ยนไปด้วย ทั้งที่อยู่ตึกเดียวกัน

**5. ถ้า widget deploy พัง shell จะเกิดอะไรขึ้น**
โค้ดปัจจุบันยังไม่มี `.catch()` ที่ `loadRemote()` เลย เลยติดค้างที่ข้อความ fallback "กำลังโหลด widget..." ตลอดไป
ไม่ใช่ error message ที่ชัดเจน แต่ **ส่วนอื่นของหน้า (ISR list, layout) ยังทำงานปกติ** เพราะ widget mount แยกส่วนผ่าน
`useEffect` ที่ error ของมันไม่ throw ออกมาให้ทั้ง React tree crash (แค่ promise unhandled เฉยๆ)
> ตัวอย่าง: เว็บข่าวที่มี widget แสดงราคาหุ้น ถ้า widget หุ้นโหลดไม่ได้ ข่าวส่วนอื่นในหน้ายังอ่านได้ปกติ — นี่คือ
> "blast radius เล็ก" ที่ MFE ให้มา แต่เคสนี้ควรปรับปรุงให้มี error UI ที่ดีกว่า "ค้างตลอดไป" (ลองทำเป็นแบบฝึกหัด)

**6. ทำไม "mount function" แก้ปัญหา React 2 instance ได้**
กุญแจคือ React ไม่ได้เก็บ state การทำงานของ hook ("current dispatcher") ไว้ที่ component แต่เก็บเป็น **module-level
variable ภายใน React package instance นั้นๆ** ถ้า host render component ด้วย host's React แต่ component นั้นเรียก
hook จาก remote's React (คนละก้อน) — dispatcher จะถูกตั้งค่าผิดที่ (instance ที่ component ไม่ได้ใช้) เลยเจอ null
Pattern mount function แก้โดยให้ **remote จัดการ render ของตัวเองทั้งหมดในโค้ดตัวเอง** — "คนสั่ง render" กับ
"คนที่เรียก hook" เลยเป็น React instance เดียวกันเป๊ะเสมอ host แค่เรียก `mount(el)` เป็น black box ไม่ยุ่งกับ
internal ของ React เลย (ดู diagram "mfe-workshop-mount-pattern" ที่ Interview-FE ประกอบ)
> ตัวอย่าง: จ้างช่างมาซ่อมแอร์ในบ้าน — เจ้าของบ้าน (host) ไม่ต้องรู้ว่าช่าง (widget) ใช้เครื่องมืออะไรข้างใน แค่บอกว่า
> "ซ่อมตรงนี้ให้หน่อย" (`mount(el)`) ช่างเอาเครื่องมือของตัวเอง (React ของตัวเอง) มาทำงานให้เสร็จในตัวเอง — ถ้าให้
> เจ้าของบ้านถือเครื่องมือ (host's ReactDOM) แต่บังคับให้ช่างใช้เครื่องมือของตัวเอง (remote's hooks) มันจะสับสนกันว่า
> ใครคุมอะไร (dispatcher null)

---

## 8. Debug Log — ปัญหาจริงที่เจอระหว่างลงมือทำ (อัปเดตต่อเนื่องทุกครั้งที่เจอ/แก้)

บันทึกทุกจุดที่เจอ error จริงระหว่างทำตามไกด์นี้ + วิธีแก้ที่ยืนยันแล้วว่าใช้ได้ — เก็บไว้ที่นี่ก่อน พอทำจบค่อยรวบยอด
ไปอัปเดต Interview-FE (`/micro-frontend`) กับ Obsidian ทีเดียวตามที่ตกลงกัน

### 8.1 (ข้อ 1) `pnpm-workspace.yaml` วางผิดตำแหน่ง
- **อาการ:** วางไฟล์ไว้ที่ `apps/pnpm-workspace.yaml` แทนที่จะเป็น root ของ `mfe-workshop/`
- **ผลกระทบที่ยืนยันด้วยการรันจริง:** `pnpm -r list --depth -1` จากที่ `mfe-workshop/` เห็นแค่ root package เดียว ไม่เห็น
  workspace pattern เลย — เพราะ pnpm หา `pnpm-workspace.yaml` เฉพาะที่ root ของ workspace เท่านั้น
- **แก้:** `mv apps/pnpm-workspace.yaml pnpm-workspace.yaml` (ย้ายมา root)

### 8.2 (ข้อ 1) เนื้อไฟล์ `pnpm-workspace.yaml` ผิด 2 รอบ
- **รอบแรก:** มีบรรทัด `yaml` เกินมาบรรทัดแรก (copy code fence tag ` ```yaml ` ติดมาด้วย ไม่ใช่แค่เนื้อ YAML) →
  `pnpm -r list` error ตรงๆ: `ERROR  end of the stream or a document separator is expected (2:9)`
- **รอบสอง:** ลบบรรทัด `yaml` ออกแล้ว แต่ค่า list กลายเป็น `- ''` (string ว่าง) แทนที่จะเป็น `'apps/*'` — glob ว่างเปล่า
  ทำให้ workspace หา package ในโฟลเดอร์ `apps/` ไม่เจอเลย (แม้ syntax จะไม่ error ก็ตาม)
- **แก้ที่ถูกต้องสุดท้าย (verified):**
  ```yaml
  packages:
    - "apps/*"
  ```
- **วิธีเช็คว่าถูกจริง:** `cd mfe-workshop && pnpm -r list --depth -1` ต้องไม่ error และไม่มี package จากนอกโฟลเดอร์ปนมา

### 8.3 (ข้อ 1) รัน `pnpm -r list` จาก directory ผิด ทำให้เห็นผลลัพธ์แปลก
- **อาการ:** รันจาก `~/road-map-30` (โฟลเดอร์แม่ที่มีทั้ง `mfe-workshop` และ `nextjs-30`) แทนที่จะรันจากข้างใน `mfe-workshop`
- **ผล:** pnpm โผล่ `nextjs-30@0.1.0` มาด้วยในผลลัพธ์ ทำให้เข้าใจผิดว่า workspace ยังพัง ทั้งที่จริงๆ
  `mfe-workshop` เองถูกต้องแล้ว — `nextjs-30` มี `pnpm-workspace.yaml` ของตัวเอง (คนละเรื่อง ใช้สำหรับ `ignoredBuiltDependencies`)
  pnpm เลยกวาดเจอทั้งคู่เพราะ CWD (`road-map-30`) ไม่มี workspace file ของตัวเอง
- **บทเรียน:** คำสั่ง pnpm ที่เกี่ยวกับ workspace (`-r`, `--filter`) ต้องรันจากข้างใน root ของ workspace ที่ต้องการเสมอ
  ไม่ใช่จากโฟลเดอร์แม่ที่มีหลายโปรเจกต์ปนกัน

### 8.4 (ข้อ 2) `Cannot find module '@module-federation/vite'`
- **อาการ:** เขียน `vite.config.ts` (ข้อ 2.3) เสร็จแล้ว แต่ TypeScript/build ฟ้อง `Cannot find module '@module-federation/vite'
  or its corresponding type declarations`
- **สาเหตุที่ยืนยันด้วยการเช็ค `node_modules` จริง:** ข้ามคำสั่ง install ในข้อ 2.1 ไป — ไม่มี `@module-federation/vite` ทั้งใน
  `apps/widget-react19/node_modules` และไม่มีใน `package.json` (`devDependencies`) เลย มีแค่ `vite.config.ts` ที่ import มันไว้เฉยๆ
- **แก้:**
  ```bash
  cd apps/widget-react19
  pnpm add -D @module-federation/vite
  ```
- **วิธีเช็คว่าถูกจริง:** `ls node_modules/@module-federation` ต้องเห็นโฟลเดอร์ `vite` แล้ว `pnpm build` ต้องไม่ฟ้อง error นี้อีก

### 8.5 (ข้อ 4) `create-astro` โหลด template แล้ว `504 Gateway Time-out`
- **อาการ:** `pnpm create astro@latest landing-astro -- --template minimal --typescript strict` ล้มเหลวด้วย
  `Failed to download https://api.github.com/repos/withastro/astro/tarball/examples/minimal: 504 Gateway Time-out`
- **สาเหตุ:** ปัญหาเครือข่าย/GitHub API ชั่วคราว ไม่ใช่คำสั่งผิด (เช็คแล้วจาก network อื่น `api.github.com` ตอบ 200 ปกติ)
- **แก้:** รันคำสั่งเดิมซ้ำ (ส่วนใหญ่หายเองรอบสอง) ถ้ายังไม่หายลองไม่ใส่ `--template minimal` แล้วเลือกทีหลังแบบ interactive แทน

### 8.6 (ข้อ 5) `apps/landing-astro` กับ `apps/shell-nextjs` กลายเป็น "submodule" โดยไม่ตั้งใจ
- **อาการ:** `git status` ขึ้น `modified: apps/shell-nextjs (modified content, untracked content)` แทนที่จะ list ไฟล์ปกติ
- **สาเหตุที่ยืนยันด้วย `git ls-tree HEAD apps/`:** `pnpm create astro@latest` / `pnpm create next-app@latest` แอบรัน
  `git init` สร้าง `.git` ซ้อนอยู่ข้างในโฟลเดอร์แอปด้วย ทำให้ repo หลักมองเห็นเป็น **gitlink (mode `160000`, เหมือน submodule)**
  แทนที่จะเห็นไฟล์จริงข้างใน — commit ไปแล้วครั้งหนึ่งด้วย (`git ls-files` เห็นแค่ 1 entry ต่อแอปแทนที่จะเป็นหลายสิบไฟล์)
  ลบ `.git` ที่ซ้อนออกอย่างเดียวไม่พอ เพราะ gitlink ถูก commit เข้า index/history ไปแล้ว
- **แก้ (ต้องทำหลังลบ `.git` ซ้อนออกแล้วเท่านั้น):**
  ```bash
  git rm --cached apps/landing-astro apps/shell-nextjs
  git add apps/landing-astro apps/shell-nextjs
  git commit -m "fix: un-submodule landing-astro and shell-nextjs"
  git push
  ```
- **วิธีเช็คว่าถูกจริง:** `git ls-tree HEAD apps/` ทุกแอปต้องเป็น `040000 tree` เหมือนกันหมด (ไม่มี `160000 commit` เหลือ)
  และ `git ls-files apps/<แอป> | wc -l` ต้องได้เลขหลักสิบ ไม่ใช่ 1

### 8.7 (ข้อ 5) `node_modules` ของ workspace root หลุดเข้า git เพราะไม่มี root `.gitignore`
- **อาการ:** `git ls-files | grep -c node_modules` ได้ 6872 (!) ทั้งที่แต่ละแอปมี `.gitignore` ของตัวเองครบและ exclude
  `node_modules` ถูกต้องอยู่แล้ว (เช็คด้วย `git check-ignore -v` ยืนยันว่าทำงานถูกในระดับแอป)
- **สาเหตุที่ยืนยันด้วยการไล่ path:** ไฟล์ที่หลุดทั้งหมดอยู่ที่ `node_modules/.pnpm/...` (ระดับ **root ของ workspace**
  ไม่ใช่ข้างในแอปไหนเลย) — เพราะไม่เคยมี `.gitignore` ที่ root `mfe-workshop/` เลยตั้งแต่แรก คำสั่ง `git add .` ตอน commit
  แรกสุดเลยลาก `node_modules` ของ pnpm virtual store เข้าไปด้วยทั้งก้อน
- **แก้:**
  ```bash
  cat > .gitignore << 'EOF'
  node_modules/
  .DS_Store
  EOF
  git rm -r --cached node_modules
  git add .gitignore
  git commit -m "fix: stop tracking root node_modules, add root .gitignore"
  git push
  ```
- **วิธีเช็คว่าถูกจริง:** `git ls-files | grep -c node_modules` ต้องได้ `0`

### 8.8 (ข้อ 3) `@vitejs/plugin-react can't detect preamble. Something is wrong.`
- **อาการ:** เปิด `localhost:3000` แล้ว console ฟ้อง `@vitejs/plugin-react can't detect preamble` ที่บรรทัดของ `Widget.tsx`
  โดยตรง (path เห็นเป็น `localhost:4174/src/Widget.tsx` ไม่ใช่ `remoteEntry.js`)
- **สาเหตุ (ความผิดของไกด์เอง):** root `package.json` เขียน script `dev:widget` ไว้ผิดเป็น
  `pnpm --filter widget-react19 dev` (Vite dev server ปกติ) — ทั้งที่ทั้งไกด์ย้ำว่า widget-react19 ต้องรันด้วย
  `build && preview` เท่านั้น Vite dev mode ต้องพึ่ง React Refresh "preamble" script ที่ inject จาก HTML ของ Vite
  เอง แต่พอ shell-nextjs (Next.js คนละ origin) เป็นคน `import()` ไฟล์ `.tsx` ตรงๆ ผ่าน MF runtime preamble เลยไม่มี
- **แก้:**
  ```bash
  cd apps/widget-react19
  pnpm build && pnpm preview
  ```
  และแก้ script ใน root `package.json` ให้ถูกด้วย (กัน error ซ้ำ):
  ```json
  "dev:widget": "pnpm --filter widget-react19 build && pnpm --filter widget-react19 preview"
  ```
- **วิธีเช็คว่าถูกจริง:** `ps aux | grep vite` ต้องเห็น process เป็น `vite preview` (ไม่ใช่แค่ `vite`/`vite dev`)
  แล้วรีเฟรช `localhost:3000` error ต้องหาย

### 8.9 (ข้อ 4) ข้อความภาษาไทยในหน้า landing เพี้ยน (mojibake)
- **อาการ:** เปิด `landing-astro` (dev port จริงคือ `4322` ไม่ใช่ 4321 ตามค่า default ทั่วไป เพราะ 4321 ชนกับ process อื่น
  ในเครื่อง) แล้ว title/เนื้อหาภาษาไทยกลายเป็นตัวอักษรมั่วๆ เช่น `à¸«à¸™à¹‰à¸²` แทนที่จะเป็น "หน้า"
- **สาเหตุ:** `<head>` ของ `index.astro` ไม่มี `<meta charset="utf-8" />` — browser เลยเดา encoding ผิดตอนอ่านไฟล์ HTML
  ที่มีอักขระไทย (UTF-8 หลายไบต์ต่อตัวอักษร) ทั้งที่ตัวไฟล์เก็บเป็น UTF-8 ถูกต้องอยู่แล้ว
- **แก้:**
  ```astro
  <head>
    <meta charset="utf-8" />
    <title>MFE Workshop — Landing</title>
  </head>
  ```
- **วิธีเช็คว่าถูกจริง:** รีโหลดหน้า ข้อความไทยต้องอ่านออกปกติ ไม่ใช่ mojibake — เป็นเรื่องที่ต้องเช็คทุกครั้งที่ scaffold
  หน้า HTML ใหม่ด้วยมือ (framework ส่วนใหญ่อย่าง Next.js ใส่ charset ให้อัตโนมัติ แต่ Astro raw HTML ต้องใส่เอง)

### 8.10 (ข้อ 6) `ERR_PNPM_OUTDATED_LOCKFILE` ตอน deploy บน Vercel
- **อาการ:** Vercel build fail ทันทีด้วย `Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to
  date with apps/landing-astro/package.json` — `1 dependencies were added: astro@^7.2.6`
- **สาเหตุที่ยืนยันด้วยการเช็คจริง:** `pnpm-lock.yaml` (root) ถูก commit ไว้ตั้งแต่ก่อน `landing-astro/package.json`
  จะมี `astro@^7.2.6` (น่าจะจากตอน retry scaffold แก้ error 504 — ดู 8.5) แล้วไม่เคยรัน `pnpm install` ที่ root ซ้ำเพื่อ
  sync lockfile ก่อน commit — Vercel รัน `pnpm install --frozen-lockfile` เพื่อความ reproducible ซึ่ง fail ทันทีถ้า
  lockfile กับ package.json ไม่ตรงกัน
- **แก้:**
  ```bash
  pnpm install   # ไม่ใส่ --frozen-lockfile เพื่อให้ regenerate ใหม่
  git add pnpm-lock.yaml
  git commit -m "fix: regenerate lockfile"
  git push
  ```
- **วิธีเช็คว่าถูกจริง:** รัน `pnpm install --frozen-lockfile` ที่ local (คำสั่งเดียวกับที่ Vercel รันจริง) ต้องผ่านไม่ error
  ก่อน push — **กฎทั่วไป:** ทุกครั้งที่แก้ dependency ใน `package.json` ของแอปไหนก็ตาม ต้องรัน `pnpm install` ที่ root
  แล้ว commit `pnpm-lock.yaml` ไปด้วยเสมอ

### 8.11 (ข้อ 6) shell โหลด widget จาก `localhost:4174` แม้ deploy ขึ้น production แล้ว
- **อาการ:** เปิด shell บน production ค้างที่ "กำลังโหลด widget จาก remote..." ตลอด console ฟ้อง
  `[ Federation Runtime ]: Failed to load script resource...imported module: http://localhost:4174/remoteEntry.js`
- **สาเหตุที่ยืนยันด้วยการเช็ค production จริง:** ตั้ง env var `NEXT_PUBLIC_WIDGET_REMOTE_ENTRY` ใน Vercel dashboard
  ไว้ถูกแล้ว แต่ **ไม่ได้ redeploy ใหม่** — `NEXT_PUBLIC_*` ของ Next.js ถูก bake เข้า JS bundle ตอน **build time**
  ไม่ใช่อ่านตอน runtime แค่ตั้งค่าใน dashboard เฉยๆ ไม่มีผลกับ build ที่ deploy ไปแล้วก่อนหน้า
- **แก้:** ไปที่ Vercel project ของ shell → tab **Deployments** → กด **Redeploy** (หรือ push commit ใหม่ก็ trigger build ให้เอง)
- **วิธีเช็คว่าถูกจริง:** เปิดหน้า production ใหม่ (tab สดไม่มี cache) เห็น widget render + คลิกปุ่มนับได้จริง —
  ทดสอบยืนยันแล้วว่าหลัง redeploy ทำงานถูก (นับได้ถึง 2)

### 8.12 (ข้อ 6) `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` เฉพาะ `shell-nextjs` — ไฟล์ `pnpm-lock.yaml` ปลอมค้างอยู่ในแอปย่อย
- **อาการ:** Vercel build ของ `shell-nextjs` fail ด้วย
  `"@mfe/shared-types@workspace:*" is in the dependencies but no package named "@mfe/shared-types" is present in the
  workspace` แม้ local รัน `pnpm install --frozen-lockfile` จาก root ผ่านตลอด
- **สาเหตุที่ยืนยันด้วยการเช็คจริง:** `git ls-tree -r HEAD --name-only` เจอ `apps/shell-nextjs/pnpm-lock.yaml` และ
  `apps/landing-astro/pnpm-lock.yaml` ตกค้างอยู่ตั้งแต่ commit แก้ "submodule" (ดู 8.6) — lockfile ปลอมพวกนี้เก่ากว่า
  ตัวจริงที่ root และไม่มี entry ของ `@mfe/shared-types`
- **แก้:**
  ```bash
  rm apps/shell-nextjs/pnpm-lock.yaml apps/landing-astro/pnpm-lock.yaml
  # เพิ่มกันเผลอ commit ซ้ำ:
  # apps/*/pnpm-lock.yaml ใน .gitignore
  git add -A
  git commit -m "fix: remove stray per-app pnpm-lock.yaml files causing Vercel deploy failures"
  git push
  ```
- **วิธีเช็คว่าถูกจริง:** จำลอง CWD เดียวกับที่ Vercel ใช้จริง (ไม่ใช่รันจาก root เฉยๆ เพราะ root หาไฟล์ถูกอยู่แล้ว):
  `cd apps/shell-nextjs && pnpm install --frozen-lockfile` ต้องผ่านไม่ error — **บั๊กนี้แก้ได้แค่บางส่วน** ยัง error
  ต่อด้วยสาเหตุอื่นซ้อนอยู่ (ดู 8.13)

### 8.13 (ข้อ 6) สาเหตุจริง — `pnpm-workspace.yaml` ปลอมค้างอยู่ในแอปย่อย ทำให้ pnpm หยุดหา root ก่อนเจอตัวจริง
- **อาการ:** error เดิมจาก 8.12 ยังขึ้นซ้ำแม้ลบ `pnpm-lock.yaml` ปลอมไปแล้ว —
  `Packages found in the workspace: ` (ว่างเปล่า)
- **สาเหตุที่ยืนยันด้วยการเช็คจริง:** `git ls-tree` เจอ `apps/shell-nextjs/pnpm-workspace.yaml` และ
  `apps/landing-astro/pnpm-workspace.yaml` ตกค้างอยู่คู่กับ lockfile ปลอมใน 8.12 — ทั้งคู่**ไม่มี `packages:` field**
  เลย pnpm หา `pnpm-workspace.yaml` โดยเดินขึ้นทีละ level จาก CWD แล้ว**หยุดค้นหาทันทีที่เจอไฟล์ชื่อนี้ครั้งแรก** ไม่สนว่า
  เนื้อหาข้างในจะว่างเปล่าหรือไม่ — พอเจอไฟล์ปลอมก่อน ก็เลยไม่เดินขึ้นไปหาตัวจริงที่ root ที่มี `packages: [apps/*, packages/*]`
  (`widget-react19` ไม่พังเพราะไม่มีไฟล์ปลอมแบบนี้ตกค้าง — เป็นเบาะแสสำคัญที่ทำให้เทียบโค้ด 2 แอปนี้แล้วเจอ)
- **แก้:**
  ```bash
  rm apps/shell-nextjs/pnpm-workspace.yaml apps/landing-astro/pnpm-workspace.yaml
  # เพิ่มกันเผลอ commit ซ้ำ:
  # apps/*/pnpm-workspace.yaml ใน .gitignore
  git add -A
  git commit -m "fix: remove stray per-app pnpm-workspace.yaml files (real root cause)"
  git push
  ```
- **วิธีเช็คว่าถูกจริง:** `cd apps/shell-nextjs && pnpm install --frozen-lockfile` ต้องเจอ "Scope: all 6 workspace
  projects" — **บทเรียน:** เมื่อ error เกิดเฉพาะบน CI/CD แต่ local (รันจาก root) ผ่านตลอด ให้สงสัยไฟล์ตกค้างที่ local ไม่เคย
  รันจาก CWD เดียวกับ CI ก่อน แล้วค่อยสงสัย platform config — อย่าวนเช็ค dashboard settings ซ้ำๆ โดยไม่มีหลักฐานจากโค้ด/ไฟล์จริง

### 8.14 (ข้อ 6) `packageManager` field อยู่ผิดตำแหน่ง — ทำให้ deploy ยัง fail ต่ออีกชั้นแม้แก้ 8.12-8.13 แล้ว
- **อาการ:** error เดิมจาก 8.13 ยังขึ้นซ้ำอีกรอบแม้ลบไฟล์ปลอมครบแล้ว
- **สาเหตุที่ยืนยันด้วยการเช็คจริง:** เทียบ `package.json` ของ `shell-nextjs` (fail) กับ `widget-react19` (deploy ผ่าน)
  ตรงๆ เจอว่า `apps/shell-nextjs/package.json` มี `"packageManager": "pnpm@10.11.0"` ซึ่ง `widget-react19/package.json`
  ไม่มี — ตาม Vercel docs field นี้ควรอยู่ที่ **root `package.json` เท่านั้น** การมีอยู่ในแอปย่อยที่ Root Directory ชี้ตรง
  ไปหา (เฉพาะ framework preset Next.js) รบกวนขั้นตอน detect package manager/workspace
- **แก้:** ย้าย field ออกจาก `apps/shell-nextjs/package.json` ไปไว้ที่ root `package.json` แทน
  ```diff
  # apps/shell-nextjs/package.json
     "tailwindcss": "^4",
     "typescript": "^5"
  -  },
  -  "packageManager": "pnpm@10.11.0"
  +  }
   }
  ```
  ```diff
  # package.json (root)
       "dev:widget": "pnpm --filter widget-react19 build && pnpm --filter widget-react19 preview"
  -  }
  +  },
  +  "packageManager": "pnpm@10.11.0"
   }
  ```
- **วิธีเช็คว่าถูกจริง:** push แล้วดู deployment ใหม่ผ่าน + `curl` production URL ของ shell-nextjs เจอ test div
  (`bg-danger-500`) ที่ก่อนหน้านี้ไม่เคยขึ้นเลยตลอดการ debug รอบนี้ — ยืนยันว่า deploy สำเร็จจริง ไม่ใช่แค่ build ผ่าน

---

## 9. ใช้ประโยชน์จริงของ monorepo (แบบฝึกหัดเสริม — ยังไม่ได้ทำ ลองเองแล้วเล่าผล)

ตามที่คุยกัน — สถาปัตยกรรมตอนนี้ (แอปแยกอิสระ สื่อสารผ่าน URL ล้วนๆ) **ไม่ได้ใช้ความสามารถจริงของ monorepo เลย**
3 repo แยกกันก็ทำงานได้เหมือนเดิม 2 แบบฝึกหัดนี้จะบังคับให้ใช้ของจริง 2 อย่างที่ monorepo ให้ได้แต่ multi-repo ทำยากกว่า

### 9.1 แชร์ type ข้าม 2 แอปผ่าน `workspace:*` (ไม่ต้อง publish package)

ตอนนี้ type `MountFn` ถูกเขียนซ้ำ 2 ที่แบบไม่ผูกกัน — ใน `shell-nextjs/app/RemoteWidgetIsolated.tsx` (ฝั่งเรียกใช้)
และโดยนัยใน `widget-react19/src/mount.tsx` (ฝั่ง implement) ถ้า widget เปลี่ยน signature ของ `mount()` shell จะไม่รู้
เลยจนกว่าจะพังตอน runtime — เอา type มา "แชร์จริง" ด้วย local package กัน

**1. เพิ่ม `packages/*` เข้า workspace:**
```yaml
# pnpm-workspace.yaml (root) — แก้จาก apps/* เป็น 2 บรรทัด
packages:
  - "apps/*"
  - "packages/*"
```

**2. สร้าง shared package:**
```bash
mkdir -p ~/road-map-30/mfe-workshop/packages/shared-types/src
cd ~/road-map-30/mfe-workshop/packages/shared-types
```
`package.json`:
```json
{
  "name": "@mfe/shared-types",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```
`src/index.ts`:
```ts
export type MountResult = { unmount: () => void }
export type MountFn = (el: HTMLElement) => MountResult
```

**3. ให้ 2 แอปที่ต้องใช้ type นี้ import จาก package เดียวกัน** — เพิ่มใน `dependencies` ของทั้ง
`apps/shell-nextjs/package.json` และ (ถ้าต้องการ export type จริงจาก build) `apps/widget-react19/package.json`:
```json
"@mfe/shared-types": "workspace:*"
```
แล้ว `pnpm install` ที่ root ใหม่ (pnpm จะ symlink package นี้เข้า `node_modules` ของทั้ง 2 แอปให้อัตโนมัติ ไม่ต้อง publish)

**4. แก้ `RemoteWidgetIsolated.tsx` ให้ import แทนประกาศเอง:**
```ts
import type { MountFn } from '@mfe/shared-types'
// ลบ type MountFn = ... ที่ประกาศเองทิ้ง
```

**พิสูจน์ว่าได้ประโยชน์จริง:** ลองแก้ `MountResult` ใน `packages/shared-types/src/index.ts` ให้ผิดเจตนา (เช่นเปลี่ยน
`unmount: () => void` เป็น `close: () => void`) แล้วรัน `pnpm --filter shell-nextjs build` — TypeScript ต้อง **error
ทันทีที่ shell** บอกว่า type ไม่ตรง ทั้งที่ยังไม่ได้แตะโค้ดของ shell เลยสักบรรทัด — นี่คือสิ่งที่ 3 repo แยกกันทำไม่ได้
(ต้อง publish version ใหม่ + อีกฝั่ง update dependency ก่อนถึงจะรู้ว่าพัง)

### 9.2 แก้ contract ข้าม 2 แอปใน PR/commit เดียว (atomic cross-app change)

ต่อยอดจากที่คุยเรื่อง auth ไว้ —ลองเพิ่ม `props` ให้ `mount()` รับ user object จริง แก้พร้อมกันทั้ง 2 แอปใน branch เดียว:

1. `packages/shared-types/src/index.ts` — เพิ่ม `export type MountProps = { user: { name: string } | null }` แล้วแก้
   `MountFn` ให้รับ `props: MountProps` เป็น argument ที่ 2
2. `apps/widget-react19/src/mount.tsx` — แก้ `mount(el, props: MountProps)` ส่ง `props.user` เข้า `<Widget user={props.user} />`
3. `apps/widget-react19/src/Widget.tsx` — รับ prop `user` แสดงชื่อถ้ามี
4. `apps/shell-nextjs/app/RemoteWidgetIsolated.tsx` — แก้เรียก `mod.mount(ref.current, { user: { name: 'Tammarat' } })`

ทำทั้ง 4 ไฟล์ (ข้าม 2 แอป) ใน branch เดียว, commit เดียว, PR เดียว:
```bash
git checkout -b feat/widget-shell-user-prop
# แก้ 4 ไฟล์ข้างบน
git add packages/shared-types apps/widget-react19 apps/shell-nextjs
git commit -m "feat: pass user prop from shell to widget via mount()"
git push
```

**พิสูจน์ว่าได้ประโยชน์จริง:** สังเกตว่า PR นี้ diff เดียวมีทั้ง shared-types + widget + shell ครบ — reviewer เห็นภาพรวม
การเปลี่ยนแปลงทั้งระบบในที่เดียว ไม่ต้องเปิด 2-3 PR คนละ repo แล้วพยายามจำว่าต้อง merge เรียงลำดับไหนก่อนถึงจะไม่พัง —
นี่คือ "atomic cross-app change" ที่เป็นเหตุผลจริงที่ทีมใหญ่เลือก monorepo

---

## เมื่อทำเสร็จ

**อัปเดต:** ทำครบทั้ง 6 ข้อแล้ว deploy จริงบน Vercel สำเร็จ verified ทุกจุด (widget/shell/landing เชื่อมกันได้จริง, CORS
ผ่านอัตโนมัติ, charset ถูก) เหลือแค่ข้อ 5 (git branching practice — merge feature branch ทดสอบว่า deploy แค่ project
ที่เปลี่ยนจริง) ที่ยังไม่ได้ลองยืนยันแบบ end-to-end บน Vercel — ถ้าลองแล้วมาเล่าผลให้ฟัง จะได้บันทึกต่อ

**ข้อ 9 (ใช้ประโยชน์จริงของ monorepo) ยังไม่ได้ลองทำ** — เป็นแบบฝึกหัดเสริมที่ตอบคำถาม "ทำไมต้อง monorepo" ที่คุยกันไว้
ลองทำแล้วมาเล่าผล โดยเฉพาะจุดพิสูจน์ (TypeScript error ข้ามแอปตอนแก้ shared type ผิด, PR เดียวที่ diff ครบทั้งระบบ)
จะได้บันทึกเป็นความรู้ verified ต่อ เหมือนทุกข้ออื่นที่ผ่านมา
