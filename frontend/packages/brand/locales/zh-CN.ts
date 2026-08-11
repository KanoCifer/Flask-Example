export default {
  noonTool: {
    meta: {
      title: "NoonTool — 把 1688 的商品发到 Noon",
      description:
        "NoonTool 是一款 Chrome 浏览器扩展，帮你从 1688 采集商品，自动整理标题、价格和图片，翻译成英文和阿拉伯语，再逐件发布到 Noon 阿联酋和沙特站。店铺设置全部保存在本地；翻译和图片处理在扩展自带的服务里完成，不记录任何账号数据。",
      keywords: ["NoonTool", "1688", "Noon 上架", "Noon UAE", "Noon Saudi", "浏览器扩展"],
    },
    hero: {
      eyebrow: "NoonTool · Chrome 浏览器扩展",
      headline: "把 1688 的商品，发到 Noon",
      subheadline:
        "NoonTool 是 Noon 卖家的上架工具：从 1688 采集商品，自动翻译成英文和阿拉伯语、整理好图片，再逐件发布到 Noon 平台。",
      ctaPrimary: "添加到 Chrome",
      ctaPrimaryHint: "Chrome Web Store 链接待补",
      ctaSecondary: "查看工作流程",
      localeZh: "中文",
      localeEn: "EN",
      screenshotAlt: "NoonTool 主界面截图",
      screenshotCaption: "右侧抽屉，一条黄色确认到底",
    },
    trust: {
      item1Label: "需要提供的密钥",
      item1Value: "0",
      item1Note: "不需要，也不会保存",
      item2Label: "数据追踪",
      item2Value: "0",
      item2Note: "无埋点、无统计",
      item3Label: "本地数据",
      item3Value: "100%",
      item3Note: "全部留在你的浏览器里",
    },
    features: {
      sectionTitle: "六个真正省事的特性",
      sectionSubtitle: "每一项都为「操盘手与运营」的一天而设计",
      items: {
        pipeline: {
          title: "一键把 1688 商品发到 Noon",
          imageAlt: "一键采集到发布全流程的截图",
          body: "采集源页、加入待发布列表、提交上架、激活并登记质保，一气呵成。",
        },
        multiAccount: {
          title: "多店铺集中管理",
          imageAlt: "侧栏多店铺列表与切换的截图",
          body: "在同一个面板里管理多家 Noon 店铺，切换店铺时自动填好上架设置。",
        },
        translate: {
          title: "中译英 / 阿 自动翻译",
          imageAlt: "翻译结果的截图",
          body: "标题、卖点与商品属性自动翻译，覆盖阿联酋与沙特两个站点。",
        },
        image: {
          title: "图片自动处理成可上架",
          imageAlt: "商品图按 660×900 规格处理的截图",
          body: "商品图自动调整为 Noon 要求的尺寸和白底（660×900），不合格的图片不会导致上架被拒。",
        },
        serial: {
          title: "逐件发布，出错即停",
          imageAlt: "逐件独立发布的商品截图",
          body: "每件商品独立发布；第一件失败就停止整个批次，不会出现一半上架、一半漏掉的情况。",
        },
        ai: {
          title: "自动推荐 Noon 类目",
          imageAlt: "自动推荐的 Noon 类目截图",
          body: "根据 1688 抓取到的信息自动推荐 Noon 类目，不用手动挑选。",
        },
      },
    },
    how: {
      sectionTitle: "三步走完一批货",
      imageAlt: "采集、确认、发布三步流程的截图",
      steps: {
        capture: {
          title: "在 1688 商品页一键采集",
          body: "打开任意 1688 商品详情页，扩展会自动把商品信息加入待发布列表。",
        },
        confirm: {
          title: "逐条确认，黄色高亮",
          body: "右侧抽屉里逐条核对商品，可调整价格、币种和商品属性；一条黄色确认到底，每一步都清楚。",
        },
        publish: {
          title: "逐件发布到 Noon",
          body: "提交商品、激活并登记质保；失败即停，可安全重试。",
        },
      },
    },
    audience: {
      title: "为谁而做",
      body: "面向外部客户的 Noon 卖家（操盘手与运营），以中文为工作语言，从 1688 采购，在 Noon 阿联酋和沙特站上架。",
    },
    privacy: {
      sectionTitle: "你的数据去了哪里",
      sectionSubtitle: "三栏一目了然：留在本地、只发给 Noon、我们永远不会看到",
      colLocal: "留在本地",
      colEgress: "只发给 Noon",
      colNever: "永远不会看到",
      local: [
        "你的店铺设置（国家、合作方代码、仓库、数量、质保、品牌）",
        "你的店铺记录与当前使用的店铺",
        "你的商品批次草稿",
      ],
      egress: [
        "你提交给 Noon 的商品信息（标题、描述、属性、价格、库存）",
        "你提交给 Noon 的商品图片（已处理为 660×900）",
        "你提交给 Noon 的质保与激活请求",
      ],
      never: [
        "你的 Noon 账号密码",
        "任何密钥或登录授权",
        "任何追踪、统计、埋点数据",
        "你的浏览历史或不相关网站的 Cookie",
      ],
    },
    permissions: {
      sectionTitle: "权限说明",
      sectionSubtitle: "三项核心权限；用到的网站列在下面",
      top: {
        tabs: {
          name: "标签页",
          reason: "找到你已打开的 Noon 页面并切换过去。",
        },
        storage: {
          name: "本地存储",
          reason: "把你的店铺记录、设置与批次草稿保存在浏览器里。",
        },
        sidePanel: {
          name: "侧边栏",
          reason: "在 Chrome 侧边栏里显示 NoonTool 的店铺管理面板。",
        },
      },
      fullTitle: "展开完整权限列表",
      full: {
        hostsTitle: "工具会用到的网站",
        permissions: {
          tabs: {
            name: "标签页",
            reason: "找到并切换到已打开的 Noon 页面。",
          },
          storage: {
            name: "本地存储",
            reason: "保存店铺记录、设置与批次草稿。",
          },
          sidePanel: {
            name: "侧边栏",
            reason: "显示侧边栏店铺管理面板。",
          },
        },
        hosts: {
          noon: {
            name: "Noon 网站",
            reason: "Noon 阿联酋 / 沙特站的商品与店铺页面",
          },
          noonPartners: {
            name: "Noon 合作方后台",
            reason: "Noon 的合作方管理页面（商品目录）",
          },
          noonCdn: {
            name: "Noon 图片服务",
            reason: "Noon 的图片与文件服务器",
          },
          cdn1688: {
            name: "1688 图片服务",
            reason: "1688 商品图片的服务器",
          },
          alicom: {
            name: "1688 网站",
            reason: "1688 的商品与登录页面",
          },
          alibabaCdn: {
            name: "1688 文件服务",
            reason: "1688 的静态文件服务器",
          },
          backend: {
            name: "扩展自带服务",
            reason: "负责翻译与图片处理，不记录任何账号数据",
          },
        },
      },
    },
    faq: {
      sectionTitle: "常见疑问",
      items: {
        free: {
          q: "NoonTool 是免费的吗？",
          a: "工具本身免费使用。设置与登录信息（Cookie）都留在你自己的浏览器里，没有订阅费。",
        },
        apiKey: {
          q: "我需要提供任何密钥或登录授权吗？",
          a: "不需要。NoonTool 通过你已登录的 Noon 会话（Cookie）直接操作，你完全不用输入密码或密钥。",
        },
        regions: {
          q: "支持哪些 Noon 站点？",
          a: "目前支持 Noon 阿联酋站与沙特站。其他站点未在范围内验证，暂不承诺。",
        },
        sources: {
          q: "除了 1688 还支持其它源吗？",
          a: "目前支持 1688。其它平台在计划中，但尚未承诺上线。",
        },
        data: {
          q: "我的数据存放在哪里？",
          a: "全部存在本地浏览器里：没有服务器账户，也没有云端同步。",
        },
        translation: {
          q: "翻译质量如何？是否需要二次校对？",
          a: "翻译自动完成（中译英 / 阿）。高客单价或品牌商品建议发布前人工抽检，自动翻译不保证等同于母语水平。",
        },
        failure: {
          q: "上架失败的商品会怎样？",
          a: "批量发布中第一件失败即停止；失败的商品会在列表中标出，可单独重试或手动修改后再发布。",
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
