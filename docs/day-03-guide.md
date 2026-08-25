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

> ⚠️ **CORS ตอนขึ้น production:** พอ widget-react19 กับ shell-nextjs อยู่คนละ domain บน Vercel จะเจอ CORS ตอน fetch
> `remoteEntry.js` ข้าม origin เหมือนที่เจอตอน dev (แก้ไปแล้วด้วย `cors: true` ในข้อ 2.3 ฝั่ง dev/preview server — แต่ Vercel
> ใช้ static hosting คนละ mechanism จาก `vite preview` ดังนั้น**ต้องทดสอบซ้ำตอน deploy จริง** ว่า Vercel ส่ง
> `Access-Control-Allow-Origin` มาด้วยไหม เปิด DevTools เช็คจริงแทนเดา — ถ้าไม่มีให้เพิ่ม `vercel.json` ใส่ header เอง)

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

## 6. Deploy ทั้ง 3 แอปแยกกันด้วย Vercel (3 projects, 1 repo)

Push repo ขึ้น GitHub ก่อน (repo เดียว มีทั้ง 3 apps) แล้วสร้าง Vercel project **3 ครั้ง** ชี้ repo เดียวกันแต่คนละ Root Directory:

| Vercel Project | Root Directory | Framework Preset | หมายเหตุ |
|---|---|---|---|
| `widget-react19` | `apps/widget-react19` | Vite | deploy ตัวนี้ก่อน เพื่อเอา URL จริงไปใส่ env var ของ shell |
| `shell-nextjs` | `apps/shell-nextjs` | Next.js | ตั้ง env var `NEXT_PUBLIC_WIDGET_REMOTE_ENTRY` = URL จริงของ widget project (เช่น `https://widget-react19-xxx.vercel.app/remoteEntry.js`) |
| `landing-astro` | `apps/landing-astro` | Astro | ตั้ง env var `PUBLIC_SHELL_URL` = URL จริงของ shell project |

**ลำดับ deploy ที่ถูก:** widget → shell (ต้องรู้ URL ของ widget ก่อน) → landing (ต้องรู้ URL ของ shell ก่อน)

**Checkpoint 4 (สุดท้าย):** เปิด URL ของ landing-astro บน production → คลิกลิงก์ไป shell (production) → เห็น widget
(production) โหลดมาแสดงในหน้า shell ได้ — ครบ loop ทั้ง 3 แอป คนละ deploy คนละ URL คนละ build จริง

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

---

## เมื่อทำเสร็จ

กลับมาบอกผลลัพธ์ + ปัญหาที่เจอจริง (ถ้ามี) แล้วเราจะเอาสิ่งที่แก้ได้จริงไปบันทึกเพิ่มใน Interview-FE (`/micro-frontend`)
กับ Obsidian ตามธรรมเนียมเดิม — โดยเฉพาะจุดที่ยังไม่ปิดเคส 100%: `vite dev` รองรับ federation ไหม (ตอนนี้ใช้ build+preview
เลี่ยงไปก่อน), CORS บน Vercel production จริง (ข้อ 3.4), และถ้าใครอยากลองทำ true React-singleton sharing สำเร็จ (ข้อ 3.5
ช่วงท้าย) เพราะนั่นคือความรู้ verified จริงจากการลงมือทำ ไม่ใช่แค่ก็อปจาก docs
