# FanPass Ongoing Build Journey

Last updated: 2026-07-25 (Asia/Shanghai).

## 1. 记录范围

这是一份持续更新的在建项目记录。FanPass 尚未完成商业落地，本文件不提前把它定义为成功或失败，也不是逐条聊天转录。

本次回填依据：

- `archive/school-project/docs/FANPASS_REPORT.md` 保存的早期构想和商业分析；
- 2026-05-30 至 2026-07-23 的全部 144 个 Git 提交；
- 当前产品、架构、安全、QA、部署、成本和证据文档；
- 已写入 Handoff 的模拟器、实体设备、浏览器和 Staging 验证；
- Owner 在开发过程中报告的真实故障、截图和产品判断。

Git 是逐变更原始记录，本文件负责保留“目标 -> 尝试 -> 遇到的问题 -> 判断变化 -> 当前结果 -> 下一步”。没有持久证据的口头过程不会被写成已验证事实。

### 持续更新约定

- 每次有意义的产品、设计、工程、部署或运营工作结束后，追加一条简短进展；
- 同一主题积累到一个阶段后，再把零散进展合并成阶段总结，但保留 Git 原始历史；
- 技术故障可以记录为故障，不把一次故障上升为整个项目的失败结论；
- 同时记录“做了什么”和“为什么改变判断”，不只记录最终代码；
- 当前进行中的事项必须明确标注，不把方案、Local 验证或 Staging 验证写成正式上线；
- 后续 Codex 工作把更新本文件作为固定收尾动作，而不是等项目结束后再补写。

## 2. 从一个想法开始：票务不是一张 NFT

早期构想已经包含 NFT/SBT 票、可追溯转让、订单簿和粉丝任务。真正重要的第一次产品转向，是没有把项目描述成“链上炒票市场”，而是定义为主办方授权、粉丝友好、受控转售、透明价格和现场验证的一体化票务产品。

早期研究也暴露了第一个通用教训：看起来最酷的技术名词，不等于用户真正购买的价值。用户需要的是票是真的、价格可解释、转让可控、入场可靠；Web3 只能在它能提高证明和可移植性时出现。

保留下来的产品原则：

- 票不是完全同质化资产，活动、日期、票种、座位和权益都会影响交易；
- 主销售、转售、支付、所有权和核销是一条状态链，不是五个独立页面；
- Fan Access 的目标是公平分配，而不是制造任务农场；
- 主办方、粉丝和现场员工需要不同产品面和权限。

证据：[学校项目报告](../../archive/school-project/docs/FANPASS_REPORT.md)、[Beta Roadmap](../BETA_ROADMAP.md)。

## 3. 2026-05-30：一次性生成了很大的 Beta Foundation

首个 Git 提交 `f20becf` 一次加入 271 个文件和约 80,382 行，已经包含 NestJS/Prisma、Console、SwiftUI、智能合约、大量安全脚本和证据文档。

这证明 AI 可以非常快地建立一个完整形状，也留下长期教训：

- “项目看起来很大”不等于真实用户路径已经跑通；
- 大量脚手架会让人误以为 Alpha/Beta 已经接近完成；
- 如果不先指定当前产品真相、领域状态和退出门，后续会花很多时间区分 Mock、历史代码、真实实现和证据占位符；
- 自动化审计只有在绑定当前代码和真实证据时才有价值。

这一步后来演化出 `README -> HANDOFF -> ARCHITECTURE -> ROADMAP -> TASKS -> QA` 的最小文档骨架。

## 4. 2026-05-31 至 2026-06-07：第一次从“本地能跑”走向 Staging

阶段目标：Render API、Vercel/Render Console、Neon PostgreSQL、Hosted CI 和 Privy 可行性。

主要经历：

- API 上 Render，Console 最初走 Vercel，随后为了 BFF 和运行时边界迁到 Render；
- 固定 Node 运行时，补 Prisma 生成顺序和 CI 类型问题；
- 建立部署证据、Security Headers、脱敏、Admin 健康和 Provider 边界检查；
- Privy SDK 被隔离，避免把不适合的依赖直接带进整个生产运行时；
- Console 从 Next 逐步形成退出计划，最终迁为更小的 Vite BFF 运行时。

最重要的经验不是“选了哪个云”，而是：

1. 本地通过不能证明部署配置正确；
2. 供应商价格、计划功能和 SDK 边界会反过来影响架构；
3. Staging 证据必须关联 HTTPS URL、部署版本、环境和脱敏要求；
4. 免费路径适合证明可部署，不等于适合真实用户长期依赖。

代表提交：`8a03f3c`、`21a0315`、`afc92d2`、`2fd850e`、`ee0c0ec`。

## 5. 2026-06-12 至 2026-06-14：支付、票、动态二维码开始成为真实状态链

阶段目标：让 Stripe 授权、订单结算、所有权同步、票码和 iOS 真机不再是互相独立的演示。

遇到的问题：

- 支付完成不代表本地订单已经安全结算；
- Webhook 可能延迟、重复或在进程重启后到达；
- 动态二维码的生命周期不能只由客户端倒计时决定；
- Staging 活动目录和 Stripe Catalog 可能不同步；
- UI 很容易先展示“成功”，后端实际仍处于待处理或失败。

形成的方案：

- 数据库 Outbox 和可恢复 Worker 处理支付/所有权副作用；
- 幂等键、签名验证、状态迁移和失败补偿成为必需；
- 动态票码由后端签发，包含版本、过期、Nonce 和 Owner 绑定；
- 真机安装、Render 部署和 API 验证一起作为证据；
- 用户界面只展示后端已经确认的结果。

代表提交：`d2a0767`、`1e7a86f`、`f2fb60c`、`ce09fea`、`8cd9297`。

可复制经验：先画状态机和失败补偿，再接 Payment Sheet；否则“支付成功页面”会掩盖最危险的问题。

