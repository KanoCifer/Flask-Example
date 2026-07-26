# Domain Context

kanocifer.chat是一个个人阅读追踪 + 博客系统，名称源于日语 "kuro neko"（黑猫）。

## Stack

- Backend: FastAPI
- Go Backend: Gin
- Desktop frontend: Vue 3.5 (`frontend/apps/vue-app/`)
- Mobile frontend: React 19 (`frontend/apps/react-app/`)
- Task queue: Taskiq + RabbitMQ

## Domain Glossary

| 术语              | 含义                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| User              | 系统用户，支持密码/Passkey/GitHub OAuth 三种认证方式。`ADMIN_USER_IDS`（默认 `[1, 2]`）为管理员 |
| Profile           | 用户个人资料，与 User 一对一关联（PostgreSQL）                                                  |
| Post              | 博客文章（MongoDB），Markdown 正文、分类、评论（Twikoo）、点赞、浏览量（views）                 |
| Moment (碎碎念)   | 轻量动态（MongoDB），类似 Twitter。支持图片/链接/书籍/引用附件、标签、心情、定位、可见性控制    |
| Subscription      | 付费订阅追踪（PostgreSQL），账单周期、月度费用、多渠道到期提醒（Email/Bark/飞书）               |
| Device            | 设备资产跟踪（PostgreSQL），里程碑提醒（100 天/1 年等）、成本分析                               |
| FishingRecord     | 钓鱼记录（MongoDB），天气/潮汐/用户反馈 + 专家评分（9 特征加权）+ ML 残差校准（Ridge 回归）     |
| FishingModelMeta  | 钓鱼 ML 模型元数据（MongoDB），版本/训练时间/权重持久化                                         |
| WeRead (微信读书) | 外部书源（MongoDB），用户通过 token 导入书架。`WereadBook`/`UserBook`/`Archive` 文档模型        |
| RssArticle        | RSS 订阅文章（MongoDB），聚合/已读标记                                                          |
| Changelog         | 版本更新日志（MongoDB），双端通过 API 读取                                                      |
| DevTask           | 开发任务看板（MongoDB），Kanban 三列排序                                                        |
| FriendLinks       | 友链（MongoDB），每日精选轮换                                                                   |
| GalleryImage      | 图库图片，PostgreSQL `pic` 表 + Redis 缓存，瀑布流展示                                          |
| Event             | 系统事件（PostgreSQL `event` 表），承载 startup / deploy / notify_failure 等业务事件            |
| Admin             | 非角色系统。硬编码 `user.id in ADMIN_USER_IDS` 为管理员，用于内容审核、部署触发、系统监控       |
