"""生成简历解析评测集。

这些 PDF 不是用户的真实简历，而是按常见排版（单栏/双栏/表格/无小标题/英文/多页）
构造的测试样本，用于量化解析准确率。每份样本的期望值见 expected.json。

用法：python eval/gen_resumes.py
"""

import os

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "resumes")

W, H = 595, 842
LEFT = 52
TOP = 56


RIGHT_MARGIN = 40


def wrap_text(text, fontname, size, max_width):
    """按可用宽度折行。超出右边界的内容在 PDF 里会被裁掉，真实简历也会折行。"""
    if not text:
        return [""]
    lines, cur = [], ""
    for ch in text:
        trial = cur + ch
        if pymupdf.get_text_length(trial, fontname=fontname, fontsize=size) > max_width and cur:
            # 英文尽量在空格处断
            if ch != " " and " " in cur:
                head, _, tail = cur.rpartition(" ")
                if head:
                    lines.append(head)
                    cur = tail + ch
                    continue
            lines.append(cur)
            cur = ch
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


class Flow:
    """极简纵向排版器：逐行往下写，可指定 x/y 以模拟分栏。"""

    def __init__(self, page, x=LEFT, y=TOP, right=W - RIGHT_MARGIN):
        self.page = page
        self.x = x
        self.y = y
        self.right = right

    def put(self, text="", size=10, bold=False, gap=5):
        if text:
            fontname = "china-ss" if bold else "china-s"
            max_width = self.right - self.x
            for line in wrap_text(text, fontname, size, max_width):
                self.page.insert_text((self.x, self.y), line,
                                      fontname=fontname, fontsize=size)
                self.y += size + 4
        self.y += gap - 4 if text else 0
        return self

    def blank(self, n=6):
        self.y += n
        return self


def new_page(doc):
    return doc.new_page(width=W, height=H)


# ---------------------------------------------------------------- 01 应届·单栏·运营
def resume_01():
    doc = pymupdf.open()
    f = Flow(new_page(doc))
    f.put("李思远", 16, True, 8)
    f.put("求职意向：新媒体运营 / 用户运营", gap=4)
    f.put("手机：139-1234-5678  邮箱：lisiyuan@163.com  上海", gap=14)

    f.put("教育背景", 11, True)
    f.put("2022.09 - 2026.06   上海财经大学   市场营销   本科", gap=3)
    f.put("主修课程：市场调研、消费者行为学、统计学；GPA 3.6/4.0", gap=12)

    f.put("实习经历", 11, True)
    f.put("2025.07 - 2025.12   得物   内容运营实习生", gap=3)
    f.put("负责潮流社区话题运营，策划12期专题，单期最高曝光260万")
    f.put("搭建选题库与内容排期表，内容产出周期从3天缩短至1天")
    f.put("按用户分层推送，新用户7日留存从21%提升至34%", gap=8)
    f.put("2024.12 - 2025.03   上海某MCN   新媒体运营实习生", gap=3)
    f.put("运营小红书账号，3个月涨粉1.2万，笔记平均互动率6.8%", gap=12)

    f.put("项目经历", 11, True)
    f.put("2025.03 - 2025.06   校园种草社群   负责人", gap=3)
    f.put("从0搭建2000人社群，设计裂变规则，月均新增400人", gap=12)

    f.put("荣誉奖项", 11, True)
    f.put("2024年  校级优秀学生干部", gap=3)
    f.put("2025年  全国大学生广告艺术大赛  省级三等奖", gap=12)

    f.put("专业技能", 11, True)
    f.put("内容策划、短视频运营、小红书、抖音、数据分析、Excel、Photoshop")
    doc.save(os.path.join(OUT_DIR, "01_fresh_ops.pdf"))


# ---------------------------------------------------------------- 02 社招·三段经历·后端
def resume_02():
    doc = pymupdf.open()
    f = Flow(new_page(doc))
    f.put("陈浩", 16, True, 8)
    f.put("Java 后端开发工程师", gap=4)
    f.put("电话：15900008888  邮箱：chenhao.dev@gmail.com  杭州", gap=14)

    f.put("工作经历", 11, True)
    f.put("2022.03 - 至今   蚂蚁集团   高级后端工程师", gap=3)
    f.put("负责支付清结算核心链路，日均交易量3000万笔，P99延迟从180ms降至65ms")
    f.put("主导账务系统分库分表改造，单表12亿数据拆分为64个分片")
    f.put("建设灰度发布与回滚机制，故障恢复时间从30分钟缩短到3分钟", gap=8)
    f.put("2019.07 - 2022.02   网易   后端开发工程师", gap=3)
    f.put("参与电商订单系统开发，支撑大促峰值QPS 2万")
    f.put("优化订单查询接口，引入Redis多级缓存，接口耗时下降70%", gap=14)

    f.put("教育背景", 11, True)
    f.put("2015.09 - 2019.06   浙江大学   软件工程   本科", gap=12)

    f.put("专业技能", 11, True)
    f.put("Java、Spring Boot、Spring Cloud、MySQL、Redis、Kafka、Docker、")
    f.put("Kubernetes、分布式系统、JVM调优")
    doc.save(os.path.join(OUT_DIR, "02_social_backend.pdf"))


