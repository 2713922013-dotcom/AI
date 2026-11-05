"""简历解析准确率基准测试。

跑法：
    python eval/benchmark.py            # 汇总
    python eval/benchmark.py -v         # 附带每份样本的实际解析结果

口径：
    - 字段级：姓名/手机/邮箱/学校/专业/学历/毕业年份，逐字段比对
    - 技能级：给定清单中至少命中一半算通过（避免因同义词写法差异误判）
    - 记录级：实习/项目条数下限
    - 奖项/证书：条数下限或包含指定关键字
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

import main  # noqa: E402

EXACT_FIELDS = ["name", "phone", "email", "school", "major",
                "education_level", "graduation_year"]


def parse_one(pdf_path, target):
    with open(pdf_path, "rb") as f:
        raw = f.read()
    text, meta = main.extract_pdf_text(raw)
    if not meta.get("usable"):
        return None, meta
    cleaned = main.clean_resume_text(text)
    sections = main.detect_sections(cleaned)
    parsed = main.structured_extract(cleaned, sections, target)
    return parsed, meta


def compare(parsed, exp):
    """返回 [(字段, 期望, 实际, 是否通过)]"""
    rows = []

    for field in EXACT_FIELDS:
        if field not in exp:
            continue
        want = str(exp[field])
        got = str(parsed.get(field) or "")
        ok = want.strip().lower() in got.strip().lower() if field == "name" else want == got
        rows.append((field, want, got, ok))

    if "skills_any" in exp:
        want_list = exp["skills_any"]
        got = [str(s) for s in (parsed.get("skills") or [])]
        hit = [s for s in want_list if any(s.lower() in g.lower() for g in got)]
        need = max(1, len(want_list) // 2)
        rows.append(("skills_any", f"≥{need}/{len(want_list)}",
                     f"{len(hit)}/{len(want_list)} {hit}", len(hit) >= need))

    for kind, need in (exp.get("records_min") or {}).items():
        key = "experience_records" if kind == "experience" else "project_records"
        got_n = len(parsed.get(key) or [])
        rows.append((f"{kind}_count", f"≥{need}", str(got_n), got_n >= need))

    if "awards_min" in exp:
        got_n = len(parsed.get("awards") or [])
        rows.append(("awards_count", f"≥{exp['awards_min']}", str(got_n),
                     got_n >= exp["awards_min"]))

    if "certifications_any" in exp:
        want_list = exp["certifications_any"]
        got = " ".join(str(c) for c in (parsed.get("certifications") or []))
        hit = [w for w in want_list if w.lower() in got.lower()]
        rows.append(("certifications", "包含 " + "/".join(want_list),
                     got[:40] or "空", bool(hit)))

    return rows


def main_run(verbose=False):
    with open(os.path.join(HERE, "expected.json"), encoding="utf-8") as f:
        expected = json.load(f)

    resume_dir = os.path.join(HERE, "resumes")
    if not os.path.isdir(resume_dir):
        print("缺少样本目录，请先运行 python eval/gen_resumes.py")
        return 1

    field_stat = {}
    total_ok = total_all = 0
    failures = []

    print(f"{'样本':28s} {'通过/总数':>9s}  失败字段")
    print("-" * 78)
    for fname in sorted(expected):
        if fname.startswith("_"):
            continue
        exp = expected[fname]
        path = os.path.join(resume_dir, fname)
        if not os.path.exists(path):
            print(f"{fname:28s} {'--':>9s}  样本缺失")
            continue

        parsed, meta = parse_one(path, exp.get("target", ""))
        if parsed is None:
            print(f"{fname:28s} {'--':>9s}  提取失败: {meta.get('reason')}")
            total_all += len(EXACT_FIELDS)
            failures.append((fname, "extract", meta.get("reason")))
            continue

        rows = compare(parsed, exp)
        ok = sum(1 for r in rows if r[3])
        total_ok += ok
        total_all += len(rows)
        bad = [f"{r[0]}(期望{r[1]}→实得{r[2] or '空'})" for r in rows if not r[3]]
        print(f"{fname:28s} {ok:>4d}/{len(rows):<4d}  {'; '.join(bad) if bad else '—'}")
        for r in rows:
            k = r[0]
            field_stat.setdefault(k, [0, 0])
            field_stat[k][1] += 1
            if r[3]:
                field_stat[k][0] += 1

        if verbose:
            print("    实际:", json.dumps({k: v for k, v in parsed.items() if v},
                                          ensure_ascii=False)[:400])
        for r in rows:
            if not r[3]:
                failures.append((fname, r[0], r[1], r[2]))

    print("-" * 78)
    print(f"{'总准确率':28s} {total_ok:>4d}/{total_all:<4d}  {total_ok / max(total_all, 1) * 100:.1f}%")
    print()
    print("分字段准确率：")
    for k in [f for f in EXACT_FIELDS] + ["skills_any", "experience_count",
                                        "project_count", "awards_count", "certifications"]:
        if k not in field_stat:
            continue
        ok, n = field_stat[k]
        bar = "█" * int(ok / n * 20)
        print(f"  {k:18s} {ok:>2d}/{n:<2d} {ok / n * 100:5.1f}%  {bar}")

    return 0 if total_all and total_ok == total_all else 2


if __name__ == "__main__":
    sys.exit(main_run(verbose="-v" in sys.argv))
