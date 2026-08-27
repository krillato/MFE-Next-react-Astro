import z from "zod";

export const step1Schema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อสินค้า"),
  price: z.number({ message: "กรุณากรอกตัวเลข" }).positive("ราคาต้องมากกว่า 0"),
});

export const step2Schema = z.object({
  sku: z.string().trim().toUpperCase().min(1, "กรุณากรอก SKU"),
  description: z.string().trim().max(20, "คำอธิบายยาวเกินไป"),
});

export const createProductSchema = step1Schema.merge(step2Schema);
export type CreateProductForm = z.infer<typeof createProductSchema>;
