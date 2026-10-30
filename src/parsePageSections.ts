export { parsePageSections }
export { extractPageSections }
export type { PageSection }

import type { PluginOption } from 'vite'
import { assert } from './utils/assert.js'
import { determineSectionUrlHash } from './utils/determineSectionUrlHash.js'

type PageSection = {
  pageSectionTitle: string
  pageSectionId: string | null
  pageSectionLevel: number
}

function parsePageSections(): PluginOption {
  return {
    name: '@brillout/docpress:parsePageSections',
    enforce: 'pre',
    transform: async (code: string, id: string) => {
      if (!id.endsWith('+Page.mdx')) {
        return
      }
      const codeNew = transform(code)
      return codeNew
    },
  }
}

function transform(code: string) {
  const { codeNew, pageSections } = extractPageSections(code)
  return `${codeNew}\n\nexport const pageSectionsExport = ${JSON.stringify(pageSections)};\n`
}

/** Replaces the Markdown headings with HTML headings (with their `id`) and returns them as page sections — also used by `$ docpress lint` */
function extractPageSections(code: string) {
  const pageSections: PageSection[] = []
  let isCodeBlock = false
  const codeNew = code
    .split('\n')
    .map((line) => {
      // Skip code blocks, e.g.
      // ~~~md
      // # Markdown Example
      // Bla
      // ~~~
      if (line.startsWith('~~~') || line.startsWith('```')) {
        isCodeBlock = !isCodeBlock
        return line
      }
      if (isCodeBlock) {
        return line
      }

      if (
        line.startsWith('#')
        /* TO-DO/eventually: implement.
        || line.startsWith('<h2')
        */
      ) {
        const { pageSectionId, pageSectionLevel, pageSectionTitle, headingHtml } = parsePageSection(line)
        pageSections.push({ pageSectionId, pageSectionLevel, pageSectionTitle })
        return headingHtml
      }

      return line
    })
    .join('\n')
  return { codeNew, pageSections }
}

function parsePageSection(line: string): PageSection & { headingHtml: string } {
  // A file with Windows line endings (CRLF) has a `\r` at the end of each line
  // Same as Markdown: `##` then spaces or tabs, the title, and an optional closing sequence `##`
  const match = /^(#+)(?:[ \t]+(.*?))??(?:[ \t]+#+)?[ \t]*$/.exec(line.replace(/\r$/, ''))
  assert(match, { line })
  const pageSectionLevel = match[1]!.length

  const titleMdx = match[2]
  assert(titleMdx, { line })

  let pageSectionTitle = titleMdx
  let anchor = titleMdx
  {
    // Support custom anchor: `## Some Title{#custom-anchor}`
    const customAnchor = /(?<={#).*(?=})/g.exec(titleMdx)?.[0]
    if (customAnchor) {
      anchor = customAnchor
      pageSectionTitle = titleMdx.replace(/[ \t]*{#.*}/g, '')
    }
  }
  const pageSectionId = determineSectionUrlHash(anchor)

  const titleParsed = parseMarkdownMini(pageSectionTitle)
  assert(pageSectionId === null || pageSectionId.length > 0)
  const headingId = pageSectionId === null ? '' : ` id="${pageSectionId}"`
  const headingHtml = `<h${pageSectionLevel}${headingId}>${titleParsed}</h${pageSectionLevel}>`

  const pageSection = { pageSectionLevel, pageSectionTitle, pageSectionId, headingHtml }
  return pageSection
}

function parseMarkdownMini(titleMarkdown: string): string {
  type Part = { nodeType: 'text' | 'code'; content: string }
  const parts: Part[] = []
  let current: Part | undefined
  titleMarkdown.split('').forEach((letter) => {
    if (letter === '`') {
      if (current?.nodeType === 'code') {
        // </code>
        parts.push(current)
        current = undefined
      } else {
        // <code>
        if (current) {
          parts.push(current)
        }
        current = { nodeType: 'code', content: '' }
      }
    } else {
      if (!current) {
        current = { nodeType: 'text', content: '' }
      }
      current.content += letter
    }
  })
  if (current) {
    parts.push(current)
  }

  const titleHtml = parts
    .map((part) => {
      if (part.nodeType === 'code') {
        return `<code>${serializeText(part.content)}</code>`
      } else {
        assert(part.nodeType === 'text', { parts })
        return serializeText(part.content)
      }
    })
    .join('')

  return titleHtml

  function serializeText(text: string) {
    const textEscaped = text.split("'").join("\\'")
    return `{'${textEscaped}'}`
  }
}
