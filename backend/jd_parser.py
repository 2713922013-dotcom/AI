"""
JD 解析器 —— 把用户粘贴的招聘网站原文，拆成结构化岗位字段。

为什么要有它：
    国内招聘站（BOSS/拉勾/牛客）全是 SPA + 登录鉴权，抓不到结构化数据。
    但求职者手上本来就有 JD —— 复制一段粘贴进来就行。
    这是唯一能拿到「真实、实时、合规」岗位数据的路径。

设计原则（重要）：
    宁可留空，绝不编造。
    解析不出来的字段返回空值并登记到 missing_fields，由前端让用户补填。
    一个假的薪资（比如凭空写 25-40K）比一个空字段危害大得多 ——
    用户会拿它当决策依据。
"""
import re

from skill_taxonomy import FULL_SKILL_KEYWORDS, normalize_skill

MAX_DESCRIPTION = 4000

# ============================================================
# 城市词表：命中即取，最长优先（"乌鲁木齐"不能被"乌鲁木齐"以外的词抢）
# ============================================================
CITY_LIST = [
    "北京", "上海", "广州", "深圳", "杭州", "成都", "南京", "武汉", "西安", "苏州",
    "天津", "重庆", "长沙", "郑州", "东莞", "青岛", "合肥", "佛山", "宁波", "昆明",
    "沈阳", "无锡", "厦门", "福州", "济南", "大连", "哈尔滨", "长春", "南昌", "贵阳",
    "南宁", "常州", "南通", "嘉兴", "徐州", "温州", "太原", "石家庄", "珠海", "中山",
    "惠州", "烟台", "兰州", "海口", "乌鲁木齐", "呼和浩特", "银川", "西宁", "拉萨",
    "香港", "台北", "澳门", "远程",
]

EDU_PATTERNS = [
    ("博士", ("博士",)),
    ("硕士", ("硕士", "研究生")),
    ("本科", ("本科", "学士")),
    ("大专", ("大专", "专科", "高职")),
    ("中专", ("中专", "中技")),
    ("高中", ("高中",)),
]

# JD 里常见但技能词典没收录的写法。只放不会误伤的，短别名一律不加。
JD_ALIASES = {
    "golang": "Go",
    "k8s": "Kubernetes",
    "postgres": "PostgreSQL",
    "mysql数据库": "MySQL",
    "reactjs": "React",
    "react.js": "React",
    "vue3": "Vue",
    "vue.js": "Vue",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "springboot": "Spring Boot",
    "spring boot": "Spring Boot",
    "微服务架构": "微服务",
    "分布式系统": "分布式",
    "高并发": "分布式",
}

# 招聘网站页面上的噪音行，复制 JD 时会一起带进来
NOISE_PATTERNS = (
    "举报", "竞争力分析", "查看更多", "立即沟通", "微信扫码", "APP内打开",
    "投诉", "收藏", "分享", "职位发布者", "近两周该职位的简历处理率",
    "相似职位", "看过该职位的人还看了", "工商信息", "公司介绍",
)


def _is_word_char(ch):
    return ch.isascii() and (ch.isalnum() or ch in "+#._")


def _find_spans(text, needle):
    """找出 needle 在 text 中的所有合法出现区间（英文词要求左右边界）"""
    spans = []
    tl, nl = text.lower(), needle.lower()
    if not nl:
        return spans
    latin = any(c.isascii() and c.isalpha() for c in needle)
    start = 0
    while True:
        i = tl.find(nl, start)
        if i < 0:
            break
        end = i + len(nl)
        if not latin or (
            (i == 0 or not _is_word_char(text[i - 1]))
            and (end >= len(text) or not _is_word_char(text[end]))
        ):
            spans.append((i, end))
        start = i + 1
    return spans


def extract_skills(text):
    """从 JD 原文提取技能，按「长词优先 + 区间独占」避免子串误判。

    这个算法解决两个经典坑：
      - "JavaScript" 里包含 "Java"，不能同时算作 Java
      - "Django" 里包含 "go"，不能算作 Go
    做法是先匹配长词并占住区间，短词命中已占区间就跳过。
    """
    candidates = sorted(
        {kw for kw in FULL_SKILL_KEYWORDS} | set(JD_ALIASES),
        key=len, reverse=True,
    )
    occupied = []
    hits = []

    for kw in candidates:
        for start, end in _find_spans(text, kw):
            if any(not (end <= s or start >= e) for s, e in occupied):
                continue
            occupied.append((start, end))
            std = JD_ALIASES.get(kw.lower()) or normalize_skill(kw)
            if std and std not in hits:
                hits.append(std)

    return hits


def parse_salary(text):
    """返回 (min_K, max_K)，单位统一为 千元/月。识别不到返回 (None, None)。"""
    # 20-40K / 20k-35k / 20 - 40 K（两端的 K 都可能出现，也可能都没有）
    m = re.search(r"(\d+(?:\.\d+)?)\s*[kK千]?\s*[-~－—至]\s*(\d+(?:\.\d+)?)\s*[kK千]", text)
    if m:
        return int(float(m.group(1))), int(float(m.group(2)))

    # 15-25万/年
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-~－—至]\s*(\d+(?:\.\d+)?)\s*万\s*/?\s*年", text)
    if m:
        return round(float(m.group(1)) * 10 / 12), round(float(m.group(2)) * 10 / 12)

    # 1.5-2.5万（默认按月）
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-~－—至]\s*(\d+(?:\.\d+)?)\s*万", text)
    if m:
        return int(float(m.group(1)) * 10), int(float(m.group(2)) * 10)

    # 8000-12000元/月
    m = re.search(r"(\d{4,6})\s*[-~－—至]\s*(\d{4,6})\s*元", text)
    if m:
        return round(int(m.group(1)) / 1000), round(int(m.group(2)) / 1000)

    # 20K以上
    m = re.search(r"(\d+(?:\.\d+)?)\s*[kK]\s*以上", text)
    if m:
        return int(float(m.group(1))), None

    return None, None


