export default {
  noonTool: {
    meta: {
      title: "NoonTool — Put 1688 products on Noon",
      description:
        "NoonTool is a Chrome extension that captures 1688 product pages, translates the details (Chinese to English and Arabic), prepares images, and publishes each product to Noon UAE and Saudi. Store settings and account config stay on your machine; translation and image processing run on the tool's own service, which stores no account data.",
      keywords: ["NoonTool", "1688", "Noon listing", "Noon UAE", "Noon Saudi", "browser extension"],
    },
    hero: {
      eyebrow: "NoonTool · Chrome extension",
      headline: "Put 1688 products on Noon",
      subheadline:
        "NoonTool helps Noon sellers publish products: capture from a 1688 page, translate (Chinese to English and Arabic), prepare images, and publish each product to Noon — one warm yellow confirm at a time.",
      ctaPrimary: "Add to Chrome",
      ctaPrimaryHint: "Chrome Web Store link TBD",
      ctaSecondary: "See how it works",
      localeZh: "中文",
      localeEn: "EN",
      screenshotAlt: "NoonTool main interface screenshot",
      screenshotCaption: "A side drawer on the right, one yellow confirm per product",
    },
    trust: {
      item1Label: "Keys needed",
      item1Value: "0",
      item1Note: "never asked for, never stored",
      item2Label: "Tracking",
      item2Value: "0",
      item2Note: "no analytics, no tracking",
      item3Label: "Local data",
      item3Value: "100%",
      item3Note: "kept in your browser",
    },
    features: {
      sectionTitle: "Six ways it saves you time",
      sectionSubtitle: "Designed for operators running several stores",
      items: {
        pipeline: {
          title: "One click from 1688 to Noon",
          imageAlt: "Screenshot of the one-click capture-to-publish flow",
          body: "Capture the source page, add it to your batch, submit it, and finish with activation and warranty — all in one flow.",
        },
        multiAccount: {
          title: "Manage several stores in one place",
          imageAlt: "Screenshot of the multi-store list and switching in the side panel",
          body: "Keep all your Noon stores in one panel and switch stores to auto-fill the listing settings.",
        },
        translate: {
          title: "Auto-translate Chinese to English and Arabic",
          imageAlt: "Screenshot of the translation result",
          body: "Titles, selling points and attributes are translated automatically, covering both Noon UAE and Saudi.",
        },
        image: {
          title: "Product images ready to publish",
          imageAlt: "Screenshot of images being prepared to the 660×900 spec",
          body: "Images are resized and cleaned to Noon's spec (660×900, white background) automatically, so non-compliant pictures never block a listing.",
        },
        serial: {
          title: "Publish one by one, stop on the first problem",
          imageAlt: "Screenshot of independently published products",
          body: "Each product is published independently. If one fails, the batch stops — no half-published listings.",
        },
        ai: {
          title: "Category suggested automatically",
          imageAlt: "Screenshot of the suggested Noon category",
          body: "The Noon category is suggested from the 1688 data, so you don't have to pick it by hand.",
        },
      },
    },
    how: {
      sectionTitle: "Three steps per batch",
      imageAlt: "Screenshot of the three-step flow: capture, confirm, publish",
      steps: {
        capture: {
          title: "Capture a 1688 product page",
          body: "Open any 1688 product page; the extension pulls the details into your batch.",
        },
        confirm: {
          title: "Confirm one yellow row at a time",
          body: "The drawer on the right shows each product for review — adjust price, currency and details. One warm yellow confirm keeps every step clear.",
        },
        publish: {
          title: "Publish each product to Noon",
          body: "Submit the product, activate it and register the warranty. If something fails, the batch stops and you can retry safely.",
        },
      },
    },
    audience: {
      title: "Made for this kind of seller",
      body: "Chinese-speaking sellers who source from 1688 and list on Noon UAE and Saudi.",
    },
    privacy: {
      sectionTitle: "Where your data goes",
      sectionSubtitle:
        "At a glance: what stays on your machine, what goes only to Noon, what we never see",
      colLocal: "Stays on your machine",
      colEgress: "Only sent to Noon",
      colNever: "Never seen by us",
      local: [
        "Your store settings (country, partner code, warehouse, quantity, warranty, brand)",
        "Your store records and which store is active",
        "Your product batches and drafts",
      ],
      egress: [
        "The product details you submit to Noon (title, description, attributes, price, stock)",
        "The images you submit to Noon (prepared to 660×900)",
        "The warranty and activation requests you submit to Noon",
      ],
      never: [
        "Your Noon account password",
        "Any login keys or access tokens",
        "Any tracking, analytics, or telemetry data",
        "Your browsing history or unrelated cookies",
      ],
    },
    permissions: {
      sectionTitle: "Permissions, explained",
      sectionSubtitle: "Three core permissions; the sites the tool uses are listed below",
      top: {
        tabs: {
          name: "Tabs",
          reason: "Find the Noon page you have open and switch to it.",
        },
        storage: {
          name: "Storage",
          reason: "Save your store records, settings and batches in your browser.",
        },
        sidePanel: {
          name: "Side panel",
          reason: "Show the store-management panel in Chrome's side panel.",
        },
      },
      fullTitle: "Show the full permission list",
      full: {
        hostsTitle: "Sites the tool uses",
        permissions: {
          tabs: {
            name: "Tabs",
            reason: "Find and switch to the Noon page you have open.",
          },
          storage: {
            name: "Storage",
            reason: "Save your store records, settings and batches.",
          },
          sidePanel: {
            name: "Side panel",
            reason: "Show the store-management panel in the side panel.",
          },
        },
        hosts: {
          noon: {
            name: "Noon website",
            reason: "Noon UAE / Saudi product and store pages",
          },
          noonPartners: {
            name: "Noon partner area",
            reason: "Noon's partner management pages (product catalog)",
          },
          noonCdn: {
            name: "Noon image server",
            reason: "Noon's image and file server",
          },
          cdn1688: {
            name: "1688 image server",
            reason: "1688 product image servers",
          },
          alicom: {
            name: "1688 website",
            reason: "1688 product and login pages",
          },
          alibabaCdn: {
            name: "1688 file server",
            reason: "1688 static file servers",
          },
          backend: {
            name: "Tool's own service",
            reason: "Handles translation and image processing; stores no account data",
          },
        },
      },
    },
    faq: {
      sectionTitle: "Frequently asked",
      items: {
        free: {
          q: "Is NoonTool free?",
          a: "Yes — the tool itself is free. Settings and cookies stay in your own browser; no subscription.",
        },
        apiKey: {
          q: "Do I need to provide a key or sign in somewhere?",
          a: "No. NoonTool works through your existing Noon login (cookies), so you never have to enter a password or key.",
        },
        regions: {
          q: "Which Noon regions are supported?",
          a: "Noon UAE and Noon Saudi today. Other regions are not validated and not promised.",
        },
        sources: {
          q: "Can I use sources other than 1688?",
          a: "1688 is supported today. Other platforms are planned, but not promised.",
        },
        data: {
          q: "Where is my data stored?",
          a: "On your machine. Settings are saved in your browser's local storage. No server-side account, no cloud sync.",
        },
        translation: {
          q: "How good is the translation? Should I proofread?",
          a: "Translation is automatic (Chinese to English and Arabic). For high-value or brand items, do a quick spot-check before publishing — auto-translation isn't guaranteed to be native-level.",
        },
        failure: {
          q: "What happens if a listing fails?",
          a: "The batch stops on the first failed item. That item is flagged in the list and can be retried on its own or fixed manually.",
        },
      },
    },
    finalCta: {
      title: "Hand listing back to a workflow",
      body: "One yellow confirm is worth a whole evening of copy-paste.",
      button: "Install NoonTool now",
      hint: "Chrome Web Store link TBD",
    },
    footer: {
      tagline: "NoonTool — quietly move 1688 goods onto Noon",
      links: {
        privacy: "Privacy",
        source: "Source",
        contact: "Contact",
      },
      license: "MIT License",
      placeholder: "(TBD)",
    },
  },
} as const;
