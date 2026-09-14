import { StudioWorkspace } from "@/features/studio";
export function StudioPage({ projectId }: { projectId?: string }) {
  return <StudioWorkspace projectId={projectId} />;
}
