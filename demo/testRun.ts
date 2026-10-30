export { testRun }

import { test, expect, run, fetchHtml, page, getServerUrl, autoRetry } from '@brillout/test-e2e'

function testRun(cmd: 'pnpm run dev' | 'pnpm run preview') {
  const isDev = cmd === 'pnpm run dev'

  {
    // Preview => `npm run preview` takes a long time
    // Dev => `Learn more collapsible` takes a long time
    const additionalTimeout = 120 * 1000
    run(cmd, { additionalTimeout })
  }

  const landingPageUrl = '/'
  test(landingPageUrl, async () => {
    await testLandingPageHtml()
    await page.goto(getServerUrl() + landingPageUrl)
    await testLandingPageClient()
  })
  async function testLandingPageHtml() {
    const html = await fetchHtml(landingPageUrl)
    expect(getTitleHtml(html)).toBe('DocPress Demo')
    expect(html).toContain('<meta property="og:type" content="website">')
    expect(html).toContain('<meta property="og:title" content="DocPress Demo">')
    expect(html).toContain('<meta property="og:url" content="fake-website.example.org">')
    expect(html).toContain('<meta property="og:description" content="DocPress Demonstration.">')
    expect(html).toContain('<meta name="twitter:site" content="@brillout">')
    expect(html).toContain('aria-label="Changelog (v0.4.255)"')
    expect(html).toContain('href="https://x.com/brillout"')
    expectAlgoliaCategory(html, 'Overview', 1)
  }
  async function testLandingPageClient() {
    expect(await page.textContent('h1')).toBe('Next Generation Docs')
    expect(await page.textContent('body')).toContain('This demo is used for testing and developing DocPress.')
    expect(await getTitleClient()).toBe('DocPress Demo')
  }

  const featuresURL = '/features'
  test(featuresURL, async () => {
    await page.goto(getServerUrl() + featuresURL)
    const text = await page.textContent('body')
    expect(text).toContain('Features')
    expect(text).toContain('Edit')
    expect(text).toContain('This page is for testing/developing DocPress features.')
    expect(text).toContain('Guides > Some Page (basic link)')
    expect(text).toContain('Orphan Page (link to detached page)')
    expect(text).toContain('<Link> (same-page link, non-inferred original heading title without needing sectionTitles)')
    expect(text).toContain('Basic (same-page link, sub heading)')
    {
      const html = await fetchHtml(featuresURL)
      expect(getTitleHtml(html)).toBe('Features | Demo')
      expect(await getTitleClient()).toBe('Features | Demo')
      expectAlgoliaCategory(html, 'Overview', 1)
      // The YAML frontmatter of the ```md code block is highlighted, see getHighlighter.ts
      expect(html).toContain('>author</span>')
    }
  })
  test(`${featuresURL} - custom URL hash`, async () => {
    const testUrlHash = async () => {
      await autoRetry(
        async () => {
          const hash = await page.evaluate(() => window.location.hash)
          expect(hash).toBe('#custom-hash')
        },
        { timeout: 5 * 1000 },
      )
    }
    /* Doens't work, seems to be a Playwright bug?
    await page.click('h2:has-text("Code blocks")', { timeout: 1000 })
    await page.click('h3:has-text("Custom URL hash for section heading")', { timeout: 1000 })
    await testUrlHash()
    //*/
    const text = await page.textContent('body')
    expect(text).toContain('Custom URL hash for section heading (custom hash)')
    // The page's own link (the "On this page" rail, earlier in the DOM, also links to the section)
    await page.click('.page-content a[href="#custom-hash"]', { timeout: 1000 })
    await testUrlHash()
  })
  test(`${featuresURL} - JavaScript toggle`, async () => {
    const tsText1 = "const hello: string = 'world'"
    const jsText1 = "const hello = 'world'"
    const tsText2 = 'const someMessage: SomeMessage ='
    const jsText2 = 'const someMessage ='
    const tsText3 = "const hello: string = 'world'\nconst hello: string[] = ['hello', 'world']"
    const jsText3 = "const hello = 'world'\nconst hello = ['hello', 'world']"
    const tsText4 = 'pages/(marketing)/index/+Page.ts'
    const jsText4 = 'pages/(marketing)/index/+Page.js'
    const hasJs = (text: string | null, yes = true) => {
      expect(text).not.toBe(null)
      if (yes) {
        expect(text).toContain(jsText1)
        expect(text).toContain(jsText2)
        expect(text).toContain(jsText3)
        expect(text).toContain(jsText4)
      } else {
        expect(text).not.toContain(jsText1)
        expect(text).not.toContain(jsText2)
        expect(text).not.toContain(jsText3)
        expect(text).not.toContain(jsText4)
      }
    }
    const hasTs = (text: string | null, yes = true) => {
      expect(text).not.toBe(null)
      if (yes) {
        expect(text).toContain(tsText1)
        expect(text).toContain(tsText2)
        expect(text).toContain(tsText3)
        expect(text).toContain(tsText4)
      } else {
        expect(text).not.toContain(tsText1)
        expect(text).not.toContain(tsText2)
        expect(text).not.toContain(tsText3)
        expect(text).not.toContain(tsText4)
      }
    }

    const textFull = await page.textContent('body')
    hasJs(textFull)
    hasTs(textFull)

    const expectTs = async () => {
      const text = await getVisibleText(page)
      hasJs(text, false)
      hasTs(text)
    }
    const expectJs = async () => {
      const text = await getVisibleText(page)
      hasJs(text)
      hasTs(text, false)
    }

    await page.evaluate(() => window.localStorage.clear())

    await expectJs()

    if (!isDev) {
      await page.locator('#choice-TypeScript').first().dispatchEvent('click')
    }

    await autoRetry(
      async () => {
        if (!isDev) {
          await expectTs()
        }
      },
      { timeout: 5 * 1000 },
    )

    // Test hiding the copy button
    const bashPreHtml = await page.innerHTML('pre[data-language="bash"]')
    expect(bashPreHtml).not.toContain('Copy to clipboard')

    {
      const html = await fetchHtml(featuresURL)
      expect(html).toContain('SomeMessage')
    }
  })

  test(`${featuresURL} - Choice Group`, async () => {
    const honoNpmChoiceText = 'npm install hono @photonjs/hono'
    const expressPnpmChoiceText = 'pnpm add express @photonjs/express'
    const honoChoiceText = "import { Hono } from 'hono'"
    const expressChoiceText = "import express from 'express'"
    const fastifyChoiceText = "import fastify from 'fastify'"

    const hasHonoChoice = (text: string | null, yes = true) => {
      expect(text).not.toBe(null)
      if (yes) {
        expect(text).toContain(honoNpmChoiceText)
        expect(text).toContain(honoChoiceText)
      } else {
        expect(text).not.toContain(honoNpmChoiceText)
        expect(text).not.toContain(honoChoiceText)
      }
    }

    const hasExpressChoice = (text: string | null, yes = true) => {
      expect(text).not.toBe(null)
      if (yes) {
        expect(text).toContain(expressPnpmChoiceText)
        expect(text).toContain(expressChoiceText)
      } else {
        expect(text).not.toContain(expressPnpmChoiceText)
        expect(text).not.toContain(expressChoiceText)
      }
    }

    const hasFastifyChoice = (text: string | null, yes = true) => {
      expect(text).not.toBe(null)
      if (yes) {
        expect(text).toContain(fastifyChoiceText)
      } else {
        expect(text).not.toContain(fastifyChoiceText)
      }
    }

    const textFull = await page.textContent('body')

    hasHonoChoice(textFull)
    hasExpressChoice(textFull)
    hasFastifyChoice(textFull)

    const expectHonoChoice = async () => {
      const text = await getVisibleText(page)
      hasHonoChoice(text)
      hasExpressChoice(text, false)
      hasFastifyChoice(text, false)
    }

    const expectExpressChoice = async () => {
      const text = await getVisibleText(page)
      hasHonoChoice(text, false)
      hasExpressChoice(text)
      hasFastifyChoice(text, false)
    }

    const expectFastifyChoice = async () => {
      await page.locator('#choice-Fastify').first().dispatchEvent('click')
      const text = await getVisibleText(page)
      hasHonoChoice(text, false)
      hasExpressChoice(text, false)
      hasFastifyChoice(text)
    }

    await page.evaluate(() => window.localStorage.clear())

    await expectHonoChoice()

    if (!isDev) {
      await page.locator('#choice-pnpm').first().dispatchEvent('click')
      await page.locator('#choice-Express').first().dispatchEvent('click')
    }

    await autoRetry(
      async () => {
        if (!isDev) {
          await expectExpressChoice()
          await expectFastifyChoice()
        }
      },
      { timeout: 5 * 1000 },
    )
  })

  test(`${featuresURL} - Choice Group nested in a <Tabs> choice`, async () => {
    // The `uiFramework` group is toggled by `<Tabs>` (its choices start with prose, so it has no dropdown) — but the
    // code blocks it contains still get their own npm/pnpm dropdown, also inside blockquotes.
    const reactChoice = page.locator('.choice[data-choice-value="React"]', { hasText: 'Install vike-react' })
    expect(await reactChoice.count()).toBe(1)
    expect(await reactChoice.locator('.choice-select__list[data-choice-group="pkgManager"]').count()).toBe(2)
    expect(await reactChoice.locator('blockquote .choice-select__list[data-choice-group="pkgManager"]').count()).toBe(1)
    const vueChoice = page.locator('.choice[data-choice-value="Vue"]', { hasText: 'Install vike-vue' })
    expect(await vueChoice.locator('.choice-select__list[data-choice-group="pkgManager"]').count()).toBe(1)
    expect(await vueChoice.locator('.choice-select__list[data-choice-group="codeLang"]').count()).toBe(1)

    // Multi-line commands are converted line by line (comments and package names containing `npm` are left alone)
    const text = await page.textContent('body')
    expect(text).toContain('npm install vike-react')
    expect(text).toContain('pnpm add vike-react')
    expect(text).toContain('yarn add vike-react')
    expect(text).toContain('bun add vike-react')
    expect(text).toContain('# Make sure you install skills-npm\nnpm install -D skills-npm\nnpx skills-npm setup')
    expect(text).toContain('# Make sure you install skills-npm\npnpm add -D skills-npm\npnpm dlx skills-npm setup')
    expect(text).toContain('# Make sure you install skills-npm\nyarn add --dev skills-npm\nyarn dlx skills-npm setup')
    expect(text).toContain('# Make sure you install skills-npm\nbun add --dev skills-npm\nbun x skills-npm setup')
  })

  test(`${featuresURL} - Choice Group without content for the selected choice`, async () => {
    // A group displays nothing while a choice it doesn't have content for is selected: it doesn't fall back to another
    // choice. (Only a choice absent from the whole page falls back, see `H3` below.)
    const expressNoteText = 'Express.js is deprecated.'
    const tsOnlyText = 'Some content only shown to TypeScript users.'
    const honoChoiceText = "import { Hono } from 'hono'"
    const helloReactText = 'Hello from React'
    const installSolidText = 'Install vike-solid'

    {
      const html = await fetchHtml(featuresURL)
      const getSelectedChoiceSSR = (text: string) =>
        page.evaluate(
          ([html, text]) => {
            const doc = new DOMParser().parseFromString(html, 'text/html')
            const choiceEl = [...doc.querySelectorAll('.choice')].filter((el) => el.textContent!.includes(text)).pop()!
            return choiceEl.closest('.choice-group')!.querySelector('select')!.value
          },
          [html, text] as const,
        )
      expect(await getSelectedChoiceSSR(expressNoteText)).toBe('Hono')
      expect(await getSelectedChoiceSSR(tsOnlyText)).toBe('JavaScript')
    }

    const expectVisible = async (text: string, yes = true) => {
      await autoRetry(
        async () => {
          const visibleText = await getVisibleText(page)
          if (yes) {
            expect(visibleText).toContain(text)
          } else {
            expect(visibleText).not.toContain(text)
          }
        },
        { timeout: 5 * 1000 },
      )
    }
    const clickTab = async (choiceGroup: string, choice: string) => {
      await page
        .locator(`.choice-tabs__tab-list[data-choice-group="${choiceGroup}"] label`, { hasText: choice })
        .click()
    }
    const load = async (choices: Record<string, string> = {}) => {
      await page.evaluate((choices) => {
        window.localStorage.clear()
        for (const [group, choice] of Object.entries(choices))
          window.localStorage.setItem(`docpress:choice:${group}`, choice)
      }, choices)
      await page.goto(getServerUrl() + featuresURL)
      await page.waitForFunction(() => (window as any).__docpress_hydrationFinished)
    }

    await load()
    await expectVisible(honoChoiceText)
    await expectVisible(expressNoteText, false)
    await expectVisible(tsOnlyText, false)

    await clickTab('server', 'Express')
    await expectVisible(expressNoteText)
    await clickTab('server', 'Fastify')
    await expectVisible(expressNoteText, false)
    await clickTab('server', 'Hono')
    await expectVisible(honoChoiceText)
    await expectVisible(expressNoteText, false)

    // The `React`/`Vue` group displays nothing while the `Solid` tab is selected
    await expectVisible(helloReactText)
    await clickTab('uiFramework', 'Solid')
    await expectVisible(installSolidText)
    await expectVisible(helloReactText, false)

    await load({ codeLang: 'TypeScript' })
    await expectVisible(tsOnlyText)

    // `H3` is absent from the page (hidden from the tabs, without content): fall back to the default choice (#169)
    await load({ server: 'H3' })
    await expectVisible(honoChoiceText)
    await expectVisible(expressNoteText, false)

    await page.evaluate(() => window.localStorage.clear())
  })

  const somePageUrl = '/some-page'
  test(`${somePageUrl} - custom <Pre> injected into nested MDX`, async () => {
    await page.goto(getServerUrl() + somePageUrl)
    const choiceGroupHtml = await page.innerHTML('div.choice-group')
    expect(choiceGroupHtml).toContain('Copy to clipboard')
  })

  const orphanURL = '/orphan'
  test(orphanURL, async () => {
    await page.goto(getServerUrl() + orphanURL)
    const text = await page.textContent('body')
    expect(text).toContain(`This page is "detached": it isn't included in the left-side navigation.`)
    expect(text).toContain(`Another Orphan Page Without Headings.`)
    expect(text).toContain(`Same page link for orphan page: Some SecTion.`)
    {
      const html = await fetchHtml(orphanURL)
      expect(getTitleHtml(html)).toBe('Orphan Page | Demo')
      expectAlgoliaCategory(html, 'Guides', 0)
    }
  })

  const orphan2URL = '/orphan-2'
  test(orphan2URL, async () => {
    const html = await fetchHtml(orphan2URL)
    expect(getTitleHtml(html)).toBe('Orphan Page Without Headings | Demo')
    expect(html).toContain('Orphan Page Without Heading')
    expect(html).toContain('<meta name="algolia:category" content="Guides 2"><meta name="algolia:category:hide">')
  })

  test(`${featuresURL} - menu opened with the keyboard`, async () => {
    const closeButton = '#menu-modal-wrapper .menu-modal-close'
    // The "Docs" menu: on desktop, beside the left navigation, the category tabs replace it
    // Desktop too narrow for the left navigation: the dropdown's first link gets the focus
    await withViewport({ width: 1040, height: 720 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      await page.waitForFunction(() => (window as any).__docpress_hydrationFinished)
      await openWithKeyboard('#menu-navigation-0 a[href]')
    })
    await withViewport({ width: 800, height: 720 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      await page.waitForFunction(() => (window as any).__docpress_hydrationFinished)
      // The dialog's close button gets the focus, and the toggle gets it back, also when it's opened again
      await openWithKeyboard(closeButton)
      await openWithKeyboard(closeButton)
      // Also scrolled down, once the scroll event is past (a scroll of the page closes the menu)
      await page.evaluate(() => window.scrollTo(0, 400))
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await openWithKeyboard(closeButton)
    })
    async function openWithKeyboard(focused: string) {
      await page.focus('.menu-toggle-0')
      await page.keyboard.press('Enter')
      await autoRetry(
        async () => {
          const isOpen = await page.evaluate(
            (focused) =>
              document.documentElement.classList.contains('menu-modal-show') &&
              document.activeElement === document.querySelector(focused),
            focused,
          )
          expect(isOpen).toBe(true)
        },
        { timeout: 5 * 1000 },
      )
      await page.keyboard.press('Escape')
      await autoRetry(
        async () => {
          const isClosed = await page.evaluate(
            () =>
              !document.documentElement.classList.contains('menu-modal-show') &&
              document.activeElement === document.querySelector('.menu-toggle-0'),
          )
          expect(isClosed).toBe(true)
        },
        { timeout: 5 * 1000 },
      )
    }
  })

  test(`${featuresURL} - "Docs" menu wherever the left navigation is hidden`, async () => {
    const isMenuToggleShown = (url: string, width: number) =>
      withViewport({ width, height: 720 }, async () => {
        await page.goto(getServerUrl() + url)
        return await page.isVisible('.menu-toggle-0')
      })
    // Desktop, too narrow for the left navigation
    expect(await isMenuToggleShown(featuresURL, 1040)).toBe(true)
    // Beside the left navigation, the category tabs replace it
    expect(await isMenuToggleShown(featuresURL, 1366)).toBe(false)
    // `hideMenuLeft`
    expect(await isMenuToggleShown('/tiny', 1366)).toBe(true)
  })

  test(`${featuresURL} - "Skip to content" focused on a scrolled page`, async () => {
    await page.goto(getServerUrl() + featuresURL)
    await page.waitForFunction(() => (window as any).__docpress_hydrationFinished)
    await page.evaluate(() => window.scrollTo(0, 800))
    await page.keyboard.press('Tab')
    // The page isn't scrolled back to the top to show it
    const focus = await page.evaluate(() => ({
      isSkipLink: document.activeElement!.matches('.skip-link'),
      scrollY: window.scrollY,
    }))
    expect(focus.isSkipLink).toBe(true)
    expect(focus.scrollY).toBe(800)
  })

  test(`${featuresURL} - the "Menu" toggle's focus ring isn't cut off (phone)`, async () => {
    await withViewport({ width: 390, height: 844 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      await page.focus('.nav-head-menu-toggle')
      const ring = await getFocusRing('.nav-head-menu-toggle .text-menu')
      expect(ring.outlineStyle).toBe('solid')
      expect(ring.clippedBy).toBe('')
    })
  })

  test(`${featuresURL} - the logo lines up with the left navigation's text and the first category tab's icon`, async () => {
    const getLogoLeft = () =>
      page.evaluate(() => document.querySelector('.nav-head-logo img')!.getBoundingClientRect().left)
    await withViewport({ width: 1440, height: 900 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      const navLeftTextLeft = await page.evaluate(() => {
        const range = document.createRange()
        range.selectNodeContents(document.querySelector('#nav-left .nav-item')!)
        return range.getBoundingClientRect().left
      })
      const logoLeft = await getLogoLeft()
      expect(logoLeft).toBe(navLeftTextLeft)
      // The logo doesn't move between pages
      await page.goto(getServerUrl() + '/')
      expect(await getLogoLeft()).toBe(logoLeft)
    })
    // Desktop, too narrow for the left navigation
    await withViewport({ width: 1040, height: 720 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      const left = await page.evaluate(() => {
        const getLeft = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().left
        return { logo: getLeft('.nav-head-logo img'), icon: getLeft('.category-tab-icon') }
      })
      expect(left.icon).toBe(left.logo)
    })
  })

  test(`${featuresURL} - "On this page" below the top bar while the category tabs are hidden`, async () => {
    await withViewport({ width: 1440, height: 900 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      await page.waitForFunction(() => (window as any).__docpress_hydrationFinished)
      // A slide that outlasts the scroll: the rail is measured from where it ends up
      await page.addStyleTag({ content: ':root { --dp-duration-reveal: 60s; }' })
      // Scrolled down (the tabs slide away) until the "Code blocks" section ends 40px below the top bar
      const navHeadHeight = await getNavHeadHeight()
      await page.evaluate(
        (navHeadHeight) =>
          window.scrollTo(
            0,
            document.getElementById('basic')!.getBoundingClientRect().top + window.scrollY - navHeadHeight - 40,
          ),
        navHeadHeight,
      )
      await autoRetry(
        async () => {
          const isCodeBlocksInked = await page.evaluate(() =>
            document.querySelector('.toc-item[href="#code-blocks"]')!.hasAttribute('data-visible'),
          )
          expect(isCodeBlocksInked).toBe(true)
        },
        { timeout: 5 * 1000 },
      )
    })
  })

  test(`${featuresURL} - "On this page" after a jump down`, async () => {
    await withViewport({ width: 1440, height: 900 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      await page.waitForFunction(() => (window as any).__docpress_hydrationFinished)
      // The jump hides the category tabs: above the "Diff" heading, only its top margin is on screen
      await page.click('.toc-item[href="#diff"]')
      await autoRetry(
        async () => {
          const firstInked = await page.evaluate(() =>
            document.querySelector('.toc-item[data-visible]')!.getAttribute('href'),
          )
          expect(firstInked).toBe('#diff')
        },
        { timeout: 5 * 1000 },
      )
    })
  })

  test(`${featuresURL} - category tabs hidden on scroll down, shown on scroll up and on keyboard focus`, async () => {
    await withViewport({ width: 1440, height: 900 }, async () => {
      await page.goto(getServerUrl() + featuresURL)
      await page.waitForFunction(() => (window as any).__docpress_hydrationFinished)
      const isHidden = () => page.evaluate(() => document.documentElement.classList.contains('category-tabs-hidden'))
      const scrollTo = (y: number) => page.evaluate((y) => window.scrollTo(0, y), y)
      const navHeadHeight = await getNavHeadHeight()
      await scrollTo(1200)
      await autoRetry(
        async () => {
          expect(await isHidden()).toBe(true)
          // The strip the tabs leave, 20px below the top bar, is the page's
          const isStripClickable = await page.evaluate(
            (y) => !document.elementFromPoint(700, y)!.closest('header'),
            navHeadHeight + 20,
          )
          expect(isStripClickable).toBe(true)
        },
        { timeout: 5 * 1000 },
      )
      await scrollTo(1199)
      await autoRetry(async () => expect(await isHidden()).toBe(false), { timeout: 5 * 1000 })
      await scrollTo(1500)
      await autoRetry(async () => expect(await isHidden()).toBe(true), { timeout: 5 * 1000 })
      // Tabbing from the top bar's last control into the hidden tabs shows them
      await page.evaluate(() => {
        const controls = document.querySelectorAll<HTMLElement>('.nav-head :is(a[href], button)')
        controls[controls.length - 1]!.focus({ preventScroll: true })
      })
      await page.keyboard.press('Tab')
      await autoRetry(
        async () => {
          const tab = await page.evaluate(() => ({
            isFocused: document.activeElement!.matches('.category-tab'),
            transform: getComputedStyle(document.querySelector('.category-tabs')!).transform,
          }))
          expect(tab.isFocused).toBe(true)
          expect(tab.transform).toBe('none')
        },
        { timeout: 5 * 1000 },
      )
      // The focus ring isn't clipped by the tabs' row (it scrolls sideways)
      expect((await getFocusRing('.category-tab:focus')).clippedBy).toBe('')
    })
  })

  test('client-side navigation', async () => {
    await page.click('.nav-head a[href="/"]')
    await autoRetry(
      async () => {
        await testLandingPageClient()
      },
      { timeout: 5 * 1000 },
    )
  })
}

