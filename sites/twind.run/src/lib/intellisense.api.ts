import type { Intellisense } from './intellisense'
import System from './system'

let resolveInit: (autocomplte: Promise<import('@twind/intellisense').Intellisense>) => void

let intellisensePromise = new Promise<import('@twind/intellisense').Intellisense>((resolve) => {
  resolveInit = resolve
})

const api: Intellisense = {
  async init({ entry, importMap }) {
    System.addImportMap(importMap)

    intellisensePromise = System.import(entry).then(({ default: intellisense }) => intellisense)

    resolveInit(intellisensePromise)

    await intellisensePromise
  },

  async suggestAt(...args) {
    const intellisense = await intellisensePromise
    return intellisense.suggestAt(...args)
  },

  async documentationFor(...args) {
    const intellisense = await intellisensePromise
    return intellisense.documentationFor(...args)
  },

  async documentationAt(...args) {
    const intellisense = await intellisensePromise
    return intellisense.documentationAt(...args)
  },

  async collectColors(...args) {
    const intellisense = await intellisensePromise
    return intellisense.collectColors(...args)
  },

  async validate(...args) {
    const intellisense = await intellisensePromise
    return intellisense.validate(...args)
  },
}

export default api
