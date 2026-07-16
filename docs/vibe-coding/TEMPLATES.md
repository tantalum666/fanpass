# Commercial Vibe Coding Templates

这些模板可以直接复制到新项目。删除不适用的项，不要为了填满模板制造假信息。

## 1. 项目启动契约

```md
# [项目名] Project Contract

Last updated: YYYY-MM-DD
Owner: [最终决策者]
Current stage: [Opportunity / Product Contract / Vertical Slice / Alpha / Closed Beta / Paid Pilot / Scale]

## 用户与问题

- 目标用户：
- 发生场景：
- 当前做法：
- 最大痛点：
- 为什么现在解决：

## 产品承诺

一句话价值：

第一个核心旅程：

1.
2.
3.

## 商业假设

- 谁付费：
- 为什么付费：
- 收费方式：
- 最便宜的验证方法：

## 边界

- V1 包含：
- V1 不包含：
- 不能伪造的状态：
- 最大安全/隐私/合规风险：
- 内容/数据/素材权利来源：

## 成功指标

- 用户结果：
- 可靠性：
- 商业：
- 本阶段退出条件：
```

## 2. 一页架构权威表

```md
# Authority Map

| 状态/动作 | 最终权威 | 客户端可以缓存什么 | 失败策略 | 审计证据 |
| --- | --- | --- | --- | --- |
| Identity/session | | | | |
| Role/permission | | | | |
| Order | | | | |
| Payment | | | | |
| Inventory/entitlement | | | | |
| Reward/score | | | | |
| Notification | | | | |
| Content license | | | | |

## 不变量

1.
2.
3.

## 第三方依赖

| Provider | 用途 | 发送的数据 | 失败体验 | 替换/退出方案 | 价格触发器 |
| --- | --- | --- | --- | --- | --- |
```

## 3. 给 AI 的标准任务 Brief

```md
# Task: [用用户结果命名]

## Desired outcome

[完成后用户/运营人员可以做到什么]

## Current truth

- 当前可发布版本：
- 当前环境/部署：
- 已知相关文件/模块：
- 已知失败证据：
- 用户已有未完成修改：

## In scope

-

## Non-goals

-

## Product rules

- 数据/操作最终权威：
- 角色和权限：
- 加载/空/错/过期/恢复状态：
- 隐私/安全要求：
- 内容/素材授权要求：

## Engineering rules

- 保持现有模块边界，不写单体巨型文件。
- 先检查根因再修改。
- 不覆盖无关用户修改。
- 不自动购买服务、迁移生产或扩大权限。

## Acceptance evidence

- [ ] 类型/静态检查
- [ ] 自动测试
- [ ] 真实运行环境
- [ ] 浏览器/模拟器/设备用户路径
- [ ] 失败与恢复路径
- [ ] 安全/隐私/并发（若适用）
- [ ] 文档/Handoff 更新
```

## 4. 工作会话记录

有意义的工作结束后，把简短结果加入 Journey；重大转向或阶段变化时使用下面的完整格式。普通细节继续留在 Handoff、任务和 Commit。

```md
## YYYY-MM-DD - [结果]

Intent:

Starting evidence:

Assumptions:

Decision:

Implemented:

Verification:

- Static:
- Automated:
- Runtime:
- Experience:

What failed or surprised us:

Root cause:

Remaining risk:

Reusable lesson:
```

## 5. Decision Record

适用于会影响数据模型、用户体验、供应商、成本、安全或未来迁移的决定。

```md
# ADR-[编号] - [决定标题]

Date: YYYY-MM-DD
Status: Proposed / Accepted / Superseded
Owner:

## Context

[事实、限制、指标，不写结论]

## Options

### Option A

- Benefits:
- Costs:
- Risks:

### Option B

- Benefits:
- Costs:
- Risks:

## Decision

[选什么，以及为什么适合当前阶段]

## Consequences

- 现在得到：
- 现在放弃：
- 需要新增的保护：

## Revisit trigger

[出现哪些可测量信号时重新评估]
```

## 6. Bug / Incident 记录

```md
# Incident - [用户看到的症状]

Date/time:
Environment:
Affected version/deploy SHA:
Impact:

## User-visible symptom

[只写用户真正看到的]

## Layer isolation

- Interaction/UI:
- Client/session/cache:
- Network/Cookie/Origin:
- BFF/API/authz:
- Database/transaction:
- Provider:
- Deployment/config:

## Initial hypothesis

## Evidence that disproved it

## Root cause

## Fix

## Regression protection

## Runtime verification

## Recovery/rollback

## What the user should do now
```

