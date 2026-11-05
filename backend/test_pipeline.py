"""
解析流水线回归测试

覆盖历史上真实出过的问题：
1. 空文本 PDF（扫描件）必须被拒绝，而不是产出一份全是 0 分的假报告
2. 「专业技能」标题不能被当成专业名
3. ATS 评分里项目相关性计算曾经因变量名写错直接 500（只在有项目时触发）
4. Offer 预测必须可复现，不能每次刷新都变

运行：venv/Scripts/python.exe test_pipeline.py
"""
import io
import re
import sys

import fitz

import main


def _pdf_with_text(text, fontname="china-s"):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(50, 50, 545, 792), text, fontsize=9.5,
                        fontname=fontname, lineheight=1.45)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def _blank_pdf():
    """只有图形没有文字，模拟扫描件/图片型简历"""
    doc = fitz.open()
    page = doc.new_page()
    page.draw_rect(fitz.Rect(50, 50, 550, 700), fill=(0.95, 0.95, 0.95))
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


SAMPLE_RESUME = """张明
求职意向：产品运营 | 电话：138-0000-1234 | 邮箱：zhangming@example.com

教育背景
2021.09 - 2025.06  华东师范大学  信息管理与信息系统  本科  GPA 3.7/4.0

专业技能
产品运营、用户增长、数据分析、SQL、Python、Excel、活动策划、A/B测试

实习经历
2024.06 - 2024.12  小红书  产品运营实习生
负责社区内容活动策划，主导3场话题活动，累计曝光1200万
搭建用户分层运营SOP，消息打开率从8%提升至15%

2023.07 - 2023.09  携程  增长运营实习生
负责小程序拉新活动，单月新增注册用户3.2万

项目经历
2024.03 - 2024.06  校园二手交易平台  运营负责人
从0搭建校园二手交易社群，覆盖5所高校，累计用户8000+，日活从200提升至900
"""


def _prepare(pdf_bytes):
    text, info = main.extract_pdf_text(pdf_bytes)
    cleaned = main.clean_resume_text(text)
    sections = main.detect_sections(cleaned)
    parsed = main.structured_extract(cleaned, sections, "产品运营")
    return text, info, cleaned, sections, parsed


# ---------- 1. 扫描件必须被拒绝 ----------
def test_blank_pdf_is_not_usable():
    _, info = main.extract_pdf_text(_blank_pdf())
    assert info["usable"] is False, "空文本 PDF 被误判为可用"
    assert info["reason"] == "no_text"
    assert info["needs_ocr"] is True
    print("  ✓ 扫描件被识别为不可用（reason=no_text）")


def test_english_resume_not_rejected():
    pdf = _pdf_with_text(
        "John Smith\nEducation: Tsinghua University, Computer Science\n"
        "Skills: Python, SQL, React, Machine Learning\n"
        "Experience: Software Engineer Intern, built a recommendation pipeline.",
        fontname="helv",
    )
    _, info = main.extract_pdf_text(pdf)
    assert info["usable"] is True, "纯英文简历被误判为扫描件"
    print(f"  ✓ 英文简历正常通过（英文词 {info['latin_words']} 个）")


# ---------- 2. 字段提取质量 ----------
def test_chinese_resume_fields():
    _, info, _, _, parsed = _prepare(_pdf_with_text(SAMPLE_RESUME))
    assert info["usable"] is True
    assert parsed["name"] == "张明", f"姓名识别错误: {parsed['name']!r}"
    assert parsed["school"] == "华东师范大学", f"学校识别错误: {parsed['school']!r}"
    assert parsed["major"] == "信息管理与信息系统", f"专业识别错误: {parsed['major']!r}"
    assert parsed["education"] == "本科", f"学历识别错误: {parsed['education']!r}"
    assert len(parsed["skills"]) >= 6, f"技能过少: {parsed['skills']}"
    assert len(parsed["experience_records"]) == 2, \
        f"实习经历应为 2 段，实际 {len(parsed['experience_records'])}"
    first = parsed["experience_records"][0]
    assert first.get("company") == "小红书", f"公司识别错误: {first.get('company')!r}"
    assert first.get("position") == "产品运营实习生", f"职位识别错误: {first.get('position')!r}"
    assert first.get("time_range") == "2024.06-2024.12", f"时间识别错误: {first.get('time_range')!r}"
    print(f"  ✓ 姓名/学校/专业/学历/技能({len(parsed['skills'])})/经历({len(parsed['experience_records'])}) 全部正确")


