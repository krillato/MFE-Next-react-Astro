# Day 1 Guide — Proxy, Route Handler, RSC, Caching, Server Actions, Suspense

คู่มืออธิบายทุกอย่างที่สร้างไว้ในวันที่ 1 ของแพลน — **การทำงาน**, **เหตุผลที่ใช้แนวทางนี้**, และ **วิธีทดสอบ** ของแต่ละหัวข้อ
เขียนไว้ให้กลับมาอ่านทวนได้ทีหลัง โดยไม่ต้องเปิด Interview-FE

---

## ⚠️ สิ่งที่ต้องรู้ก่อน: โปรเจกต์นี้ใช้ Next.js 16

Next.js 16 เปลี่ยน API บางตัวจากที่สอนกันทั่วไป (รวมถึงเนื้อหาอ้างอิงที่เคยเตรียมไว้):

| เรื่อง | ของเก่า (v13-15) | ของจริงใน v16 (โปรเจกต์นี้) |
|---|---|---|
| ไฟล์ดักทุก request | `middleware.ts` + `export function middleware()` | `proxy.ts` + `export function proxy()` — การทำงานเหมือนเดิมทุกอย่าง แค่เปลี่ยนชื่อ |
| Caching model | Request Memoization → Data Cache → Full Route Cache → Router Cache | เหมือนเดิม **ตราบใดที่ไม่เปิด** `cacheComponents: true` ใน `next.config.ts` (โปรเจกต์นี้ยังไม่เปิด) |

ทุกไฟล์ในคู่มือนี้ใช้ API ที่ตรวจสอบแล้วจริงจาก `node_modules/next/dist/docs/` ของโปรเจกต์นี้เอง ไม่ใช่จำมาจากที่อื่น

---

## โครงสร้างไฟล์ที่เพิ่มวันนี้

```text
nextjs-30/
├── proxy.ts                       ← Proxy (เดิมเรียก Middleware)
├── lib/
│   └── posts.ts                   ← data layer, ตัวอย่าง fetch caching
├── app/
│   ├── layout.tsx                 ← เพิ่ม nav ให้กดไปแต่ละหน้าได้
│   ├── login/
│   │   ├── actions.ts             ← Server Action: login/logout
│   │   └── page.tsx
│   ├── dashboard/
│   │   └── page.tsx               ← หน้าที่ proxy.ts ป้องกันไว้
│   ├── api/
│   │   └── health/route.ts        ← Route Handler
│   └── posts/
│       ├── page.tsx                ← RSC list + caching + Suspense
│       ├── actions.ts              ← Server Action: like
│       ├── LikeButton.tsx          ← Client Component
│       ├── SlowRecommendations.tsx ← ตัวอย่าง streaming
│       └── [id]/page.tsx           ← Dynamic route + ISR
```

---

## 1. Proxy — `proxy.ts`

### การทำงาน
`proxy.ts` รันบน **Edge Runtime ก่อน** ที่ request จะไปถึง route handler/page ใดๆ — ตรวจ path ที่เข้ามา แล้วตัดสินใจว่าจะปล่อยผ่าน (`NextResponse.next()`) หรือ redirect/rewrite

```ts
export function proxy(request: NextRequest) {
  const isLoggedIn = request.cookies.has("session");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
```

### เหตุผลที่ใช้แนวทางนี้
- **ตรวจสิทธิ์ที่ proxy แทนที่จะให้แต่ละหน้าเช็คเอง** — เพราะถ้ามีหลายหน้า protected ในอนาคต (เช่น `/dashboard/settings`, `/dashboard/billing`) จะไม่ต้อง copy logic เช็ค cookie ซ้ำทุกหน้า เขียนที่เดียวจบ
- **ใช้ `matcher` แคบๆ (`/dashboard/:path*`) ไม่ปล่อยว่าง** — proxy รันทุก request ที่ match ต้องเร็ว การจำกัด path กันไม่ให้ไปรันซ้ำบน route ที่ไม่เกี่ยวข้อง (เช่น static asset, `/posts`)
- **เช็คแค่ "มี cookie ไหม" ไม่ verify signature ที่นี่** — เอกสาร Next.js เตือนไว้ตรงๆ ว่า Proxy ไม่ควรใช้เป็น full session management เต็มรูปแบบ ควรใช้แค่ optimistic check (เร็ว, กันหน้าเปล่าๆ) ส่วนการ verify จริงจังทำที่ server component/route handler ที่เป็น Node runtime เต็ม

