import { z } from 'zod';
export const workspaceSchema = z.object({ id: z.string(), name: z.string(), projectName: z.string(), projectId: z.string(), directory: z.string(), projectRoot: z.string(), worktree: z.boolean() });
export const projectSchema = z.object({ id: z.string(), name: z.string(), directory: z.string() });
export type Project = z.infer<typeof projectSchema>;
export const workspaceCatalogSchema = z.object({ workspaces: z.array(workspaceSchema), projects: z.array(projectSchema).optional() });
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceCatalog = z.infer<typeof workspaceCatalogSchema>;
