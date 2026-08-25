export default function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm motion-reduce:animate-none"
    >
      <div className="h-40 w-full bg-slate-200" />

      <div className="flex flex-grow flex-col p-4">
        <div className="space-y-2">
          <div className="h-4 w-11/12 rounded bg-slate-200" />
          <div className="h-4 w-3/4 rounded bg-slate-200" />
        </div>

        <div className="mt-3 flex gap-2">
          <div className="h-3 w-1/3 rounded bg-slate-100" />
          <div className="h-3 w-2/5 rounded bg-slate-100" />
        </div>

        <div className="mt-5 space-y-2">
          <div className="h-3 w-20 rounded bg-slate-100" />
          <div className="h-6 w-28 rounded bg-slate-200" />
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-1.5 w-full rounded-full bg-slate-200" />
          <div className="flex justify-between">
            <div className="h-3 w-16 rounded bg-slate-100" />
            <div className="h-3 w-14 rounded bg-slate-100" />
          </div>
        </div>

        <div className="mt-4 h-11 w-full rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
