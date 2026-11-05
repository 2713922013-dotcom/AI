"""模拟面试引擎测试。

重点验三件事：
1. 题目必须长在简历上（能引用项目名、能追问简历里的数字），不是通用模板
2. 评分必须可复现且有区分度（好回答 > 中等 > 差），不能有随机成分
3. 空答/异常输入不能崩
"""

import interview
import interview_bank as bank

PARSED = {
    "skills": ["Python", "SQL", "数据分析"],
    "project_records": [
        {
            "name": "校园二手交易平台",
            "time_range": "2024.03-2024.06",
            "tech_stack": ["Python", "SQL"],
            "description": "从0搭建校园二手交易社群，覆盖5所高校\n日活从200提升至900，月留存45%",
        }
    ],
    "experience_records": [
        {"company": "小红书", "position": "产品运营实习生", "time_range": "2024.06-2024.12"},
    ],
}


def test_family_detection():
    assert bank.detect_family("后端开发工程师") == "backend"
    assert bank.detect_family("数据分析师") == "data"
    assert bank.detect_family("产品经理") == "product"
    assert bank.detect_family("新媒体运营") == "ops"
    assert bank.detect_family("算法工程师") == "algorithm"
    assert bank.detect_family("前端开发工程师") == "frontend"
    assert bank.detect_family("") == "general"
    print("  ✓ 岗位族判定正确")


def test_plan_is_grounded_in_resume():
    plan = interview.build_plan("数据分析师", PARSED)
    text = " ".join(q["question"] for q in plan["questions"])
    assert "校园二手交易平台" in text, "项目名没有出现在题目里，说明没读简历"
    assert "小红书" in text, "实习公司没有出现在题目里"
    assert any(q["category"] == "数字追问" for q in plan["questions"]), "简历里有数字却没生成追问"
    assert 6 <= len(plan["questions"]) <= 9, f"题量异常: {len(plan['questions'])}"
    print(f"  ✓ 题目长在简历上（{plan['family_label']}，{len(plan['questions'])} 题）")


def test_no_resume_still_works():
    plan = interview.build_plan("后端开发工程师", {})
    assert len(plan["questions"]) >= 5
    assert all(q["question"] for q in plan["questions"])
    assert not plan["has_resume_context"]
    print("  ✓ 没有简历也能出题（只出岗位题与通用题）")


def test_jd_gap_question():
    plan = interview.build_plan(
        "后端开发工程师", PARSED,
        "任职要求：熟悉 Java、Spring Boot、MySQL、Redis，了解 Kafka。",
    )
    text = " ".join(q["question"] for q in plan["questions"])
    assert "能力缺口" in [q["category"] for q in plan["questions"]], "JD 有缺口技能却没生成缺口题"
    jd_skills = ["Java", "Spring Boot", "MySQL", "Redis", "Kafka"]
    assert any(s in text for s in jd_skills), "缺口技能没有进入题面"
    # 简历里已有的技能不该被当成缺口
    assert "「Python」" not in text and "「SQL」" not in text, "把自己会的技能当成了缺口"
    print("  ✓ JD 缺口题生成正确")


def test_scoring_discrimination():
    q = [x for x in bank.BACKEND_QUESTIONS if x["id"] == "b1"][0]
    good = ("当时订单接口 P99 到 180ms，用户投诉明显。我先看监控和慢日志，"
            "定位到瓶颈是数据库全表扫描。我设计了二级缓存，压测后 P99 从 180ms 降到 45ms。")
    medium = ("当时接口比较慢，我负责优化。我先看了日志，发现是数据库的问题，"
              "然后加了索引和缓存。最后快了不少。")
    bad = "我做过性能优化，主要是加缓存，效果还不错。"

    s_good = interview.score_answer(q, good)["score"]
    s_mid = interview.score_answer(q, medium)["score"]
    s_bad = interview.score_answer(q, bad)["score"]
    assert s_good > s_mid > s_bad, f"区分度失效: {s_good} / {s_mid} / {s_bad}"
    assert s_good >= 80 and s_bad < 30
    print(f"  ✓ 评分有区分度（{s_good} / {s_mid} / {s_bad}）")


def test_scoring_is_deterministic():
    q = [x for x in bank.DATA_QUESTIONS if x["id"] == "d2"][0]
    ans = "先确认不是埋点问题，然后按渠道、版本、机型拆维度，发现是某个渠道投放停了，最后补投后恢复。"
    a = interview.score_answer(q, ans)["score"]
    b = interview.score_answer(q, ans)["score"]
    assert a == b, "同一份回答两次打分不一致，说明有随机成分"
    print("  ✓ 评分可复现（无随机数）")


def test_empty_and_weird_input():
    q = bank.COMMON_QUESTIONS[0]
    assert interview.score_answer(q, "")["score"] == 0
    assert interview.score_answer(q, "   ")[
        "verdict"
    ].startswith("没有作答")
    r = interview.score_answer(q, "a" * 3000)     # 超长不能崩
    assert 0 <= r["score"] <= 100
    r2 = interview.score_answer({}, "随便答一点内容看看")  # 缺字段不能崩
    assert 0 <= r2["score"] <= 100
    print("  ✓ 空答与异常输入不崩")


def test_every_question_has_required_fields():
    all_q = list(bank.COMMON_QUESTIONS)
    for qs in bank.FAMILY_BANKS.values():
        all_q.extend(qs)
    for q in all_q:
        assert q["question"].strip()
        assert q["points"], f"{q['id']} 缺考察点"
        assert q["model"], f"{q['id']} 缺参考答案要点"
        assert set(q["followups"]) == {"structure", "metric", "depth"}, f"{q['id']} 追问不全"
    ids = [q["id"] for q in all_q]
    assert len(ids) == len(set(ids)), "题目 id 重复"
    print(f"  ✓ 题库 {len(all_q)} 题结构完整")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"  ✗ {t.__name__}: {e}")
    print(f"\n{len(tests) - failed} 通过 / {failed} 失败")
    assert failed == 0, "存在失败用例"