function getTitleHtml(html: string) {
  const titleHtml = html.match(/<title>(.*?)<\/title>/i)?.[1]
  return titleHtml
}
async function getTitleClient() {
  const titleClient = await page.evaluate(() => window.document.title)
  return titleClient
}

function expectAlgoliaCategory(html: string, category: string, order: number) {
  expect(html.split('algolia:category:order').length).toBe(2)
  expect(html.split('algolia:category"').length).toBe(2)
  expect(html).toContain(
    `<meta name="algolia:category" content="${category}"><meta name="algolia:category:order" content="${order}">`,
  )
}

type Page = typeof page
async function withViewport<T>(size: { width: number; height: number }, fn: () => Promise<T>): Promise<T> {
  const sizeBefore = page.viewportSize()!
  await page.setViewportSize(size)
  const result = await fn()
  await page.setViewportSize(sizeBefore)
  return result
}
async function getNavHeadHeight(): Promise<number> {
  const navHeadHeight = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.nav-head')!).getPropertyValue('--nav-head-height')),
  )
  expect(navHeadHeight > 0).toBe(true)
  return navHeadHeight
}
// The ancestors whose overflow clips the focus ring of `selector`
async function getFocusRing(selector: string) {
  return await page.evaluate((selector) => {
    const element = document.querySelector(selector)!
    const { outlineStyle, outlineOffset, outlineWidth } = getComputedStyle(element)
    const outset = parseFloat(outlineOffset) + parseFloat(outlineWidth)
    const r = element.getBoundingClientRect()
    const clippedBy: string[] = []
    for (let el = element.parentElement; el; el = el.parentElement) {
      const { overflowX, overflowY } = getComputedStyle(el)
      if (overflowX === 'visible' && overflowY === 'visible') continue
      const box = el.getBoundingClientRect()
      const left = box.left + el.clientLeft
      const top = box.top + el.clientTop
      const isInside =
        r.left - outset >= left &&
        r.top - outset >= top &&
        r.right + outset <= left + el.clientWidth &&
        r.bottom + outset <= top + el.clientHeight
      if (!isInside) clippedBy.push(el.className)
    }
    return { outlineStyle, clippedBy: clippedBy.join(', ') }
  }, selector)
}
async function getVisibleText(page: Page, selector: string = 'body'): Promise<string> {
  return await page.evaluate((sel) => {
    function extractVisibleText(element: Element): string {
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return ''
      }

      let text = ''
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          text += child.textContent
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          text += extractVisibleText(child as Element)
        }
      }
      return text
    }

    const root = document.querySelector(sel)
    return root ? extractVisibleText(root).trim() : ''
  }, selector)
}
