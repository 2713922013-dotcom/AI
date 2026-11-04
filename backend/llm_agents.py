"""
Offer Hunter - LLM 推理层（Agent 增强）

每个函数都是「可失败的增强」：拿到结果就用，拿不到返回 None，
调用方一律回退到 main.py 里原有的规则引擎。保证任何情况下分析流程不中断。

对应关系：
    parse_resume    → Agent 1 简历解析（结构化抽取）
    review_ats      → Agent 4 ATS 评分（问题诊断）
    rewrite_resume  → Agent 4 ATS 优化（STAR 改写）
    career_advice   → Agent 5 职业教练
    predict_offer   → Agent 6 Offer 预测（叙事 + 校准）
"""

import json

import llm

MAX_RESUME_CHARS = 6000


# ------------------------------------------------------------
# 输出清洗小工具：模型偶尔会返回错误类型，这里统一兜住
# ------------------------------------------------------------
def _as_str(value, limit=500):
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return value.strip()[:limit]


def _as_str_list(value, limit=8, item_limit=200):
    if not isinstance(value, list):
        return []
    out = []
    for item in value:
        if isinstance(item, dict):
            item = item.get("text") or item.get("name") or item.get("title") or ""
        text = _as_str(item, item_limit)
        if text:
            out.append(text)
    return out[:limit]


def _as_int(value, default=0, low=0, high=100):
    try:
        num = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, num))


def _short_json(data, limit=3500):
    try:
        text = json.dumps(data, ensure_ascii=False)
    except Exception:
        return ""
    return text[:limit]


# ------------------------------------------------------------
# Agent 1: 简历结构化解析
# ------------------------------------------------------------
PARSE_SYSTEM = """你是一名资深简历解析专家，服务于中文求职场景。
你的任务是把简历原文抽取成结构化 JSON。

硬性规则：
1. 只抽取原文中真实出现的信息，禁止编造、禁止推测补全
2. 原文没有的字段，字符串留空 ""，数组留空 []
3. education 只能取：博士 / 硕士 / 本科 / 专科 / 其他
4. skills 只放具体技术、工具、方法论名称（如 Python、Figma、用户运营），不要把句子放进去
5. project_records 最多 6 条，experience_records 最多 6 条，按时间倒序
6. 严格输出 JSON，不要任何解释文字、不要 markdown 代码块

输出 JSON 结构：
{
  "name": "", "email": "", "phone": "", "location": "",
  "school": "", "major": "", "education": "", "graduation_year": "", "gpa": "",
  "skills": [], "languages": [], "certifications": [], "awards": [],
  "self_evaluation": "",
  "project_records": [
    {"name": "", "role": "", "tech_stack": [], "description": "", "highlights": []}
  ],
  "experience_records": [
    {"company": "", "position": "", "time_range": "", "description": ""}
  ]
}"""


def parse_resume(resume_text, target_position=""):
    if not llm.is_enabled() or not resume_text or len(resume_text.strip()) < 20:
        return None

    text = resume_text[:MAX_RESUME_CHARS]
    user = "目标岗位：%s\n\n简历原文：\n%s" % (target_position or "未指定", text)

    data = llm.chat_json(PARSE_SYSTEM, user, max_tokens=1800, temperature=0.1, tag="agent1_parse")
    if not isinstance(data, dict):
        return None

    projects = []
    for rec in (data.get("project_records") or [])[:6]:
        if not isinstance(rec, dict):
            continue
        name = _as_str(rec.get("name"), 80)
        desc = _as_str(rec.get("description"), 800)
        if not name and not desc:
            continue
        projects.append(
            {
                "name": name,
                "role": _as_str(rec.get("role"), 60),
                "tech_stack": _as_str_list(rec.get("tech_stack"), limit=10, item_limit=40),
                "description": desc,
                "highlights": _as_str_list(rec.get("highlights"), limit=5, item_limit=200),
            }
        )

    experiences = []
    for rec in (data.get("experience_records") or [])[:6]:
        if not isinstance(rec, dict):
            continue
        company = _as_str(rec.get("company"), 80)
        desc = _as_str(rec.get("description"), 800)
        if not company and not desc:
            continue
        experiences.append(
            {
                "company": company,
                "position": _as_str(rec.get("position"), 60),
                "time_range": _as_str(rec.get("time_range"), 40),
                "description": desc,
            }
        )

    education = _as_str(data.get("education"), 10)
    if education not in ("博士", "硕士", "本科", "专科", "其他"):
        education = ""

    return {
        "name": _as_str(data.get("name"), 20),
        "email": _as_str(data.get("email"), 80),
        "phone": _as_str(data.get("phone"), 30),
        "location": _as_str(data.get("location"), 40),
        "school": _as_str(data.get("school"), 60),
        "major": _as_str(data.get("major"), 60),
        "education": education,
        "graduation_year": _as_str(data.get("graduation_year"), 12),
        "gpa": _as_str(data.get("gpa"), 20),
        "skills": _as_str_list(data.get("skills"), limit=30, item_limit=30),
        "languages": _as_str_list(data.get("languages"), limit=8, item_limit=30),
        "certifications": _as_str_list(data.get("certifications"), limit=10, item_limit=60),
        "awards": _as_str_list(data.get("awards"), limit=8, item_limit=80),
        "self_evaluation": _as_str(data.get("self_evaluation"), 600),
        "project_records": projects,
        "experience_records": experiences,
    }


