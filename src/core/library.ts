import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { Library } from "../utils/library";
import { Progress } from "../utils/progress";
import { stringifyManifest } from "../utils/stringify";
import chalk from "chalk";
import { type Primitive } from "type-fest";

export type LibraryArguments = [string];

export interface LibraryOptions extends SpotiOptions {
  cache: boolean;
  more: boolean;
}

const LIBRARY_DEFAULTS: LibraryOptions = {
  cache: true,
  more: false,
  verbose: false,
};

export const library: ActionHandler<LibraryArguments, LibraryOptions> = async <
  TOptions extends LibraryOptions,
>(
  file?: string,
  config?: TOptions
) => {
  const options = mergeOptions(LIBRARY_DEFAULTS, config);
  const manifest = await Library.manifest(file, options);

  const progress = new Progress({
    label: "Scanning…",
    total: manifest.files.length,
    color: chalk.blue,
  });

  const details: Record<string, Primitive> = {};

  const info = await stringifyManifest(manifest, options, details, () =>
    progress.increment()
  );

  progress.done();
  console.log();
  console.log(info);
};
