import { App, normalizePath, TFolder, TFile } from 'obsidian';

/**
 * Checks if a given folder path matches a target folder configuration.
 * Supports exact matches and wildcard matches using '/**' suffix.
 *
 * @param folderPath The path of the folder to check (e.g., "Mi mundo/SubFolder").
 * @param targetFolder The configured target folder (e.g., "Mi mundo/**" or "Mi mundo").
 * @returns True if the folder matches the target configuration.
 */
export function isFolderMatch(folderPath: string, targetFolder: string): boolean {
  const normalizedFolder = normalizePath(folderPath);
  const normalizedTarget = normalizePath(targetFolder);

  const folderParts = normalizedFolder.split('/');
  const targetParts = normalizedTarget.split('/');

  // If target is just empty or root, handle accordingly (though usually not the case)
  if (targetParts.length === 0) return false;

  for (let i = 0; i < targetParts.length; i++) {
    const targetPart = targetParts[i];

    // Handle ** wildcard (matches everything remaining)
    if (targetPart === '**') {
      return true;
    }

    // If folder is shorter than target (and not matched by **), it's a mismatch
    if (i >= folderParts.length) {
      return false;
    }

    const folderPart = folderParts[i];

    // Handle * wildcard (matches any single folder component)
    if (targetPart === '*') {
      continue;
    }

    // Exact match for the component
    if (targetPart !== folderPart) {
      return false;
    }
  }

  // If we processed all target parts, ensure folder doesn't have extra parts
  // (unless the last part was **, which is handled inside the loop)
  if (folderParts.length > targetParts.length) {
    return false;
  }

  return true;
}

export async function ensureFolderExists(app: App, filePath: string) {
  const folderPath = filePath.split('/').slice(0, -1).join('/');
  if (!folderPath) {
    return;
  }

  const normalized = normalizePath(folderPath);
  const folder = app.vault.getAbstractFileByPath(normalized);
  if (!folder) {
    await createFolderRecursively(app, normalized);
  }
}

export async function pathExists(app: App, path: string): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (file) {
    return true;
  }

  return app.vault.adapter.exists(path);
}

export function getTemplatesFolder(app: App): string | null {
  const internalPlugins = (app as any).internalPlugins;
  const templatesPlugin = internalPlugins?.getPluginById?.('templates');
  if (!templatesPlugin) {
    return null;
  }

  const options =
    templatesPlugin.instance?.options ?? templatesPlugin.options ?? null;

  if (!options) {
    return null;
  }

  const candidates = [
    options.folder,
    options.templatesFolder,
    options.templateFolder,
    options.dir,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

async function createFolderRecursively(app: App, folderPath: string) {
  const parts = folderPath.split('/');
  let current = '';

  console.log(`[GenerateMissingNotes] Ensuring folder structure: ${folderPath}`);

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;

    // Check disk directly for robustness
    const existsOnDisk = await app.vault.adapter.exists(current);
    if (existsOnDisk) {
      // If it exists, verify it is not a file
      const stat = await app.vault.adapter.stat(current);
      if (stat?.type === 'file') {
        console.error(`[GenerateMissingNotes] Error: Path "${current}" exists as a file, cannot create folder.`);
        throw new Error(`Cannot create folder "${current}" because a file already exists with that name.`);
      }
      // It exists and is (likely) a folder
      continue;
    }

    try {
      console.log(`[GenerateMissingNotes] Creating folder: ${current}`);
      await app.vault.createFolder(current);
    } catch (e: any) {
      // Ignore "Folder already exists" errors which can happen in race conditions
      if (e?.message?.includes('Folder already exists') || e?.code === 'EEXIST') {
        continue;
      }
      console.error(`[GenerateMissingNotes] Failed to create folder "${current}":`, e);
      throw e;
    }
  }
}


export async function moveFile(app: App, file: TFile, targetPath: string): Promise<void> {
  const currentPath = file.path;

  if (currentPath === targetPath) {
    return;
  }

  // Ensure target folder exists
  await ensureFolderExists(app, targetPath);

  // Check if target file already exists
  const existingFile = app.vault.getAbstractFileByPath(targetPath);
  if (existingFile && existingFile instanceof TFile) {
    throw new Error(`Target file already exists: ${targetPath}`);
  }

  // Perform the move
  await app.fileManager.renameFile(file, targetPath);
}

export async function ensureFolderNotes(app: App, filePath: string): Promise<void> {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');

  // If path is just "File.md", no parent folders to check.
  if (parts.length <= 1) return;

  // Iterate logic:
  // Path: A/B/C/C.md
  // Iterations:
  // 1. currentPath = "A". Verify "A/A.md" exists.
  // 2. currentPath = "A/B". Verify "A/B/B.md" exists.
  // 3. currentPath = "A/B/C". Verify "A/B/C/C.md" exists (if C != C.md logic isn't circular).

  // We stop before the last part (the file itself) if we only care about PARENTS.
  // But usage suggests "create path -> verify ALL folders include a note".
  // The last part is the file itself. The parent of the file is the holding folder.

  // Let's iterate up to length - 1 (the directories).
  let currentPath = '';

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    const folderNotePath = `${currentPath}/${part}.md`;
    const exists = await pathExists(app, folderNotePath);

    if (!exists) {
      try {
        // Create empty note
        await app.vault.create(folderNotePath, '');
      } catch (e) {
        console.error(`Failed to create folder note at ${folderNotePath}`, e);
      }
    }
  }
}
