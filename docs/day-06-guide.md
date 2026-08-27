# Day 6 Guide — มินิโปรเจกต์: รวม MFE + Tailwind + Zod เป็น flow เดียว

> **กฎเดิม: ไกด์นี้มีไว้ให้คุณลงมือทำเอง — ผมจะไม่แก้โค้ดในโปรเจกต์คุณให้**
> ทุก code block คือสิ่งที่ต้อง type/run เอง

**วันนี้ไม่มีเนื้อหาใหม่** — เอา 3 เรื่องที่ทำมาทั้งสัปดาห์มาต่อกันเป็น flow จริงอันเดียว:

```
กรอกฟอร์ม "สร้างสินค้า" (Day 5, Zod validate + sanitize)
        ↓
ส่งข้อมูลผ่าน Module Federation mount() เป็น props   ← เคลียร์แบบฝึกหัด 9.2 ที่ค้างไว้จาก Day 3
        ↓
widget-react19 render เป็น "Product Preview Card"   ← สไตล์ทั้งหมดมาจาก @mfe/design-system (Day 4)
```

พูดง่ายๆ: ข้อมูลที่ผ่านการ validate/sanitize แล้วจากฟอร์มใน `shell-nextjs` จะวิ่งข้าม deploy ข้าม repo จริงๆ ไปโผล่เป็น UI
ใน `widget-react19` — ถ้าทำสำเร็จ แปลว่าทั้ง 3 เรื่องของสัปดาห์นี้ต่อกันได้จริง ไม่ใช่แค่ทำแยกกันคนละหน้า

---

## 0. เช็คสถานะปัจจุบันก่อนเริ่ม (อ่านโค้ดจริงในโปรเจกต์คุณมาแล้ว)

3 ไฟล์นี้คือจุดที่จะแก้วันนี้ — ตอนนี้หน้าตาเป็นแบบนี้:

- `packages/shared-types/src/index.ts` — มีแค่ `MountResult`/`MountFn` ยังไม่มี props ใดๆ (ตรงกับที่ค้างไว้จาก
  แบบฝึกหัด 9.2)
- `apps/widget-react19/src/Widget.tsx` — ตอนนี้เป็น demo ปุ่มนับเลข (counter) ไม่รับ prop อะไรเลย
- `apps/shell-nextjs/app/RemoteWidgetIsolated.tsx` — เรียก `mod.mount(ref.current)` เฉยๆ ไม่มี props
- `apps/shell-nextjs/app/create-product/page.tsx` (Day 5) — `onSubmit` แค่ `console.log` ข้อมูลออก ยังไม่ได้ส่งต่อไปไหน

ถ้าไฟล์ของคุณหน้าตาไม่ตรงกับนี้ (เช่นยังไม่ได้ทำ Day 5 หรือแก้ path เอง) ให้ปรับ step ด้านล่างตามโครงสร้างจริงของคุณ

---

## 1. ขยาย `@mfe/shared-types` — เพิ่ม `Product` + `MountProps`

แก้ `packages/shared-types/src/index.ts`:

```ts
export type MountResult = { unmount: () => void };

export type Product = {
  name: string;
  price: number;
  sku: string;
  description?: string;
};

export type MountProps = { product?: Product };

// props เป็น optional (ตัวที่ 2, มี ? ทั้งคู่) — ที่อื่นที่ยังเรียก mount(el) เฉยๆ (ไม่มี props)
// จะไม่พัง เพราะยังตรงกับ signature เดิมได้อยู่
export type MountFn = (el: HTMLElement, props?: MountProps) => MountResult;
```

> ทำไมต้อง optional ทั้งคู่ — เพราะ `mount()` มีจุดเรียกอยู่แล้วที่ไม่ได้ส่ง props (ถ้ามี) การบังคับ `props: MountProps`
> (required) จะทำให้จุดเรียกเดิมพัง (TypeScript error) ทันที เป็นตัวอย่างของการ **extend contract แบบไม่ breaking**
> ผู้เรียกเดิม — หลักการเดียวกับการเพิ่ม field ใหม่แบบ optional ใน API contract ทั่วไป

---

## 2. แก้ `mount.tsx` ให้รับ props แล้วส่งต่อเข้า Widget

แก้ `apps/widget-react19/src/mount.tsx`:

```tsx
import { createRoot, type Root } from "react-dom/client";
import Widget from "./Widget";
import type { MountProps } from "@mfe/shared-types";
import "./index.css";

export function mount(el: HTMLElement, props?: MountProps): Root {
  const root = createRoot(el);
  root.render(<Widget product={props?.product} />);
  return root;
}
```