### วิธีทดสอบ
1. เปิด `http://localhost:3000/dashboard` โดยยังไม่ login → ต้องเด้งไป `/login?from=%2Fdashboard`
2. Login ด้วย username อะไรก็ได้ → ต้องเด้งกลับไป `/dashboard` อัตโนมัติ
3. เปิด DevTools → Application → Cookies → ต้องเห็น cookie ชื่อ `session`
4. ลบ cookie นั้นออก แล้วรีเฟรช `/dashboard` → ต้องเด้งไป `/login` อีกครั้ง (พิสูจน์ว่า proxy เช็คทุก request จริง)
5. ดู terminal ที่รัน `pnpm dev` → ต้องเห็น log `[proxy] GET /dashboard` ทุกครั้งที่เข้าหน้านี้

---

## 2. Route Handler — `app/api/health/route.ts`

### การทำงาน
ไฟล์ `route.ts` ในโฟลเดอร์ `app/` ทำหน้าที่เป็น REST endpoint — export function ชื่อ HTTP method (`GET`, `POST`, ...) รับ/คืนค่าด้วย Web standard `Request`/`Response` API

```ts
export async function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ received: body }, { status: 201 });
}
```

### เหตุผลที่ใช้แนวทางนี้
- **ใช้ Route Handler แทน Server Action ตรงนี้** เพราะ `/api/health` ต้องเป็น endpoint ที่เรียกจากภายนอกได้ (monitoring tool, curl, mobile app ในอนาคต) — Server Action ผูกกับ form/client component ของแอปเดียว เรียกจาก third-party ตรงๆ ไม่ได้
- **`.catch(() => ({}))` ตอน parse JSON** — กัน request ที่ body ว่าง/ไม่ใช่ JSON ทำให้ endpoint 500 ทั้งที่ควรจะรับได้เฉยๆ แล้วตอบ `{}` แทน

### วิธีทดสอบ
```bash
curl http://localhost:3000/api/health
# → {"status":"ok","time":"..."}

curl -X POST http://localhost:3000/api/health \
  -H "Content-Type: application/json" \
  -d '{"ping":"pong"}'
# → {"received":{"ping":"pong"}}   status 201
```
หรือเปิด `http://localhost:3000/api/health` ในเบราว์เซอร์ตรงๆ (จะเห็นผล GET เป็น JSON ดิบ)

---

## 3. RSC + Data Fetching + Caching — `lib/posts.ts` + `app/posts/page.tsx`

### การทำงาน
`app/posts/page.tsx` เป็น **Server Component** (ไม่มี `"use client"`) — `await getPosts()` ได้ตรงๆ ในตัว component เลย ไม่ต้องใช้ `useEffect`/`useState` แบบฝั่ง client

```ts
// lib/posts.ts
export async function getPosts(): Promise<Post[]> {
  const res = await fetch(`${API}/posts?_limit=10`, { cache: "force-cache" });
  return res.json();
}
```

### เหตุผลที่ใช้แนวทางนี้
- **`cache: 'force-cache'` สำหรับ list ของ posts** — ข้อมูลนี้ไม่เปลี่ยนบ่อย (เหมือนบทความ/แคตตาล็อกสินค้า) จึงยอม cache ไว้ยาวๆ ลด round-trip ไป API ทุกครั้งที่มีคนเข้าเว็บ ต่างจาก `no-store` ที่จะ fetch ใหม่ทุก request (ช้ากว่า, ยิง API บ่อยกว่าโดยไม่จำเป็น)
- **fetch จริงจาก JSONPlaceholder แทนข้อมูล mock ในหน่วยความจำ** — เพื่อให้เห็นพฤติกรรม cache ของ Next.js จริงๆ (mock data ในตัวแปรธรรมดาไม่ผ่าน fetch cache ของ Next เลย จะทดสอบ cache ไม่ได้)
- **ครอบ `<SlowRecommendations />` ด้วย `<Suspense>`** — แยกส่วนที่ช้าออกจากส่วนหลัก ผู้ใช้เห็น list posts ทันทีโดยไม่ต้องรอส่วนที่ดีเลย์ 1.5s (ดูรายละเอียดหัวข้อ 6)

