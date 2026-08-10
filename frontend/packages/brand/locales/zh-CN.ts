export default {
  noonTool: {
    meta: {
      title: "NoonTool — Noon 卖家的商品上架工具",
      description:
        "NoonTool 是一款 Chrome 浏览器扩展，从 1688 源页抓取商品，解析、翻译（CN → EN / AR）、建图并逐件发布到 Noon UAE 与 Saudi。店铺设置、账号配置与会话 Cookie 全部保留在本地；翻译与图片处理在插件自带的桥接后端完成，该后端不记录账号数据。",
      keywords: ["NoonTool", "1688", "Noon 上架", "Noon UAE", "Noon Saudi", "浏览器扩展"],
    },
    hero: {
      eyebrow: "NoonTool · 浏览器扩展",
      headline: "把 1688 的商品，采集到 Noon",
      subheadline:
        "NoonTool 是 Noon 卖家的商品上架工具：从 1688 源页抓取商品，解析出结构化商品数据，翻译（CN → EN / AR）、建图并逐商品发布到 Noon 平台完成上架（listing）。",
      ctaPrimary: "添加到 Chrome",
      ctaPrimaryHint: "Chrome Web Store 链接待补",
      ctaSecondary: "查看工作流程",
      localeZh: "中文",
      localeEn: "EN",
      screenshotAlt: "NoonTool 主界面截图",
      screenshotCaption: "右侧抽屉、底部 FAB，单条确认到底",
    },
    trust: {
      item1Label: "API Key",
      item1Value: "0",
      item1Note: "不要求、不存储",
      item2Label: "遥测",
      item2Value: "0",
      item2Note: "无埋点、无分析",
      item3Label: "本地配置",
      item3Value: "100%",
      item3Note: "全部留在 chrome.storage.local",
    },
    features: {
      sectionTitle: "五个真正省事的特性",
      sectionSubtitle: "每一项都为「操盘手与运营」的一天而设计",
      items: {
        pipeline: {
          title: "一键 1688 → Noon 上架",
          imageAlt: "源页快照、GoodsList 批次、product/create 链路截图",
          body: "源页快照 → GoodsList 批次 → product/create 链 → activate + warranty 收尾。",
        },
        cart: {
          title: "1688 购物车采集",
          imageAlt: "1688 购物车内多件商品一次性采集的截图",
          body: "在 1688 购物车页一次性勾选多件商品，按选区批量加入 GoodsList，不必逐件打开详情页。下个迭代提供。",
        },
        translate: {
          title: "CN → EN / AR 自动翻译",
          imageAlt: "翻译管线的截图",
          body: "在管线中翻译商品标题、卖点与属性，覆盖 Noon UAE 与 Saudi 两个站点的语言要求。",
        },
        competitor: {
          title: "www.noon.com 跟卖",
          imageAlt: "跟卖任务列表的截图",
          body: "粘贴 Noon 公开商品链接，自动抓取标题、卖点、图片与类目，复制到本地商店作为新草稿。下个迭代提供。",
        },
        serial: {
          title: "批量逐件发布，失败即停",
          imageAlt: "逐件独立 ListingProduct 的截图",
          body: "每件独立 ListingProduct，第一件失败即中止批次，避免后续漏单或错单。",
        },
        ai: {
          title: "Noon 官方分类 AI 预测",
          imageAlt: "FullTypeCategory 类目预测截图",
          body: "FullTypeCategory 自动从 cate_list / official_ai_predict（1688 抓取结果）推导，无需手动挑选类目。",
        },
      },
    },
    how: {
      sectionTitle: "三步走完一批货",
      imageAlt: "抓取、确认、发布三步流程的截图",
      steps: {
        capture: {
          title: "在 1688 源页抓取",
          body: "打开任一 1688 商品详情页，扩展自动抽取结构化字段，加入 GoodsList。",
        },
        confirm: {
          title: "逐条黄色确认",
          body: "右侧抽屉逐条确认、调整价格与货币，Yellow Rarity Rule 保证每一步都清楚。〔Yellow Rarity Rule 命名待产品确认〕",
        },
        publish: {
          title: "逐件发布到 Noon",
          body: "提交到 product/create，激活并登记 warranty；失败即停、可重试。",
        },
      },
    },
    audience: {
      title: "为谁而做",
      body: "对外分发的 Noon 卖家（操盘手与运营），以中文为工作语言，从 1688 采购并在 Noon UAE（ae 站）/ Saudi（sa 站）开店。",
    },
    privacy: {
      sectionTitle: "数据去哪儿了",
      sectionSubtitle: "一目了然的三栏：留在本地、仅上传到 Noon、我们永远不会看到",
      colLocal: "留在本地",
      colEgress: "仅上传到 Noon",
      colNever: "我们永远不会看到",
      local: [
        "noonListingStoreSettings（店铺设置：国家 / partnerCode / warehouseId / 数量 / 质保 / 品牌）",
        "noonConfig（账号与分项配置）",
        "你在 noon.partners 已登录的会话 Cookie（chrome.cookies）",
      ],
      egress: [
        "你提交给 Noon 的商品字段（标题 / 描述 / 属性 / 价格 / 库存）",
        "你提交给 Noon 的图片（处理后的 660×900 JPEG）",
        "你提交给 Noon 的 warranty / activation 请求",
      ],
      never: [
        "你的 Noon 账号密码",
        "任何 API Key 或 OAuth Token",
        "任何遥测、分析、埋点数据",
        "你的浏览历史、不相关站点的 Cookie",
      ],
    },
    permissions: {
      sectionTitle: "权限逐条说明",
      sectionSubtitle: "前台列出 4 项核心；完整 11 项折叠在下方",
      top: {
        storage: {
          name: "storage",
          reason: "把店铺设置与账号配置保存在 chrome.storage.local。",
        },
        cookies: {
          name: "cookies",
          reason: "复用你已在 noon.partners 登录的会话 Cookie，让扩展以你的身份完成上架。",
        },
        activeTab: {
          name: "activeTab",
          reason: "仅在用户点击扩展图标时访问当前 1688 / Noon 标签页。",
        },
        sidePanel: {
          name: "sidePanel",
          reason: "在 Chrome 侧边栏承载 NoonTool 的右侧操作抽屉。",
        },
      },
      fullTitle: "展开完整权限列表",
      full: {
        permissions: {
          scripting: "在用户主动触发时，向 1688 / Noon 页面注入抓取与翻译脚本。",
          tabs: "枚举当前窗口的标签，以定位 1688 源页与 Noon 目标页。",
          storage: "保留店铺设置、账号配置与翻译记忆。",
          cookies: "复用你已在 noon.partners 登录的会话，让扩展以你的身份完成上架。",
          sidePanel: "承载右侧抽屉式操作台。",
          activeTab: "仅在用户主动触发时访问当前标签。",
          declarativeNetRequest: "在白名单 URL 上执行请求改写，确保抓取与发布请求只命中目标域。",
        },
        hosts: {
          noon: "Noon UAE / Saudi 商品与店铺管理界面",
          noonPartners: "Noon Partners 后台（catalog / fbp）",
          noonCdn: "Noon 图片与资源 CDN",
          cdn1688: "1688 商品图片资源域",
          alicom: "1688 主站与登录域",
          alibabaCdn: "1688 静态资源 CDN",
          backend: "插件自带的桥接后端（执行翻译与图片处理，不记录账号）",
        },
      },
    },
    faq: {
      sectionTitle: "常见疑问",
      items: {
        free: {
          q: "NoonTool 是免费的吗？",
          a: "工具本身免费使用。本地配置与 Cookie 仓库都留在你自己的浏览器里，没有订阅费。",
        },
        apiKey: {
          q: "我需要提供 API Key 或 OAuth Token 吗？",
          a: "不需要。NoonTool 通过 content script 桥接到你自己已登录的 Noon 会话（Cookie 通道），完全不接触任何凭据。",
        },
        regions: {
          q: "支持哪些 Noon 站点？",
          a: "目前支持 Noon UAE（ae 站）与 Noon Saudi（sa 站）。其他站点未在产品范围内验证。",
        },
        sources: {
          q: "除了 1688 还支持其它源吗？",
          a: "源站是可插拔的：当前 1688 是已实现实例，其它平台在产品文档中列为计划扩展，尚未承诺上线。",
        },
        data: {
          q: "我的数据存放在哪里？",
          a: "全部在本地：店铺设置走 chrome.storage.local。无服务端账户，无云端同步。",
        },
        translation: {
          q: "翻译质量如何？是否需要二次校对？",
          a: "翻译在管线中自动完成（CN → EN / AR）。高客单价或品牌词建议发布前人工抽检，未承诺自动翻译等价于母语水平。",
        },
        failure: {
          q: "上架失败的商品会怎样？",
          a: "批次内首件失败即停；该件状态在 GoodsList 标红，可单独重试或人工修正后再发布。",
        },
      },
    },
    finalCta: {
      title: "把上架这件事，交还给流程",
      body: "一条黄色确认，抵过一晚的复制粘贴。",
      button: "现在就装上 NoonTool",
      hint: "Chrome Web Store 链接待补",
    },
    footer: {
      tagline: "NoonTool — 把 1688 的商品，安静地搬到 Noon",
      links: {
        privacy: "隐私",
        source: "源码",
        contact: "联系",
      },
      license: "MIT License",
      placeholder: "（待补）",
    },
  },
} as const;
