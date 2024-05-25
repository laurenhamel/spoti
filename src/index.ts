import { program } from "@commander-js/extra-typings";
import { sync as glob } from "glob";
import pkg from "../package.json";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  console.log("Hello from Spoti!");

  const commands = glob(join(resolve(__dirname, "./commands"), "*.ts"), {
    nodir: true,
  });

  program.name(pkg.name).description(pkg.description).version(pkg.version);

  for (const file of commands) {
    const command = (await import(file)).default;
    program.addCommand(command);
  }

  program.parse(process.argv);
})();