### วิธีทดสอบ
1. เปิด `/posts` → ต้องเห็นรายการโพสต์จริงจาก JSONPlaceholder (ภาษาอังกฤษ, เนื้อหาสุ่ม)
2. รีเฟรชหน้าซ้ำหลายรอบ → เนื้อหาต้อง**เหมือนเดิมทุกครั้ง** (เพราะ cache ไว้แล้ว ไม่ยิง API ซ้ำ)
3. เปิด DevTools → Network → รีเฟรช → ไม่ควรเห็น request ไป `jsonplaceholder.typicode.com` ซ้ำ (fetch แรกครั้งเดียวตอน build/ครั้งแรกเท่านั้น)
4. หยุด+รัน `pnpm dev` ใหม่ → cache หายเพราะเป็น in-memory ผูกกับ process ของ dev server

### 🔍 ตรวจสอบว่า cache ทำงานจริงยังไง (ไม่ต้องเดา มี log บอกตรงๆ)
เปิด `logging.fetches` ใน `next.config.ts` (ใส่ไว้ให้แล้วในโปรเจกต์นี้):
```ts
const nextConfig: NextConfig = {
  logging: { fetches: { fullUrl: true } },
}
```
รีสตาร์ท `pnpm dev` แล้วดู terminal ตอนเปิด `/posts` หรือ `/posts/[id]`:
```text
GET /posts 200 in 1533ms
 │ GET https://.../posts?_limit=10 200 in 6ms (cache hit)

GET /posts/2 200 in 185ms
 │ GET https://.../posts/2 200 in 143ms (cache skip)
 │ │ Cache skipped reason: (cache-control: no-cache (hard refresh))

POST /posts/2 200 in 200ms
  └─ ƒ likePost(2) in 2ms app/posts/actions.ts   ← Server Action logging เปิดอยู่แล้ว default ไม่ต้องตั้งอะไร
```

**ความหมายของแต่ละ label:**
| Label | ความหมาย |
|---|---|
| `(cache hit)` | เจอ cache ที่ยังใช้ได้ → **ไม่ยิง network ไปหา API จริง** ใช้ข้อมูลที่เก็บไว้แทน |
| `(cache skip)` | **ยิง network จริง** ไม่ใช้ cache สำหรับ request นี้ — มาพร้อม "เหตุผล" เสมอ (`no-store`, hard refresh ส่ง no-cache, หรือ `revalidate` หมดอายุ) |

**อย่าใช้เวลา (ms) เดาว่า cache หรือไม่** — response เร็วไม่ได้แปลว่า hit เสมอ (API ปลายทางอาจเร็วอยู่แล้ว) ให้ดู label ตรงๆ แม่นกว่า

**`/posts` ขึ้น `(cache hit)` ตลอดคือเรื่องปกติ ไม่ใช่บั๊ก** — เพราะใช้ `cache: 'force-cache'` ซึ่งไม่มีวันหมดอายุเอง ถ้าอยากเห็น `(cache skip)` บ้าง: restart dev server, hard refresh (`Cmd+Shift+R`), เทส `/posts/[id]` แล้วรอเกิน 30s (มี `revalidate: 30`), หรือกด like (`revalidatePath` บังคับ invalidate)

---

## 4. Dynamic Routes + ISR — `app/posts/[id]/page.tsx`

### การทำงาน
`[id]` ในชื่อโฟลเดอร์ = dynamic segment — `generateStaticParams()` บอก Next.js ว่า id ไหนบ้างที่ควร prerender ไว้ตั้งแต่ build time