## 6. 2026-06-15 至 2026-06-16：链上证明、入场和硬件边界被重新认识

阶段目标：把 Sepolia 所有权证明、FanPass Ops、二维码/NFC 和闸机原型连接起来。

关键转向：

- 用户不需要在票详情页看到全部区块链术语，只需要可信且可解释的证明；
- 入场必须以快速、稳定、可撤销的二维码为通用路径；
- NFC 受 Apple 权限、设备能力和现场硬件影响，不能当成发布的唯一入口；
- 智能合约操作不能让应用服务器长期持有裸私钥；
- 核销权威仍然是后端事务，链上记录不是闸机并发锁。

硬件原型、NDEF 和闸机代码后来被保留为学校项目档案，不再绑架商业 App 的发布路径。这是一次重要的范围管理：保存探索价值，但让产品依赖现实平台能力。

代表提交：`302bce1`、`d02745b`、`a90f2b8`、`a9b4c73`、`edf8844`。

## 7. 2026-06-22 至 2026-06-29：Sponsored USDC 让“Web3 抽象”接受现实检验

阶段目标：让用户不需要理解 Gas 和复杂钱包操作也能使用 USDC 支付/所有权路径。

经历过的迭代：

- HKD/USDC 汇率来源和报价过期保护；
- 预取报价和 Sponsor Wallet fallback；
- Wallet ID 同步、JWT 交换和授权边界；
- Node WebCrypto/HPKE 兼容；
- 交易哈希、Receipt Event、网络确认等待和失败日志；
- Sponsor 余额不足、Provider 错误和客户端钱包回退。

这段经历说明：Web3 的用户体验复杂度不会消失，只会被产品、后端和运维吸收。想让普通用户无感，团队就必须承担网络、Gas、报价、最终性、钱包授权、资金补充和客服解释。

最终原则：链上路径必须是适配器；订单和票状态不能仅凭客户端发出的交易哈希变成成功。

代表提交：`bf261ef` 至 `40bad65`，以及 `7f3fd9c`、`b2c0b69`。

## 8. 2026-07-07：长会话、远端状态和跨设备一致性

阶段目标：解决用户登录保持、Listing 权限、远端核销状态和闸机串口噪声。

实际问题把“客户端显示什么”与“后端真实是什么”的差距暴露出来：

- App 重启后会话需要恢复，但过期和 401 也需要统一策略；
- 一台设备核销后，另一台设备不能继续显示可用票码；
- 市场上架必须验证已登录用户确实拥有可出售票；
- 设备串口/扫描噪声不能误触发核销。

形成的规则：远端票状态优先；核销与 Used 状态在后端一次性事务中完成；客户端只缓存可恢复展示，不缓存业务最终权威。

代表提交：`005aaf1`、`20d410d`、`fc89b7a`、`f84dc46`。

## 9. 2026-07-12：从“功能多”转向“真实商业路径”

这是项目最密集的一次产品化转折。

### 9.1 转售并发与补偿

好友的真实 Sell Ask 开始可以被另一台设备购买，同时买家争夺同一张票时必须只有一个成功。修复从客户端判断转向 PostgreSQL 行锁、`pg_advisory_xact_lock`、原子状态迁移和支付补偿。

教训：凡是涉及最后一张票、最后一个名额、同一优惠或同一兑换码，都要用数据库不变量和并发测试证明，不能靠按钮禁用。

### 9.2 高需求开售

加入预队列随机化、FIFO、库存 Hold、透明公共快照、账户/支付限制和隐私边界。项目明确：等待室和边缘计数负责流量准入，PostgreSQL 才能卖票。

教训：公平不是 UI 上显示一个队列数字，而是随机化时点、排队顺序、Hold、库存锁、限制和可审计结果的组合。

### 9.3 移除 Mock 后出现产品回归

一次“把假数据换成真实 API”的产品化修改，同时丢掉了活动封面和五个 Account 入口。技术目标正确，产品表现退步。

根因：展示元数据和 Mock 交易状态混在一起；删除假业务状态时误删了仍然有效的内容资产/导航。

教训：Fixture、展示内容和可变业务状态必须分层；“去 Mock”也需要视觉和导航回归。

### 9.4 V4 与 V5 真相冲突

仓库中 V5 设计探索看起来很完整，但没有 Swift 实现。Owner 明确纠正：V5 还没真正做出来，先以 V4 为准。随后清理文档、归档学校项目、恢复 V4 封面和完整 Account。

教训：漂亮设计文档不能自动成为当前产品版本；版本真相必须由运行代码、批准状态和 Handoff 共同定义。

### 9.5 部署验证不能只相信命令成功

Render CLI 的成功形状不足以证明服务真的跟随目标分支；REST 验证还发现过重复 `/v1` 导致的 404。最终做法是确认服务配置、部署 SHA、Health、公共 API 和 Console 页面。

代表提交：`667b567`、`4e38d95`、`9a6c3eb`、`808929b`、`49be599`、`13b1f05`。

## 10. 2026-07-14：Market 和 Console 从“存在”变成“可用”

### 10.1 Market

Owner 发现 K 线图不见了，活动和票种横向 Chip 在数据多时必须一直左右滑。

最终方案不是继续缩小卡片，而是：

- K 线只使用已完成的 `SETTLED` 转售数据；
- 没有真实成交时显示诚实空状态，不造 OHLC；
- Market 只保留当前市场入口；
- 活动和票种改成全屏、可搜索的层级选择页；
- 模拟器跑通活动搜索、票种搜索、选择和返回。

经验：信息数量超过一个屏幕的选择问题，需要信息架构和搜索，不是更多横向滚动。

### 10.2 Console

Owner 发现 organizer/admin Console 还没有真正产品化。参考成熟后台后，它被重构为 Event-first 工作区：持久导航、URL 中的 Event Context、按领域拆分的 Overview、Inventory、Sales、Entry、Team、Risk。

