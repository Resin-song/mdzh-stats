# Brainstorming: Markdown 中文字数与高频词统计 CLI

**Date Started:** 2026-10-19
**Status:** Done
**Current Phase:** finalizing
**Final Spec:** `docs/superpowers/specs/2026-10-19-markdown-zh-word-stats-design.md`
**Last Updated:** 2026-10-19 17:21

## Original User Request

> [$superpowers-deepseek-v4:brainstorming](C:\Users\EricY\.codex\plugins\cache\gylove1994-superpowers-deepseek-v4\superpowers-deepseek-v4\5.1.3\skills\brainstorming\SKILL.md) 我想做一个命令行工具：扫描一个目录下的 Markdown 文件，统计每个文件的中文字数和出现频率最高的 10 个词。\
> 请用 superpowers 工作流来做：先不要写代码，先做需求澄清并给出分步实现计划。

---

## Phase A: Alignment Decision Log

### Q1: 高频词的切词口径
**Options Presented:**
- A: 使用 `jieba` 精确模式，按中文词切分；更符合通常理解，但引入分词依赖并受词典影响
- B: 将每一段连续中文整体视为一个词；简单可预测，但通常不能形成有意义的高频词
- C: 按固定 2–4 字 n-gram 统计；无需中文词典，但碎片和重叠统计较多
**Decision:** A
**Rationale:** 用户接受推荐方案，优先获得符合通常语义的中文词频结果。
**Timestamp:** 2026-10-19 17:03

### Q2: Markdown 正文统计范围
**Options Presented:**
- A: 只统计自然语言正文；忽略 YAML front matter、围栏代码块、行内代码、URL、HTML 注释和 Markdown 标记，保留标题、普通链接文字和图片替代文字
- B: 统计所有可读内容，包括代码块中的文字
- C: 尽量直接统计原始源码，只排除少量 Markdown 标记
**Decision:** A
**Rationale:** 用户接受推荐方案，希望词频反映文章正文而不是代码或元数据。
**Timestamp:** 2026-10-19 17:04

### Q3: 字数和候选词的中文限定
**Options Presented:**
- A: 中文字数只统计汉字字符；高频词只保留纯中文词，英文、数字和标点不参与
- B: 中文字数只统计汉字；高频词允许英文缩写和数字作为独立词
- C: 字数统计所有非空白正文字符；高频词也包含英文和数字
**Decision:** A
**Rationale:** 用户接受推荐方案，工具只衡量中文文本。
**Timestamp:** 2026-10-19 17:05

### Q4: 高频词过滤规则
**Options Presented:**
- A: 过滤内置中文停用词并忽略单字词，只比较长度至少为 2 的中文词
- B: 只忽略单字词，不过滤“的、了、是”等停用词
- C: 保留所有中文词，包括单字和高频虚词
**Decision:** A
**Rationale:** 用户接受推荐方案，希望高频结果更有信息量。
**Timestamp:** 2026-10-19 17:06

### Q5: 命令的输出形态
**Options Presented:**
- A: 默认输出易读的终端表格，同时提供 `--json` 供脚本处理
- B: 只输出固定格式的纯文本
- C: 只输出 JSON
**Decision:** A
**Rationale:** 用户接受推荐方案，兼顾人工阅读与机器消费。
**Timestamp:** 2026-10-19 17:07

### Q6: 实现技术栈
**Options Presented:**
- A: Node.js + TypeScript，使用 `remark` 和 `@node-rs/jieba`，经 npm 分发
- B: Python + `jieba`，中文 NLP 生态成熟，但当前机器缺少 Python
- C: Rust + `jieba-rs`，可生成单文件程序，但当前机器缺少 Rust 且开发成本最高
**Decision:** A
**Rationale:** 用户接受推荐方案；当前环境已有 Node.js 24，可直接开发和测试。
**Timestamp:** 2026-10-19 17:08

### Q7: 目录扫描范围
**Options Presented:**
- A: 递归扫描子目录；识别 `.md` 和 `.markdown`（不区分大小写）；跳过隐藏目录和符号链接目录；按相对路径稳定排序
- B: 递归扫描，但包含隐藏目录并跟随符号链接
- C: 只扫描指定目录第一层
**Decision:** A
**Rationale:** 用户接受推荐方案，兼顾完整性和可预测、安全的扫描行为。
**Timestamp:** 2026-10-19 17:09