```ts
export async function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

export async function getPost(id: string): Promise<Post> {
  const res = await fetch(`${API}/posts/${id}`, { next: { revalidate: 30 } });
  return res.json();
}
```

### เหตุผลที่ใช้แนวทางนี้
- **`generateStaticParams` ใส่แค่ id 1-3** — จำลองสถานการณ์จริงที่ prerender เฉพาะหน้ายอดนิยม/ที่คาดว่าคนเข้าเยอะไว้ตั้งแต่ build ส่วน id อื่น (4, 5, ...) ยัง**เข้าถึงได้ปกติ** แค่ render แบบ on-demand ตอนมีคนเข้าครั้งแรกแทน — ไม่ต้อง build ทุก id ล่วงหน้าซึ่งอาจมีเป็นพันเป็นหมื่นรายการ
- **`revalidate: 30` แทน `force-cache` เฉยๆ** — หน้ารายละเอียดโพสต์อาจมีการแก้ไข (เช่นจำนวน like) จึงยอมให้ cache หมดอายุเร็วกว่า list (30 วินาที) เพื่อให้เห็นข้อมูลใหม่ไม่ช้าเกินไป โดยยังไม่ต้อง fetch ใหม่ทุก request
- **ใช้ `notFound()` เมื่อ fetch ล้มเหลว** แทนโยน error ตรงๆ — ให้ Next.js render หน้า 404 ที่ถูกต้องตาม convention แทนหน้า error ทั่วไป

### วิธีทดสอบ
1. เปิด `/posts/1`, `/posts/2`, `/posts/3` → ควรโหลดเร็วมาก (prerender ไว้แล้วจาก build)
2. เปิด `/posts/7` (ไม่อยู่ใน `generateStaticParams`) → ก็ยังเปิดได้ปกติ (on-demand render)
3. เปิด `/posts/9999` (id ที่ไม่มีจริง) → ต้องเจอหน้า 404 ไม่ใช่หน้า error แดงๆ
4. รอ 30+ วินาทีแล้วรีเฟรช `/posts/1` → ข้อมูลอาจ refresh เบื้องหลัง (เนื้อหาจาก mock API เหมือนเดิมเพราะ API ไม่เปลี่ยน แต่กลไก revalidate ทำงานอยู่เบื้องหลังจริง)

---

## 5. Server Actions — `app/login/actions.ts`, `app/posts/actions.ts`, `LikeButton.tsx`

### การทำงาน
มี 2 แบบให้เห็นความต่าง:

**แบบ form (progressive enhancement):**
```ts
// app/login/actions.ts
export async function login(formData: FormData) {
  "use server";
  const username = formData.get("username");
  const cookieStore = await cookies();
  cookieStore.set("session", username, { httpOnly: true, sameSite: "lax" });
  redirect("/dashboard");
}
```
```tsx
<form action={login}>...</form>
```

**แบบเรียกจาก event handler (Client Component):**
```ts
// app/posts/actions.ts
export async function likePost(id: number) {
  "use server";
  const total = incrementLikes(id);
  revalidatePath(`/posts/${id}`);
  return total;
}
```
```tsx
// LikeButton.tsx — "use client"
onClick={() => startTransition(async () => {
  const total = await likePost(postId);
  setLikes(total);
})}
```