经验：后台不是把所有 API 放进一张长 Dashboard；它应该围绕运营对象、角色和决策组织。

代表提交：`be6c548`、`592cbd8`。

## 11. 2026-07-14 至 2026-07-16：Privy Console 登录为什么反复修了很多次

用户看到的症状依次包括：

- 点击 Continue with Privy 没反应；
- `Privy session active` 但 `session sync failed`；
- 每次打开先看到 Render Service Waking Up；
- 登录后又回到登录卡；
- 被重定向到 JSON：`FanPass Console mutation origin is not allowed`；
- 页面提示无法创建 Console session；
- 多次修改后仍然失败。

这些不是同一个 Bug。最终被拆成四层：

1. **服务可用性**：Render Free 冷启动确实慢，但服务醒来后错误仍持续；
2. **身份层**：Privy 登录可以成功；
3. **会话交接层**：跨 Origin Fetch、Opaque Origin、Cookie 和 State 需要第一方安全交接；
4. **后端授权层**：Console 还要创建 organizer/admin HttpOnly session，并处理过期和限流。

修复过程包括：

- 修复 CTA 指向自身导致的 No-op；
- 把 Auth 从 Next 隔离成更小的 Vite/Node 运行时；
- Console 创建短期随机 State 和 HttpOnly Cookie；
- Auth 用顶层 Form 把 Token 与 State 交回 Console，Token 不进 URL/Storage/Log；
- Console 常量时间校验并创建第一方 Session；
- 对过期 Token 使用一次 Refresh、一次 Re-auth、最终停止的有界状态机；
- 把共享 Render 出口 IP 从“每个用户”限流键中移除，改用凭证指纹和独立 Origin Flood Ceiling；
- 最终由 Owner 在真实 Chrome 路径完成登录，并由脱敏结构日志确认 `accepted/201`。

最重要的经验：不要因为先看到冷启动就把所有后续问题都归因于免费版；也不要只用 API Curl 代替真实浏览器 Cookie/Redirect 路径。

代表提交：`8fec526`、`b3d7d81`、`0543a6c`、`e8e47dd`、`108f4e6`、`ce5b4f2`。

## 12. 2026-07-16 至 2026-07-17：Explore、内容、Fan Access 和长期可用性

### 12.1 Explore 不只是活动列表

Owner 判断 Explore “有点差，但说不出哪里差”，随后把问题扩大到活动、艺人、潮流资讯和内容商业转载权。

产品结论：Explore 应从活动目录升级为发现系统，但内容版权必须成为数据模型和运营流程。来源 URL、授权类型、图片权利、地域、期限、编辑和下架不能靠备注或默认抓取。

### 12.2 Fan Access 的平衡

Owner 不接受繁琐空投任务，也不希望明面告诉用户可绑定的钱包上限。V1 因此选择：

- 最多三个有意义任务；
- 公开可理解的分配方式和进度；
- 钱包只是同一个人的证明来源，不是分数倍增器；
- 风控阈值、钱包数量阈值和 Bot 信号留在后端；
- 普通人的合理多钱包行为不应被公开惩罚，批量模式逐步增加验证；
- 暂不发行可交易 Fan Token。

教训：反作弊规则既不能完全透明到可被利用，也不能黑箱到让正常用户被无理由拒绝。公开原则和申诉路径，隐藏具体阈值与检测细节。

### 12.3 “挂久了掉线”其实是环境配置问题

模拟器长时间运行后 Home/Market 刷新失败，看起来像账号掉线或服务再次休眠。根因是已安装的 Local Debug Build 指向 `http://localhost:4000`，而本地 API 已停止。

最终实现：公共活动使用 Stale-While-Revalidate、本地保存最后成功目录、幂等 GET 有界重试、前台恢复和定时合并刷新；同时最终安装明确指向 Staging HTTPS。

教训：缓存能保护返回用户，却不能掩盖错误的 Build Provenance。排查移动端故障必须确认 App Build、Base URL 和后端是否是同一套环境。

### 12.4 全球基础设施路径

最初基础设施讨论容易被 Demo 城市“香港”带偏，Owner 明确 FanPass 面向全球用户。方案被修正为：

- 全球 Edge 服务公开 Web、媒体、活动/艺人/资讯和安全聚合读；
- 每个活动有一个权威交易区域；
- 库存、Hold、购买、转售和核销不做全球多主；
- 生产区域由真实主办方需求和 NA/EU/APAC 延迟证据选择；
- Render/Neon 保持到性能、SLA、合规或三年 TCO 触发迁移；
- 小团队默认评估 Cloud Run/Cloud SQL，大型企业要求或现有能力再选 AWS；不上无 Owner 的 Kubernetes。

证据：[Fan Access V1](../FAN_ACCESS_V1.md)、[Infrastructure Scaling Plan](../INFRASTRUCTURE_SCALING_PLAN.md)、[Handoff](../CODEX_HANDOFF.md)。

## 13. 反复出现的五个根问题

### 13.1 “看见了”不等于“存在了”

页面、Mock、Loading、成功 Toast 都可能比后端事实更快。FanPass 最稳定的修复都把最终状态移回数据库、支付商或被验证的身份边界。

### 13.2 “服务醒了”不等于“业务可用了”

Health 200 只能证明进程活着。Console 登录还需要浏览器身份、会话交接、角色授权和 Cookie 持久化。

### 13.3 “删 Mock”不等于“产品化完成”

移除假交易时可能误删仍需的内容资产、入口和预览。数据类型和生命周期必须分层。

### 13.4 “全球”不等于“全球写数据库”

公共读可以边缘化，稀缺库存必须单一权威。先减少用户感知延迟，再增加真正有需求的区域事务平面。

### 13.5 “AI 很快”不等于“项目一直快”

