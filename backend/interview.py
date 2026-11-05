"""模拟面试引擎：出题 + 确定性评分。

没有大模型也能做"模拟面试"，但必须诚实：
我们不做"AI 扮演面试官和你聊天"，而是做三件确定可验证的事：
    1. 出真问题——岗位高频题 + 从你简历里生成的深挖题（数字必追问）
    2. 按可解释的规则给你的回答打分（结构/量化/具体/相关/篇幅）
    3. 缺什么补什么——没结构就追结构，没数据就追数据

所有分数都由原文命中情况决定，不含随机数。
"""

import re

import interview_bank as bank

# 结构识别：STAR 四要素
_STRUCT_PATTERNS = {
    "情境": r"当时|背景|场景|那段时间|那会儿|项目背景|在.{0,12}(期间|时候)|我们团队|部门",
    "任务": r"目标|任务|需求|要求|需要|负责|要解决|目的是|KPI|指标",
    "行动": r"我(?:主导|负责|设计|实现|搭建|推动|协调|优化|拆分|重写|上线|排查|重构|做了|做了)|主动|自己(?:设计|写|搭)|牵头",
    "结果": r"结果|最终|提升|下降|降低|增长|达到|节省|缩短|从.{0,12}到|带来|拿到",
}

# 量化证据：数字 + 单位/百分比
_METRIC_RE = re.compile(
    r"\d+(?:\.\d+)?\s*(?:%|％|万|千|亿|倍|人|天|小时|分钟|秒|ms|毫秒|元|块|k|K|w|W|qps|QPS|单|场|篇|个)"
    r"|\d+(?:\.\d+)?\s*(?:到|至|→|->)\s*\d+"
)

# 具体性：动作动词 + 技术/方法名词
_ACTION_WORDS = (
    "设计", "实现", "搭建", "优化", "排查", "重构", "拆分", "推动", "协调", "上线",
    "压测", "复盘", "统计", "建模", "投放", "策划", "拆分", "迁", "接入", "落地",
    "定义", "验证", "对比", "估算", "拆解", "对齐", "沉淀",
)
_TECH_RE = re.compile(
    r"[A-Za-z][A-Za-z0-9+#.\-]{1,20}|\d+(?:\.\d+)?%?"
)


# 考察点的同义表达。面试者不会正好说出我们写的那个词，
# 但只要意思到了就该算命中，否则打分全靠运气。
_POINT_SYNONYMS = {
    "定位": ["定位", "排查", "查到", "发现是", "查明", "找到原因"],
    "瓶颈": ["瓶颈", "卡在", "慢在", "根因", "原因"],
    "监控": ["监控", "看板", "告警", "日志", "指标平台"],
    "压测": ["压测", "压力测试", "benchmark", "跑分"],
    "收益": ["收益", "提升", "下降", "降低", "快了", "涨了", "省了", "缩短"],
    "结果": ["结果", "最终", "最后", "效果"],
    "我": ["我负责", "我主导", "我做了", "我设计", "我实现", "我搭"],
    "负责": ["负责", "主导", "承担", "owner"],
    "难点": ["难点", "最难", "卡了", "挑战", "棘手"],
    "方案": ["方案", "做法", "思路", "怎么解决", "解法"],
    "口径": ["口径", "统计方式", "怎么算", "计算方式"],
    "数据来源": ["埋点", "后台导出", "数据来源", "从库里"],
    "改进": ["改进", "优化", "调整", "换成"],
    "公司": ["公司", "这家", "贵司", "业务"],
    "团队": ["团队", "小组", "部门"],
}


def _point_hit(point, answer):
    if not point:
        return False
    low = answer.lower()
    if point.lower() in low:
        return True
    return any(alt.lower() in low for alt in _POINT_SYNONYMS.get(point, []))


def _hit_ratio(answer, points):
    """命中考察点的比例，以及命中/缺失清单。"""
    hit, missed = [], []
    for p in points or []:
        if _point_hit(p, answer):
            hit.append(p)
        else:
            missed.append(p)
    total = len(points or []) or 1
    return len(hit) / total, hit, missed


