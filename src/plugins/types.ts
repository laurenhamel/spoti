/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SpotiConfiguration } from "../types/configuration";
import type { DownloadTarget } from "../types/download";
import type { Tags } from "node-id3";
import type { CamelCase, Class, PascalCase } from "type-fest";

export type PluginName = `com.spoti.${CamelCase<string> | PascalCase<string>}`;

export interface PluginConstructor<
  TOptions extends AnyPluginOptions | undefined = undefined,
> extends Omit<PluginPrototype, "name"> {
  name: string;
  new (...params: PluginParameters<TOptions>): PluginPrototype;
}

export type Plugin<TOptions extends AnyPluginOptions | undefined> = Class<
  PluginPrototype,
  PluginParameters<TOptions>
>;

export type AnyPlugin = Plugin<AnyPluginOptions>;

export type PluginOptions<TOptions extends Record<string, any>> = TOptions;

export type AnyPluginOptions = PluginOptions<Record<string, any>>;

export type PluginParameters<TOptions extends AnyPluginOptions | undefined> =
  TOptions extends undefined ? [] : [TOptions];

export type PluginPrototype = PluginMetadata & PluginHooks;

export enum PluginEnforcement {
  PRE = "pre",
  POST = "post",
}

export interface PluginMetadata {
  name: PluginName;
  enforce?: PluginEnforcement;
}

export interface PluginHooks {
  /**
   * Provides the fully resolved configuration object when ready
   * @remarks Configuration objects will be empty in plugin constructors.
   */
  resolvedConfiguration?: PluginHook<[SpotiConfiguration], void>;
  /**
   * Enables transforming track tags before writing them to the download file.
   * @remarks Tags must be mutated in place.
   */
  transformTags?: PluginHook<[DownloadTarget, Tags], void>;
}

export type PluginHook<TParams extends any[] = [], TReturn = void> = (
  ...params: TParams
) => TReturn | Promise<TReturn>;
