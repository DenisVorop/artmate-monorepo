export function Marketplaces() {
  return (
    <div className="flex w-full flex-col gap-5 lg:pt-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-xs font-semibold tracking-widest text-stone-600 uppercase">
          Маркетплейсы
        </span>
        <div className="h-px flex-1 bg-stone-800" />
        <a
          href="#"
          className="flex items-center gap-2 rounded-full border border-stone-700 bg-stone-800 px-3.5 py-2 text-sm font-medium text-stone-300 transition-all hover:border-[#005BFF]/40 hover:bg-[#005BFF]/20 hover:text-[#6699ff]"
        >
          <span className="w-4 shrink-0 text-center font-bold">O</span>
          Ozon
        </a>
        <a
          href="#"
          className="flex items-center gap-2 rounded-full border border-stone-700 bg-stone-800 px-3.5 py-2 text-sm font-medium text-stone-300 transition-all hover:border-[#CB11AB]/40 hover:bg-[#CB11AB]/20 hover:text-[#e060cc]"
        >
          <span className="w-4 shrink-0 text-center font-bold">W</span>
          Wildberries
        </a>
      </div>
    </div>
  );
}