如果每次从聊天恢复现状、没有阶段门、没有版本真相，AI 产生的代码越多，验证成本越大。Handoff、契约、测试和证据把速度变成可持续复利。

## 14. FanPass 已经形成的可复制资产

- 角色分离的 Consumer / Ops / Console 产品模型；
- Backend-authoritative 状态原则；
- Provider Adapter + PostgreSQL Outbox；
- 支付/库存/核销的并发和幂等验证；
- Prototype Shortcut Register；
- Response Privacy Matrix；
- 四层发布证据；
- Handoff 驱动的上下文恢复；
- V4/V5 当前真相与实验隔离；
- 全球 Edge + 活动权威区域的基础设施路径；
- Fan Access 的低摩擦任务和后台反滥用边界。

这些资产被提炼进 [Commercial Vibe Coding Playbook](COMMERCIAL_PROJECT_PLAYBOOK.md)。

## 15. 当前进行中的章节

FanPass 仍在持续构建和商业发布准备阶段，尚未正式全球落地。当前推进中的章节包括：

- Fan Access Staging 迁移和真实 organizer/fan E2E；
- iOS 生命周期自动测试和实体设备回归；
- 统一 401/Session Refresh；
- 非休眠生产容量、监控、备份和恢复；
- 独立 Worker、共享限流和多实例实时协调；
- 生产 Privy App/域名/MFA/Allowlist；
- 内容授权和编辑运营系统；
- 退款、转让、报表和客服 Console；
- TestFlight、法律/合规、Apple Wallet 和链托管；
- 真实主办方和全球延迟数据决定第一个 Production Region。

进行中状态本身就是记录的一部分。商业 Vibe Coding 最危险的做法，是把“已经有方案”写成“已经上线”。

## 16. 2026-07-17：记录方式校准为持续在建日志

最初整理时，本文件使用了较多“失败复盘”和“完整经历”的事后口吻。Owner 指出 FanPass 仍未真正落地且尚未完成，不应提前给整个项目下成功或失败的结论。

本次调整后的决定：

- Journey 从阶段性历史总结改为持续更新的在建记录；
- 每次有意义的工作都留下简短进展，不等项目结束再补；
- 具体登录、刷新、支付或部署问题可以称为故障，但它们只是构建过程的一部分；
- 阶段总结同时保留尝试、判断变化、当前证据和下一步；
- Handoff 继续负责“现在是什么”，Journey 负责“项目如何一路形成”。

当前结果：方法论本身也接受 Owner 校准，不把一次整理稿当成最终答案。

## 17. 后续记录格式

每次完成有意义的工作时追加简短记录；遇到重大转向或阶段跨越时使用完整格式：

```md
## YYYY-MM-DD：里程碑标题

目标：

发生了什么：

最初判断：

真实根因：

做出的决定：

验证证据：

仍在进行：

可复制经验：
```

普通修复仍保留在 Git、Handoff 和任务文档，但 Journey 至少留下结果和链接。它记录连续进展，不复制终端输出或逐条聊天。

## 18. 2026-07-17：从“用户指出问题”转向主动发布审计

Owner 进一步校准工作方式：后续不把 Mock 或 Local Build 当作默认产品真相，要从真实全球用户和真正发布的角度主动发现问题，而不是等用户逐项指出。

本次把 Home、Explore、Market、Tickets、Account、Event Detail、公开 Staging 数据、运行配置、可访问性表面和发布证据作为同一条旅程复盘。发现最需要先解决的不是视觉细节，而是三个会破坏信任的事实边界：

- API 的公开活动列表仍返回 DRAFT 和测试证据活动，客户端只能靠关键词隐藏一部分；
- API 带毫秒的时间戳解析失败后被客户端替换成当前时间，未来活动显示成当天；
- 没有转售 Ask/成交时，Event Detail 把票面价显示成 Floor 和 Recent sale，与 Market 的诚实空状态冲突。

同时确认：当前活跃 Target 仍编译 Mock 默认依赖、Debug 缺配置会静默回退 localhost、主 iOS App 没有自动测试 Target。Home 的搜索/通知/位置/推荐含有概念行为，Explore 尚未形成真正的活动/艺人/资讯发现系统，Event Detail 的购票与 Fan Access 条件也不够真实。

做出的决定：先执行 [Main App Product Audit](../MAIN_APP_PRODUCT_AUDIT.md) 的 Truth Gate，再扩展视觉和内容。以后 Local/Simulator 用于编译、调试和回归，但不能关闭可用性、身份、支付、数据或发布结论；这些结论需要部署后的 HTTPS、TestFlight/实体设备和真实用户路径证据。

仍在进行：这一阶段最初只完成诊断、优先级和持续文档，没有提前把审计结果写成“产品已修复”。随后 Gate A 进入实现和部署，结果记录在下一节。

## 19. 2026-07-17：Truth Gate 从审计进入真实 Staging

目标：先关闭会让用户看到错误事实的 Gate A，再进入 Explore 和转化体验优化。

发生了什么：

- API 公开列表和详情改为只允许 `PUBLISHED`，并增加 DRAFT 负向测试；
- iOS 严格解析带/不带毫秒的 ISO-8601，非法必填日期不再替换成“现在”；
- 票面价与真实转售行情分离，空市场在 Home、Event Detail 和 Market 中统一显示 `No asks` / 无成交；
- Fan Access 由开放 campaign 决定是否出现，钱包数量阈值继续只留在后端；
- Beta/Release 构造不再默认注入 Mock，缺少或不安全的 API Origin 直接失败；
- 新增 `FanPassTests` 目标和四个 mapper fixture，但当前 iOS 26.5 test host 没有完成 XCTest 连接，不能把“编译成功”写成“测试已执行”。

