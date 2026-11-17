import { globSync as glob, type GlobOptions } from "glob";
import { sep } from "node:path";

/**
 * Normalizes glob patterns to use forward-slash (/) separators
 * @param pattern - The glob pattern to normalize
 * @returns 
 */
function globNormalize(pattern: string): string {
  return pattern.replaceAll('\\', '/');
}

/**
 * Converts a glob match path back to using platform-specific separators
 * @param paths - The glob matches to convert
 * @returns
 */
function globSep(path: string): string {
  return path.replaceAll('/', sep);
}

/**
 * Lists files matching the given glob pattern
 * @param pattern - The glob pattern to lookup
 * @param options - Some options to use when globbing
 * @returns 
 */
export function globSync(pattern: string, options: GlobOptions = {}): string[] {
  return (glob(globNormalize(pattern), options) as string[]).map(globSep);
}
