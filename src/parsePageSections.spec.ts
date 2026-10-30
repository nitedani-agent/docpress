import { describe, it, expect } from 'vitest'
import { extractPageSections } from './parsePageSections.js'

describe('extractPageSections', () => {
  it('supports Windows line endings (CRLF)', () => {
    const { codeNew, pageSections } = extractPageSections('Some text.\r\n\r\n## Setup\r\n\r\nInstall it.\r\n')
    expect(codeNew).toBe(`Some text.\r\n\r\n<h2 id="setup">{'Setup'}</h2>\n\r\nInstall it.\r\n`)
    expect(pageSections).toEqual([{ pageSectionId: 'setup', pageSectionLevel: 2, pageSectionTitle: 'Setup' }])
  })
})
