export { CategoryTabs }
export { NavHeadCategory }
export { initCategoryTabsHiding }

import React from 'react'
import { usePageContext } from './renderer/usePageContext.js'
import { parseMarkdownMini } from './parseMarkdownMini.js'
import { bodyMaxWidth, barShadow } from './Layout.js'
import { cls } from './utils/cls.js'
import './CategoryTabs.css'

// The categories (level-1 headings) as tabs below the top bar (desktop), each linking to its first page.
// The current page's category is underlined in its color. The left navigation lists the category's pages.
function CategoryTabs() {
  const { categories } = usePageContext().resolved
  return (
    <nav className="category-tabs" aria-label="Categories" style={{ boxShadow: barShadow }}>
      <div
        className="category-tabs-content"
        // In the frame, like the top bar's content, also on pages without left navigation (they aren't capped): the
        // first tab stays under the logo from page to page
        style={{ maxWidth: bodyMaxWidth, margin: '0 auto', boxSizing: 'border-box' }}
      >
        {categories.map(
          ({ title, titleIcon, color, pages, isCurrent }, i) =>
            pages[0] && (
              <a
                key={i}
                href={pages[0].url}
                className={cls(['category-tab', isCurrent && 'is-current'])}
                aria-current={isCurrent ? 'true' : undefined}
                style={{ '--color-category': color }}
              >
                {titleIcon && <img src={titleIcon} alt="" className="category-tab-icon" />}
                {parseMarkdownMini(title)}
              </a>
            ),
        )}
      </div>
    </nav>
  )
}

// The current category in the top bar, after the logo: shown while the tabs are hidden (CategoryTabs.css)
function NavHeadCategory() {
  const category = usePageContext().resolved.categories.find((category) => category.isCurrent)
  if (!category?.pages[0]) return null
  const { title, titleIcon, color, pages } = category
  return (
    <a href={pages[0].url} className="category-tab is-current nav-head-category" style={{ '--color-category': color }}>
      {titleIcon && <img src={titleIcon} alt="" />}
      {parseMarkdownMini(title)}
    </a>
  )
}

// Any scroll down hides the tabs, any scroll up shows them (only where the top nav is sticky, see CategoryTabs.css)
function initCategoryTabsHiding() {
  let scrollYLast = window.scrollY
  window.addEventListener(
    'scroll',
    () => {
      const { scrollY } = window
      if (scrollY === scrollYLast) return
      // Past the page's top or bottom: the elastic overscroll (Safari), not the reader scrolling back
      const { scrollHeight, clientHeight } = document.documentElement
      if (scrollY < 0 || scrollY > scrollHeight - clientHeight) return
      document.documentElement.classList.toggle('category-tabs-hidden', scrollY > 0 && scrollY > scrollYLast)
      scrollYLast = scrollY
    },
    { passive: true },
  )
}
