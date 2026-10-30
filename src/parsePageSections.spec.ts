import { describe, it, expect } from 'vitest'
import { extractPageSections } from './parsePageSections.js'

describe('extractPageSections', () => {
  it('supports Windows line endings (CRLF)', () => {
    const { codeNew, pageSections } = extractPageSections('Some text.\r\n\r\n## Setup\r\n\r\nInstall it.\r\n')
    expect(codeNew).toBe(`Some text.\r\n\r\n<h2 id="setup">{'Setup'}</h2>\n\r\nInstall it.\r\n`)
    expect(pageSections).toEqual([{ pageSectionId: 'setup', pageSectionLevel: 2, pageSectionTitle: 'Setup' }])
  })

  it('reads the title of a heading as Markdown does', () => {
    const titles = {
      '## Setup ##\r': 'Setup',
      '##  Setup': 'Setup',
      '##\tSetup': 'Setup',
      '## Setup ##': 'Setup',
      '### Usage #': 'Usage',
      '## Install #####  ': 'Install',
      '## Setup ## ': 'Setup',
      '## Setup\t##': 'Setup',
      '## C#': 'C#',
      '## Use #tags': 'Use #tags',
      '## Setup  ': 'Setup',
    }
    const { codeNew, pageSections } = extractPageSections(Object.keys(titles).join('\n'))
    expect(pageSections.map(({ pageSectionTitle }) => pageSectionTitle)).toEqual(Object.values(titles))
    expect(codeNew).not.toContain('\r')
  })

  it('supports custom anchors', () => {
    const { pageSections } = extractPageSections(['## Setup {#custom}', '## Some Title{#custom-anchor}'].join('\n'))
    expect(pageSections).toEqual([
      { pageSectionId: 'custom', pageSectionLevel: 2, pageSectionTitle: 'Setup' },
      { pageSectionId: 'custom-anchor', pageSectionLevel: 2, pageSectionTitle: 'Some Title' },
    ])
  })

  it('leaves empty headings to MDX', () => {
    const code = ['##', '## ', '## ###', '## ###\r'].join('\n')
    expect(extractPageSections(code)).toEqual({ codeNew: code, pageSections: [] })
  })
})