---

## 3. แก้ `Widget.tsx` ให้ render Product Card เมื่อมี `product` prop

แก้ `apps/widget-react19/src/Widget.tsx` — เก็บ counter demo เดิมไว้เป็น fallback (ตอนไม่มี `product` prop เช่นรัน
`pnpm dev` เดี่ยวๆ ของ widget เอง จะได้ยังเห็นอะไรสักอย่าง ไม่ใช่หน้าเปล่า):

```tsx
import { useState } from "react";
import type { Product } from "@mfe/shared-types";

export default function Widget({ product }: { product?: Product }) {
  const [count, setCount] = useState(0);
  // ⚠️ useState ต้องอยู่บนสุดของ component เสมอ ไม่ว่า branch ไหนจะ return —
  // ถ้าย้ายไปประกาศหลัง `if (product) return (...)` จะผิด Rules of Hooks
  // (hook call ต้องเรียกจำนวนครั้ง/ลำดับเดิมทุก render ห้ามมีเงื่อนไขคั่นกลาง)

  if (product) {
    return (
      <div className="rounded-card bg-white p-6 shadow-card">
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
          Product Preview
        </p>
        <h2 className="mt-1 text-2xl font-bold text-neutral-900">{product.name}</h2>
        <p className="mt-2 text-sm text-neutral-500">
          {product.description || "ไม่มีคำอธิบาย"}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="rounded-pill bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            SKU: {product.sku}
          </span>
          <span className="text-lg font-bold text-neutral-900">
            ฿{product.price.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-6 shadow-card">
      <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
        Remote widget
      </p>
      <h2 className="mt-1 text-2xl font-bold text-neutral-900">React 19 · MFE</h2>
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
```

สังเกตว่า class ทั้งหมด (`rounded-card`, `shadow-card`, `bg-brand-600`, `rounded-pill`, `bg-brand-50`) มาจาก token ที่
ประกาศไว้ใน `packages/design-system/src/theme.css` ตั้งแต่ Day 4 ทั้งหมด — ไม่มีการประกาศสีหรือค่าใหม่เลยวันนี้

---

## 4. แก้ `RemoteWidgetIsolated.tsx` (ฝั่ง shell) ให้รับ + ส่งต่อ `product`

แก้ `apps/shell-nextjs/app/RemoteWidgetIsolated.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { mfInstance } from "@/lib/mf";
import type { MountFn, Product } from "@mfe/shared-types";

export default function RemoteWidgetIsolated({ product }: { product?: Product }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let root: { unmount: () => void } | undefined;
    let cancelled = false;

    mfInstance
      .loadRemote<{ mount: MountFn }>("widget_react19/mount")
      .then((mod) => {
        if (cancelled || !ref.current || !mod) return;
        root = mod.mount(ref.current, { product });   // ส่ง product เข้าไปเป็น props ตัวที่ 2
      });

    return () => {
      cancelled = true;
      root?.unmount();
    };
  }, [product]);   // ⚠️ ต้องเพิ่ม product เข้า dependency array — ดูคำอธิบายด้านล่าง

  return (
    <div ref={ref} className="p-4 border border-gray-200 rounded-lg">
      กำลังโหลด widget จาก remote...
    </div>
  );
}
```

> **ทำไมต้องเพิ่ม `[product]` เข้า dependency array:** `useEffect` เดิมมี `[]` (deps ว่าง) แปลว่ารันครั้งเดียวตอน mount
> เท่านั้น ถ้าไม่เพิ่ม `product` เข้าไป ตัวแปร `product` ที่ effect เห็นจะเป็นค่าตอน mount ครั้งแรกตลอดไป (stale closure)
> — ต่อให้ parent ส่ง `product` ใหม่เข้ามา (เช่นหลัง submit ฟอร์ม) widget จะไม่ re-mount ด้วยข้อมูลใหม่เลย ต้องเพิ่มเข้า
> deps ให้ effect รันใหม่ (unmount ของเก่า + mount ใหม่พร้อม props ล่าสุด) ทุกครั้งที่ `product` เปลี่ยน

---

## 5. เชื่อมเข้ากับฟอร์ม Day 5 — submit แล้วส่งต่อไปให้ widget แสดงผล

แก้ `apps/shell-nextjs/app/create-product/page.tsx` — เพิ่ม state เก็บสินค้าที่เพิ่ง submit แล้ว render
`RemoteWidgetIsolated` แบบ conditional ด้านล่างฟอร์ม:

