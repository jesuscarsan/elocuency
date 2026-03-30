import { config } from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import { WinstonLoggerAdapter } from '../infrastructure/logging/WinstonLoggerAdapter';

config({ path: '../../.env' }); // Load repo root

const eloWorkspacePath = process.env.ELO_WORKSPACE_PATH;
const configPath = eloWorkspacePath ? path.join(eloWorkspacePath, 'elo-config.json') : null;
let worldPathPrefix = 'Mi mundo';

// Load worldPath from config if available
if (configPath && fs.existsSync(configPath)) {
  try {
    const eloConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (eloConfig.memory && eloConfig.memory.worldPath) {
      worldPathPrefix = eloConfig.memory.worldPath;
    }
  } catch (e) {
    // Fallback to default
  }
}

async function migrateMemory() {
  const logFile = eloWorkspacePath
    ? path.join(eloWorkspacePath, 'logs', 'migrate-memory.log')
    : undefined;
  const logger = new WinstonLoggerAdapter('migrate-memory', logFile);

  const memoryPath = process.env.MEMORY_PATH;
  if (!memoryPath || !fs.existsSync(memoryPath)) {
    console.error('\n❌ MEMORY_PATH is not set or does not exist.');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  const onlyOne = process.argv.includes('--only-one');
  const onlyTen = process.argv.includes('--only-ten');

  let limit = 0;
  if (onlyOne) limit = 1;
  if (onlyTen) limit = 10;

  if (dryRun) {
    console.log('🔍 DRY RUN ENABLED - No files will be moved or modified.');
  }
  if (limit > 0) {
    console.log(`☝️ LIMIT ENABLED - Migration will stop after the first ${limit} successful note(s).`);
  }

  console.log(`🚀 Starting migration for memory at: ${memoryPath}`);
  console.log(`🌍 World Path Prefix: ${worldPathPrefix}`);

  const files = listMarkdownFiles(memoryPath);
  console.log(`Found ${files.length} markdown files.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const relativePath = path.relative(memoryPath, filePath);

    // Skip system and excluded folders
    if (
      relativePath.startsWith('config' + path.sep) ||
      relativePath.startsWith('!!archive' + path.sep) ||
      relativePath.startsWith('!!config' + path.sep) ||
      relativePath.startsWith('.obsidian' + path.sep) ||
      relativePath.startsWith('Google Keep' + path.sep) ||
      relativePath.startsWith('Eventos anuales' + path.sep) ||
      relativePath.startsWith('Mi diario' + path.sep) ||
      relativePath.startsWith('Mis proyectos' + path.sep) ||
      relativePath.startsWith('Tecnología' + path.sep)
    ) {
      skippedCount++;
      continue;
    }

    try {
      const fileName = path.basename(filePath);
      const relativeDir = path.dirname(relativePath);

      // Calculate first letter for archive folder (lowercase)
      const firstLetter = fileName.charAt(0).toLowerCase();
      // Ensure it's a valid letter or digit, otherwise use 'other'
      const archiveSubfolder = /[a-z0-9]/.test(firstLetter) ? firstLetter : '0';

      const targetDir = path.join(memoryPath, '!!archive', archiveSubfolder);
      const targetPath = path.join(targetDir, fileName);

      // 1. Generate Tag from Path
      // Replace worldPathPrefix with "Location"
      let normalizedDir = relativeDir;
      if (normalizedDir === '.') {
        normalizedDir = '';
      }

      let tagValue = normalizedDir;
      if (worldPathPrefix && tagValue.startsWith(worldPathPrefix)) {
        tagValue = tagValue.replace(worldPathPrefix, 'Location');
      } else if (tagValue !== '') {
        // If it's not in the world path, we still add it as a tag under Knowledge/ or similar?
        // User example specifically mentioned Mi mundo -> Location. 
        // For other folders, we'll just keep them as is but sanitize.
      }

      // Replace spaces with hyphens in the tag and remove parentheses
      tagValue = tagValue.split(path.sep)
        .map(p => p.trim().replace(/\s+/g, '-').replace(/[()]/g, ''))
        .join('/');

      // 2. Read and update content
      const rawContent = fs.readFileSync(filePath, 'utf8');
      const { data: frontmatter, content } = matter(rawContent);

      // Ensure tags is an array
      let tags = frontmatter.tags || [];
      if (!Array.isArray(tags)) {
        tags = typeof tags === 'string' ? [tags] : [];
      }

      // Add the path tag if it's not empty and not already present
      if (tagValue && !tags.includes(tagValue)) {
        tags.push(tagValue);
      }

      frontmatter.tags = tags;

      // Restringify with frontmatter
      const updatedContent = matter.stringify(content, frontmatter);

      // 3. Perform Migration
      console.log(`📦 Migrating: ${relativePath} -> !!archive/${archiveSubfolder}/${fileName}`);
      console.log(`🏷️  Added tag: ${tagValue}`);

      if (!dryRun) {
        // Create target directory
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Write updated content
        // If file exists at target, we might want to rename? 
        // For now, we assume distinct filenames per letter bucket.
        fs.writeFileSync(filePath, updatedContent, 'utf8');

        // Move file
        fs.renameSync(filePath, targetPath);
      }

      migratedCount++;

      // If a limit is requested, stop after reaching it
      if (limit > 0 && migratedCount >= limit) {
        console.log(`🛑 Stopping after reaching migration limit of ${limit}.`);
        break;
      }
    } catch (e: any) {
      console.error(`❌ Failed to migrate ${relativePath}: ${e.message}`);
    }
  }

  console.log(`\n✅ Migration summary:`);
  console.log(`- Total files found: ${files.length}`);
  console.log(`- Successfully migrated: ${migratedCount}`);
  console.log(`- Skipped (system folders): ${skippedCount}`);

  if (dryRun) {
    console.log(`\n⚠️ This was a DRY RUN. No files were actually moved.`);
  }
}

function listMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      results.push(...listMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

migrateMemory().catch(err => {
  console.error(err);
  process.exit(1);
});