def _structure_score(answer, question=None):
    """结构分：默认看 STAR 四要素。

    但「这个数字怎么算出来的」「你会怎么排查」这类问题本来就不该讲成故事，
    它们要的是层次（口径→来源→对比）。对这类题另算一个「说明层次」要素，
    否则答得再清楚也会被判成没结构。
    """
    groups = [k for k, pat in _STRUCT_PATTERNS.items() if re.search(pat, answer)]
    category = (question or {}).get("category", "")
    if category in ("数字追问", "能力缺口", "技术选型", "系统设计"):
        layers = sum(1 for w in ("口径", "来源", "计算", "对比", "基线", "周期", "边界", "取舍")
                     if w in answer)
        if layers >= 2:
            groups.append("说明层次")
    return len(groups) / 4 * 25, groups


def _metric_score(answer):
    hits = {m.group(0).strip() for m in _METRIC_RE.finditer(answer)}
    # 带对比语境的裸数字（"基线是200，优化后是900"）也算数据证据，
    # 但它们不如带单位的数字硬，所以单独限流，最多补两个。
    compare_ctx = re.findall(
        r"(?:基线|优化前|优化后|改前|改后|原来|之前|对比|从)[^。；\n]{0,10}?\d+(?:\.\d+)?", answer
    )
    score = min(25.0, len(hits) * 8.5 + min(len(compare_ctx), 2) * 4)
    return score, sorted(hits)[:6]


def _concreteness_score(answer, question):
    actions = {w for w in _ACTION_WORDS if w in answer}
    points = {p for p in (question.get("points") or []) if p and p.lower() in answer.lower()}
    tech = {t for t in _TECH_RE.findall(answer) if len(t) >= 2}
    raw = len(actions) * 2 + len(points) * 3 + min(len(tech), 6) * 1.5
    return min(20.0, raw), sorted(actions)[:5]


def _length_score(answer):
    n = len(answer)
    if n < 40:
        return 2.0, n
    if n < 80:
        return 5.0, n
    if n <= 400:
        return 10.0, n
    if n <= 600:
        return 7.0, n
    return 4.0, n


def score_answer(question, answer):
    """对单题作答打分。返回逐维度得分、命中/缺失要点、以及一条追问。"""
    answer = (answer or "").strip()
    if not answer:
        return {
            "score": 0,
            "dimensions": [],
            "hit_points": [],
            "missed_points": question.get("points") or [],
            "followup": question.get("followups", {}).get("structure"),
            "verdict": "没有作答，这道题等于放弃了展示机会。",
        }

    s_struct, groups = _structure_score(answer, question)
    s_metric, metrics = _metric_score(answer)
    s_concrete, actions = _concreteness_score(answer, question)
    ratio, hit_points, missed_points = _hit_ratio(answer, question.get("points") or [])
    s_relevant = ratio * 20
    s_length, n_chars = _length_score(answer)

    dims = [
        {"key": "structure", "name": "回答结构", "score": round(s_struct, 1), "max": 25,
         "comment": ("覆盖了 " + "/".join(groups) + " 四要素") if groups else "没听出明确的结构，像在平铺直叙"},
        {"key": "metric", "name": "数据支撑", "score": round(s_metric, 1), "max": 25,
         "comment": ("用到了 " + "、".join(metrics[:4]) + " 等具体数字") if metrics else "全程没有数字，面试官无法判断你的工作有多大价值"},
        {"key": "relevant", "name": "命中考点", "score": round(s_relevant, 1), "max": 20,
         "comment": f"命中 {len(hit_points)}/{len(question.get('points') or [])} 个考察点"},
        {"key": "concrete", "name": "具体程度", "score": round(s_concrete, 1), "max": 20,
         "comment": ("说到了 " + "、".join(actions[:4]) + " 等具体动作") if actions else "只有概括性描述，听不出你具体做了什么"},
        {"key": "length", "name": "表达篇幅", "score": round(s_length, 1), "max": 10,
         "comment": f"{n_chars} 字" + ("（偏短，信息量不足）" if n_chars < 80 else "（过长，重点容易被淹没）" if n_chars > 600 else "")},
    ]

    total = round(s_struct + s_metric + s_relevant + s_concrete + s_length)

    # 追问优先级：结构问题最致命 → 没数据 → 不够具体
    followup = None
    fs = question.get("followups") or {}
    if s_struct < 15:
        followup = fs.get("structure")
    elif s_metric < 12:
        followup = fs.get("metric")
    elif s_concrete < 10:
        followup = fs.get("depth")
    elif ratio < 0.5:
        followup = "你答的内容和这道题问的不是同一件事。" + (fs.get("depth") or "")

    # 结论按"最拖后腿的那一项"来说，不能只看得分总和，
    # 否则一个很具体但没讲结构的回答会被说成"太笼统"，方向就指错了。
    if total >= 85:
        verdict = "可以直接拿去面试的水平：有结构、有数据、有细节。"
    elif s_length <= 2 and total < 40:
        verdict = "信息量太少，面试官无从判断。至少要说清：当时什么情况、你做了什么、结果如何。"
    elif s_metric < 12 and s_concrete >= 12:
        verdict = "细节够了，但缺数字。你做的事情说得清，价值说不清——补上前后对比。"
    elif s_struct < 12 and s_concrete >= 12:
        verdict = "内容够具体，但没讲成一段能被记住的话：先说结论，再按层次展开。"
    elif s_relevant < 8 and s_length >= 5:
        verdict = "答得不少，但不是这道题问的。先对着题目里的考察点答。"
    elif total >= 70:
        verdict = "基本能过，但还差一口气——把结果数字补实就稳了。"
    elif total >= 50:
        verdict = "面试官会继续追问，因为关键信息还没给全。按下面的追问重答一次。"
    else:
        verdict = "这个回答在真实面试里会被打断。先补结构和数字。"

    return {
        "score": total,
        "dimensions": dims,
        "hit_points": hit_points,
        "missed_points": missed_points,
        "followup": followup,
        "verdict": verdict,
        "chars": n_chars,
    }