# ------------------------------------------------------------
# Agent 4-a: ATS 问题诊断
# ------------------------------------------------------------
ATS_SYSTEM = """你是一名有 10 年经验的 ATS（简历筛选系统）审核官，熟悉大厂和中小公司的简历初筛逻辑。
请基于给定的简历结构、ATS 各维度得分和目标岗位，指出真正会导致简历被机器或 HR 筛掉的问题。

要求：
1. 问题必须具体到简历里的内容，禁止说「建议提升整体竞争力」这类空话
2. 每条问题必须给出可直接执行的修改动作
3. 严格输出 JSON，不要任何解释文字、不要 markdown 代码块

输出 JSON 结构：
{
  "verdict": "一句话结论，说明这份简历当前最致命的短板",
  "top_issues": [
    {"title": "问题标题（15字内）", "severity": "高|中|低", "detail": "具体是什么问题，指出简历中的表现", "fix": "怎么改，给出可直接替换的表达方向"}
  ],
  "quick_wins": ["今天就能改完、改完立刻提升通过率的具体动作", "..."]
}"""


def review_ats(parsed, ats_result, target_position):
    if not llm.is_enabled():
        return None

    facts = {
        "target_position": target_position,
        "ats_total": ats_result.get("total_score"),
        "dimensions": [
            {"name": d.get("name"), "score": d.get("score"), "max": d.get("max")}
            for d in (ats_result.get("dimensions") or [])
        ],
        "rule_issues": (ats_result.get("issues") or [])[:8],
        "resume": {
            "education": parsed.get("education"),
            "school": parsed.get("school"),
            "major": parsed.get("major"),
            "skills": (parsed.get("skills") or [])[:20],
            "project_count": len(parsed.get("project_records") or []),
            "project_samples": [
                {"name": p.get("name"), "description": (p.get("description") or "")[:200]}
                for p in (parsed.get("project_records") or [])[:3]
            ],
            "experience_count": len(parsed.get("experience_records") or []),
            "experience_samples": [
                {"company": e.get("company"), "position": e.get("position"), "description": (e.get("description") or "")[:200]}
                for e in (parsed.get("experience_records") or [])[:3]
            ],
            "certifications": parsed.get("certifications") or [],
        },
    }

    data = llm.chat_json(
        ATS_SYSTEM,
        "以下是待审简历的事实数据（JSON）：\n" + _short_json(facts),
        max_tokens=1400,
        temperature=0.3,
        tag="agent4_ats",
    )
    if not isinstance(data, dict):
        return None

    issues = []
    for item in (data.get("top_issues") or [])[:6]:
        if not isinstance(item, dict):
            continue
        title = _as_str(item.get("title"), 40)
        if not title:
            continue
        severity = _as_str(item.get("severity"), 4)
        if severity not in ("高", "中", "低"):
            severity = "中"
        issues.append(
            {
                "title": title,
                "severity": severity,
                "detail": _as_str(item.get("detail"), 300),
                "fix": _as_str(item.get("fix"), 300),
            }
        )

    verdict = _as_str(data.get("verdict"), 200)
    quick_wins = _as_str_list(data.get("quick_wins"), limit=5, item_limit=160)
    if not verdict and not issues:
        return None

    return {"verdict": verdict, "top_issues": issues, "quick_wins": quick_wins}