### Q8: 错误处理与退出码
**Options Presented:**
- A: 根路径无效时退出码为 2；单文件读取或严格 UTF-8 解码失败时报告并继续；存在任何文件失败时最终退出码为 1
- B: 任意不可读文件都立即中止
- C: 尽量跳过问题文件并始终返回成功
**Decision:** A
**Rationale:** 用户接受推荐方案，保证批处理可继续，同时让自动化能感知部分失败。
**Timestamp:** 2026-10-19 17:10

### Q9: 目标文件规模
**Options Presented:**
- A: 普通个人知识库，约几千个 Markdown 文件；顺序读取、逐文件统计
- B: 数万个文件；加入受控并发和批量优化
- C: 持续变化的大型目录；加入增量索引或监听模式
**Decision:** A
**Rationale:** 用户接受推荐方案，目标规模不需要并发、索引等额外复杂度。
**Timestamp:** 2026-10-19 17:09

### Q10: 命令入口与参数接口
**Options Presented:**
- A: `mdzh-stats <目录>`，目录参数必填；`--json` 切换为 JSON 输出
- B: `mdzh-stats [目录]`，省略时扫描当前目录
- C: 一次传入多个目录或具体文件
**Decision:** A
**Rationale:** 用户接受推荐方案，选择最小且语义明确的命令入口。
**Timestamp:** 2026-10-19 17:09

### Phase A → B Transition Confirmation [2026-10-19 17:09]
**Alignment Summary (compiled by ds):**
- Decision 1: 使用 `jieba` 精确模式切分中文词。
- Decision 2: 只统计自然语言正文；忽略 front matter、代码块、行内代码、URL、HTML 注释和 Markdown 标记，保留标题、链接文字和图片替代文字。
- Decision 3: 中文字数只计算汉字字符；高频词只保留纯中文词，排除英文、数字和标点。
- Decision 4: 过滤内置中文停用词，并忽略单字词，只比较长度至少为 2 的中文词。
- Decision 5: 默认输出终端表格，并通过 `--json` 提供机器可读输出。
- Decision 6: 使用 Node.js + TypeScript、`remark` 和 `@node-rs/jieba` 实现，经 npm 分发。
- Decision 7: 递归扫描 `.md` 和 `.markdown`（不区分大小写），跳过隐藏目录和符号链接目录，按相对路径稳定排序。
- Decision 8: 根路径无效时退出码为 2；单文件读取或严格 UTF-8 解码失败时报告并继续，存在文件失败时最终退出码为 1。
- Decision 9: 面向数千文件的个人知识库，采用顺序读取和逐文件统计，不引入并发、索引或文件监听。
- Decision 10: 命令为 `mdzh-stats <目录>`，目录参数必填，`--json` 切换输出格式。

**Proposed Spec Defaults (pending confirmation):**
- 每个汉字字符计 1，重复出现重复计数；统计前进行 NFC 规范化。
- 每个文件输出最多 10 个词；先按频次降序，频次相同按词的 Unicode 码位升序，确定性排序。
- 输出路径统一为相对于扫描根目录的 POSIX 风格路径；跨平台使用同一排序和格式。
- 未找到任何 Markdown 文件时返回空结果、在 stderr 给出提示，并以退出码 0 结束。
- JSON 输出为按路径排序的数组，每项包含文件路径、中文字数及前 10 个词及其频次。
- 停用词表随包内置、版本固定，本阶段不提供自定义停用词参数。

**User Confirmation:** ✓ Confirmed

---

## Phase B: Spec Writing Status

- [✓] Initial draft complete (time: 2026-10-19 17:12)
- [✓] Round 1 revision (fallback review only; 2026-10-19 17:17)
- [✓] Round 2 revision (fresh-eyes convergence check; 2026-10-19 17:17)
- [ ] Round 3 revision (not used)
- [✓] Final sign-off (2026-10-19 17:21)

**Draft Spec:** `docs/superpowers/specs/2026-10-19-markdown-zh-word-stats-design.md`

**Sample Matching:** 0 samples selected. The available samples cover reviewer-loop workflows, visual tooling, a zero-dependency server, and worktree harness compatibility; none is a semantic match for a small Chinese text-processing CLI. Multi-reviewer dispatch therefore uses the 6 fixed reviewers and no exemplar-matchers.

## Phase B Review Progress

> Spec drafts must include ## Acceptance Scenarios (Gherkin) after Design Principles.

### Round 1 [✗ multi-agent dispatch failed; fallback review completed]

