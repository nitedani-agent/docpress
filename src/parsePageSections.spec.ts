import { describe, it, expect } from 'vitest'
import { extractPageSections } from './parsePageSections.js'

describe('extractPageSections', () => {
  it('renders backslashes in a heading as typed', () => {
    const { codeNew } = extractPageSections(
      ['## Paths like `C:\\temp\\new`', "## The `\\u` flag isn't `\\d`"].join('\n'),
    )
    expect(codeNew.split('\n')).toEqual([
      String.raw`<h2 id="paths-like-c-temp-new">{"Paths like "}<code>{"C:\\temp\\new"}</code></h2>`,
      String.raw`<h2 id="the-u-flag-isn-t-d">{"The "}<code>{"\\u"}</code>{" flag isn't "}<code>{"\\d"}</code></h2>`,
    ])
  })
})
