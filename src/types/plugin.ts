/* eslint-disable @typescript-eslint/no-explicit-any */
import { type CamelCase, type PascalCase } from "type-fest";

export type SpotiPluginName<
  TName extends CamelCase<string> | PascalCase<string> =
    CamelCase<string> | PascalCase<string>,
> = `com.spoti.${TName}`;

export type SpotiPluginConfiguration<
  TName extends SpotiPluginName = SpotiPluginName,
  TConfiguration extends Record<string, any> = Record<string, any>,
> = Record<SpotiPluginName<TName>, TConfiguration>;