部署过程没有一次直线成功：第一次本地 `git push` 返回了看似成功的退出状态，但远端 `main` 没有前进；回读远端 commit 才发现 Render 根本没收到代码。真正推送后，Render 又因为新唯一约束可能造成数据损失而拒绝 raw `prisma db push`。处理时没有加 `--accept-data-loss`，而是加入 advisory lock、重复数据前置检查和 fail-closed 迁移。随后部署日志又暴露 public upsert 先写 task、后写 campaign 的外键顺序错误；最终把 catalog/Fan Access 同步改成单事务、campaign-before-task，并从应用启动副作用移动到部署门内。

Render CLI 还出现了另一种“假成功”：更新服务 build command 后返回成功，但再次读取服务配置时仍是旧命令。当前旧命令调用的 `prisma:push` 已被改成安全包装器，因此本次 Staging 没有退回 raw push；不过仓库 `render.yaml` 和云端服务设置的漂移仍被保留为 Production 前任务，而不是在文档里假装已经同步。

当前验证证据：

- API deploy `dep-d9ckdqsvikkc73d29km0` 从 commit `8f845a1` 上线；
- `/events` 为 11/11 `PUBLISHED`，旧 DRAFT id 为 404，Aurora 为 200；
- Aurora campaign 为 `ACTIVE`、三项任务，公开响应没有钱包数量字段；
- Staging 运行时安全检查通过安全头、demo auth 禁用、未登录边界和 WebSocket Origin；
- Beta 模拟器从 Staging HTTPS 显示真实未来日期、诚实空行情和条件化 Fan Access；
- API 22 个 suite、132 个测试通过，生产依赖审计为 0 漏洞。

仍在进行：这不是正式上线或全球商业落地。Home 的位置/推荐/通知仍有概念行为，Explore 卡片在窄屏的海报/状态层仍显杂乱，Market 在无 Ask 时仍把绿色 Buy 作为主按钮；生命周期自动化、TestFlight、实体设备、非休眠容量、全球化、内容权利和真实 Fan Access 双角色 E2E 仍属于 Gate B/C。

可复制经验：部署完成必须同时回读远端 commit、云端 deploy commit、构建日志和业务正负向结果；`live`、Health 200、编译成功、CLI 退出 0 都只能证明其中一层。AI 看到相邻错误时应继续追到同一发布门的根因，但要把未完成的下一阶段明确留下，而不是无限把所有产品问题混成一次改动。

## 20. 2026-07-18 至 2026-07-20：安全扫描为什么有很多轮，以及什么时候必须停下来修

这次安全工作最容易造成误解的地方，是界面里同时出现了 Deep Scan、多个 discovery pass、候选项、验证项和 Changes 页面，看起来像是“审计永远做不完”。实际上它们解决的是不同问题：Deep Scan 的多个独立 pass 是为了减少同一类盲区；候选项要经过可达性和影响验证，不能直接当漏洞；修复后的 Changes scan 只检查本次改动有没有留下新缺口。全量发现阶段在 sealed baseline 完成后就应该停止，后面进入修复、回归和一次最终差异验证，不能因为页面多就不断重开全量扫描。

本轮先从 39 个基线问题按共同根因修复，再用 repaired-working-tree Changes scan 收敛出三个仍成立的问题：旧钱包绑定缺少可信来源、WebSocket 重连能重置准入预算、DRAFT 活动还能从转售侧进入写入和支付。随后独立交叉审查没有继续扩大扫描范围，而是沿已经改动的资金与链上状态机找实现回归，发现了四个需要马上修的相邻问题：补偿态可能被客户端显示成成功、延迟 Stripe capture 没有在执行时重新检查活动、ownership job 进入 DEAD 后可能不补偿、Privy 明确失败可能被无限当成 pending。

修复后的关键边界不是“多写几个 if”，而是把事实放进可恢复的状态机：钱包绑定有 `VERIFIED/UNVERIFIED` 来源、版本和指纹；活动发布状态在下单和最终结算都复核；Sponsored USDC 区分 pending、confirmed、definitive failure、ambiguous 和 compensation；Stripe 只在锁定后的订单、票、交易和活动事实全部成立时 capture；ownership provider 调用前先落一个不可回退的 submission fence，进程在 fence 之后崩溃就进入人工对账，不能自动重播或自动补偿。

验证也分层记录。进入 RC 收口前的本地基线通过 API 30 个 suite/308 个测试、一次性 PostgreSQL 12/12 并发测试、iOS Debug 6/6、合约 13/13、API/Console 类型检查与生产构建、真实子进程 Console 会话交接、安全边界审计和生产依赖 0 漏洞。这里的“真实”只指真实 PostgreSQL 引擎和真实进程边界，不代表真实用户发布；当时的 dirty worktree 没有部署，Stripe/Privy/Sepolia 故障注入、TestFlight/实体设备、App Attest、链托管以及多实例 WebSocket 仍未关闭。

这也回答了“审计完不用修吗”：要修，而且发现阶段有明确终点。FanPass 接下来不再开新的全量 Deep Scan，而是把这一批代码和 schema 部署到 Staging，跑真实 provider 与崩溃边界，再做一次 `Changes / Review changes` 验证。如果架构或信任边界没有明显变化，就不应该用重复全量审计替代上线验证。

可复制模式：先冻结可复现基线，再把候选项收敛成验证后的工作清单；每个修复先写失败用例和安全不变量，再实现、跑同域回归、交给独立视角检查相邻状态，最后用真实数据库/进程/provider 分层补证。扫描轮数不是进度，关闭了多少可信边界、还剩哪些外部证据才是进度。项目仍在建设中，这一阶段既不是“已经成功”，也不是“失败复盘”。

## 21. 2026-07-20：把安全修复变成可控的 Staging 发布候选

扫描收口后，下一步没有直接把 dirty worktree 推上云。三个 Render 服务的 Auto-Deploy 被关闭，仓库也固定为 `autoDeployTrigger: off`，Workspace 的重叠部署策略回读为 `Wait`；这些设置变更没有触发部署，线上仍运行旧版本。

