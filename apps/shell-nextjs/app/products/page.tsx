export const revalidate = 60; // ISR: revalidate ทุก 60 วิ

async function getProducts() {
  const res = await fetch(process.env.API_URL + "/products", {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <ul>
      {products.map((p: { id: number; name: string; price: number }) => (
        <li key={p.id}>
          {p.name} — ฿{p.price}
        </li>
      ))}
    </ul>
  );
}
