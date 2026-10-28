import { getConfigurationKey } from "../utils/configuration";
import {
  type AnyPluginOptions,
  type Plugin,
  type PluginConstructor,
  type PluginParameters,
  type PluginName,
  type AnyPlugin,
  PluginEnforcement,
  type PluginHooks,
} from "./types";
import { defaultTo } from "lodash-es";

const registry = new Map<PluginName, InstanceType<AnyPlugin>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPluginConfiguration<TConfig = any>(
  name: PluginName
): TConfig {
  return defaultTo(getConfigurationKey(["plugins", name]), {});
}

function createPlugin<
  TOptions extends AnyPluginOptions | undefined = undefined,
>(
  plugin: PluginConstructor<TOptions>,
  ...params: PluginParameters<TOptions>
): InstanceType<Plugin<TOptions>> {
  return new plugin(...params);
}

function prioritizePlugins(
  ...plugins: InstanceType<AnyPlugin>[]
): InstanceType<AnyPlugin>[] {
  const pre: InstanceType<AnyPlugin>[] = [];
  const post: InstanceType<AnyPlugin>[] = [];
  const rest: InstanceType<AnyPlugin>[] = [];

  const priorities: Record<PluginEnforcement, InstanceType<AnyPlugin>[]> = {
    [PluginEnforcement.PRE]: pre,
    [PluginEnforcement.POST]: post,
  };

  for (const plugin of plugins) {
    const priority = priorities[plugin.enforce!] ?? rest;
    priority.push(plugin);
  }

  return [...pre, ...rest, ...post];
}

export function registerPlugin<
  TOptions extends AnyPluginOptions | undefined = undefined,
>(
  plugin: PluginConstructor<TOptions>,
  ...params: PluginParameters<TOptions>
): void {
  const name = plugin.name as PluginName;
  if (registry.has(name)) return;
  registry.set(name, createPlugin(plugin, ...params));
}

export async function invokePlugins<
  TName extends keyof PluginHooks,
  THook extends NonNullable<PluginHooks[TName]> = NonNullable<
    PluginHooks[TName]
  >,
  TParams extends Parameters<THook> = Parameters<THook>,
>(hook: TName, params: TParams): Promise<void> {
  const plugins = prioritizePlugins(...Array.from(registry.values()));

  for (const plugin of plugins) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    await (plugin[hook] as Function)?.apply(plugin, params);
  }
}
