export default function DashboardLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-[#f7f8f5] p-8" aria-label="Učitavanje kontrolne table">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-12 rounded-xl bg-white" />
        <div className="h-10 w-64 rounded bg-[#e9ece5]" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-36 rounded-2xl bg-white" />)}
        </div>
      </div>
    </main>
  );
}