数据库发布新增了默认暂停的 dispatch revision fence：旧进程不能继续领取任务，新 Worker 在领取任务和调用外部 Provider 前都要重新确认 revision；受控恢复只能绑定唯一一条可领取任务并自动暂停。票据同时保存不可变的合约地址、链和版本，旧数据通过 enforcement、backfill、validation 三步迁移。只读发布预检还必须绑定经过批准的 Staging 数据库身份，并把未知状态或未知类型的活动任务一律作为阻断项，避免在错误或不完整的数据库上得到“安全”结果。

Staging 因此采用两阶段切换：Phase A 保持旧合约地址，先部署 route-aware RC；旧 Revision 退出后才部署新 Sepolia 合约，Phase B 用同一 RC 切换新地址。独立复核随后发现一个发布流程级 P1：数据库 fence 能阻止旧 Worker 领取任务，却不能让已经在线、还不认识 fence 的旧 API 自动拦住 Stripe/Privy 直连；Render 的普通零停机部署又会让旧实例在新版本 build 期间继续接收请求。因此第一次安装 fence 前必须先建立真实的公共流量维护边界、排空旧请求并核对 Provider/outbox census，等新 RC 成为唯一实例且 preflight 通过后才能恢复流量。Render Free 没有 Maintenance Mode，不能把自动休眠或未经证明的 suspend/resume 当成安全替代。

整个过程 Worker 保持关闭，先验证备份和只读数据库 preflight，再允许一条受控 probe。新合约第一张票 mint 后，不能回滚到不支持 per-ticket routing 的旧 API。

当前 RC 的 Node 22 基线为 API 32 个通过 suite/386 个通过测试，另有 13 个 PostgreSQL 测试只在明确的本地数据库门禁中开启；合约 30/30、Console Auth 16/16，API/Console/Web/合约类型检查与生产构建通过，根工作区生产依赖审计为零。iOS 证据是 Debug 6/6 和 Beta generic-device unsigned build 成功；它证明编译和环境配置，不是 TestFlight。Apple Team、签名身份和 Provisioning Profile 尚未提供。Staging 数据库尚未迁移、新合约尚未部署、没有发生链上写入，真实 Stripe/Privy/Sepolia 与故障边界证据仍待完成。独立的 Console Auth 仍有 Privy 间接依赖带来的 10 个 moderate 记录，当前没有验证到受影响的 uuid buffer 调用链，因此只接受进入受控 Staging，不能称为 Production GA 零漏洞。

可复制经验：高风险发布不能把“关 Worker”只做成进程环境变量，也不能把合约地址切换和 API 兼容性押在一次部署里。把关闭开关下沉到数据库、把迁移拆成前后兼容的两阶段、绑定发布工具的目标环境，并明确不可逆边界，才能让小团队在缺少完整企业发布设施时仍然拥有可停止、可证明的发布过程。

## 22. 2026-07-22：安全门禁本身也必须防伪

RC 收口时没有因为 API、合约和依赖测试变绿就立即提交。独立复核反过来攻击了“证明这些结果的脚本”，发现两个会制造假安全感的 P1：Render 审计器用自制缩进解析，合法 YAML 可以放一个安全 decoy、再把真正的不安全服务写成另一种结构；Hosted CI 证据只校验提交者填写的 JSON 和本地文件哈希，任意仓库、任意 run id、任意 commit 和未来时间都能被伪造成成功。

修复没有继续堆字符串判断。Render 门禁改用直接固定的 `js-yaml@4.3.0` 解析真实 AST，精确限制顶层资源、三个服务、执行字段和环境变量来源；55 个正负用例覆盖嵌套/flow decoy、重复键、额外服务、命令后缀、pre-deploy hook、repo/branch 和 secret 来源。Render self-test/audit 成为受审查组合 manifest 中不可省略、不可换序的一对命令；43 个 workflow 用例拒绝注释伪装、`exit 0`、dead branch、条件跳过、允许失败、改名、错序，以及 runner/guard/工具链路径替换。

Hosted CI 证据则改成在线证明：验证器从 Git remote 得到唯一仓库，要求工作树干净并绑定当前 RC commit，再向 GitHub API 核对 run、job、workflow 内容、三个真实顶层 step（Checkout、Setup Node 22、Verify Beta foundation）、结论和时间。GitHub job API 不会把组合验证器内部的 97 个命令展开成独立 step，所以内部命令由成功的 Verify step、受证明的 workflow 原文和不可变 commit 共同绑定。工作流的 push filter 同时覆盖 `main` 和受控的 `codex/security-rc-*`，因此本次 RC 推送会在合并前直接产生精确 head SHA 的 run；`workflow_dispatch` 只作为该定义进入默认分支后的后续入口，因为 GitHub 不接收仅存在于 RC 分支上的手动触发定义。这样就不会把 PR merge SHA 或合并后的 main run 冒充预合并证明。29 个用例证明原伪造样本现在失败；网络、404、403 或权限不足都不会降级成“离线通过”。当前本机 GitHub 凭证没有私库 `Actions: read`，所以这里只能证明验证器会安全拒绝，不能提前宣称已有真实 hosted run。

完整 Beta 门禁还暴露了一个与地区有关的真实代码问题：Prisma 把 JavaScript `Date` 作为带时区参数传入，而 PostgreSQL outbox 的 `locked_at` 是无时区列。在上海时区，两者表面时间相同但相差八小时，合法 worker claim 全被误判成旧 revision。查询现在明确把存储值解释为 UTC；本地多任务 saga 只在 revision CAS 成功后临时开启 dispatch，并在成功或异常路径都恢复 `paused=true`。这说明“面向全球”不只是 UI 语言和货币，后台锁、过期时间、审计时间也必须在非 UTC 主机上验证。