**Dispatched reviewers (6):** architect | red-team | edge-cases | yagni-gatekeeper | bdd-reviewer | tdd-reviewer

**Receipt Status:** architect ✗ failed | red-team ✗ failed | edge-cases ✗ failed | yagni-gatekeeper ✗ failed | bdd-reviewer ✗ failed | tdd-reviewer ✗ failed  (states: ⏳ waiting | ✓ | ✗ failed)

**Round metadata:** dispatched_count: 6 | successful_receipt_count: 0 | excluded_roles: all

**Transport Failure:** Three native subagents were created but received no task payload across initial dispatch, follow-up, and interrupt/retry; the remaining three could not be created because the agent-thread limit was exhausted. A local Codex CLI fallback could not initialize its writable state directory. No independent receipt is claimed.

**Fallback Mode:** The controller performed a role-separated review against the six prompt files and then applied one fresh-eyes convergence check. This is a degraded fallback, not a substitute for independent multi-agent review, and requires explicit user sign-off on the resulting spec.

**Findings:**

| ID | Sev | Location | Reviewer | Problem | Arbiter | Status |
|----|-----|----------|----------|---------|---------|--------|
| F1.1 | I | §Design / Module Interfaces | architect (fallback) | Named contracts between scanner, extractor, analyzer, renderers, and CLI were absent. | KEEP | ✓ FIXED |
| F1.2 | I | §Markdown Prose Extraction | red-team (fallback) | Raw HTML prose was silently omitted without an explicit scope rule, leaving the prose boundary ambiguous. | KEEP | ✓ FIXED |
| F1.3 | I | §Rendering | red-team (fallback) | Control characters in a display path can break human table rows. | KEEP | ✓ FIXED |
| F1.4 | I | §Error Handling | edge-cases (fallback) | The behavior when every discovered file fails was not explicitly stated. | KEEP | ✓ FIXED |
| F1.5 | I | §Acceptance Scenarios | edge-cases (fallback) | Empty and fully filtered files lacked an observable result contract. | KEEP | ✓ FIXED |
| F1.6 | I | §Goals / Acceptance Scenarios | bdd-reviewer (fallback) | The automated-testing goal had no user-observable scenario and mixed delivery process into product goals. | KEEP | ✓ FIXED |
| F1.7 | I | §Acceptance Scenarios | bdd-reviewer (fallback) | The fewer-than-ten scenario used a non-deterministic “three or fewer” outcome. | KEEP | ✓ FIXED |
| F1.8 | I | §Acceptance Scenarios | bdd-reviewer (fallback) | Default human table headers and row shape had no scenario. | KEEP | ✓ FIXED |
| F1.9 | I | §Dependencies | yagni-gatekeeper (fallback) | `tsx` was listed as a development dependency but had no required role with the selected Vitest/build scripts. | KEEP | ✓ FIXED |
| F1.10 | I | §CLI Contract / §File Inventory | architect (fallback) | The npm bin entry and shebang needed for an installable CLI were not specified. | KEEP | ✓ FIXED |

**Arbiter Output:**
- counts: raw=10 → dedup=10 → after_filter=10 (B=0, I=10, N=0)
- degradation_check: N/A
- convergence_status: CONTINUE
- arbiter_rationale: All ten fallback findings were concrete, removable defects in implementability, scope clarity, or acceptance coverage. None expanded the user-approved feature set; all were fixed in the first revision.

### Appendix (NITs)

- None.

### Round 2 [✓ fallback convergence check]

**Review mode:** fresh-eyes controller pass over the revised draft using the six role checklists.

**Findings:** 0 BLOCKING, 0 IMPORTANT, 0 NIT.

**Arbiter Output:**
- counts: raw=0 → dedup=0 → after_filter=0 (B=0, I=0, N=0)
- degradation_check: PASSED
- convergence_status: STOP_CONVERGED (fallback only)
- arbiter_rationale: The revised draft now names module contracts and packaging, makes raw-HTML exclusion explicit, covers table escaping and all-failure/empty-file states, and aligns every product Goal with observable acceptance coverage.

---

## Phase B User Intervention Decisions

### I1 [⏳ awaiting / ✓ decided]
**Triggered in round:** Round N
**Related finding:** F<x.y>
**Reason for intervention:** ...
**Options Presented:**
- A: ...
- B: ...
**User Decision:** <choice>
**Rationale:** <user reason>
**Timestamp:** YYYY-MM-DD HH:MM
