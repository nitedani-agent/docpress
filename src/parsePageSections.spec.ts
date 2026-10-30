import { describe, it, expect } from 'vitest'
import { extractPageSections } from './parsePageSections.js'

describe('extractPageSections()', () => {
  it('gives repeated headings unique ids', () => {
    const { codeNew, pageSections } = extractPageSections(
      ['## Repeated', '### Repeated', '## Repeated 1', '## Repeated', '## Other{#repeated}', '## Тест', '## Тест'].join(
        '\n',
      ),
    )
    expect(pageSections.map(({ pageSectionId }) => pageSectionId)).toEqual([
      'repeated',
      'repeated-1',
      'repeated-1-1',
      'repeated-2',
      'repeated',
      null,
      null,
    ])
    expect(codeNew).toContain(`<h3 id="repeated-1">{'Repeated'}</h3>`)
  })
})