# ------------------------------------------------------------
# Agent 4-b: 简历段落改写（STAR + 量化）
# ------------------------------------------------------------
REWRITE_SYSTEM = """你是一名简历改写专家，擅长用 STAR 法则和量化数据把平淡的经历改写成有说服力的表达。

要求：
1. original 必须是简历原文里真实存在的片段；原文没有对应内容时写「简历中未体现」
2. optimized 必须包含可验证的量化结果（数字、比例、规模、时长），无法确定时用【待补充：xx】占位，禁止编造具体数字
3. 改写只基于原文已有事实做表达升级，不要新增原文没有的经历
4. 输出 4-6 个最值得改的段落，按提升收益从高到低排序
5. 严格输出 JSON，不要任何解释文字、不要 markdown 代码块

输出 JSON 结构：
{
  "summary": "一句话说明这次改写的核心思路",
  "optimized_sections": [
    {"section": "段落名称，如 项目经历-XX系统", "reason": "为什么这样改，能提升哪一项", "original": "简历原文片段", "optimized": "改写后的表达，可含换行"}
  ]
}"""


def rewrite_resume(parsed, ats_result, gap_analysis, target_position):
    if not llm.is_enabled():
        return None

    facts = {
        "target_position": target_position,
        "ats_total": ats_result.get("total_score"),
        "ats_issues": (ats_result.get("issues") or [])[:6],
        "missing_skills": [
            m.get("name") for m in (gap_analysis.get("missing_skills") or [])[:8] if isinstance(m, dict)
        ],
        "projects": [
            {
                "name": p.get("name"),
                "role": p.get("role"),
                "tech_stack": p.get("tech_stack"),
                "description": (p.get("description") or "")[:400],
            }
            for p in (parsed.get("project_records") or [])[:4]
        ],
        "experiences": [
            {
                "company": e.get("company"),
                "position": e.get("position"),
                "description": (e.get("description") or "")[:400],
            }
            for e in (parsed.get("experience_records") or [])[:4]
        ],
        "self_evaluation": (parsed.get("self_evaluation") or "")[:300],
        "skills": (parsed.get("skills") or [])[:20],
    }

    data = llm.chat_json(
        REWRITE_SYSTEM,
        "以下是简历事实数据（JSON）：\n" + _short_json(facts),
        max_tokens=2200,
        temperature=0.4,
        tag="agent4_rewrite",
    )
    if not isinstance(data, dict):
        return None

    sections = []
    for item in (data.get("optimized_sections") or [])[:6]:
        if not isinstance(item, dict):
            continue
        section = _as_str(item.get("section"), 60)
        optimized = _as_str(item.get("optimized"), 1200)
        if not section or not optimized:
            continue
        sections.append(
            {
                "section": section,
                "reason": _as_str(item.get("reason"), 200),
                "original": _as_str(item.get("original"), 800) or "简历中未体现",
                "optimized": optimized,
            }
        )

    if not sections:
        return None

    return {"original": "", "optimized_sections": sections, "summary": _as_str(data.get("summary"), 200)}


# ------------------------------------------------------------
# Agent 5: 职业教练
# ------------------------------------------------------------
COACH_SYSTEM = """你是一名面向大学生的职业发展教练，熟悉校招和实习市场。
请基于简历事实、目标岗位和技能缺口，给出有判断力的诊断与建议。

要求：
1. 优势必须引用简历里的具体事实（项目、技能、经历），不要说套话
2. 短板必须指向可改进项，并说明它在筛选环节的实际影响
3. 成长建议要分优先级，第一条必须是未来 2 周内能启动的动作
4. 每条控制在 60 字以内
5. 严格输出 JSON，不要任何解释文字、不要 markdown 代码块

输出 JSON 结构：
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "growth_advice": ["..."],
  "interview_focus": ["面试最可能被追问的 3-5 个点，以及准备方向"]
}"""


def career_advice(parsed, gap_analysis, matched_jobs, target_position):
    if not llm.is_enabled():
        return None

    facts = {
        "target_position": target_position,
        "education": parsed.get("education"),
        "school": parsed.get("school"),
        "major": parsed.get("major"),
        "skills": (parsed.get("skills") or [])[:20],
        "projects": [
            {"name": p.get("name"), "role": p.get("role"), "tech": p.get("tech_stack")}
            for p in (parsed.get("project_records") or [])[:4]
        ],
        "experiences": [
            {"company": e.get("company"), "position": e.get("position")}
            for e in (parsed.get("experience_records") or [])[:4]
        ],
        "gap_stats": gap_analysis.get("stats"),
        "missing_skills": [
            {"name": m.get("name"), "importance": m.get("importance"), "category": m.get("category")}
            for m in (gap_analysis.get("missing_skills") or [])[:8]
            if isinstance(m, dict)
        ],
        "top_matched_jobs": [
            {"title": j.get("title"), "match_score": j.get("match_score")}
            for j in (matched_jobs or [])[:5]
        ],
    }

    data = llm.chat_json(
        COACH_SYSTEM,
        "以下是候选人事实数据（JSON）：\n" + _short_json(facts),
        max_tokens=1400,
        temperature=0.5,
        tag="agent5_coach",
    )
    if not isinstance(data, dict):
        return None

    result = {
        "strengths": _as_str_list(data.get("strengths"), limit=6, item_limit=160),
        "weaknesses": _as_str_list(data.get("weaknesses"), limit=6, item_limit=160),
        "growth_advice": _as_str_list(data.get("growth_advice"), limit=6, item_limit=160),
        "interview_focus": _as_str_list(data.get("interview_focus"), limit=5, item_limit=180),
    }
    if not any(result.values()):
        return None
    return result