### เหตุผลที่ใช้แนวทางนี้
- **`login` ใช้กับ `<form action={...}>` ไม่ใช้ `onClick`** — เพราะ login เป็น mutation ที่มาจาก form โดยธรรมชาติ ใช้ `<form>` แล้ว Next.js/React ทำ progressive enhancement ให้ฟรี (form ยัง submit ได้แม้ JS ยังโหลดไม่เสร็จ) ต่างจาก `onClick` ที่ต้องรอ JS hydrate ก่อนถึงจะกดได้
- **`likePost` ใช้กับ `onClick` ไม่ใช่ `<form>`** — เพราะปุ่ม like ไม่ใช่ form submission ที่มีข้อมูลกรอก เป็นแค่ action เดียวกดแล้วอัปเดต state ทันที การใช้ `useTransition` + `startTransition` ทำให้โชว์ loading state (`isPending`) ระหว่างรอ server ได้โดยไม่บล็อก UI
- **`revalidatePath` ใน `likePost`** — บอก Next.js ว่า cache ของหน้า `/posts/[id]` นี้เก่าแล้ว (จำนวน like เปลี่ยน) ให้ generate ใหม่รอบถัดไป ถ้าไม่เรียกตัวนี้ คนอื่นที่เข้าหน้าเดียวกันจะยังเห็นจำนวน like เก่าจนกว่า `revalidate: 30` วินาทีจะครบเอง
- **แยก `LikeButton.tsx` (client) ออกจาก `actions.ts` (server)** — ทุกอย่างที่ import เข้าไฟล์ที่มี `"use client"` จะถูกส่งไป bundle ฝั่ง browser หมด การแยกไฟล์ทำให้ logic จริง (`incrementLikes`, การต่อ database ในอนาคต) ไม่มีทางหลุดไปอยู่ใน JS bundle ที่ผู้ใช้เห็นได้
- **`cookies()` เขียนได้เฉพาะใน Server Action/Route Handler** ไม่ใช่ใน Server Component ธรรมดา (page.tsx อ่านได้อย่างเดียว) — ทำให้ logic ตั้ง session ต้องอยู่ใน `actions.ts` เท่านั้น

### วิธีทดสอบ
1. **Login form**: กรอก username → กด Login → ต้องเด้งไป `/dashboard` และเห็นชื่อที่กรอกไป
2. **Progressive enhancement**: ปิด JavaScript ใน DevTools (Settings → Debugger → Disable JavaScript) แล้วลอง submit form login อีกครั้ง → ควรยัง submit ได้ (แม้ UI จะดู "ค้าง" กว่าเดิมเพราะไม่มี client-side transition)
3. **Like button**: เปิด `/posts/1` → กดปุ่ม like หลายครั้งติดกัน → ตัวเลขต้องเพิ่มทุกครั้ง และปุ่มต้องขึ้น `...` (pending state) แวบหนึ่งระหว่างรอ server
4. **revalidatePath ทำงานจริง**: กด like ที่ `/posts/1` แล้วเปิดแท็บใหม่ไปที่ `/posts/1` อีกครั้ง → ต้องเห็นจำนวน like ล่าสุด ไม่ใช่ค่าเก่า

---

## 6. Suspense Streaming — `app/posts/SlowRecommendations.tsx`

### การทำงาน
```tsx
export default async function SlowRecommendations() {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return <div>...</div>;
}
```
ใช้ใน `page.tsx`:
```tsx
<Suspense fallback={<p>Loading recommendations...</p>}>
  <SlowRecommendations />
</Suspense>
```

### เหตุผลที่ใช้แนวทางนี้
- **ดีเลย์ปลอมด้วย `setTimeout` 1.5 วินาที** — เพื่อจำลอง component ที่ดึงข้อมูลช้า (เช่น เรียก AI, external API ที่ตอบช้า) ให้เห็นผลของ streaming ชัดเจนด้วยตา ไม่ต้องพึ่ง network จริงที่อาจเร็ว/ช้าไม่แน่นอน
- **ครอบด้วย `<Suspense>` แทนปล่อยให้ `await` ตรงๆ ใน `page.tsx`** — ถ้าไม่ครอบ, ทั้งหน้า `/posts` จะรอ 1.5 วินาทีก่อนแสดงอะไรเลยสักตัว (รวม list โพสต์ที่จริงๆ พร้อมแสดงเร็วกว่ามาก) การครอบ Suspense ทำให้ React "stream" HTML เป็นชิ้นๆ — ส่วนที่พร้อมก่อน (list โพสต์) แสดงก่อน ส่วนที่ช้ากว่า (recommendations) ค่อยตามมาทีหลังโดยไม่บล็อกกัน
- **นี่คือกลไกเดียวกับที่ทำให้เว็บใหญ่ๆ อย่าง e-commerce แสดงราคา/รูปสินค้าทันที แล้วค่อยให้ "รีวิวจากผู้ใช้" หรือ "สินค้าที่เกี่ยวข้อง" โผล่มาทีหลัง**