# ------------------------------------------------------------------ 出题
def _clean(s, limit=40):
    s = re.sub(r"\s+", " ", (s or "")).strip()
    return s[:limit]


def _first_metric_sentence(desc):
    for line in (desc or "").split("\n"):
        if _METRIC_RE.search(line) and len(line) > 8:
            return _clean(line, 50)
    return ""


def _resume_questions(parsed):
    """从简历本身生成深挖题。这类题面试官一定会问，也最容易被问穿。"""
    qs = []

    for i, rec in enumerate((parsed.get("project_records") or [])[:2], 1):
        name = _clean(rec.get("name") or "", 24) or f"你简历上的第 {i} 个项目"
        tech = "、".join((rec.get("tech_stack") or [])[:3])
        qs.append(bank.Q(
            f"r-proj-{i}", "项目深挖",
            f"你在「{name}」里具体负责哪一部分？最难的地方是什么？",
            "面试官在确认这个项目到底是不是你做的，以及你有没有真实的判断过程。",
            ["我", "负责", "难点", "方案", "结果"],
            [f"说清你个人负责的那一块，不要用「我们」概括整个过程",
             "讲一个真实的难点：为什么会卡住、你试过什么、最后怎么解决",
             ("项目用到的 " + tech + " 各自解决了什么问题") if tech else "说清技术选型的理由，而不只是用了什么",
             "给出项目的结果或影响，最好带数字"],
            {"structure": "按「我的职责—难点—解法—结果」四段说，别从项目背景讲起。",
             "metric": "这个项目有可量化的结果吗？用户量、性能、效率都行。",
             "depth": "如果重做一次，你会改哪一步？为什么？"},
            150,
        ))

        metric_line = _first_metric_sentence(rec.get("description"))
        if metric_line:
            qs.append(bank.Q(
                f"r-proj-metric-{i}", "数字追问",
                f"你提到「{metric_line}」，这个数字是怎么算出来的？",
                "简历上的数字都会被追问口径，答不上来比不写更糟。",
                ["口径", "数据来源", "计算", "周期", "对比"],
                ["说清统计口径：统计的是什么、时间范围、去重规则",
                 "数据从哪来：埋点、后台导出还是手工统计",
                 "和什么基准对比，提升的部分归因于你的哪项动作"],
                {"structure": "按「口径—来源—对比」三句话说清，不要绕。",
                 "metric": "基线和结果是各多少？统计周期多长？",
                 "depth": "这个提升里有多少是你做的，多少是其它因素带来的？"},
                120,
            ))
            break

    for i, rec in enumerate((parsed.get("experience_records") or [])[:1], 1):
        company = _clean(rec.get("company") or "", 20)
        position = _clean(rec.get("position") or "", 20)
        if not (company or position):
            continue
        where = f"在「{company}」做「{position}」期间" if company and position else f"在「{company or position}」期间"
        qs.append(bank.Q(
            f"r-exp-{i}", "经历深挖",
            f"{where}，你最有成就感的一件事是什么？",
            "面试官想看你是主动解决问题，还是被动等安排。",
            ["背景", "我做的", "结果", "影响"],
            ["挑一件具体的事，说清当时的处境和你被要求解决什么",
             "你具体做了什么（别人替代不了的那部分）",
             "结果如何，对团队/业务有什么影响"],
            {"structure": "按「处境—我做的—结果」讲，别流水账罗列日常职责。",
             "metric": "这件事的效果有数据吗？",
             "depth": "如果当时没人指导你，你会怎么做？"},
            150,
        ))

    return qs


