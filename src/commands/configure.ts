import {
  configure,
  type ConfigureArguments,
  type ConfigureOptions,
} from "../core";
import { createAction } from "../utils/action";
import { Command } from "commander";

export default new Command()
  .name("configure")
  .description("Get or set Spoti configurations")
  .argument("[key]", "A Spoti configuration key")
  .argument("[value]", "A Spoti configuration value")
  .action(createAction<ConfigureArguments, ConfigureOptions>(configure));