# ------------------------------------------------------------
# Agent 6: Offer 预测校准
# ------------------------------------------------------------
PREDICT_SYSTEM = """你是一名招聘数据模型分析师。给定候选人的简历事实、ATS 得分、技能覆盖率和岗位匹配情况，
请给出经过校准的面试概率和 Offer 概率判断。

校准基准（务必遵守）：
- 应届本科生平均面试邀约率约 30%，Offer 率约 12%
- ATS 得分 80 以上且技能覆盖率 60% 以上，面试概率应在 55-80 区间
- ATS 得分 50 以下，面试概率通常不高于 35
- offer_probability 必须小于 interview_probability
- 不确定时给出区间中位数，不要给极端值

要求：
1. reasoning 要说明判断依据，引用具体数字
2. key_factors 列出 3-5 个影响最大的因素
3. radar_data 恰好 5 项，name 固定为：学历背景、技能匹配、项目经验、行业竞争力、发展潜力
4. 严格输出 JSON，不要任何解释文字、不要 markdown 代码块

输出 JSON 结构：
{
  "interview_probability": 0,
  "offer_probability": 0,
  "competitiveness_score": 0,
  "reasoning": "",
  "key_factors": [{"factor": "", "impact": "正向|负向", "note": ""}],
  "radar_data": [{"name": "", "score": 0}]
}"""


def predict_offer(parsed, ats_result, gap_analysis, matched_jobs, baseline, target_position):
    if not llm.is_enabled():
        return None

    facts = {
        "target_position": target_position,
        "ats_total": ats_result.get("total_score"),
        "ats_dimensions": [
            {"name": d.get("name"), "score": d.get("score"), "max": d.get("max")}
            for d in (ats_result.get("dimensions") or [])
        ],
        "skill_coverage_pct": (gap_analysis.get("stats") or {}).get("coverage_pct"),
        "matched_job_count": len(matched_jobs or []),
        "avg_match_score": round(
            sum((j.get("match_score") or 0) for j in (matched_jobs or [])[:10]) / max(min(len(matched_jobs or []), 10), 1),
            1,
        ),
        "education": parsed.get("education"),
        "school": parsed.get("school"),
        "skill_count": len(parsed.get("skills") or []),
        "project_count": len(parsed.get("project_records") or []),
        "experience_count": len(parsed.get("experience_records") or []),
        "rule_baseline": baseline,
    }

    data = llm.chat_json(
        PREDICT_SYSTEM,
        "以下是候选人数据（JSON）：\n" + _short_json(facts),
        max_tokens=1200,
        temperature=0.3,
        tag="agent6_predict",
    )
    if not isinstance(data, dict):
        return None

    radar = []
    for item in (data.get("radar_data") or [])[:5]:
        if not isinstance(item, dict):
            continue
        name = _as_str(item.get("name"), 12)
        if name:
            radar.append({"name": name, "score": _as_int(item.get("score"), 0, 0, 100)})

    factors = []
    for item in (data.get("key_factors") or [])[:5]:
        if not isinstance(item, dict):
            continue
        factor = _as_str(item.get("factor"), 40)
        if factor:
            factors.append(
                {
                    "factor": factor,
                    "impact": "正向" if _as_str(item.get("impact"), 4) == "正向" else "负向",
                    "note": _as_str(item.get("note"), 120),
                }
            )

    result = {
        "interview_probability": _as_int(data.get("interview_probability"), 0, 0, 99),
        "offer_probability": _as_int(data.get("offer_probability"), 0, 0, 95),
        "competitiveness_score": _as_int(data.get("competitiveness_score"), 0, 0, 99),
        "reasoning": _as_str(data.get("reasoning"), 400),
        "key_factors": factors,
        "radar_data": radar if len(radar) == 5 else [],
    }
    if not result["reasoning"] and not result["interview_probability"]:
        return None
    return result
