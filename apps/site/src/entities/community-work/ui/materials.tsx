import type { PublicCommunityWork } from "../model";

export function CommunityWorkMaterials({ work }: { work: PublicCommunityWork }) {
  if (!work.submission.materials.length && !work.submission.symbolMappings.length) return null;

  return (
    <div className="space-y-6">
      {work.submission.materials.length > 0 && (
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
      )}

      {work.submission.symbolMappings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">Соответствие символов</h2>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {work.submission.symbolMappings.map((mapping) => {
              const material = work.submission.materials.find(
                (item) => item.position === mapping.materialPosition,
              );

              return (
                <div
                  key={mapping.symbol}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-white px-3"
                >
                  <dt className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700">
                    {mapping.symbol}
                  </dt>
                  <dd className="min-w-0 text-right">
                    <span className="block font-mono font-bold">
                      {mapping.markerNumber || "Номер не указан"}
                    </span>
                    {material ? (
                      <span className="block truncate text-xs text-stone-500">
                        {material.brand} · {material.line}
                      </span>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
    </div>
  );
}
