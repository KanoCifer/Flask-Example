export default {
  noonTool: {
    meta: {
      title: "NoonTool — The listing tool for Noon sellers",
      description:
        "NoonTool is a Chrome browser extension that captures 1688 product pages, parses structured data, translates CN → EN / AR, builds compliant images, and publishes each item to Noon UAE and Saudi. Store settings, account config and session cookies stay on your machine; translation and image processing run on the extension's bundled bridge backend, which stores no account data.",
      keywords: ["NoonTool", "1688", "Noon listing", "Noon UAE", "Noon Saudi", "browser extension"],
    },
    hero: {
      eyebrow: "NoonTool · Browser extension",
      headline: "Move 1688 goods onto Noon",
      subheadline:
        "NoonTool is the listing tool for Noon sellers: capture from a 1688 source, translate (CN → EN / AR), build images and publish each product to Noon — one warm yellow confirm at a time.",
      ctaPrimary: "Add to Chrome",
      ctaPrimaryHint: "Chrome Web Store link TBD",
      ctaSecondary: "See how it works",
      localeZh: "中文",
      localeEn: "EN",
      screenshotAlt: "NoonTool main interface screenshot",
      screenshotCaption: "Right-edge drawer, bottom-right pill FAB, one yellow confirm per item",
    },
    trust: {
      item1Label: "API keys",
      item1Value: "0",
      item1Note: "never asked for, never stored",
      item2Label: "Telemetry",
      item2Value: "0",
      item2Note: "no analytics, no tracking",
      item3Label: "Local config",
      item3Value: "100%",
      item3Note: "kept in chrome.storage.local",
    },
    features: {
      sectionTitle: "Five things that actually save time",
      sectionSubtitle: "Built around the day of an operator running multiple stores",
      items: {
        pipeline: {
          title: "One-click 1688 → Noon listing",
          imageAlt: "Screenshot of source snapshot, GoodsList batch, and the product/create chain",
          body: "Source snapshot → GoodsList batch → product/create chain → activate + warranty close-out.",
        },
        cart: {
          title: "1688 cart capture",
          imageAlt: "Screenshot of capturing multiple 1688 cart items at once",
          body: "Pick several items on a 1688 cart page and pull them into the GoodsList as a batch — no per-detail-page clicks. Coming in the next release.",
        },
        translate: {
          title: "CN → EN / AR auto-translation",
          imageAlt: "Screenshot of the translation pipeline",
          body: "Translate titles, selling points and attributes inline for both Noon UAE and Saudi.",
        },
        competitor: {
          title: "www.noon.com competitor scraping",
          imageAlt: "Screenshot of the competitor-watch task list",
          body: "Paste a public Noon product link and auto-pull title, selling points, images and category into a local draft. Coming in the next release.",
        },
        serial: {
          title: "Serial batch, fail-fast",
          imageAlt: "Screenshot of independent ListingProduct entries",
          body: "One independent ListingProduct per run. The first failure halts the batch — no half-published listings.",
        },
        ai: {
          title: "Noon-compliant category AI",
          imageAlt: "Screenshot of FullTypeCategory prediction",
          body: "FullTypeCategory predicted from cate_list / official_ai_predict (1688 capture output); no hand-picked taxonomies.",
        },
      },
    },
    how: {
      sectionTitle: "Three steps per batch",
      imageAlt: "Screenshot of the three-step flow: capture, confirm, publish",
      steps: {
        capture: {
          title: "Capture from a 1688 source page",
          body: "Open any 1688 product detail; the extension extracts structured fields and adds them to the GoodsList.",
        },
        confirm: {
          title: "Confirm one yellow row at a time",
          body: "The right-edge drawer shows each item for review — adjust price, currency, attributes. Yellow Rarity Rule keeps every step clear. [Yellow Rarity Rule naming pending product confirmation]",
        },
        publish: {
          title: "Publish each item to Noon",
          body: "Submit to product/create, activate, register warranty. Fail-fast with safe retry.",
        },
      },
    },
    audience: {
      title: "Built for this operator",
      body: "External Noon sellers (operators and store leads) working in Chinese, sourcing from 1688 and listing on Noon UAE (ae) / Saudi (sa).",
    },
    privacy: {
      sectionTitle: "Where your data goes",
      sectionSubtitle:
        "Three columns at a glance: stays local, only goes to Noon, never seen by us",
      colLocal: "Stays on your machine",
      colEgress: "Only sent to Noon",
      colNever: "Never seen by us",
      local: [
        "noonListingStoreSettings (country / partnerCode / warehouseId / quantity / warranty / brand)",
        "noonConfig (account and per-store configuration)",
        "Your already-logged-in noon.partners session cookie (chrome.cookies)",
      ],
      egress: [
        "Product fields you submit to Noon (title / description / attributes / price / stock)",
        "Images you submit to Noon (processed 660×900 JPEG)",
        "Warranty / activation requests you submit to Noon",
      ],
      never: [
        "Your Noon account password",
        "Any API key or OAuth token",
        "Any telemetry, analytics, or tracking data",
        "Your browsing history or unrelated cookies",
      ],
    },
    permissions: {
      sectionTitle: "Permissions, line by line",
      sectionSubtitle: "Four core permissions up top; all 11 in the collapsed list below",
      top: {
        storage: {
          name: "storage",
          reason: "Persist store settings and account configuration in chrome.storage.local.",
        },
        cookies: {
          name: "cookies",
          reason: "Reuse your already-logged-in noon.partners session cookie so the extension can list on your behalf.",
        },
        activeTab: {
          name: "activeTab",
          reason: "Only access the current 1688 / Noon tab when you actively click the icon.",
        },
        sidePanel: {
          name: "sidePanel",
          reason: "Host NoonTool's right-edge drawer inside Chrome's side panel.",
        },
      },
      fullTitle: "Show the full permission list",
      full: {
        permissions: {
          scripting:
            "Inject capture / translate scripts into 1688 / Noon pages only on explicit user trigger.",
          tabs: "Enumerate tabs to locate 1688 source pages and Noon target pages.",
          storage: "Persist store settings, account configuration and translation memory.",
          cookies: "Reuse your already-logged-in noon.partners session so the extension can list on your behalf.",
          sidePanel: "Host the right-edge drawer console.",
          activeTab: "Only access the active tab on explicit trigger.",
          declarativeNetRequest:
            "Rewrite requests on the URL whitelist so capture and publish only hit target domains.",
        },
        hosts: {
          noon: "Noon UAE / Saudi storefront and partner management surfaces",
          noonPartners: "Noon Partners backend (catalog / fbp)",
          noonCdn: "Noon image and asset CDN",
          cdn1688: "1688 product image asset domains",
          alicom: "1688 storefront and login domains",
          alibabaCdn: "1688 static asset CDN",
          backend:
            "Plugin-built bridge backend (translation and image processing; no account data stored)",
        },
      },
    },
    faq: {
      sectionTitle: "Frequently asked",
      items: {
        free: {
          q: "Is NoonTool free?",
          a: "Yes — the tool itself is free. Settings and cookie jars stay in your own browser; no subscription.",
        },
        apiKey: {
          q: "Do I need to provide an API key or OAuth token?",
          a: "No. NoonTool bridges into your already-logged-in Noon session via a content-script cookie channel. It never touches credentials.",
        },
        regions: {
          q: "Which Noon regions are supported?",
          a: "Noon UAE (ae) and Noon Saudi (sa) today. Other regions are not validated and not promised.",
        },
        sources: {
          q: "Do you support sources other than 1688?",
          a: "Sources are pluggable: 1688 is the live implementation. Other platforms are listed as planned in the product doc; nothing is committed.",
        },
        data: {
          q: "Where is my data stored?",
          a: "Locally. Store settings go to chrome.storage.local. No server-side profile, no cloud sync.",
        },
        translation: {
          q: "How good is the translation? Should I proofread?",
          a: "Translation runs inline (CN → EN / AR). High-value SKUs and brand terms should be spot-checked — auto-translation is not promised at native level.",
        },
        failure: {
          q: "What happens if a listing fails?",
          a: "The batch stops on the first failed item. The failed row is flagged in the GoodsList and can be retried singly or fixed manually.",
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