def _jd_gap_questions(parsed, jd_skills):
    """JD 要求但简历里没有的技能，直接问。这是最容易被问穿的题。"""
    own = {str(s).lower() for s in (parsed.get("skills") or [])}
    missing = [s for s in (jd_skills or []) if s.lower() not in own][:2]
    qs = []
    for i, skill in enumerate(missing, 1):
        qs.append(bank.Q(
            f"r-gap-{i}", "能力缺口",
            f"这个岗位要求「{skill}」，你有哪些相关经验？",
            "面试官在验证你的技能缺口有多大，以及你是否诚实。",
            ["了解", "用过", "场景", "计划"],
            ["先给结论：用过 / 只了解 / 没用过，不要含糊",
             "用过就讲场景和边界：在什么项目里、做到什么程度",
             "没用过就说清迁移能力（相近技术/类似问题）和补的节奏"],
            {"structure": "先给「用过/了解/没用过」的结论，再展开，别绕圈。",
             "metric": "用过的话，做过什么规模/量级？",
             "depth": "如果入职就要用，你多久能上手？依据是什么？"},
            120,
        ))
    return qs


def build_plan(target_position="", parsed=None, jd_text=""):
    """生成一场面试的题单。

    结构：自我介绍 → 简历深挖（最多 3 题）→ 岗位专业题 2 题 → 行为题 1 题 → 反问。
    题量控制在 6-8 题，一场 20-30 分钟，符合真实初面节奏。
    """
    parsed = parsed or {}
    family = bank.detect_family(
        target_position,
        parsed.get("skills") or [],
        jd_text,
    )
    family_bank = bank.FAMILY_BANKS.get(family) or []

    jd_skills = []
    if jd_text.strip():
        try:
            import jd_parser
            jd_skills = jd_parser.parse_jd(jd_text)["data"].get("skills_required") or []
        except Exception:
            jd_skills = []

    questions = []
    questions.append(bank.COMMON_QUESTIONS[0])                     # 自我介绍
    questions.extend(_resume_questions(parsed)[:3])                # 简历深挖
    questions.extend(_jd_gap_questions(parsed, jd_skills))         # 能力缺口
    questions.extend(family_bank[:2])                              # 岗位专业题
    questions.append(bank.COMMON_QUESTIONS[3])                     # 团队协作
    questions.append(bank.COMMON_QUESTIONS[5])                     # 反问

    # 去重并补充岗位题，凑到 7 题左右
    seen, unique = set(), []
    for q in questions:
        if q["id"] in seen:
            continue
        seen.add(q["id"])
        unique.append(q)
    for q in family_bank[2:]:
        if len(unique) >= 7:
            break
        if q["id"] not in seen:
            seen.add(q["id"])
            unique.append(q)

    total_time = sum(q.get("time_limit", 120) for q in unique)
    return {
        "family": family,
        "family_label": bank.FAMILY_LABELS.get(family, "通用"),
        "questions": unique,
        "estimated_minutes": round(total_time / 60),
        "has_resume_context": bool(parsed.get("project_records") or parsed.get("experience_records")),
    }
