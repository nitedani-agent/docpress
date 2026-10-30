import { describe, it, expect } from 'vitest'
import { extractPageSections } from './parsePageSections.js'

const getIds = (headings: string[]) =>
  extractPageSections(headings.join('\n')).pageSections.map(({ pageSectionId }) => pageSectionId)

describe('extractPageSections()', () => {
  it('gives repeated headings unique ids', () => {
    const { codeNew } = extractPageSections(['## Repeated', '### Repeated', '## Repeated'].join('\n'))
    expect(codeNew).toBe(
      [
        `<h2 id="repeated">{'Repeated'}</h2>`,
        `<h3 id="repeated-1">{'Repeated'}</h3>`,
        `<h2 id="repeated-2">{'Repeated'}</h2>`,
      ].join('\n'),
    )
    expect(getIds(['## Тест', '## Тест'])).toEqual([null, null])
  })

  it("doesn't take another heading's id", () => {
    expect(getIds(['### Setup', '### Setup', '### Setup 1'])).toEqual(['setup', 'setup-2', 'setup-1'])
    expect(getIds(['## Setup', '## Install{#setup}'])).toEqual(['setup-1', 'setup'])
  })

  it('skips code blocks and MDX comments', () => {
    const lines = [
      '````md',
      '```js',
      '```',
      '### Setup',
      '````',
      '  ~~~md',
      '  ## Setup',
      '  ~~~',
      '{/*',
      '### Setup',
      '*/}',
    ]
    const { codeNew, pageSections } = extractPageSections([...lines, '## Setup'].join('\n'))
    expect(codeNew).toBe([...lines, `<h2 id="setup">{'Setup'}</h2>`].join('\n'))
    expect(pageSections).toEqual([{ pageSectionId: 'setup', pageSectionLevel: 2, pageSectionTitle: 'Setup' }])
  })

  it('throws a usage error upon two headings with the same custom anchor', () => {
    expect(() => extractPageSections(['## Setup{#stable}', '### Install{#stable}'].join('\n'))).toThrow(
      '[DocPress][Wrong Usage] The headings ## Setup and ### Install have the same URL hash #stable',
    )
  })
})
