import { useState } from "react";

const API_URL = "https://nest-express-be.onrender.com"; // แก้เป็น URL Render จริงของคุณ
const API_KEY = "test-key-123"; // ⚠️ demo เท่านั้น — จริงๆ ต้องมาจากระบบ auth ของ user ไม่ hardcode แบบนี้

export default function UploadWidget({ productId }: { productId: number }) {
  const [status, setStatus] = useState("");

  async function handleUpload(file: File) {
    setStatus("1/3 กำลังขอ presigned URL...");
    const presignRes = await fetch(`${API_URL}/uploads/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });
    const { uploadUrl, publicUrl } = await presignRes.json();

    setStatus("2/3 กำลังอัปโหลดไฟล์ไป Supabase...");
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    setStatus("3/3 กำลังบันทึก URL ลง database...");
    await fetch(`${API_URL}/products/${productId}/image`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ imageUrl: publicUrl }),
    });
    setStatus(`เสร็จแล้ว! ${publicUrl}`);
  }

  return (
    <div className="rounded-card bg-white p-6 shadow-card">
      <p className="text-sm font-semibold text-neutral-900">
        อัปโหลดรูปสินค้า #{productId}
      </p>
      <input
        type="file"
        accept="image/*"
        className="mt-2"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      {status && <p className="mt-2 text-xs text-neutral-500">{status}</p>}
    </div>
  );
}