修复 saga 后的第一次完整重跑又暴露了另一类门禁问题：Saga 已经成功，但紧随其后的只读 health CLI 会重新加载开发者本机的 staging/Privy 配置，于是同一套组合验证因环境污染被安全拒绝。第一版 `env -i` 加最小 Nest module 看似解决，独立复核却用真实 import graph 证明旧 `prisma-client-js` 会在构造 client 之前主动读取 `apps/api/.env`；`ignoreEnvFile` 根本来不及。最终没有通过预置空 secret 或导入后删除来“让它变绿”，而是让本地 gate 完全绕开 npm、Nest 和旧 Prisma，使用隔离 HOME、固定 direct `ts-node` 入口、字面量 loopback 数据库 guard，以及 `pg` 的 repeatable-read/read-only transaction。33 个 wrapper/import 攻击例和真实非 UTC PostgreSQL 异常数据证明环境不会进入探针、原始错误不会输出、写入会收到 `25006`。这个插曲说明门禁也需要被当成安全产品审计，fixture 绿不等于真实依赖图安全。

最终 97 步组合门禁还发现四个夹具与生产合同漂移：tokenized demo ticket 没有不可变合约路由，合成 ownership job 没有保存同一路由，验证器引用了不存在的 worker 入口，PROCESSING health fixture 没有当前 dispatch revision。处理方式是修正种子、快照、真实入口和事务化测试前置条件，而不是放松数据库约束或 Worker fence；修复后本地 97 步门禁、API 32/386、合约 30/30、Render 55/55、Workflow 43/43 和 Hosted 验证器 29/29 全部通过。它仍只是本地候选证据：仓库没有 `CODEOWNERS`，分支保护查询返回 `403`，最终不可变 commit 的 Hosted attestation、Staging/provider/链上/实体设备证据仍待完成。

可复制经验：任何 release gate 都是安全边界，也需要攻击性测试、成熟解析器、不可伪造的数据来源和 fail-closed 行为。自报 JSON、字符串 contains、命令退出码、截图或绿色 UI 都不能单独证明发布事实；证明必须绑定不可变 commit 和权威系统。与此同时，Local/Mock 可以用于夹具和回归，但必须清楚标注，不能替代真实 Staging、Hosted CI、Provider、TestFlight 或实体设备证据。

## 23. 2026-07-22 至 2026-07-23：安全 RC 冻结并推送

安全收口最终固定在分支 `codex/security-rc-20260720`、不可变提交 `a25185d2747520303eac0fd2681017b5c35ac62b`，并推送到远端；没有创建 PR、合并、部署、付费升级、Blueprint 同步、数据库迁移或链上写入。最终本地权威门禁通过 97/97，包含 API 32 个 suite/386 个测试、合约 30/30、Console Auth 16/16 和专用 PostgreSQL 门禁；根工作区 production/full audit 都为零。独立的最终安全复核与 secret/scope 复核没有留下 P0/P1。隔离的 Console Auth 仍有 10 个 moderate、0 high/critical，只允许进入受控 Staging，不能称为 Production GA 零漏洞。

推送并不等于 Hosted 证明。当前 GitHub 凭证访问 Actions、Checks 和 Status API 会收到 403，因此还不能确认这次 exact-SHA run 是否成功，也没有伪造或手填一个“通过”结果。仓库仍没有 `CODEOWNERS`，分支保护状态同样没有得到可验证读权限。下一阶段是取得只读权限后封存 Hosted attestation，再在 Owner 批准的维护窗口内执行两阶段 Staging 切换，补真实 Stripe/Privy/Sepolia、Worker 崩溃、多实例、TestFlight、实体设备与 App Attest 证据，最后只做一次 `Changes / Review changes` 验证。

这次收口还把“证明系统本身”加入了可复制路径：先验证 workflow 是否真的会在目标分支/提交触发，再验证外部 API 是否能读取唯一 run 和真实 step，而不是先相信绿色截图。另一个文档全审计发现是 iOS 证据合同本身已经漂移：FanPass 当前含 Camera purpose string，Ops 的 Release/TestFlight 路径却是 QR-first 且没有 NFC entitlement，而旧 signed-build/physical-scanner 合同仍要求相反事实。在 validator、draft、self-test 与文档统一之前，不能接受对应 saved evidence。这不是把项目定义为失败，而是把尚未闭合的发布边界准确留下来。

可复制经验：冻结提交只关闭“这份代码是什么”，不会自动关闭“它是否在 Hosted、Staging、Provider、链和实体设备上成立”。商业项目的交接文档必须同时记录完成的代码边界、未完成的外部证据，以及下一步唯一安全顺序。

## 24. 2026-07-24：让 QR-first 产品能力、正式界面和发布证据说同一种话

文档全审计留下的 iOS 漂移不是措辞问题：Consumer 已有 Camera purpose string，但旧 signed-build validator 要求“没有 Camera”；FanPass Ops 的 Release/TestFlight 已移除 NFC entitlement，正式界面却仍显示 NFC 入口，旧 device validator 还强迫填写物理 NFC 已验证。继续沿用会同时伤害现场员工体验和证据可信度。

本次把当前能力固定为 `qr-first-release-v1`。FanPass 的 Camera usage description 与 scanner source 被拆成独立事实；Ops 的 QR source、NFC usage description、Release entitlement 和 DEBUG-only CoreNFC 也分别证明。Beta/Release UI 只显示 QR，NFC 控件与 CoreNFC import/session 留在 `#if DEBUG`。Device evidence 保留真实 iPhone、HTTPS、QR 接受/过期/重放拒绝、后端签名与闸机权限、认证身份和脱敏要求，同时拒绝旧 `nfcTransport` 或任何 Release NFC claim。NDEF fixture 只保留为未来能力规范，未来重新启用时必须建立单独 validator，不能拿现在的 QR gate 冒充 NFC 证明。