### วิธีทดสอบ (แบบที่พิสูจน์แล้วว่าเห็นผลจริง)
1. เปิด DevTools → Network tab ค้างไว้, throttle ตั้งเป็น **"No throttling"** (ปกติ)
2. **พิมพ์ URL ตรงๆ ที่ address bar** `http://localhost:3000/posts` แล้วกด Enter — **ห้ามคลิกผ่าน `<Link>` ใน nav** (ดูเหตุผลข้อ "ข้อควรระวัง" ด้านล่าง)
3. สังเกตด้วยตา → รายการโพสต์ต้องขึ้นทันที ส่วน "Recommended for you" ต้องขึ้นข้อความ "Loading recommendations..." ก่อน แล้วค่อยเปลี่ยนเป็นเนื้อหาจริงหลัง ~1.5 วินาที
4. ลองเอา `<Suspense>` ออกชั่วคราว (ครอบ component ตรงๆ ไม่มี fallback) → ทำซ้ำข้อ 2 → ต้องเห็นทั้งหน้าขาวค้าง ~1.5 วินาทีก่อนเห็นอะไรเลย (แล้วอย่าลืมใส่ `<Suspense>` กลับ)
5. **วัดตัวเลขจริงแบบไม่ผ่าน browser** (ตัดปัญหา prefetch/cache ออกไปเลย):
   ```bash
   curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s\n" http://localhost:3000/posts
   ```
   ผลจริงที่วัดได้จากโปรเจกต์นี้: **ไม่มี Suspense → TTFB 1.59s** vs **มี Suspense → TTFB 0.09s** (ต่างกัน 17 เท่า)

### ⚠️ ข้อควรระวังตอนทดสอบ (พลาดมาแล้วจริง แก้ไว้กันพลาดซ้ำ)
- **`<Link>` prefetch บัง effect ได้** — Next.js prefetch route ที่ลิงก์ชี้ไปล่วงหน้าในพื้นหลังตั้งแต่ลิงก์นั้น visible ในจอ (ก่อนคลิกด้วยซ้ำ) ถ้าทดสอบด้วยการคลิกลิงก์จาก nav bar งานอาจ resolve ไปแล้วเงียบๆ ก่อนคลิกจริง ทำให้รู้สึกว่า "โหลดมาพร้อมกันหมด" ทั้งที่ server ทำงานถูกต้อง — ต้องพิมพ์ URL ตรงๆ หรือ hard refresh (`Cmd+Shift+R`) เท่านั้นตอนทดสอบเปรียบเทียบ
- **Network throttle ไม่ช่วยอะไรกับ demo นี้** — ดีเลย์ 1.5s เป็น `setTimeout` ที่รันบน **server ก่อน**เริ่มส่งอะไรเลย เป็น compute delay ไม่ใช่ network delay การปรับเน็ตให้ช้าลงมีผลแค่ความเร็วตอน byte เดินทางหลังเริ่มส่งแล้วเท่านั้น ไม่เกี่ยวกับตอนที่ server ตัดสินใจเริ่มส่ง — ปรับเน็ตช้าอาจทำให้งงกว่าเดิมด้วยซ้ำเพราะทุกอย่างช้าลงพร้อมกันหมด แยกความต่างยากขึ้น

---

## รันโปรเจกต์

```bash
pnpm dev     # http://localhost:3000
pnpm build   # ตรวจ type + generate static pages ก่อน deploy จริง
```

`pnpm build` ต้องเห็น log แบบนี้ (ยืนยันว่าทุกหัวข้อถูกจัดประเภทถูกต้อง):
```text
Route (app)
┌ ○ /
├ ƒ /api/health        ← Dynamic (Route Handler)
├ ƒ /dashboard          ← Dynamic (อ่าน cookies())
├ ƒ /login              ← Dynamic (อ่าน searchParams)
├ ○ /posts              ← Static (cache: force-cache)
└   /posts/[id]
  ├ ● /posts/1          ← SSG (generateStaticParams)
  ├ ● /posts/2
  └ ● /posts/3

ƒ Proxy (Middleware)
```