```tsx
import RemoteWidgetIsolated from "../RemoteWidgetIsolated";   // เพิ่ม import นี้

// ในตัว component เพิ่ม state ใหม่ (คู่กับ step state เดิม)
const [createdProduct, setCreatedProduct] = useState<CreateProductForm | null>(null);

const onSubmit = handleSubmit((data) => {
  console.log("validated + sanitized product:", data);
  setCreatedProduct(data);   // เก็บไว้ส่งต่อให้ remote widget แสดงผล
});
```

เพิ่มใน JSX ต่อจาก `</form>`:

```tsx
{createdProduct && (
  <div className="mt-8">
    <p className="text-sm text-neutral-500 mb-2">Preview จาก widget-react19 (remote):</p>
    <RemoteWidgetIsolated product={createdProduct} />
  </div>
)}
```

---

## 6. ทดสอบว่า flow ทั้งหมดทำงานจริง

Module Federation ต้องมี remote build จริงให้โหลด (ไม่ใช่แค่ `pnpm dev` ของ widget เฉยๆ) — รัน 2 terminal:

```bash
# terminal 1 — build + serve remote จริง (ตาม script เดิมที่ root package.json มีอยู่แล้ว)
pnpm dev:widget

# terminal 2 — shell
pnpm dev:shell
```

เปิด `http://localhost:3000/create-product` แล้วเช็คให้ครบ:

1. กรอกฟอร์มให้ผ่านทั้ง 2 step แล้วกด "บันทึกสินค้า" — ใต้ฟอร์มต้องขึ้น "Preview จาก widget-react19 (remote)" พร้อมการ์ด
   สินค้าที่มีชื่อ/ราคา/SKU/คำอธิบายตรงกับที่กรอก
2. กรอก SKU เป็นตัวพิมพ์เล็ก (เช่น `abc123`) แล้ว submit → การ์ดที่ widget แสดงต้องเห็น SKU เป็น **ตัวพิมพ์ใหญ่**
   (`ABC123`) — พิสูจน์ว่าข้อมูลที่วิ่งไปถึง widget ผ่าน `.toUpperCase()` sanitize จาก Day 5 จริง ไม่ใช่ raw input
3. เปิด DevTools → Network → filter `remoteEntry` หรือ widget chunk เพื่อยืนยันว่า widget โหลดจาก origin คนละพอร์ต
   กับ shell จริง (คนละ deploy จริงๆ ไม่ใช่ import ตรงในโปรเจกต์เดียว)
4. ลองแก้ค่าสีใน `packages/design-system/src/theme.css` (เช่น `--color-brand-500`) แล้ว rebuild ทั้งคู่ — สีบนการ์ด
   product ต้องเปลี่ยนตาม (พิสูจน์ซ้ำอีกรอบว่า design token กลางทำงานข้ามแอปจริง เหมือนที่ทำไปแล้วใน Day 4)

---

## 7. Checklist ทวนความเข้าใจ

1. ทำไม `MountFn` ต้องเปลี่ยนเป็น `props?: MountProps` (optional) แทนที่จะบังคับ `props: MountProps` — เกี่ยวอะไรกับ
   จุดเรียกเดิมที่ยังไม่ได้แก้?
2. ทำไม `useState` ใน `Widget.tsx` ต้องอยู่เหนือ `if (product) return (...)` เสมอ ย้ายลงไปข้างล่างจะพังยังไง?
3. `useEffect` ที่ deps เดิมเป็น `[]` กับที่แก้เป็น `[product]` ต่างกันยังไงในทางปฏิบัติ — ถ้าลืมใส่ `product` เข้า deps
   จะเกิดอาการอะไรที่สังเกตเห็นได้จริงตอนทดสอบ?
4. ข้อมูลที่วิ่งจากฟอร์มใน `shell-nextjs` ไปโผล่เป็น UI ใน `widget-react19` วิ่งผ่านอะไรบ้างตามลำดับ (ลองวาด/พูดอธิบาย
   เป็น flow เต็มๆ ตั้งแต่กด submit จนเห็นการ์ด)?

---

## Debug Log (อัปเดตเมื่อเจอปัญหาจริงระหว่างทำ)

_ยังไม่มี — เพิ่มตรงนี้เมื่อเจอปัญหาจริงระหว่างลงมือทำ ตามธรรมเนียมเดิมของ Day 3-5_
