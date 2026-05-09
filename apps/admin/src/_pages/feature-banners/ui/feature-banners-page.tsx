import { FeatureBannersManagement } from "@/features/feature-banners-management";
import { routes } from "@/shared/constants";
import { AdminShell } from "@/widgets/admin-shell";

export function FeatureBannersPage() {
  return (
    <AdminShell activePath={routes.featureBanners}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Баннеры</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление сервисными флагами и уведомлениями сайта.
          </p>
        </div>
        <FeatureBannersManagement />
      </section>
    </AdminShell>
  );
}