## 7. Release Evidence

```md
# Release [version/SHA]

Environment:
Released at:
Owner:
Rollback target:

## Scope

-

## Database

- Migration reviewed:
- Backup/restore point:
- Forward/backward compatibility:

## Verification

| Layer | Command/path | Result | Evidence location |
| --- | --- | --- | --- |
| Static | | | |
| Unit/integration | | | |
| Security/privacy | | | |
| Deploy health | | | |
| API smoke | | | |
| Browser/device E2E | | | |
| Failure/recovery | | | |

## Monitoring

- Availability:
- Error/p95:
- Database:
- Async jobs:
- Provider webhooks:
- Budget:

## Known risks

## Go / no-go decision
```

## 8. 产品页面审查模板

适用于“我觉得页面不太对，但说不出哪里”。

```md
# Product Surface Audit - [页面]

## User job

用户来到这里要做什么决定或完成什么任务？

## First 5 seconds

- 第一眼看到的是否是最重要内容？
- 主动作是否明确？
- 是否需要先理解产品术语？

## Information architecture

- 内容是否按用户思维分组？
- 数据很多时如何搜索、筛选、排序、分层？
- 是否用横向滚动隐藏了可发现性问题？

## States

- [ ] Loading
- [ ] Data
- [ ] Empty
- [ ] Error/retry
- [ ] Signed out/no permission
- [ ] Stale but usable

## Trust

- 价格/概率/来源/时间是否可解释？
- 是否虚构活跃度、成交或库存？
- 内容和图片是否有商业使用权？

## Accessibility and devices

- 动态字体/对比度/触控面积：
- 小屏/大屏/键盘/屏幕阅读器：

## Proposed outcome

[不要写“更好看”，写用户行为变化]

## Evidence

[任务完成时间、成功率、截图、可用性测试]
```

## 9. 内容授权记录

```md
# Content Asset Record

Content ID:
Title:
Content type: Event / Artist / Trend / Editorial / Image / Video
Source URL:
Author/rights holder:
License/contract:
Allowed use: Link / Excerpt / Full text / Transform / Commercial display
Allowed regions:
Image rights:
Attribution text:
Start/end date:
Editor approval:
Takedown contact/process:
Last verified:
```

## 10. 容量与成本评审

```md
# Capacity Review - YYYY-QN / [事件]

## Demand

- MAU/DAU:
- Paid orders:
- Expected arrivals and peak RPS:
- Strategic regions:

## Runtime

- Availability:
- p50/p95/p99 and error rate:
- CPU/memory:
- Database size/connections/slow queries:
- Queue/outbox age:
- Concurrent sockets:
- Cache hit/origin traffic:

## Recovery

- Current RPO/RTO:
- Last restore/failover drill:

## Cost

- Actual by provider:
- Cost/active user:
- Cost/paid order:
- Forecast and budget variance:

## Decision

Keep / Tune / Resize / Add managed component / Migration proof / Migrate

## Trigger for next review
```

## 11. 每周复盘

```md
# Weekly Product Engineering Review

## Outcomes shipped

[只写用户/运营结果，不写文件数量]

## Evidence missing

[哪些“完成”仍只有本地或源码证据]

## Top risks

1.
2.
3.

## Prototype shortcuts approaching users

-

## Incidents and lessons

- Symptom:
- Root cause:
- Permanent protection:

## Cost and reliability

- Spend/alerts:
- Availability/error/p95:
- Backup/restore:

## Product decisions needed from Owner

-

## Next smallest vertical slice

- Outcome:
- Exit evidence:
```

## 12. 新对话恢复 Prompt

```md
先完整读取项目 Handoff 和仓库规定的文档，再开始工作。当前可发布版本、部署环境和未完成用户修改以仓库证据为准，不要依赖旧聊天猜测。

本次目标：[结果]

请先：
1. 检查 Git 和运行现状；
2. 找到相关产品/架构/安全契约；
3. 把需求改写为范围、非目标、状态权威和验收证据；
4. 先定位根因，再做可维护的最小垂直切片；
5. 完成静态、自动、运行和真实用户路径验证；
6. 更新 Handoff 和相关契约。

不要伪造数据或成功状态，不要覆盖无关用户修改，不要未经授权购买服务、迁移生产或扩大权限。
```
