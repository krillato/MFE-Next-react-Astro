import RemoteWidgetSection from "./RemoteWidgetSection";

export const revalidate = 60; //ISR

async function getData() {
  const res = await fetch(
    "https://jsonplaceholder.typicode.com/posts?_limit=5",
    {
      next: { revalidate: 60 },
    },
  );
  return res.json();
}
export default async function Home() {
  const posts = await getData();
  return (
    <main style={{ padding: 24 }}>
      <div className="bg-danger-500 p-8">test</div>
      <h1>Shell (Next.js ISR)</h1>
      <ul>
        {posts.map((p: { id: number; title: string }) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
      <RemoteWidgetSection />
    </main>
  );
}
// trigger vercel rebuild with new install command override
