import { z } from "zod";
export const settingsSchema = z.object({
  artificial_grid: z.boolean(),
  colors: z.number().int().min(2, "От 2 цветов").max(35, "Не больше 35 цветов"),
  min_area_mm2: z
    .number()
    .min(0.001, "Площадь должна быть положительной")
    .max(10000),
  font_size_px: z.number().min(4, "Минимум 4 px").max(32, "Максимум 32 px"),
});
export type Settings = z.infer<typeof settingsSchema>;
export const projectSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(120),
  start_page: z.number().int().min(1).max(999999),
  settings: settingsSchema,
});
export type ProjectValues = z.infer<typeof projectSchema>;
export const createSchema = projectSchema.pick({ name: true });
export const loginSchema = z.object({
  password: z.string().min(1, "Введите пароль студии"),
});
export type LoginValues = z.infer<typeof loginSchema>;
export const uploadSchema = z.object({
  images: z
    .custom<FileList>()
    .refine((files) => files?.length > 0, "Выберите изображения")
    .refine((files) => files?.length <= 100, "Не больше 100 изображений за раз")
    .refine(
      (files) =>
        !files || Array.from(files).every((f) => f.size <= 25 * 1024 * 1024),
      "Каждый файл должен быть не больше 25 МиБ",
    ),
});
export type UploadValues = z.infer<typeof uploadSchema>;
export const pageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  settings: settingsSchema,
  own_colors: z.boolean(),
  own_area: z.boolean(),
  own_font: z.boolean(),
  own_grid: z.boolean(),
});
export type PageValues = z.infer<typeof pageSchema>;