# ---------------------------------------------------------------- 03 双栏·数据分析
def resume_03():
    doc = pymupdf.open()
    page = new_page(doc)
    left = Flow(page, 46, TOP)
    left.put("赵雪", 15, True, 8)
    left.put("数据分析师", gap=4)
    left.put("电话 18612345678", gap=2)
    left.put("邮箱 zhaoxue@outlook.com", gap=12)
    left.put("教育背景", 10, True)
    left.put("2019.09 - 2023.06", gap=2)
    left.put("武汉大学", gap=2)
    left.put("统计学  本科", gap=2)
    left.put("GPA 3.8/4.0", gap=12)
    left.put("专业技能", 10, True)
    left.put("Python、SQL、Pandas", gap=2)
    left.put("NumPy、Tableau", gap=2)
    left.put("Power BI、A/B测试", gap=2)
    left.put("统计建模", gap=2)

    right = Flow(page, 320, TOP + 30)
    right.put("工作经历", 10, True)
    right.put("2023.07 - 至今  美团  数据分析师", gap=3)
    right.put("负责到店业务经营分析，搭建20张核心指标看板")
    right.put("通过漏斗分析定位下单流失点，推动改版后转化率提升9%", gap=12)
    right.put("项目经历", 10, True)
    right.put("2024.02 - 2024.08  用户流失预警模型", gap=3)
    right.put("用XGBoost构建流失预测模型，AUC 0.82，召回率提升25%", gap=12)
    right.put("荣誉奖项", 10, True)
    right.put("2022年  校级三好学生")
    doc.save(os.path.join(OUT_DIR, "03_two_column_da.pdf"))


# ---------------------------------------------------------------- 04 英文简历
def resume_04():
    doc = pymupdf.open()
    f = Flow(new_page(doc))
    f.put("Emily Zhang", 16, True, 8)
    f.put("Data Analyst", gap=4)
    f.put("Phone: +86 137 0000 8888 | Email: emily.zhang@example.com | Shanghai", gap=14)

    f.put("EDUCATION", 11, True)
    f.put("2016.09 - 2020.06  Fudan University  Statistics  Bachelor  GPA 3.7/4.0", gap=12)

    f.put("EXPERIENCE", 11, True)
    f.put("2020.07 - 2023.12  ByteDance  Data Analyst", gap=3)
    f.put("Built 30+ dashboards in Tableau, cut weekly reporting time by 60%")
    f.put("Led A/B testing program for feed ranking, improved CTR by 12%", gap=12)

    f.put("PROJECTS", 11, True)
    f.put("2023.01 - 2023.06  Churn Prediction Model", gap=3)
    f.put("Trained XGBoost model on 200k users, AUC 0.85, recall up 18%", gap=12)

    f.put("SKILLS", 11, True)
    f.put("Python, SQL, Tableau, Excel, Machine Learning, Statistics")
    doc.save(os.path.join(OUT_DIR, "04_english_da.pdf"))


# ---------------------------------------------------------------- 05 硕士·无实习·科研为主
def resume_05():
    doc = pymupdf.open()
    f = Flow(new_page(doc))
    f.put("周子墨", 16, True, 8)
    f.put("求职意向：算法工程师", gap=4)
    f.put("手机：13711112222  邮箱：zhouzimo@126.com  北京", gap=14)

    f.put("教育背景", 11, True)
    f.put("2023.09 - 2026.06   北京邮电大学   计算机科学与技术   硕士", gap=3)
    f.put("2020.09 - 2023.06   北京邮电大学   计算机科学与技术   本科", gap=12)

    f.put("科研经历", 11, True)
    f.put("2024.03 - 2025.06   多模态检索增强生成   实验室项目", gap=3)
    f.put("基于CLIP与向量数据库构建图文检索系统，Recall@10提升18%")
    f.put("在3万条数据集上完成评测，推理延迟控制在80ms", gap=12)

    f.put("项目经历", 11, True)
    f.put("2024.10 - 2025.02   简历解析工具", gap=3)
    f.put("使用PyMuPDF与正则规则实现中文简历结构化，字段准确率92%", gap=12)

    f.put("荣誉奖项", 11, True)
    f.put("2023年  研究生学业奖学金一等奖", gap=3)
    f.put("2022年  全国大学生数学建模竞赛  国家二等奖", gap=12)

    f.put("专业技能", 11, True)
    f.put("Python、PyTorch、Transformers、RAG、LLM、SQL、Linux")
    doc.save(os.path.join(OUT_DIR, "05_master_alg.pdf"))


