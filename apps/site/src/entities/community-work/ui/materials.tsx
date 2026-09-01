import type { PublicCommunityWork } from "../model";

export function CommunityWorkMaterials({ work }: { work: PublicCommunityWork }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold">Палитра Artmate для этой картины</h2>
        <p className="mt-1 text-sm text-stone-500">
          Официальная палитра цифровой версии · {work.official.palette.label}{" "}
          {work.official.palette.version}
        </p>
        {work.official.palette.colors.length > 0 ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {work.official.palette.colors.map((color) => (
              <li
                key={color.symbol}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2"
              >
                <span
                  className="size-9 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: color.hex }}
                  aria-label={`Официальный цвет ${color.hex}`}
                />
                <span className="min-w-0">
                  <span className="block font-bold text-stone-900">
                    {color.symbol} · маркер {color.markerNumber}
                  </span>
                  <span className="block truncate text-xs text-stone-500">
                    {color.hex}
                    {color.pantone ? ` · Pantone ${color.pantone}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Для этой версии палитра не указана.</p>
        )}
      </section>

      <section className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5 sm:p-6">
        <h2 className="text-xl font-bold">Материалы, указанные автором</h2>
        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {work.submission.materials.map((material) => (
            <li key={material.position} className="rounded-xl bg-white p-3">
              <p className="text-stone-500">Материал {material.position}</p>
              <p className="font-bold text-stone-900">
                {material.brand} · {material.line}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold">Соответствие символов</h2>
        {work.submission.symbolMappings.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {work.submission.symbolMappings.map((mapping) => (
              <div
                key={mapping.symbol}
                className="flex min-h-12 items-center justify-between rounded-xl border bg-white px-3"
              >
                <dt className="flex size-7 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700">
                  {mapping.symbol}
                </dt>
                <dd className="font-mono font-bold">{mapping.markerNumber}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Автор не указал соответствия цветов.</p>
        )}
      </section>
    </div>
  );
}
