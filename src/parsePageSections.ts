export { parsePageSections }
export { extractPageSections }
export type { PageSection }

import type { PluginOption } from 'vite'
import { assert, assertUsage } from './utils/assert.js'
import { determineSectionUrlHash } from './utils/determineSectionUrlHash.js'
import os from 'os'
import pc from '@brillout/picocolors'

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
  let codeBlockFence: string | null = null
  let isComment = false
  const lines = code.split('\n').map((line) => {
    // Skip code blocks, e.g.
    // ~~~md
    // # Markdown Example
    // Bla
    // ~~~
    if (codeBlockFence) {
      // Closed by the same character, at least as many times (CommonMark)
      const fence = /^ {0,3}(`{3,}|~{3,})[ \t]*\r?$/.exec(line)?.[1]
      if (fence?.startsWith(codeBlockFence)) codeBlockFence = null
      return line
    }
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      codeBlockFence = fence
      return line
    }

    // Skip MDX comments, e.g.
    // {/*
    // ## Draft
    // */}
    if (isComment) {
      if (/\*\//.test(line)) isComment = false
      return line
    }
    if (/^ {0,3}\{\s*\/\*(?!.*\*\/)/.test(line)) {
      isComment = true
      return line
    }

    /* TO-DO/eventually: implement.
    || line.startsWith('<h2')
    */
    // E.g. `## Some Title`, also with tabs or more spaces after `##`, and indented by up to 3 spaces (CommonMark)
    const heading = /^( {0,3})(#{1,6})[ \t]+(?=\S)/.exec(line)
    if (heading) {
      const [match, indent, hashes] = heading
      return parsePageSection(indent!, hashes!.length, line.slice(match.length))
    }

    return line
  })
  const headings = lines.filter((line) => typeof line !== 'string')
  makeIdsUnique(headings)
  const codeNew = lines.map((line) => (typeof line === 'string' ? line : getHeadingHtml(line))).join('\n')
  const pageSections: PageSection[] = headings.map(({ isCustomAnchor, indent, ...pageSection }) => pageSection)
  return { codeNew, pageSections }
}

type Heading = PageSection & { isCustomAnchor: boolean; indent: string }

function parsePageSection(indent: string, pageSectionLevel: number, titleMdx: string): Heading {
  let pageSectionTitle = titleMdx
  let anchor = titleMdx
  {
    // Support custom anchor: `## Some Title{#custom-anchor}`
    const customAnchor = /(?<={#).*(?=})/g.exec(titleMdx)?.[0]
    if (customAnchor) {
      anchor = customAnchor
      pageSectionTitle = titleMdx.replace(/{#.*}/g, '')
    }
  }
  const pageSectionId = determineSectionUrlHash(anchor)
  assert(pageSectionId === null || pageSectionId.length > 0)

  return { pageSectionId, pageSectionLevel, pageSectionTitle, isCustomAnchor: anchor !== titleMdx, indent }
}

// A page may repeat a heading title: `#setup`, `#setup-1`, ... (like GitHub). A heading keeps its own id unless a custom
// anchor or an earlier heading has it, and a suffix never takes another heading's own id.
function makeIdsUnique(headings: Heading[]) {
  const idsOwn = new Set(headings.map((heading) => heading.pageSectionId))
  const idsTaken = new Set<string>()
  headings.forEach((heading) => {
    const id = heading.pageSectionId
    if (!heading.isCustomAnchor || id === null) return
    const first = headings.find((h) => h.isCustomAnchor && h.pageSectionId === id)!
    const getMdx = (h: Heading) => pc.bold(`${'#'.repeat(h.pageSectionLevel)} ${h.pageSectionTitle}`)
    assertUsage(
      first === heading,
      `The headings ${getMdx(first)} and ${getMdx(heading)} have the same URL hash ${pc.bold(`#${id}`)}, give them different {#custom-anchor}`,
    )
    idsTaken.add(id)
  })
  headings.forEach((heading) => {
    const idBase = heading.pageSectionId
    if (idBase === null || heading.isCustomAnchor) return
    let id = idBase
    for (let i = 1; idsTaken.has(id) || (id !== idBase && idsOwn.has(id)); i++) id = `${idBase}-${i}`
    heading.pageSectionId = id
    idsTaken.add(id)
  })
}

function getHeadingHtml({ pageSectionLevel, pageSectionTitle, pageSectionId, indent }: Heading): string {
  const titleParsed = parseMarkdownMini(pageSectionTitle)
  const headingId = pageSectionId === null ? '' : ` id="${pageSectionId}"`
  return `${indent}<h${pageSectionLevel}${headingId}>${titleParsed}</h${pageSectionLevel}>`
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
    let textEscaped = text.split("'").join("\\'")
    // https://github.com/brillout/docpress/pull/2
    if (isWindows()) {
      textEscaped = textEscaped.replace(/\r/, '')
    }
    return `{'${textEscaped}'}`
  }
}

function isWindows() {
  return os.platform() === 'win32'
}
