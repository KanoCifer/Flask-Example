import { motion } from 'framer-motion';

export default function PrivacyPolicyView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-page/95 mb-20 flex h-full w-full flex-col items-center px-4 py-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="/60 bg-page/80 w-full max-w-2xl rounded-2xl border p-6 shadow-sm backdrop-blur-sm md:p-10"
      >
        <article className="text-muted space-y-7 text-base leading-relaxed">
          {/* 标题 */}
          <header className="space-y-2">
            <h1 className="text-ink text-2xl font-bold">隐私政策</h1>
            <p className="text-muted text-sm">
              更新日期：2026 年 5 月 16 日 &nbsp;·&nbsp; 生效日期：2026 年 05 月
              16 日
            </p>
          </header>

          {/* 引言 */}
          <p>
            欢迎来到
            <strong className="text-ink">Kuroome's Blog</strong>
            （以下简称"本站"）。本站非常重视您的隐私和个人信息保护。您在使用网站时，可能会收集和使用您的相关信息。通过本页面向您说明在您访问本站时，本站是如何收集、使用、保存、共享和转让这些信息。
          </p>

          {/* 信息收集与使用 */}
          <section className="space-y-4">
            <h2 className="text-ink text-lg font-semibold">信息收集与使用</h2>

            <div className="space-y-2">
              <h3 className="text-muted font-medium">在您访问时</h3>
              <blockquote className="border-accent/30 bg-accent/10 text-muted border-l-3 py-2 pl-4 italic">
                <p>在访问时，收集访问信息的服务会收集不限于以下信息：</p>
              </blockquote>
              <ul className="list-disc space-y-1 pl-6">
                <li>
                  <strong className="text-ink">网络身份标识信息</strong>
                  （浏览器 UA、IP 地址等）
                </li>
                <li>
                  <strong className="text-ink">设备信息</strong>
                  （设备型号、设备操作系统等）
                </li>
                <li>
                  <strong className="text-ink">浏览过程</strong>
                  （操作方式、浏览方式与时长、性能与网络加载情况等）
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-muted font-medium">在您注册 / 评论时</h3>
              <blockquote className="border-accent/30 bg-accent/10 text-muted border-l-3 py-2 pl-4 italic">
                <p>
                  在您注册账户或发表评论时，本站会通过以下途径获取您的相关信息：
                </p>
              </blockquote>
              <ul className="list-disc space-y-1 pl-6">
                <li>
                  <strong className="text-ink">您的邮箱</strong> —
                  用于账户注册、密码重置和回复通知（不会公开）
                </li>
                <li>
                  <strong className="text-ink">您的用户名</strong> —
                  用于公开显示的用户身份标识
                </li>
                <li>
                  <strong className="text-ink">您的头像</strong> — 通过 Gravatar
                  服务获取，基于您注册时使用的邮箱
                </li>
                <li>
                  <strong className="text-ink">您的网址</strong> —
                  如果您选择填写，将用于头像点击跳转
                </li>
                <li>
                  <strong className="text-ink">您的 IP 地址</strong> —
                  用于反垃圾评论和恶意用户识别（不会公开 IP 地址）
                </li>
                <li>
                  <strong className="text-ink">您的浏览器代理</strong> —
                  用于展示系统版本、浏览器版本，方便快速定位问题
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-muted font-medium">
                如何使用 Cookies 和本地存储
              </h3>
              <p>
                本站为实现用户认证、深色模式切换、偏好设置等功能，会在您的浏览器中进行本地存储（包括
                Cookies 和 LocalStorage）。您可以随时清除浏览器中保存的所有
                Cookies 以及
                LocalStorage，不会影响您的正常使用（但需要重新登录）。
              </p>
              <p className="text-sm">
                详情参考
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  className="text-ink hover:underline"
                >
                  在 Chrome 中删除、允许和管理 Cookie
                </a>
              </p>
            </div>
          </section>

          {/* 信息的分享和披露 */}
          <section className="space-y-2">
            <h2 className="text-ink text-lg font-semibold">信息的分享和披露</h2>
            <p>
              本站不会出售、交易或出租您的个人身份信息给外部的公司或个人，除非得到您的许可、需要遵从法律要求、保护本站的权利和财产或在紧急情况下保护个人安全。
            </p>
          </section>

          {/* 第三方服务 */}
          <section className="space-y-2">
            <h2 className="text-ink text-lg font-semibold">第三方服务</h2>
            <p>本站使用以下第三方服务，它们可能收集您的相关信息：</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong className="text-ink">Gravatar</strong> —
                用于获取您的头像
              </li>
              <li>
                <strong className="text-ink">GitHub OAuth</strong> —
                用于第三方登录（仅在您选择使用时）
              </li>
            </ul>
          </section>

          {/* 第三方网站 */}
          <section className="space-y-2">
            <h2 className="text-ink text-lg font-semibold">第三方网站</h2>
            <p>
              本站可能包含指向其他网站的链接。本站不对这些第三方网站的隐私政策或内容负责，请您在离开本站访问其他网站时阅读其隐私政策。
            </p>
          </section>

          {/* 安全性 */}
          <section className="space-y-2">
            <h2 className="text-ink text-lg font-semibold">安全性</h2>
            <p>
              本站采取适当的安全措施，包括数据加密传输（HTTPS）、密码哈希存储、JWT
              令牌认证等，以保护存储在本站系统中的个人信息不受未经授权的访问或泄露。
            </p>
          </section>

          {/* 附属协议 */}
          <section className="space-y-2">
            <h2 className="text-ink text-lg font-semibold">附属协议</h2>
            <p>
              当本站监测到存在恶意访问、恶意请求、恶意攻击、恶意评论的行为时，为了防止增大受害范围，可能会临时将您的
              IP 地址及访问信息短期内添加到黑名单，短期内禁止访问。
            </p>
            <p>
              此黑名单可能会被公开，并可能共享给其他站点使用，包括但不限于：IP
              地址、设备信息、地理位置等。
            </p>
          </section>

          {/* 隐私政策的变更 */}
          <section className="space-y-2">
            <h2 className="text-ink text-lg font-semibold">隐私政策的变更</h2>
            <p>
              本站保留随时更新或更改本隐私政策的权利。本隐私政策最新的修订日期将会在本页顶部显示。
            </p>
          </section>

          {/* 联系本站 */}
          <section className="space-y-2">
            <h2 className="text-ink text-lg font-semibold">联系本站</h2>
            <p>如果您对本隐私政策有任何疑问，请通过以下方式与本站取得联系：</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                GitHub：
                <a
                  href="https://github.com/KanoCifer"
                  target="_blank"
                  className="text-ink hover:underline"
                >
                  KanoCifer
                </a>
              </li>
              <li>
                邮箱：
                <a
                  href="mailto:kano3255@outlook.com"
                  className="text-ink hover:underline"
                >
                  kano3255@outlook.com
                </a>
              </li>
            </ul>
          </section>
        </article>
      </motion.div>
    </motion.div>
  );
}
