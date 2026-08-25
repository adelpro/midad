import type { MidadProject } from '@/storage/project-schema';

/**
 * Platform-split module (`projects.native.ts` / `projects.web.ts`).
 * This file is types-only; Metro resolves the platform implementation.
 */
export declare function listProjects(): Promise<MidadProject[]>;
export declare function loadProject(id: string): Promise<MidadProject | null>;
export declare function saveProject(project: MidadProject): Promise<void>;
export declare function deleteProject(id: string): Promise<void>;
export declare function projectFileUri(id: string): Promise<string | null>;
