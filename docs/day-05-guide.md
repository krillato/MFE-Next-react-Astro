# Day 5 Guide — Form Architecture: Zod + react-hook-form (multi-step) ใน `shell-nextjs`

> **กฎเดิม: ไกด์นี้มีไว้ให้คุณลงมือทำเอง — ผมจะไม่แก้โค้ดในโปรเจกต์คุณให้**
> ทุก code block คือสิ่งที่ต้อง type/run เอง

เป้าหมายวันนี้: สร้างฟอร์ม **"สร้างสินค้า" แบบ multi-step** (2 step) ใน `shell-nextjs` ด้วย Zod + react-hook-form —
validate ทีละ step, รวม schema validate อีกรอบตอน submit จริง, มี error UX ที่ดี และ sanitize ข้อมูลก่อนใช้

ตั้งใจเลือกฟิลด์ให้ตรงกับ `Product` entity ที่จะไปสร้าง REST API จริงด้วย NestJS ใน **Day 12** (ดู
[`/nestjs-nodejs`](http://localhost:5173/nestjs-nodejs) ใน Interview-FE) — วันนี้แค่ทำฝั่ง client ก่อน (log ข้อมูลออก
console แทนการยิง API จริง เพราะยังไม่มี backend) แล้ว Day 12 ค่อยเอาฟอร์มนี้มาต่อกับ API จริง

---

## 0. ติดตั้ง dependencies (ที่ `shell-nextjs` เท่านั้น)

`shell-nextjs` ยังไม่มี `zod`/`react-hook-form` เลย เช็คได้จาก `apps/shell-nextjs/package.json` — ไม่มี 2 ตัวนี้ใน
`dependencies`

```bash
cd ~/road-map-30/mfe-workshop
pnpm --filter shell-nextjs add zod react-hook-form @hookform/resolvers
```

> ⚠️ **จำจากบทเรียน Day 3-4:** อย่าลืม `pnpm install` ที่ root แล้ว commit `pnpm-lock.yaml` ไปด้วยเสมอหลัง
> เพิ่ม dependency (ดู debug log 8.10 ใน `day-03-guide.md`) — ไม่งั้น Vercel deploy จะ fail ด้วย
> `ERR_PNPM_OUTDATED_LOCKFILE` ตอน push

---

## 1. ออกแบบ Schema — แยกเป็น step แล้ว merge ตอนจบ

สร้างไฟล์ `apps/shell-nextjs/app/create-product/schema.ts`:

```ts
import { z } from 'zod'

// Step 1: ข้อมูลพื้นฐาน — ตรงกับ Product entity ฝั่ง NestJS (name, price)
export const step1Schema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อสินค้า').max(120, 'ชื่อยาวเกินไป'),
  price: z.number({ invalid_type_error: 'กรุณากรอกตัวเลข' }).positive('ราคาต้องมากกว่า 0'),
})

// Step 2: รายละเอียด — sku ต้อง sanitize เป็นตัวพิมพ์ใหญ่ + ตัด whitespace
export const step2Schema = z.object({
  description: z.string().trim().max(500, 'คำอธิบายยาวเกินไป').optional(),
  sku: z.string().trim().toUpperCase().min(3, 'SKU อย่างน้อย 3 ตัวอักษร'),
})

// Schema รวม — validate อีกรอบตอน submit จริง (safety net สุดท้าย)
export const createProductSchema = step1Schema.merge(step2Schema)
export type CreateProductForm = z.infer<typeof createProductSchema>
```

> `<input>` HTML คืนค่าเป็น **string เสมอ** (`"199"` ไม่ใช่ `199`) — ทางเลือกทั่วไปคือใช้ `z.coerce.number()` ให้ zod
> แปลงเอง แต่ **อย่าทำแบบนั้นตรงนี้** เพราะทำให้ type ของ field นี้ก่อน/หลัง validate ไม่ตรงกัน (input เป็น
> `unknown`, output เป็น `number`) แล้ว TypeScript จะฟ้อง error ตอนเอาไปผูกกับ `useForm<CreateProductForm>` (ดู
> debug log ข้อ 2 ท้ายไฟล์) — ให้ใช้ `z.number()` เฉยๆ แทน แล้วสั่งให้ react-hook-form แปลง string→number ให้ตอน
> register แทน (ดูข้อ 2 ด้านล่าง)
>
> `.trim().toUpperCase()` บน `sku` คือจุด sanitize อยู่ในตัว schema เลย — validate เสร็จ ได้ค่าที่สะอาดพร้อมใช้ทันที
> ไม่ต้องมาเขียน sanitize แยกอีกที

---

## 2. สร้างหน้า multi-step form

สร้างไฟล์ใหม่ `apps/shell-nextjs/app/create-product/page.tsx` (**สร้างไฟล์ใหม่ อย่าไปแก้ `app/page.tsx` เดิม** —
กันกระทบของเดิมที่ทำไว้ Day 1-4)

> ⚠️ **ชื่อไฟล์ต้องเป็น `page.tsx` เป๊ะๆ** — Next.js App Router รู้จักเฉพาะไฟล์ชื่อ `page.tsx` เท่านั้นว่าเป็น route
> พิมพ์ผิดแม้แค่ตัวเดียว (เช่น `paage.tsx`) จะไม่ error ตอน build/dev เลย แต่ route นั้นจะไม่มีอยู่จริง — กด Link แล้ว
> ขึ้น 404 เงียบๆ ไม่มี error message บอกสาเหตุ (ดู debug log ข้อ 1)

```tsx
'use client'   // ต้องมี — react-hook-form ใช้ hook + event ฝั่ง client เท่านั้น

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { step1Schema, step2Schema, createProductSchema, type CreateProductForm } from './schema'

export default function CreateProductPage() {
  const [step, setStep] = useState<0 | 1>(0)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductForm>({
    resolver: zodResolver(createProductSchema),   // resolver รวม — ใช้ schema เต็มตลอด
    mode: 'onBlur',                                 // validate ตอนออกจาก field, ไม่ใช่ทุก keystroke
    defaultValues: { name: '', price: 0, description: '', sku: '' },
  })

  // validate เฉพาะ field ของ step ปัจจุบันก่อนไป step ถัดไป
  async function goNext() {
    const fields = Object.keys(step1Schema.shape) as (keyof CreateProductForm)[]
    const valid = await trigger(fields)   // trigger = สั่ง validate เฉพาะ field ที่ระบุ
    if (valid) setStep(1)
  }

  const onSubmit = handleSubmit((data) => {
    // Day 12 ค่อยเปลี่ยนบรรทัดนี้เป็น fetch(`${API_URL}/products`, { method: 'POST', body: JSON.stringify(data) })
    console.log('validated + sanitized product:', data)
  })

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-1">สร้างสินค้า</h1>
      <p className="text-sm text-slate-500 mb-6">Step {step + 1} / 2</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {step === 0 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">ชื่อสินค้า</label>
              <input {...register('name')} className="w-full border rounded-md px-3 py-2" />
              {errors.name && <p className="text-danger-500 text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ราคา (บาท)</label>
              <input type="number" {...register('price', { valueAsNumber: true })} className="w-full border rounded-md px-3 py-2" />
              {errors.price && <p className="text-danger-500 text-sm mt-1">{errors.price.message}</p>}
            </div>
            <button type="button" onClick={goNext} className="bg-brand-500 text-white rounded-md py-2 mt-2">
              ถัดไป
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input {...register('sku')} className="w-full border rounded-md px-3 py-2" />
              {errors.sku && <p className="text-danger-500 text-sm mt-1">{errors.sku.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">คำอธิบาย</label>
              <textarea {...register('description')} className="w-full border rounded-md px-3 py-2" rows={4} />
              {errors.description && <p className="text-danger-500 text-sm mt-1">{errors.description.message}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(0)} className="flex-1 border rounded-md py-2">
                ย้อนกลับ
              </button>
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-500 text-white rounded-md py-2 disabled:opacity-50">
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสินค้า'}
              </button>
            </div>
          </>
        )}
      </form>
    </main>
  )
}
```

จุดที่ต้องสังเกต (เทียบกับ concept ที่อ่านมาจาก `/form-validation` ใน Interview-FE):

- **ปุ่ม "ถัดไป" เป็น `type="button"`** ไม่ใช่ `type="submit"` — กัน form submit ทั้งฟอร์มทั้งที่ validate แค่ step 1
- **ปุ่ม "ย้อนกลับ" ไม่เรียก `trigger()`** เลย — ไม่บังคับ validate ตอนถอยหลัง ตามหลักการที่เขียนไว้ในหน้า reference
- **resolver ใช้ schema รวม (`createProductSchema`) ตลอด** แต่ `trigger(fields)` เลือก validate เฉพาะ field ของ step
  ปัจจุบัน — วิธีนี้ทำให้ error ของ step ที่ยังไม่ได้กรอกไม่โผล่มาป่วน step แรก
- **`className="bg-brand-500 text-danger-500 ..."`** ใช้ token จาก `@mfe/design-system` ที่ทำไว้ Day 4 ได้เลย
  ไม่ต้องประกาศสีใหม่

---

## 3. เพิ่มลิงก์เข้าถึงหน้าใหม่

แก้ `apps/shell-nextjs/app/page.tsx` — เพิ่มลิงก์ไปหน้าฟอร์ม (แค่ `<Link>` บรรทัดเดียว ไม่ต้องแก้อย่างอื่น):

```tsx
import Link from 'next/link'
// ...
<Link href="/create-product" className="text-brand-600 underline">
  สร้างสินค้า →
</Link>
```

---

## 4. ทดสอบว่าทำงานจริง (ทำเองทุกข้อ)

```bash
pnpm --filter shell-nextjs dev
```

เปิด `http://localhost:3000/create-product` แล้วเช็คให้ครบ:

1. กด "ถัดไป" ทั้งที่ยังไม่กรอกอะไร → ต้องเห็น error ใต้ทั้ง 2 ช่องของ step 1 ทันที ไม่ไป step 2
2. กรอกราคาเป็นตัวอักษร (เช่น `abc`) → ต้องเห็น error ราคา (พิสูจน์ว่า `valueAsNumber: true` + validate ทำงานร่วมกัน)
3. ผ่าน step 1 ไป step 2 แล้วกด "ย้อนกลับ" → ค่าที่กรอกไว้ step 1 ต้อง**ไม่หาย** (state อยู่ใน `useForm` เดียวกันทั้งฟอร์ม
   ไม่ได้ unmount/remount ใหม่)
4. กรอก SKU เป็นตัวพิมพ์เล็ก เช่น `abc123` แล้ว submit → เช็คใน browser console ว่าค่าที่ log ออกมาเป็น `ABC123`
   (พิสูจน์ว่า `.toUpperCase()` sanitize ทำงานจริงตอน validate ผ่าน)
5. เว้น description ว่างไว้แล้ว submit → ต้องผ่าน (เพราะประกาศ `.optional()`) ไม่ error

ถ้าข้อไหนไม่ตรงตามนี้ ให้กลับไปเช็ค schema/resolver ก่อน อย่าเพิ่ง assume ว่า component ผิด

---

## 5. Checklist ทวนความเข้าใจ

1. ทำไมปุ่ม "ถัดไป" ต้องเป็น `type="button"` ไม่ใช่ `type="submit"`?
2. `trigger(fields)` กับการที่ resolver ผูกกับ `createProductSchema` (schema รวม) ทำงานร่วมกันยังไง — ทำไมไม่ error
   ทั้งฟอร์มตั้งแต่ step แรก?
3. ทำไม `register('price', { valueAsNumber: true })` คู่กับ `z.number()` ถึงหลีกเลี่ยง TS error ที่ `z.coerce.number()`
   จะทำให้เกิด (ดู debug log ข้อ 2)?
4. ถ้า user เปิด DevTools แล้วแก้ HTML ตัดปุ่ม disable ทิ้ง ยิง submit ตรงๆ ด้วยข้อมูลที่ผิด schema — อะไรกันไว้ชั้นสุดท้าย
   (hint: คิดถึง Day 12 ตอนต่อ NestJS API จริง — `ValidationPipe` ทำหน้าที่อะไร)

---

## Debug Log (อัปเดตเมื่อเจอปัญหาจริงระหว่างทำ)

### 1. Link กด "สร้างสินค้า →" แล้วไม่ไปไหน (404 เงียบๆ) — ไฟล์ชื่อผิด
- **อาการ:** คลิก `<Link href="/create-product">` แล้วหน้าไม่เปลี่ยน/ขึ้น 404 ทั้งที่โค้ดฟอร์มดูถูกทุกอย่าง ไม่มี error
  ใน terminal หรือ browser console เลย
- **สาเหตุที่ยืนยันด้วยการเช็คไฟล์จริง:** ไฟล์ที่สร้างไว้ชื่อ `apps/shell-nextjs/app/create-product/paage.tsx`
  (พิมพ์ผิด "a" เกินมา 1 ตัว) — Next.js App Router สแกนหาไฟล์ชื่อ **`page.tsx`** เป๊ะๆ เท่านั้นเพื่อลงทะเบียน route
  ชื่อไฟล์ที่สะกดผิดจะถูกมองเป็นไฟล์ธรรมดาที่ไม่เกี่ยวอะไรกับ routing เลย ไม่ error ไม่เตือน แค่ route ไม่มีอยู่จริงเฉยๆ
- **แก้:**
  ```bash
  cd apps/shell-nextjs/app/create-product
  mv paage.tsx page.tsx
  ```
- **วิธีเช็คว่าถูกจริง:** เปิด `http://localhost:3000/create-product` ตรงๆ ทาง URL bar (ไม่ผ่าน Link) ถ้ายังขึ้น 404
  แปลว่าไฟล์ชื่อยังไม่ตรง หรือ path โฟลเดอร์ผิด — **บทเรียน:** Next.js App Router (และ file-based routing ทั่วไป)
  ไม่มี type-check หรือ validation ให้ชื่อไฟล์ที่มีความหมายพิเศษ (`page.tsx`, `layout.tsx`, `route.ts`) เลย พิมพ์ผิด
  แล้วเงียบเสมอ ต้องเช็ค `ls` ชื่อไฟล์ตรงๆ ถ้า route หายไปอย่างไม่มีเหตุผล

### 2. TypeScript error ตอนผูก `zodResolver` กับ `useForm` — Resolver type ไม่ตรงกัน
- **อาการ:**
  ```
  Type 'Resolver<{ name: string; price: unknown; sku: string; description: string; }, any, ...>'
  is not assignable to type 'Resolver<{ name: string; price: number; ...}, any, ...>'
  Type 'unknown' is not assignable to type 'number'.
  ```
- **สาเหตุที่ยืนยันด้วยการเช็ค schema จริง:** ต้นเหตุคือ `price: z.coerce.number()` ใน `schema.ts` — `z.coerce.number()`
  รับ **input เป็น `unknown`** ได้ (เพราะ coerce แปลงอะไรก็ได้เป็น number) แต่ **output เป็น `number`** สอง type นี้
  ไม่เท่ากัน ในขณะที่ `CreateProductForm = z.infer<typeof createProductSchema>` ใช้ **output type** (`price: number`)
  ไปประกาศ `useForm<CreateProductForm>` แต่ `zodResolver(createProductSchema)` สร้าง `Resolver` ที่อ้างอิง
  **input type** (`price: unknown`) — สอง generic เลย mismatch กัน
- **แก้:** เปลี่ยนจาก `z.coerce.number()` เป็น `z.number()` ธรรมดา (ตัด input/output ให้เป็น type เดียวกัน) แล้วย้าย
  หน้าที่ "แปลง string จาก input เป็น number" ไปให้ react-hook-form ทำแทนผ่าน `valueAsNumber: true`:
  ```diff
  # schema.ts
  - price: z.coerce.number().positive("ราคาต้องมากกว่า 0"),
  + price: z.number({ invalid_type_error: "กรุณากรอกตัวเลข" }).positive("ราคาต้องมากกว่า 0"),
  ```
  ```diff
  # page.tsx
  - <input type="number" {...register("price")} .../>
  + <input type="number" {...register("price", { valueAsNumber: true })} .../>
  ```
- **วิธีเช็คว่าถูกจริง:** `pnpm --filter shell-nextjs build` (หรือดู red squiggly ใน editor หาย) ต้องไม่มี TS error แล้ว
  ทดสอบกรอกราคาเป็นตัวอักษรใน browser จริง ต้องยัง error ที่ field ราคาเหมือนเดิม (พิสูจน์ว่า validation ยังทำงาน แค่ย้าย
  จุดแปลง type เท่านั้น) — **บทเรียน:** `z.coerce.*()` สะดวกตอน validate ค่าที่ "รู้แหล่งที่มาแน่ๆ ว่าเป็น string" (เช่น
  query param, env var) แต่กับ react-hook-form ที่ต้องมี input/output type ตรงกันเป๊ะสำหรับ resolver generic ให้ใช้
  `valueAsNumber`/`valueAsDate` ที่ตัว `register()` แทนจะปลอดภัยกว่า
