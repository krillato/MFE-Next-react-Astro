"use client";
import { useState } from "react";
import { CreateProductForm, createProductSchema, step1Schema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export default function CreateProductPage() {
  const [step, setStep] = useState<0 | 1>(0);

  const {
    handleSubmit,
    register,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductForm>({
    resolver: zodResolver(createProductSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      price: 0,
      description: "",
      sku: "",
    },
  });

  async function goNext() {
    const fields = Object.keys(
      step1Schema.shape,
    ) as (keyof CreateProductForm)[];
    const valid = await trigger(fields); // trigger = สั่ง validate เฉพาะ field ที่ระบุ
    if (valid) setStep(1);
  }

  async function goBack() {
    setStep(0);
  }

  const onSubmit = handleSubmit((data) => {
    // Day 12 ค่อยเปลี่ยนบรรทัดนี้เป็น fetch(`${API_URL}/products`, { method: 'POST', body: JSON.stringify(data) })
    console.log("validated + sanitized product:", data);
  });

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-1">สร้างสินค้า</h1>
      <p className="text-sm text-slate-500 mb-6">Step {step + 1} / 2</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {step === 0 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                ชื่อสินค้า
              </label>
              <input
                {...register("name")}
                className="w-full border rounded-md px-3 py-2"
              />
              {errors.name && (
                <p className="text-danger-500 text-sm mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                ราคา (บาท)
              </label>
              <input
                type="number"
                {...register("price", { valueAsNumber: true })}
                className="w-full border rounded-md px-3 py-2"
              />
              {errors.price && (
                <p className="text-danger-500 text-sm mt-1">
                  {errors.price.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="bg-brand-500 text-white rounded-md py-2 mt-2"
            >
              ถัดไป
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input
                {...register("sku")}
                className="w-full border rounded-md px-3 py-2"
              />
              {errors.sku && (
                <p className="text-danger-500 text-sm mt-1">
                  {errors.sku.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">คำอธิบาย</label>
              <textarea
                {...register("description")}
                className="w-full border rounded-md px-3 py-2"
                rows={4}
              />
              {errors.description && (
                <p className="text-danger-500 text-sm mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex-1 border rounded-md py-2"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-brand-500 text-white rounded-md py-2 disabled:opacity-50"
              >
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกสินค้า"}
              </button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