def parse_experience(text):
    m = re.search(r"(\d+)\s*[-~－—至]\s*(\d+)\s*年", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}年"
    m = re.search(r"(\d+)\s*年以上", text)
    if m:
        return f"{m.group(1)}年以上"
    m = re.search(r"(\d+)\s*年以内", text)
    if m:
        return f"{m.group(1)}年以内"
    if re.search(r"应届|在校|实习生|无经验", text):
        return "应届"
    if re.search(r"经验不限|不限经验|无经验要求", text):
        return "经验不限"
    return ""


def parse_education(text):
    if re.search(r"学历不限|不限学历", text):
        return "学历不限"
    for label, keys in EDU_PATTERNS:
        if any(k in text for k in keys):
            return label
    return ""


def parse_city(text):
    """先看前几行（招聘站把地点放在标题下面），再全文兜底。"""
    head = "\n".join(text.splitlines()[:6])
    for city in sorted(CITY_LIST, key=len, reverse=True):
        if city in head:
            return city
    for city in sorted(CITY_LIST, key=len, reverse=True):
        if city in text:
            return city
    return ""


def parse_title(text):
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return ""

    # 1. 显式标记
    for ln in lines[:8]:
        m = re.match(r"^(?:岗位名称|职位名称|岗位|职位|招聘职位)\s*[:：]\s*(.{2,40})$", ln)
        if m:
            return m.group(1).strip()

    # 2. 第一行通常就是岗位名（BOSS 复制出来的格式）
    first = lines[0]
    if 2 <= len(first) <= 30 and not re.search(r"职责|要求|描述|内容|：|:", first):
        return first

    # 3. 找一个像岗位名的短行
    role_words = r"工程师|经理|专员|设计师|运营|开发|分析师|研究员|架构师|顾问|实习生|主管|总监|助理"
    for ln in lines[:15]:
        if 2 <= len(ln) <= 25 and re.search(role_words, ln) and not re.search(r"职责|要求|：|:", ln):
            return ln

    return ""


def parse_company(text):
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for ln in lines[:12]:
        m = re.match(r"^(?:公司名称|公司|企业名称|招聘企业)\s*[:：]\s*(.{2,40})$", ln)
        if m:
            return m.group(1).strip()
    # 「XX有限公司」这类完整工商名
    m = re.search(r"([\u4e00-\u9fa5A-Za-z0-9()（）]{2,30}(?:股份有限公司|有限责任公司|有限公司))", text)
    if m:
        return m.group(1)
    return ""


def clean_description(text):
    """保留原文主体，只去掉招聘站页面的噪音行。

    不做摘要、不改写 —— 用户要看的是原始 JD，
    任何"帮你总结"的加工都会丢信息，也会让后续匹配失真。
    """
    kept = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if any(p in s for p in NOISE_PATTERNS):
            continue
        kept.append(s)
    out = "\n".join(kept).strip()
    return out[:MAX_DESCRIPTION]


def parse_jd(raw_text):
    """主入口。返回结构化字段 + 未识别字段清单 + 解析出的技能数。"""
    text = (raw_text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return {
            "ok": False,
            "reason": "empty_text",
            "message": "JD 内容为空，请粘贴完整的岗位描述",
        }
    if len(text) < 20:
        return {
            "ok": False,
            "reason": "too_short",
            "message": f"JD 只有 {len(text)} 个字符，太短了，请粘贴完整的岗位描述",
        }

    salary_min, salary_max = parse_salary(text)
    skills = extract_skills(text)

    job = {
        "title": parse_title(text),
        "company": parse_company(text),
        "city": parse_city(text),
        "description": clean_description(text),
        "skills_required": skills,
        "education_required": parse_education(text),
        "salary_min": salary_min,
        "salary_max": salary_max,
        "industry": "",
        "experience_required": parse_experience(text),
        "source_url": "",
    }

    # 必填校验：岗位名和技能是这个产品能用的最低要求
    missing = []
    if not job["title"]:
        missing.append("title")
    if not job["company"]:
        missing.append("company")
    if not job["city"]:
        missing.append("city")
    if not job["experience_required"]:
        missing.append("experience_required")
    if not job["education_required"]:
        missing.append("education_required")
    if salary_min is None and salary_max is None:
        missing.append("salary")
    if not skills:
        missing.append("skills_required")

    warnings = []
    if len(skills) == 0:
        warnings.append("没识别出技能关键词，岗位匹配会用不上这条数据，建议手动补充")
    if len(text) > MAX_DESCRIPTION:
        warnings.append(f"JD 原文超过 {MAX_DESCRIPTION} 字，已截断保存")

    return {
        "ok": True,
        "data": job,
        "missing_fields": missing,
        "warnings": warnings,
        "char_count": len(text),
        "skill_count": len(skills),
        "confidence": {
            "high": len(missing) <= 1,
            "label": "识别良好" if len(missing) <= 1 else ("需要补充" if len(missing) <= 3 else "识别较差，请手动填写"),
        },
    }
