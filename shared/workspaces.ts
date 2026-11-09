import { z } from 'zod';
export const workspaceSchema = z.object({ id: z.string(), name: z.string(), projectName: z.string(), projectId: z.string(), directory: z.string(), projectRoot: z.string(), worktree: z.boolean() });
export const workspaceCatalogSchema = z.object({ workspaces: z.array(workspaceSchema) });
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceCatalog = z.infer<typeof workspaceCatalogSchema>;
