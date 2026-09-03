export const revalidate = 60;

async function getProducts() {
  const res = await fetch(process.env.API_URL + "/products", {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function ProductsListPage() {
  const products = await getProducts();
  console.log(products);
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">รายการสินค้า</h1>
      <ul className="mt-4 space-y-2">
        {products.map((p: { id: number; name: string; price: number }) => (
          <li key={p.id} className="rounded-card bg-white p-4 shadow-card">
            {p.name} — ฿{p.price}
          </li>
        ))}
      </ul>
    </div>
  );
}
