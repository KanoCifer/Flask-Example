export default {
  noonTool: {
    meta: {
      title: 'Nomu: an easy-to-use Chrome extension for Noon',
      description:
        "Nomu is a Chrome extension that captures 1688 product pages, translates the details (Chinese to English and Arabic), prepares images, and publishes each product to Noon UAE and Saudi. Store settings and account config stay on your machine; translation and image processing run on the tool's own service, which stores no account data.",
      keywords: ['Nomu', '1688', 'Noon listing', 'Noon UAE', 'Noon Saudi', 'browser extension'],
    },
    hero: {
      eyebrow: 'Nomu · Chrome extension',
      headline: 'An easy-to-use',
      headlineTail: 'Noon Chrome extension',
      subheadline:
        'Same 1688 pages you already browse, same Noon stores you already run. Capture, translation, image prep and per-item publishing run as one pipeline, from source page to listed product.',
      ctaPrimary: 'Add to Chrome',
      ctaPrimaryHint: 'Opens the Chrome Web Store listing for a one-click install of Nomu',
      ctaSecondary: 'See what it does',
      ctaDocs: 'Read the docs',
      localeZh: '中文',
      localeEn: 'EN',
      pipeline: {
        capture: 'Capture',
        translate: 'Translate',
        image: 'Image',
        category: 'Category',
        publish: 'Publish',
      },
      screenshotAlt: 'Nomu main interface screenshot',
      screenshotCaption: 'The drawer on the right, one confirmed product at a time',
    },
    positioning: {
      claim1: 'Data stays on your machine',
      claim2: 'No keys · No tracking',
      claim3: 'Publishes one by one · Stops on the first failure',
    },
    features: {
      eyebrow: 'Features',
      sectionTitle: 'Capture products. The extension handles the rest.',
      sectionSubtitle:
        'Every step ships with a sensible default: automatic translation, compliant images and AI category suggestions. Your part is checking the highlights before anything goes out.',
      items: {
        pipeline: {
          title: 'Send 1688 products to Noon',
          imageAlt: 'Screenshot of the one-click capture-to-publish flow',
          body: 'Capture the source page, add it to your batch, then submit for listing, activation and warranty registration in one flow.',
        },
        multiAccount: {
          title: 'Store management in one place',
          imageAlt: 'Screenshot of the multi-store list and switching in the side panel',
          body: 'Keep all your Noon stores in one panel and switch stores to auto-fill the listing settings.',
        },
        translate: {
          title: 'Auto-translate Chinese to English and Arabic',
          imageAlt: 'Screenshot of the translation result',
          body: 'Titles, selling points and attributes are translated automatically, covering both Noon UAE and Saudi.',
        },
        image: {
          title: 'Product images ready to publish',
          imageAlt: 'Screenshot of images being prepared to the 660×900 spec',
          body: "Images are resized onto white backgrounds at Noon's 660×900 spec automatically, so a non-compliant picture never blocks a listing.",
        },
        serial: {
          title: 'Publish one by one, stop on the first problem',
          imageAlt: 'Screenshot of independently published products',
          body: 'Each product publishes on its own. If one fails, the whole batch stops instead of leaving half-published listings behind.',
        },
        ai: {
          title: 'Category suggested automatically',
          imageAlt: 'Screenshot of the suggested Noon category',
          body: "The Noon category is suggested from the 1688 data, so you don't have to pick it by hand.",
        },
      },
    },
    how: {
      eyebrow: 'Workflow',
      sectionTitle: 'Three steps per batch',
      imageAlt: 'Screenshot of the three-step flow: capture, confirm, publish',
      steps: {
        capture: {
          title: 'Capture a 1688 product page',
          body: 'Open any 1688 product page; the extension pulls the details into your batch.',
        },
        confirm: {
          title: 'Confirm one highlighted row at a time',
          body: 'The drawer shows each product for review. Price, currency, translations and category can all be adjusted before anything is submitted.',
        },
        publish: {
          title: 'Publish each product to Noon',
          body: 'Submit the product, activate it and register the warranty. If something fails, the batch stops and you can retry safely.',
        },
      },
    },
    audience: {
      motto: 'Built for Chinese-speaking sellers sourcing on 1688, listing on Noon UAE and Saudi',
    },
    roadmap: {
      eyebrow: 'Roadmap',
      sectionTitle: 'What is on the roadmap next',
      sectionSubtitle:
        'These are the nearest capabilities already on the list. No timelines promised; we move when real demand arrives.',
      status: 'Planned',
      items: {
        sources: {
          title: 'More source platforms',
          body: 'Bring in common sourcing platforms beyond 1688, so a batch can mix sources at once.',
        },
        egypt: {
          title: 'AI fills in everything',
          body: 'Plug in AI to fill out titles, descriptions, attributes and other fields automatically.',
        },
        templates: {
          title: 'Listing templates',
          body: 'Save sensible defaults per category (titles, price ranges, image handling) and reuse them when opening a new store.',
        },
        batchEdit: {
          title: 'AI image generation',
          body: 'Plug in AI image generation to create high-quality ecommerce promo images automatically.',
        },
      },
    },
    privacy: {
      eyebrow: 'Privacy',
      sectionTitle: "A tool that works for you shouldn't ask for blind trust.",
      sectionSubtitle:
        "An extension can touch your store settings and every submission you make. It shouldn't be a black box, so the data flow below is split into three columns you can check at a glance.",
      colLocal: 'Stays on your machine',
      colEgress: 'Only sent to Noon',
      colNever: 'Never seen by us',
      local: [
        'Your store settings (country, partner code, warehouse, quantity, warranty, brand)',
        'Your store records and which store is active',
        'Your product batches and drafts',
      ],
      egress: [
        'Product details (title, description, attributes, price, stock)',
        'Product images (prepared to 660×900)',
        'Warranty and activation requests',
      ],
      never: [
        'Your Noon account password',
        'Any login keys or access tokens',
        'Any tracking, analytics, or telemetry data',
        'Your browsing history or unrelated cookies',
      ],
    },
    permissions: {
      sectionTitle: 'Permissions, explained',
      sectionSubtitle: 'Four core permissions; the sites the tool uses are listed below',
      top: {
        tabs: {
          name: 'Tabs',
          reason: 'Find the Noon page you have open and switch to it.',
        },
        storage: {
          name: 'Storage',
          reason: 'Save your store records, settings and batches in your browser.',
        },
        sidePanel: {
          name: 'Side panel',
          reason: "Show the store-management panel in Chrome's side panel.",
        },
        cookies: {
          name: 'Cookies',
          reason: 'Read and use your cookies to talk to Noon',
        },
      },
      fullTitle: 'Show the full permission list',
      full: {
        hostsTitle: 'Sites the tool uses',
        permissions: {
          tabs: {
            name: 'Tabs',
            reason: 'Find and switch to the Noon page you have open.',
          },
          storage: {
            name: 'Storage',
            reason: 'Save your store records, settings and batches.',
          },
          sidePanel: {
            name: 'Side panel',
            reason: 'Show the store-management panel in the side panel.',
          },
          cookies: {
            name: 'Cookies',
            reason: 'Read and use your cookies to talk to Noon',
          },
        },
        hosts: {
          noon: {
            name: 'Noon website',
            reason: 'Noon UAE / Saudi product and store pages',
          },
          noonPartners: {
            name: 'Noon partner area',
            reason: "Noon's partner management pages (product catalog)",
          },
          noonCdn: {
            name: 'Noon image server',
            reason: "Noon's image and file server",
          },
          cdn1688: {
            name: '1688 image server',
            reason: '1688 product image servers',
          },
          alicom: {
            name: '1688 website',
            reason: '1688 product and login pages',
          },
          alibabaCdn: {
            name: '1688 file server',
            reason: '1688 static file servers',
          },
          backend: {
            name: "Tool's own service",
            reason: 'Handles translation and image processing; stores no account data',
          },
        },
      },
    },
    faq: {
      sectionTitle: 'Frequently asked',
      items: {
        free: {
          q: 'Is Nomu free?',
          a: 'Yes, the tool itself is free. Settings and cookies stay in your own browser; no subscription.',
        },
        apiKey: {
          q: 'Do I need to provide a key or sign in somewhere?',
          a: 'No. Nomu works through your existing Noon login (cookies), so you never have to enter a password or key.',
        },
        regions: {
          q: 'Which Noon regions are supported?',
          a: 'Noon UAE and Noon Saudi today. Other regions are not validated and not promised.',
        },
        sources: {
          q: 'Can I use sources other than 1688?',
          a: 'Both 1688 and noon.com are supported today. Other platforms are planned, but not promised.',
        },
        data: {
          q: 'Where is my data stored?',
          a: "On your machine. Settings are saved in your browser's local storage. No server-side account, no cloud sync.",
        },
        translation: {
          q: 'How good is the translation? Should I proofread?',
          a: "Translation is automatic (Chinese to English and Arabic). For high-value or brand items, do a quick spot-check before publishing; auto-translation isn't guaranteed to be native-level.",
        },
        failure: {
          q: 'What happens if a listing fails?',
          a: 'The batch stops on the first failed item. That item is flagged in the list and can be retried on its own or fixed manually.',
        },
      },
    },
    support: {
      eyebrow: 'Support',
      sectionTitle: 'Stuck? Reach the developer directly.',
      sectionSubtitle:
        'No forum digging. If install, capture or publishing gets stuck, or you have a feature idea, get in touch.',
      viewQr: 'View WeChat QR code',
      channels: {
        wechat: {
          title: 'WeChat (recommended)',
          body: 'Scan the QR code to add me, mention "Nomu". Day-to-day questions and feature requests live here.',
        },
        docs: {
          title: 'Check the docs first',
          body: 'Install failures, updates, common questions: the docs site covers most of it at kanocifer.chat/docs',
        },
        github: {
          title: 'GitHub Issue',
          body: 'Prefer GitHub? Open an issue on the repo with your version number and what happened.',
        },
      },
    },
    finalCta: {
      title: 'Hand listing back to a workflow',
      body: 'You keep browsing 1688 and running your Noon stores as before. What goes away is the copy-paste part.',
      button: 'Add to Chrome',
      hint: 'One-click install from the Chrome Web Store',
    },
    footer: {
      tagline: 'Nomu: an easy-to-use Chrome extension for Noon',
      links: {
        privacy: 'Privacy',
        changelog: 'Changelog',
        support: 'Support',
        docs: 'Docs',
      },
      license: 'AGPL-3.0 License',
      placeholder: '(TBD)',
    },
  },
} as const;