def test_major_not_from_section_heading():
    """「专业技能」标题不能污染专业字段"""
    _, _, _, _, parsed = _prepare(_pdf_with_text(SAMPLE_RESUME))
    assert parsed["major"] != "技能"
    assert not parsed["major"].startswith(("技能", "课程"))
    print("  ✓ 专业字段未被「专业技能」标题污染")


# ---------- 3. ATS 评分不能崩 ----------
def test_ats_score_with_projects():
    """项目相关性曾因变量名写错抛 NameError，只在简历真有项目时触发"""
    _, _, _, _, parsed = _prepare(_pdf_with_text(SAMPLE_RESUME))
    ats = main.calculate_ats_score(parsed, "产品运营", ["产品运营", "数据分析", "SQL"])
    assert 0 <= ats["total_score"] <= 100, f"ATS 分数越界: {ats['total_score']}"
    total_of_dims = sum(d["score"] for d in ats["dimensions"])
    assert abs(total_of_dims - ats["total_score"]) < 0.01, "维度分之和与总分不一致"
    for d in ats["dimensions"]:
        assert d["score"] <= d["max"], f"{d['name']} 超出上限 {d['max']}"
    print(f"  ✓ ATS 评分正常：{ats['total_score']}，维度分之和一致")


# ---------- 4. 预测必须可复现 ----------
def test_forecast_is_deterministic():
    _, _, _, _, parsed = _prepare(_pdf_with_text(SAMPLE_RESUME))
    ats = main.calculate_ats_score(parsed, "产品运营", ["产品运营", "数据分析"])
    gap = main.analyze_skill_gap(parsed, [], "产品运营")

    a = main.deterministic_forecast(parsed, ats, gap, [])
    b = main.deterministic_forecast(parsed, ats, gap, [])
    assert a["interview_probability"] == b["interview_probability"]
    assert a["offer_probability"] == b["offer_probability"]
    assert a["competitiveness_score"] == b["competitiveness_score"]
    assert 0 <= a["offer_probability"] <= a["interview_probability"] <= 100
    print(f"  ✓ 预测可复现：面试 {a['interview_probability']}% / Offer {a['offer_probability']}%")


# ---------- 5. 优化建议不能编造数字 ----------
def test_suggestions_are_grounded():
    """
    简历改写曾整段是模板：无论简历内容如何，都输出「QPS 5000+」
    「Bug率下降40%」「Lighthouse 62→92」这些没发生过的数字。
    候选人照抄进真简历，面试一追问就穿帮。
    """
    text, _, cleaned, _, parsed = _prepare(_pdf_with_text(SAMPLE_RESUME))
    ats = main.calculate_ats_score(parsed, "产品运营", ["产品运营", "数据分析"])
    gap = main.analyze_skill_gap(parsed, [], "产品运营")
    result = main.generate_targeted_suggestions(parsed, ats, gap, "产品运营")
    sections = result["optimized_sections"]
    assert sections, "优化建议为空"

    all_text = "\n".join(s["optimized"] for s in sections)
    for fake in ("QPS", "5000+", "Lighthouse", "Bug率", "复用率", "从0到1项目落地"):
        assert fake not in all_text, f"仍存在编造内容：{fake}"

    # 改写后的每一条都必须来自原文（去掉占位提示后是原文子串）
    norm = lambda s: re.sub(r"\s+", "", s or "")
    source = norm(cleaned)
    placeholders = 0
    for s in sections:
        if not s["section"].startswith(("经历改写", "项目改写")):
            continue
        for line in s["optimized"].split("\n"):
            if not line.startswith("· "):
                continue
            content = line[2:].split("　→")[0].strip()
            if "【补" in content:
                placeholders += 1
                continue
            assert norm(content) in source, f"改写出原文不存在的内容：{content}"

    print(f"  ✓ 优化建议全部有原文依据（{placeholders} 处标注待补真实数字，0 处编造）")


def test_metric_detection():
    """量化判断不能把「5所高校」「8000+」当成没数字"""
    assert main._has_metric("覆盖5所高校，累计用户8000+")
    assert main._has_metric("主导3场话题活动")
    assert main._has_metric("服务超过十万名用户")
    assert not main._has_metric("每周输出数据周报，使用SQL完成留存与转化分析")
    assert not main._has_metric("负责用户增长相关工作，策划多场活动")
    print("  ✓ 量化识别准确（中文数量词与 +号 均可识别）")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    print(f"运行 {len(tests)} 个解析流水线测试\n")
    failed = 0
    for fn in tests:
        print(fn.__name__)
        try:
            fn()
        except AssertionError as e:
            failed += 1
            print(f"  ✗ 失败: {e}")
    print(f"\n{'全部通过' if not failed else f'{failed} 个失败'}")
    sys.exit(1 if failed else 0)
