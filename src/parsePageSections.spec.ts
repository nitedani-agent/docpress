import { describe, it, expect } from 'vitest'
import { extractPageSections } from './parsePageSections.js'

describe('extractPageSections', () => {
  it('removes the closing sequence of a heading', () => {
    const { pageSections } = extractPageSections(
      ['## Setup ##', '### Usage #', '## Install #####  ', '## C#', '## Use #tags'].join('\n'),
    )
    expect(pageSections.map(({ pageSectionTitle }) => pageSectionTitle)).toEqual([
      'Setup',
      'Usage',
      'Install',
      'C#',
      'Use #tags',
    ])
  })
})
