import type {
  BaseTheme,
  Preset,
  TwindConfig,
  TwindUserConfig,
  ExtractThemes,
  TwindPresetConfig,
} from './types'

import { asArray } from './utils'

/**
 * @group Configuration
 * @param param0
 * @returns
 */
export function defineConfig<Theme = BaseTheme, Presets extends Preset<any>[] = Preset[]>({
  presets = [] as unknown as Presets,
  ...userConfig
}: TwindUserConfig<Theme, Presets>): TwindConfig<BaseTheme & ExtractThemes<Theme, Presets>> {
  // most user config values go first to have precendence over preset config
  // only `preflight` and `theme` are applied as last preset to override all presets
  let config: TwindConfig<BaseTheme & ExtractThemes<Theme, Presets>> = {
    preflight: userConfig.preflight !== false && [],
    darkMode: undefined,
    darkColor: undefined,
    theme: {},
    variants: asArray(userConfig.variants),
    rules: asArray(userConfig.rules),
    ignorelist: asArray(userConfig.ignorelist),
    hash: userConfig.hash,
    stringify: userConfig.stringify || noprefix,
  }

  for (const preset of asArray([
    ...presets,
    {
      darkMode: userConfig.darkMode,
      darkColor: userConfig.darkColor,
      preflight: userConfig.preflight !== false && asArray(userConfig.preflight),
      theme: userConfig.theme as TwindConfig<BaseTheme & ExtractThemes<Theme, Presets>>['theme'],
      hash: userConfig.hash,
      stringify: userConfig.stringify,
    } as TwindPresetConfig<Theme>,
  ])) {
    const {
      preflight,
      darkMode = config.darkMode,
      darkColor = config.darkColor,
      theme,
      variants,
      rules,
      ignorelist,
      hash = config.hash,
      stringify = config.stringify,
    } = typeof preset == 'function' ? preset(config) : (preset as TwindPresetConfig<Theme>)

    config = {
      // values defined by user or previous presets take precedence
      preflight: config.preflight !== false &&
        preflight !== false && [...config.preflight, ...asArray(preflight)],

      darkMode,
      darkColor,

      theme: {
        ...config.theme,
        ...theme,
        extend: {
          ...config.theme.extend,
          ...theme?.extend,
        },
      },

      variants: [...config.variants, ...asArray(variants)],
      rules: [...config.rules, ...asArray(rules)],
      ignorelist: [...config.ignorelist, ...asArray(ignorelist)],

      hash,
      stringify,
    } as TwindConfig<BaseTheme & ExtractThemes<Theme, Presets>>
  }

  return config
}

function noprefix(property: string, value: string): string {
  return property + ':' + value
}
