export type Settings = {
  colors: number;
  min_area_mm2: number;
  font_size_px: number;
};
export type Quality = {
  palette_colors: number;
  regions: number;
  actual_min_area_mm2: number;
  prefilled_regions?: number;
};
export type Job = {
  id: string;
  page_id: string;
  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "deleting";
  stage: string;
  cancel_requested: number;
  error: string | null;
  created_at: number;
  expires_at: number | null;
  settings: {
    colors: number;
    min_area_mm2: number;
    font_size_pt: number;
    start_page: number;
  };
  report: {
    quality: Quality;
    palette: { rgb: number[]; symbol: string | null }[];
  } | null;
};
export type Page = {
  id: string;
  project_id: string;
  name: string;
  state: "uploading" | "ready" | "deleting";
  position: number;
  number: number;
  selected_job_id: string | null;
  width: number;
  height: number;
  settings: Settings;
  overrides: Partial<Settings>;
  outdated: boolean;
  jobs: Job[];
};
export type Project = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  settings: Settings;
  start_page: number;
  version: number;
  page_count: number;
  ready_count?: number;
  pages: Page[];
};
export type Usage = {
  used_bytes: number;
  limit_bytes: number;
  queue: number;
  worker_online: boolean;
  storage_blocked: boolean;
  preview_seconds: number;
  upload_bytes: number;
  pages_per_project: number;
};
