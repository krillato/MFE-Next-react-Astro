//create layout for create product page
export default function CreateProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen contain-layout flex flex-col">
      <header className="border-b text-2xl font-bold px-4 py-2">Header</header>
      {children}
      <footer className="border-t px-4 py-2">Footer</footer>
    </div>
  );
}
