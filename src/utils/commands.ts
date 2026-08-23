import { type Command } from "commander";
import { globSync } from "glob";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMMANDS_DIRNAME = resolve(__dirname, "../commands");
const COMMANDS_PATTERN = join(COMMANDS_DIRNAME, "*.ts");

/**
 * List the `commands/*.ts` files
 */
export function listCommands(): string[] {
  return globSync(COMMANDS_PATTERN, { nodir: true });
}

/**
 * Imports a command by file path
 */
export async function importCommand(file: string): Promise<Command> {
  const imported = (await import(file)).default;
  return imported as Command;
}

/**
 * Registers commands in the given program
 */
export async function registerCommands(program: Command): Promise<void> {
  const commands = listCommands();

  for (const file of commands) {
    const command = await importCommand(file);
    program.addCommand(command);
  }
}
