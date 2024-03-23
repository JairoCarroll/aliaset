import type { Preset } from '@twind/core'
import type { TailwindTheme } from './types'

import theme from './defaultTheme'
import preflight from './preflight'
import rules from './rules'
import variants from './variants'

export * from './types'

export interface TailwindPresetOptions {
  /** Allows to disable to tailwind preflight (default: `false` eg include the tailwind preflight ) */
  disablePreflight?: boolean | undefined
}

export default function presetTailwind({
  disablePreflight,
}: TailwindPresetOptions = {}): Preset<TailwindTheme> {
  return {
    // allow other preflight to run
    preflight: disablePreflight ? undefined : preflight,
    theme,
    variants,
    rules,
  }
}
