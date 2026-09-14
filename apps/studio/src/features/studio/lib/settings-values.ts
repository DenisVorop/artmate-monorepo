import type { Page, Project } from "@/entities/project";
import type { PageValues, ProjectValues } from "./schema";
export const projectValues = (project: Project): ProjectValues => ({
  name: project.name,
  start_page: project.start_page,
  settings: project.settings,
});
export const pageValues = (page: Page): PageValues => ({
  name: page.name,
  settings: page.settings,
  own_colors: page.overrides.colors !== undefined,
  own_area: page.overrides.min_area_mm2 !== undefined,
  own_font: page.overrides.font_size_px !== undefined,
});
export const pagePayload = (values: PageValues) => ({
  name: values.name,
  overrides: {
    ...(values.own_colors ? { colors: values.settings.colors } : {}),
    ...(values.own_area ? { min_area_mm2: values.settings.min_area_mm2 } : {}),
    ...(values.own_font ? { font_size_px: values.settings.font_size_px } : {}),
  },
});
export function movedPages(project: Project, id: string, direction: number) {
  const ids = project.pages.map((p) => p.id);
  const index = ids.indexOf(id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  [ids[index], ids[next]] = [ids[next]!, ids[index]!];
  return ids;
}