局部 validator/self-test、iOS distribution/NDEF audits、FanPass Ops Beta/Debug 与 FanPass Beta 本地构建已通过；Beta 二进制没有链接 CoreNFC，Debug dylib 仍保留 CoreNFC。随后完整的 Node 22 Beta foundation 本地权威组合门禁以退出码 `0` 完成，终行是 `Beta foundation local gates passed.`；其中 API 回归为 32 个 suite/386 个测试通过，默认单测步骤按设计跳过三个 suite 中 13 个受保护的 PostgreSQL 测试，并由对应的专用组合步骤覆盖适用的真实数据库门禁。

Owner 在 2026-07-24 纠正了状态表达：历史 TestFlight 安装和实体 iPhone QR 验证已经做过，仓库也保留两个 bundle id 的 TestFlight 上传历史以及带 provisioning profile 的有效签名 iPhoneOS 构建。旧 `outputs` JSON 仍是 draft，说明当时没有把操作结果封装成当前 validator 可接受的证据，而不是测试从未发生。正确的未完成项是把已经跑通的路径在下一份 `qr-first-release-v1` 候选上重跑并绑定版本，不是重新证明 FanPass 能否上 TestFlight 或 iPhone 能否扫 QR。Owner 同时授权后续改动通过门禁后自动推进 Hosted、受控 Staging 与 Internal TestFlight；只有缺失 API/key 或不可逆的付费/公开生产决策才暂停询问。

这份修复随后以 `ec3ab855a40f22670e41a4e727025b6ec6b80e97` 提交到 `codex/security-rc-20260724-qr-first`，并通过 GitHub Hosted `FanPass Beta Foundation` run `#93`。App Store Connect 的实时数据同时确认 FanPass `1.0 (2)` 有 3 次安装/108 次使用，FanPass Ops `1.0 (1)` 有 2 次安装/24 次使用，二者无已记录崩溃；这进一步证明旧 TestFlight 路径确实跑过，但不替代新候选复测。Render 仍在旧 `main` revision 与 Free API 上，最低 Starter 维护边界为 `$7/月`；因为它会产生持续费用，尚未在没有 Owner 明确确认的情况下应用，也没有自动接受 Apple 更新后的开发者协议或 EU trader 法律状态。

随后文档 head `7d77584e1dac520dc90562eea09edd6b01d5f793` 通过 exact-HEAD Hosted run `#94`。Owner 在 2026-07-25 明确要求 Render 暂时保持 Free，并把长期发布策略定为 Auto-Deploy Off、每次由插件或 CLI 手动触发和验证。一次误选 Starter 产生了针对当时 `main` head `b7cbc46668fa24d10afabb89fca58d023164845e` 的 Render deploy `dep-d9hp9vfavr4c739ikcsg`；发现 source drift 后在 checkout/cache 阶段立即取消，未进入 build 或数据库命令，复核套餐仍为 Free，最后成功部署仍是 `8f845a19e32bd072b4e6b4df6e61ce11a7548214`。这也暴露了一个真实运维陷阱：实例类型变化会以当前 linked branch head 触发部署，不能假设它会自动复用旧 live SHA。

同一轮 Computer Use 已到达新版 Apple Developer Program License Agreement 的最终 `Agree` 按钮，并打开 DSA 的 `trader` / `not a trader or no EU distribution` 二选一；按照法律动作确认边界，两者都停在提交前等待 Owner 明确选择。签名预检发现 Xcode 26.5、XcodeGen 和一个有效签名身份，但标准目录中没有 provisioning profile，因此协议通过后仍需恢复两个 bundle id 的分发 profile，才能生成下一份候选绑定的 signed archive。

Owner 随后决定暂时搁置 DSA，继续 V5 视觉升级。这次没有把它处理成一次全局换肤：先复核 V4 在 368x800 的 Home、Explore、Event Detail，再用已有 Round 06 标志、Backstage Pass 色彩和排版，把最关键的发现到购买路径做成一个独立可维护的竖切。Home 删除了没有真实服务的通知、收藏、概念搜索和伪定位，改为真实目录城市、Explore 搜索交接和 Account 路由；Explore 增加真实事件/场馆/城市/分类搜索以及城市/分类过滤，不再把完整列表叫作 `Recommended`，并把真实活动期 Fan Access 收成一个上下文入口；Event Detail 去掉重复标题和首屏行情卡，把票种、库存、规则与登录/结账动作提前，并在购买路径隐藏 tab bar。

工程上新增独立 V5 semantic tokens 与共享组件层，未迁移的 Market、Tickets、Account、Checkout、Fan Access 和 Ops 仍使用 V4，避免一次半成品主题替换污染交易页面。选定标志通过 24px/header 检查；App Icon 的外层背景修为完整方形、由 iOS 负责圆角遮罩，并重新生成全部不带 alpha 的 iPhone/iPad/marketing 尺寸。三张同状态 V4/V5 对比图经过目视检查后又修正了窄屏密度、首屏 CTA、占位 hero 和小尺寸品牌标志。最终 Beta 模拟器构建启动通过，Debug 单测 6/6 通过，两项 iOS 分发/角色边界审计通过，V5 代码/资产/合同以 `2a910a0a6e83055743bb2992b15226259e9e9663` 落盘；随后 exact head `ce3737f8a70088cac8a450e088a2dad5a94e25ed` 通过 Hosted `FanPass Beta Foundation #95`（总计 5分36秒）。因为这轮只有 iOS 源码与资产变化，没有 API、Render 配置或数据库改动，Render Free 与 Auto-Deploy Off 保持不变，也没有为了“自动部署”制造一次无意义的后端发布。下一步是先完成 Market 的无流动性动作和 Account 持久化边界，再把候选绑定到签名/TestFlight 与实体 iPhone 复测证据。