# ---------------------------------------------------------------- 06 表格·教育经历
def resume_06():
    doc = pymupdf.open()
    page = new_page(doc)
    f = Flow(page)
    f.put("孙悦", 16, True, 8)
    f.put("产品经理", gap=4)
    f.put("电话：13566667777 | 邮箱：sunyue@qq.com | 深圳", gap=10)

    f.put("教育经历", 11, True, 8)

    # 画一个 4 行的表格：时间 / 学校 / 专业 / 学历
    x0, y0 = 52, f.y
    rows = [
        ["2017.09-2021.06", "中山大学", "工商管理", "本科"],
        ["2021.09-2024.06", "中山大学", "企业管理", "硕士"],
    ]
    col_w = [110, 100, 110, 60]
    row_h = 22
    for r, row in enumerate(rows):
        x = x0
        for c, cell in enumerate(row):
            rect = pymupdf.Rect(x, y0 + r * row_h, x + col_w[c], y0 + (r + 1) * row_h)
            page.draw_rect(rect, color=(0.6, 0.6, 0.6), width=0.6)
            page.insert_text((x + 5, y0 + r * row_h + 15), cell, fontname="china-s", fontsize=9)
            x += col_w[c]

    f.y = y0 + len(rows) * row_h + 20
    f.put("工作经历", 11, True)
    f.put("2024.07 - 至今   腾讯   产品经理", gap=3)
    f.put("负责企业微信客户联系模块，DAU从800万提升至1200万")
    f.put("主导客户群功能迭代，需求交付周期从6周缩短到3周", gap=12)

    f.put("项目经历", 11, True)
    f.put("2023.06 - 2024.01   校园招聘平台改版", gap=3)
    f.put("重构投递流程，转化率提升15%", gap=12)

    f.put("专业技能", 11, True)
    f.put("需求分析、PRD撰写、Axure、SQL、用户调研、A/B测试", gap=12)

    f.put("证书", 11, True)
    f.put("PMP 项目管理专业人士、英语六级")
    doc.save(os.path.join(OUT_DIR, "06_table_pm.pdf"))


# ---------------------------------------------------------------- 07 无小标题·纯段落
def resume_07():
    doc = pymupdf.open()
    f = Flow(new_page(doc))
    f.put("吴桐", 15, True, 6)
    f.put("求职意向 前端开发工程师", gap=3)
    f.put("电话 13022223333 邮箱 wutong@foxmail.com 成都", gap=10)
    f.put("2017.09-2021.06 电子科技大学 软件工程 本科", gap=10)
    f.put("2021.07-2023.08 京东 前端开发工程师 负责商家后台管理系统开发，", gap=3)
    f.put("使用React与TypeScript，页面首屏加载从3.2s优化到1.1s", gap=8)
    f.put("2023.09-至今 字节跳动 前端开发工程师 主导飞书文档协同编辑模块，", gap=3)
    f.put("支撑日均50万编辑请求，兼容8种浏览器", gap=10)
    f.put("技能 React Vue TypeScript JavaScript Webpack Vite Node.js")
    doc.save(os.path.join(OUT_DIR, "07_no_heading_fe.pdf"))


# ---------------------------------------------------------------- 08 两页·奖项在第二页
def resume_08():
    doc = pymupdf.open()
    f = Flow(new_page(doc))
    f.put("何雨", 16, True, 8)
    f.put("软件测试工程师", gap=4)
    f.put("手机：13233334444  邮箱：heyu.test@163.com  南京", gap=14)

    f.put("教育背景", 11, True)
    f.put("2016.09 - 2020.06   南京航空航天大学   计算机科学与技术   本科", gap=12)

    f.put("工作经历", 11, True)
    f.put("2020.07 - 至今   中兴通讯   测试工程师", gap=3)
    f.put("负责核心网网元自动化测试，用例从1200条扩充到4500条")
    f.put("搭建Jenkins持续集成流水线，回归测试耗时从8小时降至1.5小时", gap=12)

    f.put("专业技能", 11, True)
    f.put("Python、Selenium、Pytest、Postman、JMeter、MySQL、Linux")

    page2 = new_page(doc)
    f2 = Flow(page2)
    f2.put("项目经历", 11, True)
    f2.put("2023.03 - 2023.10   接口自动化测试平台", gap=3)
    f2.put("基于Pytest与Allure搭建平台，覆盖800个接口，缺陷发现提前2天", gap=12)
    f2.put("荣誉奖项", 11, True)
    f2.put("2022年  部门年度优秀员工", gap=3)
    f2.put("2019年  全国大学生软件测试大赛  省级一等奖", gap=12)
    f2.put("证书", 11, True)
    f2.put("软件评测师（中级）、CET-6")
    doc.save(os.path.join(OUT_DIR, "08_two_page_qa.pdf"))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for fn in (resume_01, resume_02, resume_03, resume_04,
               resume_05, resume_06, resume_07, resume_08):
        fn()
    files = sorted(os.listdir(OUT_DIR))
    print(f"已生成 {len(files)} 份样本 -> {OUT_DIR}")
    for name in files:
        size = os.path.getsize(os.path.join(OUT_DIR, name))
        print(f"  {name}  {size} bytes")


if __name__ == "__main__":
    main()
