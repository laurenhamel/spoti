/* eslint-disable @typescript-eslint/no-explicit-any */
import { type SpotiOptions } from "./config";

export type ActionParameters<
  TArguments extends any[],
  TOptions extends SpotiOptions,
> = [...TArguments, TOptions];

export type ActionHandler<
  TArguments extends any[],
  TOptions extends SpotiOptions,
> = <TConfiguration extends TOptions = TOptions>(
  ...params: ActionParameters<TArguments, TConfiguration>
) => void | Promise<void>;
