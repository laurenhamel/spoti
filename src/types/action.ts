/* eslint-disable @typescript-eslint/no-explicit-any */
import { type SpotiOptions } from "./config";
import { type Command } from "commander";

export type ActionParameters<
  TArguments extends any[],
  TOptions extends SpotiOptions,
> = [...TArguments, TOptions, Command];

export type ActionHandler<
  TArguments extends any[],
  TOptions extends SpotiOptions,
> = <TConfiguration extends TOptions = TOptions>(
  ...params: ActionParameters<TArguments, TConfiguration>
) => void | Promise<void>;
