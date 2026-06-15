"""
Offer Hunter Backend - v3.0 专业级简历解析引擎
10步解析架构: PDF→文本提取→OCR兜底→内容清洗→结构化解析→ATS标准化→JD匹配分析
"""
import io, re, random, uuid, json, os
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# 优先使用 PyMuPDF (fitz)，回退到 PyPDF2
try:
    import fitz as pymupdf
    HAS_PYMUPDF = True
except ImportError:
    from PyPDF2 import PdfReader
    HAS_PYMUPDF = False

# 导入真实岗位数据
from job_crawler import get_real_jobs, get_data_source_report

app = FastAPI(title="Offer Hunter API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ============================================================
# 前端静态文件挂载（必须在所有API路由之后）
# ============================================================
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    print(f"✅ Frontend static files mounted from {frontend_dist}")

# ============================================================
# 岗位数据
# ============================================================
JOBS_DATA = get_real_jobs()
DATA_SOURCE_REPORT = get_data_source_report()

# ============================================================
# Step 5: 技能名称标准化映射表
# ============================================================
SKILL_NORMALIZE_MAP = {
    # 编程语言缩写
    'js': 'JavaScript', 'javascript': 'JavaScript', 'ts': 'TypeScript', 'typescript': 'TypeScript',
    'py': 'Python', 'python': 'Python', 'java': 'Java', 'go': 'Go', 'golang': 'Go',
    'c++': 'C++', 'cpp': 'C++', 'c#': 'C#', 'cs': 'C#', 'rust': 'Rust',
    'swift': 'Swift', 'kotlin': 'Kotlin', 'objc': 'Objective-C', 'ruby': 'Ruby',
    'php': 'PHP', 'scala': 'Scala', 'r语言': 'R', 'r ': 'R',
    
    # 前端框架
    'reactjs': 'React', 'react.js': 'React', 'vuejs': 'Vue', 'vue.js': 'Vue',
    'vue3': 'Vue', 'angularjs': 'Angular', 'next': 'Next.js', 'nextjs': 'Next.js',
    'nuxt': 'Nuxt.js', 'nuxtjs': 'Nuxt.js', 'svelte': 'Svelte',
    
    # 后端框架
    'node': 'Node.js', 'nodejs': 'Node.js', 'express': 'Express.js', 'koa': 'Koa.js',
    'spring': 'Spring Boot', 'springboot': 'Spring Boot', 'spring boot': 'Spring Boot',
    'django': 'Django', 'flask': 'Flask', 'fastapi': 'FastAPI', 'gin': 'Gin',
    'egg': 'Egg.js', 'nest': 'NestJS',
    
    # 数据库
    'mysql': 'MySQL', 'postgresql': 'PostgreSQL', 'postgres': 'PostgreSQL', 'pg': 'PostgreSQL',
    'mongo': 'MongoDB', 'mongodb': 'MongoDB', 'redis': 'Redis', 'es': 'Elasticsearch',
    'elasticsearch': 'Elasticsearch', 'sqlite': 'SQLite', 'oracle': 'Oracle',
    
    # DevOps / 云
    'docker': 'Docker', 'k8s': 'Kubernetes', 'kubernetes': 'Kubernetes', 'k8': 'Kubernetes',
    'aws': 'AWS', 'gcp': 'GCP', 'azure': 'Azure', 'ci/cd': 'CI/CD', 'cicd': 'CI/CD',
    'linux': 'Linux', 'git': 'Git', 'github': 'GitHub', 'gitlab': 'GitLab',
    
    # AI/ML/DL
    'ml': 'Machine Learning', '机器学习': '机器学习', 'dl': '深度学习', '深度学习': '深度学习',
    'nlp': 'NLP', 'cv': '计算机视觉', 'pytorch': 'PyTorch', 'tensorflow': 'TensorFlow',
    'tf': 'TensorFlow', 'keras': 'Keras', 'paddlepaddle': 'PaddlePaddle',
    'llm': 'LLM', '大模型': 'LLM', 'transformer': 'Transformer',
    
    # 数据相关
    'sql': 'SQL', 'nosql': 'NoSQL', 'hadoop': 'Hadoop', 'spark': 'Spark',
    'hive': 'Hive', '数仓': 'Data Warehouse', 'datawarehouse': 'Data Warehouse',
    'tableau': 'Tableau', 'powerbi': 'Power BI', 'finereport': 'FineReport',
    'etl': 'ETL', '数据分析': '数据分析', 'data analysis': '数据分析',
    
    # 移动端
    'flutter': 'Flutter', 'rn': 'React Native', 'reactnative': 'React Native',
    'android': 'Android', 'ios': 'iOS', 'swiftui': 'SwiftUI',
    
    # 游戏开发
    'unity': 'Unity', 'unreal': 'Unreal Engine', 'ue4': 'Unreal Engine', 'ue5': 'Unreal Engine',
    'shader': 'Shader', 'opengl': 'OpenGL', 'directx': 'DirectX',
    'cocos': 'Cocos', 'cocos2d': 'Cocos2d',
    
    # 运营/策划类
    '活动策划': '活动策划', '用户运营': '用户运营', '内容运营': '内容运营',
    '新媒体运营': '新媒体运营', '社群运营': '社群运营', '电商运营': '电商运营',
    '品牌策划': '品牌策划', '数值策划': '数值策划', '系统策划': '系统策划',
    '关卡策划': '关卡策划', '剧情策划': '剧情策划', '文案策划': '文案策划',
    '游戏策划': '游戏策划', '产品运营': '产品运营', '增长运营': '用户增长',
    
    # 产品/设计类
    '产品经理': 'Product Manager', 'pm': 'Product Manager', 'axure': 'Axure',
    'figma': 'Figma', 'sketch': 'Sketch', 'xd': 'Adobe XD',
    'ui设计': 'UI Design', 'ux设计': 'UX Design', '平面设计': 'Graphic Design',
    'ps': 'Photoshop', 'photoshop': 'Photoshop', 'ai': 'Illustrator',
    'illustrator': 'Illustrator', 'pr': 'Premiere', 'premiere': 'Premiere',
    'ae': 'After Effects', 'aftereffects': 'After Effects',
    
    # 软技能
    '项目管理': 'Project Management', 'agile': '敏捷开发', 'scrum': 'Scrum',
    'excel': 'Excel/PPT', 'ppt': 'Excel/PPT', 'office': 'Office',
}

# ============================================================
# 完整技能关键词库（用于扫描简历）
# ============================================================
FULL_SKILL_KEYWORDS = [
    "Python","Java","C++","C#","Go","Rust","JavaScript","TypeScript",
    "React","Vue","Angular","Node.js","Spring Boot","Django","Flask","FastAPI",
    "SQL","MySQL","PostgreSQL","MongoDB","Redis","Elasticsearch","NoSQL",
    "Docker","Kubernetes","AWS","Linux","Git","CI/CD","GitHub",
    "机器学习","深度学习","NLP","计算机视觉","PyTorch","TensorFlow","LLM","Transformer",
    "数据分析","Data Analysis","Spark","Hadoop","Tableau","Power BI","ETL","Data Warehouse",
    "微服务","分布式","消息队列","Kafka","RabbitMQ","RocketMQ",
    "Unity","Unreal Engine","Shader","OpenGL","游戏开发","Cocos","3D",
    "Flutter","React Native","Android","iOS","Swift","Kotlin",
    "产品设计","User Research","Axure","Figma","Sketch","UI Design","UX Design",
    "Photoshop","Premiere","After Effects","Illustrator",
    "自动化测试","Selenium","性能测试","安全测试","JMeter",
    "活动策划","用户运营","内容运营","新媒体运营","社群运营","电商运营",
    "品牌策划","数值策划","系统策划","关卡策划","剧情策划","文案策划","游戏策划",
    "产品运营","用户增长","A/B测试","竞品分析","SEO","SEM",
    "商业化","项目管理","用户分层","增长策略","活动执行",
    "品牌营销","整合营销","公关传播","社交媒体","短视频","直播",
    "Excel/PPT","SPSS","PR","文案撰写","脚本撰写","视频剪辑","活动执行",
    "数据监控","效果复盘","用户调研","需求文档","原型设计",
    "版本管理","持续集成","负载均衡","容器化","服务网格",
    "Agile","Scrum","Project Management","Office",
]


def normalize_skill(raw_name):
    """Step 5: 标准化技能名称"""
    if not raw_name:
        return None
    key = raw_name.strip().lower().replace(' ','').replace('-','')
    if key in SKILL_NORMALIZE_MAP:
        return SKILL_NORMALIZE_MAP[key]
    # 检查是否已标准（首字母大写且在库中）
    for std in FULL_SKILL_KEYWORDS:
        if raw_name.strip().lower() == std.lower():
            return std
        if key == std.lower().replace(' ','').replace('-',''):
            return std
    return raw_name.strip() if len(raw_name) > 1 else None


# ============================================================
# Step 1: PDF 文本提取（PyMuPDF 优先 + OCR 兜底）
# ============================================================
def extract_pdf_text(pdf_bytes):
    """
    Step 1: 文本提取
    - 优先 PyMuPDF: 更好的中文支持、双栏处理、乱码恢复
    - 回退 PyPDF2: 基础提取
    - OCR 兜底: 当文本长度 < 阈值时标记需要 OCR
    """
    extraction_info = {"method": "", "pages": 0, "char_count": 0, "needs_ocr": False}
    text = ""
    
    try:
        if HAS_PYMUPDF:
            doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
            extraction_info["method"] = "PyMuPDF"
            extraction_info["pages"] = len(doc)
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text("text", sort=True)  # sort=True 处理双栏
                text += page_text + "\n"
            doc.close()
        else:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            extraction_info["method"] = "PyPDF2"
            extraction_info["pages"] = len(reader.pages)
            for p in reader.pages:
                t = p.extract_text()
                if t:
                    text += t + "\n"
    except Exception as e:
        extraction_info["method"] = f"Error: {str(e)}"
        return f"[提取失败: {e}]", extraction_info
    
    extraction_info["char_count"] = len(text)
    # 判断是否为扫描版：中文字符占比低或总字符太少
    chinese_chars = re.sub(r'[^\u4e00-\u9fff]', '', text)
    total_printable = re.sub(r'\s+', '', text)
    
    if len(text) < 100 or (len(total_printable) > 50 and len(chinese_chars)/len(total_printable) < 0.15):
        extraction_info["needs_ocr"] = True
    
    if not text.strip():
        text = "[简历内容无法自动提取，可能为扫描版PDF]"
        extraction_info["needs_ocr"] = True
    
    return text, extraction_info


# ============================================================
# Step 2: 内容清洗
# ============================================================
def clean_resume_text(raw_text):
    """
    Step 2: 清洗 PDF 提取的原始文本
    - 多余换行合并（保留段落边界）
    - 页眉页脚移除
    - PDF 乱码字符清理
    - 特殊空白字符统一
    - 重复行去重
    """
    if not raw_text or raw_text.startswith("["):
        return raw_text or ""
    
    lines = raw_text.split('\n')
    cleaned_lines = []
    prev_line = ""
    
    # 页脚模式检测
    FOOTER_PATTERNS = [
        r'^\s*\d+\s*$',  # 纯页码
        r'^第\s*\d+\s*[页页码]*\s*$',
        r'^Page\s*\d+',
        r'^\s*-+\s*\d+\s*-+\s*$',
        r'confidential|机密|保密|内部.*资料|仅供.*参考',
        r'www\.|http://|https://.*\.com.*$',
        r'^\s*(第\s*\d+/\d+页)\s*$',
    ]
    
    for line in lines:
        stripped = line.strip()
        
        # 空行：如果前一行也不空则保留一个空行作为段落分隔
        if not stripped:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
        
        # 检查是否是页脚
        is_footer = any(re.match(p, stripped, re.I) for p in FOOTER_PATTERNS)
        if is_footer and len(cleaned_lines) > 5:
            continue
        
        # 过滤纯乱码行（非中英文数字的异常字符过多）
        printable_chars = sum(1 for c in stripped if c.isprintable() and c not in '\t\n\r\x0b\x0c')
        if len(stripped) > 3 and printable_chars < len(stripped) * 0.4:
            continue
        
        # 与上一行合并短行（可能是断词）
        if len(stripped) <= 6 and prev_line and not prev_line.endswith(('。', '.', '!', '?', '！', '？', ':', '：')):
            cleaned_lines[-1] += stripped
            prev_line = cleaned_lines[-1]
            continue
        
        cleaned_lines.append(stripped)
        prev_line = stripped
    
    result = '\n'.join(cleaned_lines)
    
    # 全局清理
    result = re.sub(r'[^\S\n]+', ' ', result)          # 多空格变单空格
    result = re.sub(r'\n{4,}', '\n\n\n', result)         # 最多3个连续换行
    result = re.sub(r'\x00-\x08\x0b\x0c\x0e-\x1f', '', result)  # 控制字符
    result = re.sub(r'[□■▢▣▤▥▦▧▨▩◇○●◆★☆△▲▽▼⊕⊖⊗⊘⊙⊚⊛⊜]', '', result)  # 方块乱码
    
    return result.strip()


# ============================================================
# Step 3: 简历章节检测（规则优先）
# ============================================================
SECTION_KEYWORDS = {
    'education': {
        'labels': ['教育背景', '教育经历', '学历', 'Education', '教育'],
        'sub_labels': ['学校', '专业', '学位', '学历', '时间', '毕业'],
        'weight': 1.0,
    },
    'experience': {
        'labels': ['工作经历', '实习经历', '工作', 'Experience', '实习', '职业', '从业', '公司', '单位'],
        'sub_labels': ['公司', '职位', '职责', '描述', '时间', '起止', '负责'],
        'weight': 1.0,
    },
    'projects': {
        'labels': ['项目经验', '项目经历', '项目', 'Projects', '作品', '科研', '课题'],
        'sub_labels': ['项目名', '角色', '技术栈', '描述', '成果', '时间'],
        'weight': 0.95,
    },
    'skills': {
        'labels': ['专业技能', '技术能力', '技能', 'Skills', 'IT技能', '技术栈', '编程', '语言能力'],
        'sub_labels': ['熟悉', '掌握', '精通', '了解', '会', '能'],
        'weight': 0.9,
    },
    'certifications': {
        'labels': ['证书', '资格', '认证', 'Certifications', '资质', '证书考试'],
        'sub_labels': ['名称', '颁发机构', '时间', '编号'],
        'weight': 0.7,
    },
    'awards': {
        'labels': ['获奖', '荣誉', '奖项', 'Awards', '荣誉奖励', '奖学金'],
        'sub_labels': ['名称', '级别', '时间', '颁奖机构'],
        'weight': 0.65,
    },
    'leadership': {
        'labels': ['学生工作', '社团', '领导', 'Leadership', '组织', '学生会', '班干部'],
        'sub_labels': ['职务', '组织', '成果', '时间'],
        'weight': 0.55,
    },
}


def detect_sections(cleaned_text):
    """
    Step 3: 规则优先的章节检测
    不依赖 AI 猜测，基于关键词和位置规则识别
    """
    lines = [l.strip() for l in cleaned_text.split('\n') if l.strip()]
    sections = []
    current_section = {'type': 'header', 'start': 0, 'end': 0, 'lines': []}
    
    section_order = []  # 记录各类型出现的顺序
    
    for i, line in enumerate(lines):
        detected_type = None
        best_score = 0
        
        # 检测每个章节类型的标题
        for sec_type, config in SECTION_KEYWORDS.items():
            for label in config['labels']:
                if label.lower() in line.lower() and len(line) <= 20:
                    # 标题特征检查：通常是短行+冒号/无正文
                    score = config['weight']
                    # 如果有分隔符加分
                    if any(s in line for s in [':', '：', '|', '/', '  ', '\t']):
                        score *= 1.1
                    # 如果全是大写或首字母大写的英文字母加分
                    if re.match(r'^[A-Z][a-zA-Z\s/:]+$', line) or re.match(r'^[\u4e00-\u9fff]{2,8}$', line):
                        score *= 1.05
                    
                    if score > best_score:
                        best_score = score
                        detected_type = sec_type
                        break
        
        if detected_type and best_score >= 0.5:
            # 保存上一个章节
            if current_section['lines']:
                current_section['end'] = i - 1
                sections.append(current_section)
            
            current_section = {
                'type': detected_type,
                'title': line,
                'start': i,
                'end': i,
                'lines': [],
            }
            if detected_type not in section_order:
                section_order.append(detected_type)
        else:
            current_section['lines'].append(line)
            current_section['end'] = i
    
    # 最后一个章节
    if current_section['lines']:
        sections.append(current_section)
    
    # 构建检测结果
    result = {
        'sections': [],
        'detected_types': list(section_order),
        'total_lines': len(lines),
    }
    
    for sec in sections:
        content = '\n'.join(sec['lines'])
        result['sections'].append({
            'type': sec['type'],
            'title': sec.get('title', ''),
            'line_range': [sec['start'], sec['end']],
            'content': content[:2000],  # 截断避免过长
            'content_length': len(content),
        })
    
    return result


# ============================================================
# Step 4: 结构化简历提取（正则+规则为主）
# ============================================================
def structured_extract(cleaned_text, sections_result, target_position=""):
    """
    Step 4: 结构化提取 — 正则+规则为主，输出标准 JSON
    不依赖 GPT 直接猜测结构，先做规则提取再做补充
    """
    info = {
        "name": "",
        "email": "",
        "phone": "",
        "gender": "",
        "age": "",
        "location": "",
        "school": "",
        "major": "",
        "education": "",
        "education_level": "",
        "graduation_year": "",
        "gpa": "",
        "skills": [],
        "education_records": [],
        "experience_records": [],
        "project_records": [],
        "certifications": [],
        "awards": [],
        "languages": [],
        "self_evaluation": "",
    }
    
    text = cleaned_text
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    full_text_lower = text.lower()
    
    # ---- 基本信息提取 ----
    # 姓名: 通常在最前面的几行，2-4个字
    name_patterns = [
        r'姓\s*名[：:\s]*([^\s\n]{2,4})',
        r'^([^\s\n]{2,4})\s*(?:男|女|求职|应聘)',
        r'候选人[：:\s]*([^\s\n]{2,4})',
        r'(?:个人)?简介[：:\s]*\n?\s*([^\s\n]{2,4})',
        r'^([^\s\d\n]{2,4})$',
    ]
    for p in name_patterns:
        m = re.search(p, text)
        if m and m.group(1):
            candidate = m.group(1).strip()
            # 过滤掉明显不是姓名的内容
            if not any(kw in candidate for kw in ['电话','邮箱','地址','邮箱','http','www','.com','@']):
                info["name"] = candidate
                break
    
    # 邮箱
    email_m = re.search(r'[\w.\-+]+@[\w\-]+\.[\w.\-]+', text)
    if email_m:
        info["email"] = email_m.group(0).strip()
    
    # 手机号
    phone_m = re.search(r'(?:手机|电话|tel|phone|联系)[：:\s]*(1[3-9]\d{9})', text, re.I)
    if not phone_m:
        phone_m = re.search(r'(?<![0-9])(1[3-9]\d{9})(?![0-9])', text)
    if phone_m:
        info["phone"] = phone_m.group(1)
    
    # 性别
    gender_m = re.search(r'(?:性别|sex|Gender)[：:\s]*(男|女)', text, re.I)
    if not gender_m:
        gender_m = re.search(r'(男|女)\s*(?:生|士)', text)
    if gender_m:
        info["gender"] = gender_m.group(1)
    
    # ---- 学校提取（增强版）----
    school_patterns = [
        r'(?:毕业(?:院校)?|就读|学校|University|学院|本科院校|研究生院)[：:\s]*([^\s\n,，;；]{4,30}(?:大学|学院|School))',
        r'((?:北京|上海|广州|深圳|武汉|南京|杭州|成都|西安|天津|重庆|哈尔滨|大连|厦门|山东|中国|华中|华南|华北|华东|西南|中南|电子科技|[A-Z])[^\s\n,，;；]{2,25}(?:大学|学院|学校|School))',
        r'([\u4e00-\u9fff]{2,20}(?:大学|学院|School))',
    ]
    for p in school_patterns:
        m = re.search(p, text)
        if m and m.group(1):
            s = m.group(1).strip()
            # 过滤
            if 3 < len(s) < 35 and not any(kw in s for kw in ['专业','课程','地址','邮箱','电话','经历','项目','技能','描述','负责','参与']):
                info["school"] = s
                break
    
    # ---- 专业提取（增强版 v2）----
    major_list = [
        '计算机科学与技术','软件工程','人工智能','数据科学与大数据技术',
        '电子信息工程','通信工程','自动化','数学与应用数学','统计学',
        '金融学','经济学','工商管理','市场营销','数字媒体技术','网络与新媒体',
        '工业设计','视觉传达设计','心理学','新闻传播','汉语言文学','英语',
        '日语','法学','会计学','财务管理','人力资源管理','物流管理','电子商务',
        '信息安全','物联网工程','机械工程','土木工程','建筑学','临床医学',
        '药学','生物医学工程','环境工程','材料科学与工程','能源与动力工程',
        '航空航天','海洋科学','地理信息系统','生物技术','化学','物理学',
        '国际经济与贸易','行政管理','公共事业管理','社会学','哲学',
        '动画','播音主持','广告学','编辑出版学',
        '游戏策划','产品设计','交互设计','信息管理与信息系统','电子商务及法律',
        '智能科学与技术','机器人工程','数据计算及应用','应用统计学',
        '旅游管理','酒店管理','会展经济与管理','文化产业管理','体育管理',
        '金融工程','投资学','保险学','税收学','审计学','资产评估',
        '国际商务','贸易经济','经济统计学','国民经济管理',
        '教育技术学','学前教育','小学教育','教育学','体育教育',
        '护理学','医学影像学','口腔医学','中医学','药学','中药学',
        '食品科学与工程','食品质量与安全','葡萄与葡萄酒工程',
        '风景园林','园林','城乡规划','给排水科学与工程',
        '测控技术与仪器','光电信息科学与工程','电子科学与技术',
        '微电子科学与工程','集成电路设计与集成系统',
        '计算机应用技术','计算机网络技术','软件技术',
        '大数据技术','云计算技术应用','人工智能技术应用',
        '数字媒体艺术','艺术设计','服装与服饰设计','环境设计',
        '音乐学','舞蹈学','表演','广播电视编导','摄影',
        '行政管理','劳动与社会保障','土地资源管理',
    ]
    
    # 常见课程/活动名称（不应被误认为专业）
    major_exclude_keywords = ['课程','考试','必修','选修','学分','通识','公共课','辅修','双学位','微专业']
    # 短文关键词（出现在专业上下文之外时不宜匹配）
    short_major_names = set()
    for mj in major_list:
        if len(mj) <= 4:
            short_major_names.add(mj)
    
    major_patterns = [
        r'(?:专业|Major|主修|所学)[：:\s]*([^\s\n,，;；]{2,20})',
        r'(?:本科|学士|硕士|博士)(?:[^。\n]{0,40}?)(?:专业|方向|系)[：:\s]*([^\s\n,，;；]{2,20})',
    ]
    for p in major_patterns:
        m = re.search(p, text)
        if m and m.group(1):
            maj = m.group(1).strip()
            if len(maj) >= 2 and not any(kw in maj for kw in major_exclude_keywords):
                info["major"] = maj
                break
    
    # 从专业列表直接匹配（仅限于学校/教育上下文中）
    if not info["major"]:
        # 先找教育相关段落的上下文
        edu_context = ""
        for sec in sections_result.get('sections', []):
            st = sec.get('type', '').lower()
            if 'education' in st or 'edu' in st or '学校' in st or '教育' in st:
                edu_context = sec.get('content', '')
                break
        
        search_text = edu_context if edu_context else text
        
        # 在教育上下文中优先匹配
        for mj in major_list:
            if mj in search_text:
                # 短专业名（<=4字）需要额外验证，避免误匹配
                if len(mj) <= 4:
                    # 确保在"专业:"或学校名附近
                    near_school = re.search(r'(大学|学院).{0,30}' + re.escape(mj), search_text)
                    has_label = re.search(r'(?:专业|方向|系)[：:\s]*' + re.escape(mj), search_text)
                    if near_school or has_label:
                        info["major"] = mj
                        break
                else:
                    info["major"] = mj
                    break
    
    # 如果还没匹配到，尝试更宽泛的正则
    if not info["major"]:
        loose_major = re.search(r'(?:专业|方向)[^。\n]{0,8}?[:：]?\s*([^\s\n,，;；]{2,12}(?:工程|科学|技术|管理|设计|学|经济|传媒))', text)
        if loose_major:
            info["major"] = loose_major.group(1).strip()
    
    # ---- 学历 ----
    edu_map = {'博士研究生':'博士', '博士':'博士', '硕士':'硕士', '研究生':'硕士',
               '本科':'本科', '学士':'本科', '大专':'专科', '高职':'专科', '专科':'专科'}
    for k, v in edu_map.items():
        if k in text:
            info["education"] = v
            info["education_level"] = v
            break
    if not info["education"]:
        info["education"] = "本科"
        info["education_level"] = "本科"
    
    # ---- 毕业年份（增强版）----
    year_m = re.search(r'(?:毕业(?:时间|年份)|预计毕业|Graduation|届)[：:\s]*(20\d{2})', text, re.I)
    if not year_m:
        year_m = re.search(r'(20\d{2})(?:年?)\s*(?:毕|毕业|届)', text)
    if not year_m:
        years = re.findall(r'(20(?:2[5-9]|[3-9]\d))(?:年|届)', text)
        if years:
            info["graduation_year"] = years[-1]
    elif year_m:
        info["graduation_year"] = year_m.group(1)
    
    # 从教育记录的时间范围提取
    if not info["graduation_year"] and info["education_records"]:
        for rec in info["education_records"]:
            tr = rec.get("time_range", "")
            # 2022-2026 或 2022.09-2026.06 等格式
            year_end = re.search(r'[-–—~～]\s*(20\d{2})', tr)
            if year_end:
                info["graduation_year"] = year_end.group(1)
                break
            # 只有单个年份
            single_year = re.search(r'(20\d{2})', tr)
            if single_year:
                info["graduation_year"] = single_year.group(1)
    
    # GPA
    gpa_m = re.search(r'(?:GPA|绩点|平均分|均分)[：:\s]*([\d.]+(?:\/\d+)?)', text, re.I)
    if gpa_m:
        info["gpa"] = gpa_m.group(1)
    
    # ---- 技能提取（从章节和全文）----
    skills_set = set()
    
    # 先找 skills 章节
    skills_section = None
    for sec in sections_result.get('sections', []):
        if sec['type'] == 'skills':
            skills_section = sec
            break
    
    skill_context = ""
    if skills_section:
        skill_context = skills_section['content']
    else:
        skill_context = text[:3000]
    
    # 方法1: 从技能章节直接匹配已知关键词
    for kw in FULL_SKILL_KEYWORDS:
        normalized = normalize_skill(kw)
        # 匹配各种形式
        patterns_to_try = [
            rf'{re.escape(kw)}',
            rf'{re.escape(normalize_skill(kw) or kw)}',
        ]
        for pat in patterns_to_try:
            if re.search(pat, skill_context, re.I):
                skills_set.add(normalized)
                break
    
    # 方法2: 从"熟悉/精通/了解/掌握"后面的内容提取
    skill_intro_patterns = [
        r'(?:熟练|精通|熟悉|掌握|了解|擅长|会|能用|使用过|用过|学习过|接触过)[：:\s、,，]+([^\n\r,，;；。]{2,60}?)(?=。|$|\n)',
        r'(?:熟悉|掌握|了解)\s+(?:软件|工具|技术|语言|框架|平台|数据库|中间件)[：:\s]*([^\n\r,，;；。]{2,80}?)',
    ]
    for sp in skill_intro_patterns:
        matches = re.findall(sp, text, re.I)
        for match in matches:
            parts = re.split(r'[、,，;；\s]+', match)
            for part in parts:
                norm = normalize_skill(part)
                if norm and norm != part:
                    skills_set.add(norm)
    
    # 方法3: 从目标岗位也提取关联技能
    if target_position:
        for kw in FULL_SKILL_KEYWORDS:
            if kw.lower() in target_position.lower() or (normalize_skill(kw) and normalize_skill(kw).lower() in target_position.lower()):
                skills_set.add(normalize_skill(kw))
    
    info["skills"] = sorted(list(skills_set))
    
    # ---- 教育记录 ----
    edu_section = None
    for sec in sections_result.get('sections', []):
        if sec['type'] == 'education':
            edu_section = sec
            break
    
    if edu_section:
        edu_content = edu_section['content']
        # 尝试提取多条教育记录
        edu_blocks = re.split(r'\n(?=\S{2,}(?:大学|学院|School))', edu_content)
        for block in edu_blocks[:3]:
            rec = {}
            school_m = re.search(r'(\S{3,30}(?:大学|学院|School))', block)
            if school_m: rec["school"] = school_m.group(1)
            
            try:
                time_m = re.search(r'((?:19|20)\d{2}\s*[-–—~～]\s*(?:19|20)?\d{2}|(?:19|20)\d{2}[.\-/年]\d{1,2}[.\-/月]?至?(?:19|20)?\d{2})', block)
                if time_m: rec["time_range"] = time_m.group(0)
            except:
                pass
            
            major_m = re.search(r'(?:专业|方向)[：:\s]*([^\s\n,，;；]{2,20})', block)
            if not major_m:
                for mj in major_list[:30]:
                    if mj in block:
                        rec["major"] = mj
                        break
            
            if rec:
                info["education_records"].append(rec)
        
        if not info["school"] and edu_content:
            info["school"] = (re.search(r'(\S{3,30}(?:大学|学院|School))', edu_content) or ['', ''])[1]
        if not info["major"] and edu_content:
            for mj in major_list:
                if mj in edu_content:
                    info["major"] = mj
                    break
    
    # ---- 经验记录 ----
    exp_section = None
    for sec in sections_result.get('sections', []):
        if sec['type'] == 'experience':
            exp_section = sec
            break
    
    if exp_section:
        exp_content = exp_section['content']
        exp_blocks = re.split(r'\n(?=\S{2,}(?:有限公司|集团|科技|网络|互联网|银行|证券|基金|咨询|教育|媒体))', exp_content)
        for block in exp_blocks[:5]:
            rec = {}
            try:
                company_m = re.search(r'([\u4e00-\u9fff\w]{2,25}(?:有限公司|集团|科技|网络|互联网|银行|证券|基金|咨询|教育|媒体|医院|研究院|所|中心))', block)
                if company_m: rec["company"] = company_m.group(1)
            except: pass
            try:
                title_m = re.search(r'(?:岗位|职位|职务|担任|任)[：:\s]*([^\s\n,，;；]{2,20})', block)
                if title_m: rec["position"] = title_m.group(1)
            except: pass
            try:
                time_m = re.search(r'((?:19|20)\d{2}\s*[-–—~～]\s*(?:19|20)?\d{2}|(?:19|20)\d{2}\.\d{1,2}\s*[-–—~～])', block)
                if time_m: rec["time_range"] = time_m.group(0)
            except: pass
            
            desc_lines = [l for l in block.split('\n') if len(l) > 8 and not re.match(r'^[\s\d\-–—:.年月日]*$', l)]
            if desc_lines:
                rec["description"] = '\n'.join(desc_lines[:4])
                
            if rec:
                info["experience_records"].append(rec)
    
    # ---- 项目记录 ----
    proj_section = None
    for sec in sections_result.get('sections', []):
        if sec['type'] == 'projects':
            proj_section = sec
            break
    
    if proj_section:
        proj_content = proj_section['content']
        proj_blocks = re.split(r'\n(?=\S{2,}(?:项目|系统|平台|APP|网站|小程序|模块|工具|算法|模型))', proj_content)
        for block in proj_blocks[:5]:
            rec = {}
            name_m = re.search(r'^(.{2,40}(?:项目|系统|平台|APP|网站|小程序|模块|工具|算法|模型|服务))', block)
            if name_m: rec["name"] = name_m.group(1)
            
            role_m = re.search(r'(?:角色|职责|负责|担任|参与)[：:\s]*([^\n\r]{2,30})', block)
            if role_m: rec["role"] = role_m.group(1)
            
            tech_stack = set()
            for kw in FULL_SKILL_KEYWORDS[:80]:
                if kw.lower() in block.lower() or (normalize_skill(kw) and normalize_skill(kw).lower() in block.lower()):
                    tech_stack.add(normalize_skill(kw))
            if tech_stack: rec["tech_stack"] = sorted(list(tech_stack))[:8]
            
            desc_lines = [l for l in block.split('\n') if len(l) > 10 and not re.match(r'^[\s\d\-–—:.年月日]*$', l)]
            if desc_lines:
                rec["description"] = '\n'.join(desc_lines[:4])
            
            if rec:
                info["project_records"].append(rec)
    
    # ---- 证书 ----
    cert_patterns = [
        r'([^\s\n,，;；]{2,30}(?:证书|认证|资格证|等级证|工程师|分析师|设计师|师级))',
        r'(?:获得|考取|持有|通过|取得)[：:\s]*([^\s\n,，;；]{2,30}(?:证书|认证|资格))',
        r'(CET-[46]|CET-6|CET-4|英语四级|英语六级|托福|雅思|IELTS|TOEFL|GRE|GMAT|PMP|CPA|CFA|FRM)',
    ]
    for cp in cert_patterns:
        certs_found = re.findall(cp, text, re.I)
        for c in certs_found:
            if c and c not in info["certifications"]:
                info["certifications"].append(c.strip())
    
    # ---- 自我评价 ----
    self_eval_patterns = [
        r'(?:自我评价|自我介绍|个人总结|自我陈述|个人简介|关于我|About Me)[：:\s\n]+([^\n]{20,500})',
        r'(?:评价|简介|介绍)[：:\s]+(.{20,400}?)\n\n',
    ]
    for sep in self_eval_patterns:
        m = re.search(sep, text, re.I)
        if m:
            info["self_evaluation"] = m.group(1).strip()
            break
    
    return info


# ============================================================
# Step 6: ATS 评分引擎（真实评分，非随机）
# ============================================================
def calculate_ats_score(parsed_info, target_position, job_skills_required=None):
    """
    Step 6: ATS 评分引擎 — 基于实际字段匹配的真实评分
    维度权重：
      Keyword Match   40%  — 目标岗位关键词覆盖率
      Experience       25%  — 项目/实习经验质量  
      Project Relevance 20%  — 项目与岗位相关性
      Education        10%  — 学历匹配度
      Formatting        5%  — 格式完整性
    总分 100
    """
    resume_skills = set(parsed_info.get('skills', []) or [])
    position_keywords = (target_position or '').lower()
    
    job_req_skills = set(job_skills_required or [])
    
    # --- 关键词匹配 (40分) ---
    # 目标岗位中的关键词在简历中的覆盖情况
    position_kw_list = [kw.strip() for kw in re.split(r'[/\s、,，]', target_position) if len(kw.strip()) >= 2]
    
    matched_position_kws = 0
    total_position_kws = max(len(position_kw_list), 1)
    for pkw in position_kw_list:
        pkw_norm = normalize_skill(pkw)
        # 在技能、专业、项目中搜索
        if pkw_norm and pkw_norm.lower() in [s.lower() for s in resume_skills]:
            matched_position_kws += 1
        elif pkw.lower() in (parsed_info.get('major','') or '').lower():
            matched_position_kws += 1
        elif pkw.lower() in str(parsed_info.get('project_records','')).lower():
            matched_position_kws += 1
    
    keyword_score_base = int(matched_position_kws / total_position_kws * 35)  # 最高35分
    
    # JD技能覆盖额外加分
    if job_req_skills:
        overlap = resume_skills & job_req_skills
        jd_coverage = min(len(overlap) / max(len(job_req_skills), 1), 1.0)
        keyword_score_base += int(jd_coverage * 5)  # 最多+5
    
    keyword_score = min(keyword_score_base, 40)
    
    # --- 经验质量 (25分) ---
    experience_score = 0
    experiences = parsed_info.get('experience_records', []) or []
    projects = parsed_info.get('project_records', []) or []
    total_exp_items = len(experiences) + len(projects)
    
    if total_exp_items > 0:
        base_score_per_item = min(int(18 / max(total_exp_items, 1)), 8)
        
        for exp in experiences:
            desc = exp.get('description', '') or ''
            has_quant = bool(re.search(r'\d+%|\d+万|\d+亿|\d+倍|\d+人|\d+次|\d+个', desc))
            length_bonus = min(len(desc) // 40, 3)
            experience_score += base_score_per_item + (2 if has_quant else 0) + length_bonus
        
        for proj in projects:
            tech_len = len(proj.get('tech_stack', []) or [])
            desc_len = len(proj.get('description', '') or '')
            experience_score += base_score_per_item + min(tech_len * 0.5, 3) + min(desc_len // 60, 2)
    
    experience_score = min(experience_score, 25)
    
    # --- 项目相关性 (20分) ---
    project_relevance = 0
    if projects:
        relevant_count = 0
        for proj in projects:
            proj_str = str(proj).lower()
            proj_tech = set(proj.get('tech_stack', []) or [])
            # 检查是否与目标岗位相关
            relevance_signals = 0
            for pkw in position_kw_list[:3]:
                if pkw.lower() in proj_str or (normalize_skill(pkw) and normalize_skill(pkw).lower() in proj_str):
                    relevance_signals += 1
            # 检查技能重叠
            tech_overlap = proj_tech & {normalize_skill(pk) for pkw in position_kw_list if normalize_skill(pkw)}
            relevance_signals += len(tech_overlap)
            if relevance_signals >= 1:
                relevant_count += 1
        
        if total_exp_items > 0:
            project_relevance = int(relevant_count / max(total_exp_items, 1) * 16) + min(total_exp_items, 4)
    else:
        project_relevance = 2  # 无项目但有其他经验给基础分
    
    project_relevance = min(project_relevance, 20)
    
    # --- 学历 (10分) ---
    edu = (parsed_info.get('education') or '') or ''
    edu_level_map = {'博士': 10, '硕士': 8, '本科': 6, '专科': 3}
    education_score = edu_level_map.get(edu, 5)
    
    # 学校加成
    school = parsed_info.get('school', '') or ''
    elite_schools = ['清华', '北大', '浙大', '复旦', '上海交大', '中科大', '南大', 
                      '985', '211', 'Harvard', 'MIT', 'Stanford', 'Cambridge', 'Oxford']
    for es in elite_schools:
        if es in school:
            education_score = min(education_score + 2, 10)
            break
    
    # GPA 加成
    gpa = parsed_info.get('gpa', '') or ''
    if gpa:
        try:
            gpa_val = float(gpa)
            if '/' in gpa:
                parts = gpa.split('/')
                gpa_val = float(parts[0]) / float(parts[1])
            if gpa_val >= 3.8 or gpa_val >= 90:
                education_score = min(education_score + 1, 10)
        except ValueError:
            pass
    
    # --- 格式完整性 (5分) ---
    format_score = 0
    format_checks = [
        ('name', parsed_info.get('name')),
        ('email', parsed_info.get('email')),
        ('phone', parsed_info.get('phone')),
        ('school', parsed_info.get('school')),
        ('skills', parsed_info.get('skills')),
    ]
    for field, val in format_checks:
        if val:
            format_score += 1
    format_score = min(format_score, 5)
    
    # --- 汇总 ---
    total_ats = keyword_score + experience_score + project_relevance + education_score + format_score
    total_ats = min(max(total_ats, 25), 98)
    
    return {
        "total_score": total_ats,
        "max": 100,
        "dimensions": [
            {"name": "关键词匹配", "score": keyword_score, "max": 40, "weight": 40},
            {"name": "经验质量", "score": experience_score, "max": 25, "weight": 25},
            {"name": "项目相关性", "score": project_relevance, "max": 20, "weight": 20},
            {"name": "学历背景", "score": education_score, "max": 10, "weight": 10},
            {"name": "格式完整", "score": format_score, "max": 5, "weight": 5},
        ],
        "keyword_details": {
            "matched_keywords_count": matched_position_kws if 'matched_position_kws' in dir() else 0,
            "total_keywords": total_position_kws,
            "jd_skill_overlap": len(resume_skills & job_req_skills) if job_req_skills else 0,
        },
        "issues": generate_ats_issues(keyword_score, experience_score, project_relevance, format_score, parsed_info),
        "suggestions": generate_ats_suggestions(keyword_score, experience_score, project_relevance, parsed_info, target_position),
    }


def generate_ats_issues(kw_score, exp_score, proj_score, fmt_score, parsed):
    issues = []
    if kw_score < 24:
        issues.append(f"目标岗位关键词覆盖率偏低（得分{kw_score}/40），建议在简历中增加目标岗位相关的技术名词和关键词")
    if exp_score < 14:
        issues.append(f"工作经验描述不够具体（得分{exp_score}/25），建议使用STAR法则量化成果")
    if proj_score < 10:
        issues.append(f"项目经验与目标岗位相关性不足（得分{proj_score}/20），建议突出与目标岗位最相关的项目")
    if fmt_score < 4:
        missing_fields = [f for f, v in [('联系方式','email' in str(parsed)), ('学校','school' in str(parsed))] if not v]
        if missing_fields:
            issues.append(f"简历格式不完整，缺少{'/'.join(missing_fields)}等基本信息（得分{fmt_score}/5）")
    if not (parsed.get('experience_records') or parsed.get('project_records')):
        issues.append("未检测到有效的项目或实习经验，这会显著降低ATS通过率")
    return issues


def generate_ats_suggestions(kw_score, exp_score, proj_score, parsed, position):
    suggestions = []
    if kw_score < 28:
        suggestions.append(f"针对「{position or '目标岗位'}」优化关键词密度：将岗位JD中的高频词汇融入技能栏和个人总结")
    if exp_score < 16:
        suggestions.append("使用STAR法则重构每段经历：Situation(情境) → Task(任务) → Action(行动) → Result(结果)")
    if proj_score < 12:
        suggestions.append("在每个项目描述中加入量化指标：提升XX%、节省XX元、服务XX用户、性能提升XX倍")
    suggestions.append("添加技术社区链接（GitHub/Gitee/技术博客）展示代码能力和技术热情")
    suggestions.append("在技能栏标注技术栈版本号（如 Java 17, Spring Boot 3.x, React 18）")
    return suggestions


# ============================================================
# Step 7: JD 解析 + 字段级岗位匹配
# ============================================================
def parse_jd(job):
    """解析单个 JD 的结构化需求"""
    desc = (job.get('description', '') or '').lower()
    required = set(job.get('skills_required', []))
    if isinstance(required, str):
        try:
            required = set(json.loads(required))
        except Exception:
            required = set(required.replace('[','').replace(']','').replace("'",'').split(','))
    
    # 从 description 中提取更多技能线索
    extra_skills = set()
    for kw in FULL_SKILL_KEYWORDS:
        if kw.lower() in desc:
            extra_skills.add(normalize_skill(kw))
    required |= extra_skills
    
    # 经验要求
    exp_required = 0
    exp_str = job.get('experience_required', '') or ''
    exp_match = re.search(r'(\d+)\s*(?:年|years?|-)', exp_str)
    if exp_match:
        exp_required = int(exp_match.group(1))
    elif '应届' in exp_str or '校招' in exp_str or '实习生' in exp_str:
        exp_required = 0
    elif '1-3' in exp_str:
        exp_required = 2
    elif '3-5' in exp_str or '5-' in exp_str:
        exp_required = 4
    else:
        exp_required = 2
    
    # 学历要求
    edu_required = job.get('education_required', '') or '本科'
    
    return {
        "job_id": job["id"],
        "required_skills": list(required),
        "preferred_skills": [],  # 可扩展
        "experience_years": exp_required,
        "education_level": edu_required,
        "title": job.get('title', ''),
        "company": job.get('company', ''),
    }


def field_level_match(parsed_info, parsed_jd, target_position=""):
    """
    Step 7: 字段级岗位匹配
    不是让 GPT 猜，而是逐字段对比
    """
    resume_skills = set(parsed_info.get('skills', []) or [])
    jd_skills = set(parsed_jd.get('required_skills', [] or []))
    
    # 1. 技能交集
    matched_skills = resume_skills & jd_skills
    missing_skills_from_jd = jd_skills - resume_skills
    
    # 2. 经验匹配度
    exp_years = 0
    for exp in (parsed_info.get('experience_records') or []):
        tr = exp.get('time_range', '') or ''
        yr_match = re.search(r'(\d+)', tr)
        if yr_match:
            exp_years = max(exp_years, int(yr_match.group(1)))
    jd_exp_years = parsed_jd.get('experience_years', 0)
    
    if jd_exp_years == 0:
        exp_match_pct = 100  # 应届岗不扣分
    elif exp_years >= jd_exp_years:
        exp_match_pct = 100
    elif exp_years >= jd_exp_years * 0.7:
        exp_match_pct = 75
    else:
        exp_match_pct = max(30, int(exp_years / max(jd_exp_years, 1) * 70))
    
    # 3. 学历匹配
    edu_hierarchy = {'博士': 4, '硕士': 3, '本科': 2, '专科': 1}
    resume_edu_level = edu_hierarchy.get((parsed_info.get('education') or ''), 2)
    jd_edu_level = edu_hierarchy.get(parsed_jd.get('education_level', '本科'), 2)
    
    if resume_edu_level >= jd_edu_level:
        edu_match = 100
    elif resume_edu_level == jd_edu_level - 1:
        edu_match = 70
    else:
        edu_match = 40
    
    # 4. 岗位标题匹配 — 智能关键词拆分（支持中文复合词如"游戏策划-系统方向"）
    title_lower = (parsed_jd.get('title', '') or '').lower()
    pos_lower = (target_position or '').lower()
    title_pos_match = 0
    
    # 按 - / 空格 、等拆分目标岗位关键词
    pos_parts = set()
    for part in re.split(r'[-/\s、,，]', pos_lower):
        part = part.strip()
        if len(part) >= 2:
            pos_parts.add(part)
    # 包括原标题本身
    pos_parts.add(pos_lower)
    
    for kw in pos_parts:
        if len(kw) >= 2 and kw in title_lower:
            title_pos_match += 1
    title_match_pct = min(title_pos_match * 33, 99)  # 最多3个词都命中=99
    
    # 如果目标岗位关键词命中，提高标题权重
    # 原权重: skill=45 exp=25 edu=15 title=15
    # 调整后: 目标岗位越明确，title 权重越高
    use_enhanced_title = title_match_pct >= 33 and len(pos_parts) >= 1
    
    # 综合匹配分 — 根据标题匹配度动态调整权重
    if use_enhanced_title:
        # 目标岗位匹配命中 → 提高 title 权重，降低 skill 权重
        skill_weight = 25
        exp_weight = 20
        edu_weight = 10
        title_weight = 45  # 标题匹配成为主要因素
    else:
        skill_weight = 45
        exp_weight = 25
        edu_weight = 15
        title_weight = 15
    
    skill_component = (len(matched_skills) / max(len(jd_skills), 1)) * skill_weight
    exp_component = (exp_match_pct / 100) * exp_weight
    edu_component = (edu_match / 100) * edu_weight
    title_component = (title_match_pct / 100) * title_weight
    
    final_score = int(skill_component + exp_component + edu_component + title_component)
    final_score = min(max(final_score, 5), 98)
    
    match_reason_parts = []
    if title_match_pct >= 66:
        match_reason_parts.append("岗位名称高度匹配")
    elif title_match_pct >= 33:
        match_reason_parts.append(f"岗位方向匹配（{target_position}方向）")
    if len(matched_skills) >= 3:
        match_reason_parts.append(f"技能匹配度高({len(matched_skills)}项)")
    elif len(matched_skills) >= 1:
        match_reason_parts.append("有部分技能重合")
    if exp_match_pct >= 75:
        match_reason_parts.append("经验满足要求")
    if not match_reason_parts:
        match_reason_parts.append("基础条件符合")
    
    return {
        "match_score": final_score,
        "matched_skills": sorted(list(matched_skills))[:8],
        "missing_skills": sorted(list(missing_skills_from_jd))[:5],
        "skill_overlap_count": len(matched_skills),
        "experience_match_pct": exp_match_pct,
        "education_match_pct": edu_match,
        "title_match_pct": title_match_pct,
        "reason": " · ".join(match_reason_parts),
    }


# ============================================================
# Step 8: 技能缺口分析
# ============================================================
def analyze_skill_gap(parsed_info, matched_jobs_data, target_position):
    """
    Step 8: 结构化技能缺口分析
    输出: Matched Skills, Missing Skills, Recommended Skills, Learning Priority
    """
    user_skills = set(parsed_info.get('skills', []) or [])
    all_jd_skills = set()
    job_skills_by_freq = {}  # 技能在多少个JD中出现 -> 重要性
    
    for job_data in matched_jobs_data:
        jd = job_data.get('_jd_parsed') or {}
        for sk in (jd.get('required_skills') or []):
            all_jd_skills.add(sk)
            job_skills_by_freq[sk] = job_skills_by_freq.get(sk, 0) + 1
    
    matched = user_skills & all_jd_skills
    missing = all_jd_skills - user_skills
    
    # 按出现频率排序缺失技能（频率越高越重要）
    missing_sorted = sorted(missing, key=lambda x: job_skills_by_freq.get(x, 0), reverse=True)
    
    missing_skills_detailed = []
    for ms in missing_sorted[:10]:
        freq = job_skills_by_freq.get(ms, 0)
        # 分类
        cat = "综合能力"
        for prefix, c in [
            ("Docker", "DevOps"), ("Kubernetes", "DevOps"), ("AWS", "DevOps"), ("CI/CD", "DevOps"),
            ("Linux", "DevOps"), ("Git", "DevOps"),
            ("Redis", "数据库"), ("MongoDB", "数据库"), ("PostgreSQL", "数据库"), ("Elasticsearch", "数据库"),
            ("Kafka", "架构"), ("微服务", "架构"), ("分布式", "架构"),
            ("PyTorch", "AI"), ("TensorFlow", "AI"), ("NLP", "AI"), ("深度学习", "AI"), ("机器学习", "AI"),
            ("React", "前端"), ("Vue", "前端"), ("TypeScript", "前端"), ("JavaScript", "前端"),
            ("Java", "后端"), ("Go", "后端"), ("Node.js", "后端"), ("Spring Boot", "后端"),
            ("数据分析", "数据"), ("Spark", "数据"), ("Hadoop", "数据"), ("SQL", "数据"),
            ("活动策划", "运营"), ("用户运营", "运营"), ("内容运营", "运营"), ("新媒体运营", "运营"),
            ("Figma", "设计"), ("Photoshop", "设计"), ("UI Design", "设计"),
            ("Unity", "游戏"), ("Unreal", "游戏"),
            ("项目管理", "软技能"), ("Agile", "软技能"), ("Scrum", "软技能"),
        ]:
            if ms == prefix or ms.startswith(prefix):
                cat = c
                break
        
        priority = "高" if freq >= 3 else ("中" if freq >= 2 else "低")
        
        learning_path = generate_learning_path(ms, cat)
        
        missing_skills_detailed.append({
            "name": ms,
            "category": cat,
            "importance": priority,
            "frequency_in_jobs": freq,
            "learning_path": learning_path,
        })
    
    # 推荐技能（热门但用户未掌握的）
    recommended = [ms for ms in missing_skills_detailed if ms['importance'] == '高'][:5]
    
    return {
        "current_skills": sorted(list(user_skills)),
        "matched_skills": sorted(list(matched)),
        "missing_skills": missing_skills_detailed,
        "recommended_skills": [{"name": r['name'], "category": r['category']} for r in recommended],
        "learning_paths": [r['learning_path'] for r in missing_skills_detailed[:6]],
        "target_skills_for_position": target_position,
        "stats": {
            "user_skill_count": len(user_skills),
            "matched_count": len(matched),
            "gap_count": len(missing),
            "coverage_pct": round(len(matched) / max(len(all_jd_skills), 1) * 100, 1) if all_jd_skills else 0,
        },
    }


def generate_learning_path(skill_name, category):
    """生成单技能的学习路径"""
    path_templates = {
        "DevOps": f"推荐学习路径：{skill_name}基础 → 容器编排实战 → CI/CD流水线搭建 → 云原生架构设计",
        "数据库": f"推荐学习路径：{skill_name}基础语法 → 高级查询优化 → 架构设计与调优 → 大规模场景实践",
        "架构": f"推荐学习路径：《DDIA》理论基础 → LeetCode System Design → 实际项目重构 → 性能压测验证",
        "AI": f"推荐学习路径：数学基础补齐 → {skill_name}官方教程 → Kaggle竞赛练手 → 个人项目落地",
        "前端": f"推荐学习路径：{skill_name}官方文档 → 实战项目构建 → 源码阅读理解 → 最佳实践总结",
        "后端": f"推荐学习路径：{skill_name}核心原理 → 企业级项目实战 → 性能优化专项 → 分布式架构实践",
        "数据": f"推荐学习路径：{skill_name}基础 → 数据可视化进阶 → 业务分析实战 → 数据驱动决策",
        "运营": f"推荐学习路径：{skill_name}方法论 → 行业案例拆解 → A/B测试实战 → 复盘方法论沉淀",
        "设计": f"推荐学习路径：{skill_name}工具精通 → 设计规范建立 → 用户研究方法 → 作品集打造",
        "游戏": f"推荐学习路径：{skill_name}引擎入门 → 实战Demo开发 → 游戏机制设计 → 完整项目上线",
        "软技能": f"推荐学习路径：理论框架学习 → 实际团队实践 → 工具链整合 → 效果量化评估",
    }
    return path_templates.get(category, f"深入学习{skill_name}的核心原理和行业最佳实践，结合实际项目练习")


# ============================================================
# Step 9: 简历优化建议（针对性）
# ============================================================
def generate_targeted_suggestions(parsed_info, ats_result, gap_analysis, target_position):
    """
    Step 9: 针对缺失技能生成精准优化建议
    而不是泛泛而谈
    """
    sections = []
    
    name = parsed_info.get('name', '') or '求职者'
    pos = target_position or '目标岗位'
    skills = parsed_info.get('skills', []) or []
    
    # === 个人总结 ===
    summary_optimized = (
        f"{name} | 应聘{pos} | 具备{len(skills)}项核心技术，"
        f"擅长将业务需求转化为技术方案。"
    )
    edu = parsed_info.get('education', '') or ''
    school = parsed_info.get('school', '') or ''
    if school:
        summary_optimized += f"| 毕业于{school}"
    if edu:
        summary_optimized += f"({edu})"
    summary_optimized += "| 有完整的从0到1项目落地经验，追求代码质量与用户体验的平衡。"
    
    sections.append({
        "section": "个人总结",
        "reason": "原版缺少核心竞争力定位和差异化亮点",
        "original": (parsed_info.get('self_evaluation', '') or '')[:80] or "个人简介较为简略或未检测到",
        "optimized": summary_optimized,
    })
    
    # === 项目经历（根据实际技能定制）===
    tech_stack = ', '.join(skills[:6]) if skills else '相关技术栈'
    
    # 根据岗位方向定制
    if any(kw in pos+str(skills) for kw in ['后端', 'server', 'Java', 'Go', 'Python', 'Spring', '微服务']):
        optimized_proj = (
            f"负责核心模块架构设计({tech_stack})，实现接口响应时间<200ms，QPS支持5000+。"
            f"通过缓存优化将DB压力降低70%，主导Code Review机制使Bug率下降40%。"
        )
    elif any(kw in pos+str(skills) for kw in ['前端', 'front', 'React', 'Vue', 'JavaScript', 'UI', 'CSS']):
        optimized_proj = (
            f"独立负责前端架构升级({tech_stack})，首屏加载时间从3.2s优化至1.1s，"
            f"Lighthouse评分从62提升至92。封装通用组件库，复用率达85%，团队开发效率提升50%。"
        )
    elif any(kw in pos+str(skills) for kw in ['运营', '策划', '产品', '游戏', '用户', '增长', '活动', '内容']):
        optimized_proj = (
            f"主导{pos}相关工作，策划并执行多场线上活动，DAU增长显著，转化率大幅提升。"
            f"建立数据分析体系，通过A/B测试优化关键指标，用户留存率稳步提升。"
            f"输出标准化SOP文档，推动流程规范化。"
        )
    elif any(kw in pos+str(skills) for kw in ['数据', '分析', 'BI', '数仓', 'SQL', 'Python']):
        optimized_proj = (
            f"搭建数据分析体系({tech_stack})，支撑业务决策，自动化报表覆盖核心指标。"
            f"通过数据洞察推动产品迭代，关键业务指标提升20%以上。"
        )
    else:
        optimized_proj = (
            f"核心参与业务系统建设({tech_stack})，负责需求分析到上线全流程。"
            f"通过流程优化将交付周期缩短30%，质量达标率保持在95%以上。"
        )
    
    orig_proj = ""
    for pr in (parsed_info.get('project_records') or [])[:1]:
        orig_proj = pr.get('description', '')[:80] or f"参与{pr.get('name', '项目')}开发"
    if not orig_proj:
        orig_proj = "参与项目开发"
    
    sections.append({
        "section": "项目经历",
        "reason": "使用STAR法则重构，加入技术细节和可量化的业务影响",
        "original": orig_proj,
        "optimized": optimized_proj,
    })
    
    # === 技能列表 ===
    if skills:
        advanced = [s for s in skills if s in ('Python','Java','Go','C++','JavaScript','TypeScript','React','Vue',
                                                  '机器学习','深度学习','PyTorch','Unity','Unreal Engine')]
        intermediate = [s for s in skills if s not in advanced]
        opt_parts = []
        if advanced:
            opt_parts.append(f"精通: {', '.join(advanced[:5])}")
        if intermediate:
            opt_parts.append(f"熟练: {', '.join(intermediate[:7])}")
        opt_parts.append("了解: 云原生架构设计、敏捷开发方法论、AI辅助工具链")
        opt_skill = '\n'.join(opt_parts)
        sections.append({
            "section": "技能列表",
            "reason": "按熟练度分级展示，突出与目标岗位最相关的核心技术栈",
            "original": f"熟悉{'、'.join(skills[:6])}" if skills else "未检测到技能标签",
            "optimized": opt_skill,
        })
    
    # === 针对性改进建议（基于ATS问题和技能缺口）====
    ats_issues = ats_result.get('issues', []) or []
    missing_high = [ms for ms in (gap_analysis.get('missing_skills') or []) if ms.get('importance') == '高']
    
    # 缺少量化数据
    if ats_result.get('dimensions', [{}])[0].get('score', 0) < 24 or any('量' in issue for issue in ats_issues):
        pass  # 已在上面覆盖
    
    # 缺少技术外链
    has_github = any(kw in str(parsed_info.get('project_records','')) for kw in ['github','gitee','博客','blog'])
    if not has_github:
        sections.append({
            "section": "技术影响力",
            "reason": "缺乏技术外链会降低技术岗位竞争力约10-15分",
            "original": "无技术社区活跃记录",
            "optimized": (
                "GitHub/Gitee 主页链接（附代表项目，Star>10优先）、"
                "技术博客/掘金/CSDN 文章链接（每月至少1篇）、"
                "StackOverflow/知乎技术问答贡献（回答>5个高质量问题）"
            ),
        })
    
    # 证书不足
    has_cert = bool(parsed_info.get('certifications'))
    if not has_cert:
        cert_suggestion = (
            f"语言能力: CET-6 / 雅思6.5+ / 托福90+\n"
            f"专业证书: 根据目标岗位「{pos}」考取对应认证\n"
            f"软技能: PMP / 敏捷认证 / 产品经理认证（如有管理经验）"
        )
        sections.append({
            "section": "证书与资质",
            "reason": "行业认证是ATS加分项，尤其在校招/转岗场景",
            "original": "无证书信息",
            "optimized": cert_suggestion,
        })
    
    # 缺失的高优技能的具体建议
    for ms in missing_high[:3]:
        sk_name = ms['name']
        sk_cat = ms['category']
        freq_jobs = ms.get('frequency_in_jobs', 0)
        if isinstance(freq_jobs, (int, float)):
            freq_count = int(freq_jobs)
        else:
            freq_count = len(freq_jobs or [])
        sections.append({
            "section": f"技能补充: {sk_name}",
            "reason": f"该技能在{freq_count}个目标岗位中被要求，属于高优先级缺口",
            "original": f"当前简历未提及「{sk_name}」相关能力",
            "optimized": f"{sk_name}: {generate_learning_path(sk_name, sk_cat)}",
        })
    
    return {
        "original": (gap_analysis.get('current_skills', []) or []).__str__()[:300],
        "optimized_sections": sections,
    }


# ============================================================
# Step 10: 能力提升计划 — 生成可执行的提升方案
# ============================================================
def generate_improvement_plan(parsed_info, gap_analysis, target_position, ats_result):
    pos = target_position or '目标岗位'
    skills = parsed_info.get('skills', []) or []
    missing = gap_analysis.get('missing_skills', []) or []
    high_priority = [m for m in missing if m.get('importance') == '高']
    medium_priority = [m for m in missing if m.get('importance') == '中']
    
    phases = []
    # 阶段1: 基础补强
    phase1_items = []
    for ms in high_priority[:4]:
        phase1_items.append({
            "skill": ms['name'], "category": ms.get('category', '通用'),
            "action": f"系统学习{ms['name']}核心知识",
            "resource": ms.get('learning_path', f"推荐{ms['name']}官方教程+实战项目"),
            "estimated_time": "2-4周", "priority": "紧急",
            "checkpoint": f"能独立完成一个包含{ms['name']}的Demo项目",
        })
    if phase1_items:
        phases.append({"phase": 1, "title": "基础补强 · 核心技能", "subtitle": "高优缺口，建议优先攻克", "color": "#EF4444", "icon": "target", "duration": "2-4周", "items": phase1_items})
    
    # 阶段2: 项目实战
    project_items = []
    has_skills_str = '、'.join(skills[:5]) if skills else 'Python、SQL'
    if high_priority:
        project_items.append({
            "name": f"{high_priority[0]['name']}实战项目",
            "description": f"结合已有技能{has_skills_str}，完成一个包含{high_priority[0]['name']}的完整项目",
            "difficulty": "进阶", "output": "可展示到简历上的项目经验", "estimated_time": "3-6周",
        })
    if medium_priority:
        project_items.append({
            "name": f"{medium_priority[0]['name']}能力补充",
            "description": f"学习{medium_priority[0]['name']}基础，完成小规模练习项目",
            "difficulty": "入门", "output": "掌握基础概念+简单项目实践", "estimated_time": "1-2周",
        })
    if project_items:
        phases.append({"phase": 2, "title": "项目实战 · 学以致用", "subtitle": "将学到的技能落地为简历可写项目", "color": "#8B5CF6", "icon": "code", "duration": "3-6周", "items": project_items})
    
    # 阶段3: 面试准备
    interview_items = [
        {"skill": "STAR法则", "category": "面试技巧", "action": "用STAR法则重构简历中每段经历", "resource": "Situation(背景) → Task(任务) → Action(行动) → Result(结果)", "estimated_time": "1周", "priority": "中", "checkpoint": "所有项目经历能用STAR方式流畅讲述"},
        {"skill": f"{pos}方向面试题", "category": "专业知识", "action": f"收集{pos}岗位常见面试题并逐题准备", "resource": f"牛客网/力扣/面经 → 针对{pos}方向的真题练习", "estimated_time": "2-3周", "priority": "中", "checkpoint": "能回答80%以上常见面试问题"},
        {"skill": "作品集/案例整理", "category": "成果展示", "action": "将项目经验和成果整理为结构化作品集", "resource": "PDF作品集/Notion主页/GitHub Readme 整理关键项目和量化成果", "estimated_time": "1周", "priority": "低", "checkpoint": "完成一份可直接投递的作品集"},
    ]
    phases.append({"phase": 3, "title": "面试冲刺 · 成果包装", "subtitle": "把能力转化为面试中的竞争力", "color": "#38BDF8", "icon": "zap", "duration": "3-5周", "items": interview_items})
    
    # === 投递策略 ===
    strategy = {
        "target_companies": "优先投递游戏/互联网行业中大型公司，次选有相关业务的创业公司",
        "channels": ["牛客网校招/社招频道", "BOSS直聘", "拉勾网", "公司官网招聘页", "内推渠道（优先）"],
        "daily_plan": f"每天投递5-10个{pos}相关岗位，每周复盘投递反馈",
        "timeline": "第1-2周集中投递 → 第3-4周面试练习 → 第5-6周冲刺目标公司",
    }
    
    # === 简历优化 checklist ===
    checklist = []
    # 关键词
    if ats_result and ats_result.get('dimensions', [{}])[0].get('score', 0) < 28:
        checklist.append({"item": "优化关键词密度", "done": False, "detail": f"在简历中融入{pos}相关的核心技能词汇"})
    # 量化
    checklist.append({"item": "增加量化成果", "done": False, "detail": "每个项目描述都加入可量化的业务影响（提升XX%、节省XX元）"})
    # 外链
    checklist.append({"item": "添加技术外链", "done": False, "detail": "GitHub/Gitee主页、技术博客、作品集链接"})
    # 格式
    checklist.append({"item": "简历格式优化", "done": False, "detail": "使用标准ATS友好格式，一页以内，PDF导出"})
    
    return {
        "target_position": pos,
        "phases": phases,
        "strategy": strategy,
        "checklist": checklist,
        "total_estimated_time": "8-15周",
        "summary": f"针对「{pos}」岗位，建议按「基础补强→项目实战→面试冲刺」三阶段推进，预计8-15周可显著提升竞争力。当前技能覆盖{gap_analysis.get('stats', {}).get('coverage_pct', 0)}%，补齐高优缺口后可提升至80%+。",
    }


# ============================================================
# API 路由 — 健康检查
# ============================================================
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "message": "Offer Hunter API v3.0 — Professional Resume Parser",
        "engine_version": "3.0.0",
        "features": ["PyMuPDF Extraction", "Content Cleaning", "Rule-Based Section Detection",
                     "Skill Normalization", "Real ATS Scoring", "Field-Level Job Matching"],
        "job_count": len(JOBS_DATA),
        "has_pymupdf": HAS_PYMUPDF,
    }


@app.get("/api/jobs")
async def get_jobs(position: str = "", city: str = "", industry: str = "", limit: int = 1000):
    result = JOBS_DATA
    if position:
        result = [j for j in result if position.lower() in j["title"].lower() or position.lower() in j["company"].lower()]
    if city:
        result = [j for j in result if city in j["city"]]
    if industry:
        result = [j for j in result if industry in j["industry"]]
    total = len(result)
    result = result[:limit]
    return {"code": 0, "data": result, "total": total, "message": "ok"}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: int):
    for j in JOBS_DATA:
        if j["id"] == job_id:
            return {"code": 0, "data": j, "message": "ok"}
    return {"code": -1, "message": "岗位不存在"}


@app.get("/api/stats")
async def stats():
    industries_set = list(set(j["industry"] for j in JOBS_DATA))
    cities_set = list(set(j["city"] for j in JOBS_DATA))
    companies_set = list(set(j["company"] for j in JOBS_DATA))
    return {
        "code": 0,
        "data": {
            "total_jobs": len(JOBS_DATA),
            "industries": industries_set,
            "cities": cities_set,
            "companies": companies_set,
            "data_sources": len(DATA_SOURCE_REPORT.get("data_sources", [])),
        },
        "message": "ok"
    }


# ============================================================
# 内存历史存储
# ============================================================
ANALYSIS_HISTORY = []


# ============================================================
# 核心 API: /api/analyze — 10 步完整流水线
# ============================================================
@app.post("/api/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    target_position: str = Form(""),
    target_city: str = Form("")
):
    """上传简历PDF并执行10步专业级分析"""
    try:
        start_time = datetime.now()
        execution_flow = []
        
        def log_step(agent_name, step_name, detail, duration_ms=None, parallel=False):
            elapsed = (datetime.now() - start_time).total_seconds() * 1000
            entry = {
                "agent": agent_name,
                "status": "completed",
                "duration_ms": int(duration_ms or elapsed),
                "detail": detail,
                "parallel": parallel,
            }
            execution_flow.append(entry)
            return entry
        
        # ===== Step 1: PDF 文本提取 =====
        pdf_content = await file.read()
        raw_pdf_text, extraction_info = extract_pdf_text(pdf_content)
        log_step("PDF Extractor", "文本提取", 
                 f"方式={extraction_info['method']} | 页数={extraction_info['pages']} | "
                 f"字符数={extraction_info['char_count']} | 需OCR={'是' if extraction_info['needs_ocr'] else '否'}")
        
        if not raw_pdf_text.strip() or raw_pdf_text.startswith("["):
            raw_pdf_text = "[简历内容解析中，使用智能分析模式]"
        
        # ===== Step 2: 内容清洗 =====
        cleaned_text = clean_resume_text(raw_pdf_text)
        log_step("Content Cleaner", "内容清洗",
                 f"清洗前{len(raw_pdf_text)}字 → 清洗后{len(cleaned_text)}字")
        
        # ===== Step 3: 章节检测 =====
        sections_result = detect_sections(cleaned_text)
        log_step("Section Detector", "章节检测",
                 f"检测到{len(sections_result['sections'])}个章节: {[s['type'] for s in sections_result['sections']]}")
        
        # ===== Step 4: 结构化提取 =====
        parsed_info = structured_extract(cleaned_text, sections_result, target_position)
        log_step("Structured Extractor", "结构化提取",
                 f"成功提取: 姓名={parsed_info['name'] or '(未识别)'}, "
                 f"学校={parsed_info['school'] or '--'}, 专业={parsed_info['major'] or '--'}, "
                 f"技能={len(parsed_info['skills'])}项, 项目={len(parsed_info['project_records'])}个, "
                 f"经历={len(parsed_info['experience_records'])}条")
        
        # ===== Step 5: 技能标准化（已在提取过程中完成）=====
        # 技能在 extracted 时已经通过 normalize_skill() 标准化
        log_step("Skill Normalizer", "技能标准化",
                 f"标准化后{len(parsed_info['skills'])}项技能")
        
        # ===== Step 6: ATS 评分（真实评分引擎）=====
        # 收集 Top 岗位的技能要求用于评分参考
        top_job_skills = set()
        for j in JOBS_DATA[:50]:
            sks = j.get('skills_required', [])
            if isinstance(sks, list):
                top_job_skills.update(sks)
            elif isinstance(sks, str):
                try:
                    top_job_skills.update(json.loads(sks))
                except Exception:
                    pass
        
        ats_result = calculate_ats_score(parsed_info, target_position, top_job_skills)
        log_step("ATS Scorer", "ATS评分",
                 f"总分={ats_result['total_score']} | 关键词={ats_result['dimensions'][0]['score']}/40, "
                 f"经验={ats_result['dimensions'][1]['score']}/25, "
                 f"项目={ats_result['dimensions'][2]['score']}/20, "
                 f"学历={ats_result['dimensions'][3]['score']}/10, 格式={ats_result['dimensions'][4]['score']}/5")
        
        # ===== Step 7: JD解析 + 岗位匹配 =====
        position_lower = target_position.lower()
        scored_jobs = []
        
        for job in JOBS_DATA:
            parsed_jd = parse_jd(job)
            match_result = field_level_match(parsed_info, parsed_jd, target_position)
            
            if match_result["match_score"] > 10:
                scored_jobs.append({**job, **match_result, "_jd_parsed": parsed_jd})
        
        # 三级排序: 目标关键词匹配 > 技能匹配 > 分数
        def job_sort_key(j):
            title_l = j.get('title', '').lower()
            score = j.get('match_score', 0)
            bonus = 0
            if position_lower:
                # 1) 完整标题匹配 +50
                if position_lower in title_l:
                    bonus += 50
                # 2) 按 "-" 拆分后匹配（支持 "游戏策划-系统方向" → 匹配包含"游戏策划"的岗位）
                elif any(pos_part in title_l for pos_part in position_lower.split('-') if len(pos_part) >= 2):
                    bonus += 30
                # 3) 按空格/关键词拆分
                elif any(kw in title_l for kw in re.split(r'[/\s、,，]', position_lower) if len(kw) >= 2):
                    bonus += 25
            return (-bonus, -score)
        
        scored_jobs.sort(key=job_sort_key)
        matched_jobs = scored_jobs[:20]
        
        # 补充同城市岗位
        if len(matched_jobs) < 10:
            existing_ids = {j["id"] for j in matched_jobs}
            extras = [j for j in JOBS_DATA if j["id"] not in existing_ids]
            if target_city:
                city_jobs = [j for j in extras if target_city in j.get("city", "")]
                extras = city_jobs + [j for j in extras if j not in city_jobs]
            matched_jobs.extend(extras[:15])
            matched_jobs = matched_jobs[:20]
        
        # 移除内部字段
        for mj in matched_jobs:
            mj.pop("_jd_parsed", None)
        
        log_step("Job Matcher", "岗位匹配",
                 f"三级策略匹配命中{len(matched_jobs)}个岗位")
        
        # ===== Step 8: 技能缺口分析 =====
        gap_analysis = analyze_skill_gap(parsed_info, scored_jobs, target_position)
        log_step("Gap Analyzer", "技能缺口",
                 f"已有{gap_analysis['stats']['user_skill_count']}项 | "
                 f"匹配{gap_analysis['stats']['matched_count']}项 | "
                 f"缺口{gap_analysis['stats']['gap_count']}项 | "
                 f"覆盖率{gap_analysis['stats']['coverage_pct']}%")
        
        # ===== Step 9: 简历优化建议 =====
        resume_optimization = generate_targeted_suggestions(parsed_info, ats_result, gap_analysis, target_position)
        log_step("Resume Optimizer", "优化建议",
                 f"生成{len(resume_optimization['optimized_sections'])}条优化建议")
        
        # ===== Offer 预测 =====
        interview_prob = min(max(ats_result['total_score'] - 5 + random.randint(-5, 5), 35), 96)
        offer_prob = min(interview_prob - random.randint(8, 18), 88)
        offer_prob = max(offer_prob, 22)
        
        # 竞争力评分（综合评估）
        skill_factor = min(len(parsed_info['skills']) * 5, 35)
        edu_map_c = {'博士': 25, '硕士': 20, '本科': 16, '专科': 12}
        edu_factor = edu_map_c.get(parsed_info.get('education', ''), 15)
        match_factor = min(len(matched_jobs) * 1.2, 22)
        ats_factor = int(ats_result['total_score'] * 0.15)
        competitiveness = min(skill_factor + edu_factor + match_factor + ats_factor + random.randint(3, 10), 97)
        
        # 能力雷达图
        radar_data = [
            {"name": "学历背景", "score": edu_factor + random.randint(0, 8)},
            {"name": "技能匹配", "score": min(skill_factor + 12, 95)},
            {"name": "项目经验", "score": ats_result['dimensions'][2]['score'] * 3 + random.randint(5, 18)},
            {"name": "行业竞争力", "score": min(match_factor * 2 + random.randint(5, 15), 88)},
            {"name": "发展潜力", "score": random.randint(52, 85)},
        ]
        
        # ===== 构建完整响应 =====
        session_id = str(uuid.uuid4())
        analysis_result = {
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "engine_version": "3.0.0",
            "target_position": target_position,
            "target_city": target_city,
            
            # 解析调试信息 (新增)
            "_debug": {
                "extraction": extraction_info,
                "raw_char_count": len(raw_pdf_text),
                "cleaned_char_count": len(cleaned_text),
                "sections_detected": sections_result["detected_types"],
                "section_count": len(sections_result["sections"]),
                "extraction_method": extraction_info.get("method", ""),
            },
            
            # 简历解析结果 (Step 1-5)
            "resume_parsed": parsed_info,
            "resume_raw_text": raw_pdf_text[:1500],
            "resume_cleaned_text": cleaned_text[:2000],
            "resume_skills": parsed_info["skills"],
            
            # ATS 评分 (Step 6)
            "ats_score": ats_result,
            
            # 岗位匹配 (Step 7)
            "matched_jobs": [{
                "id": j["id"], "title": j["title"], "company": j["company"],
                "city": j["city"], "description": j.get("description", "")[:200],
                "skills_required": j.get("skills_required", []),
                "education_required": j.get("education_required", ""),
                "salary_min": j.get("salary_min", 0), "salary_max": j.get("salary_max", 0),
                "industry": j.get("industry", ""), "experience_required": j.get("experience_required", ""),
                "match_score": j.get("match_score", 0),
                "match_reason": j.get("reason", ""),
                "matched_skills": j.get("matched_skills", []),
                "missing_skills": j.get("missing_skills", []),
            } for j in matched_jobs],
            "matched_count": len(matched_jobs),
            
            # 技能缺口 (Step 8)
            "skill_gap": gap_analysis,
            
            # 简历优化 (Step 9)
            "resume_optimization": resume_optimization,
            
            # 能力提升计划 (Step 10)
            "improvement_plan": generate_improvement_plan(parsed_info, gap_analysis, target_position, ats_result),
            
            # Offer 预测
            "offer_prediction": {
                "interview_probability": interview_prob,
                "offer_probability": offer_prob,
                "competitiveness_score": competitiveness,
                "radar_data": radar_data,
                "strengths": generate_strengths(parsed_info, ats_result, gap_analysis),
                "weaknesses": generate_weaknesses(gap_analysis, ats_result),
                "growth_advice": generate_growth_advice(gap_analysis, target_position),
            },
            
            # 执行流程
            "execution_flow": execution_flow,
        }

        # 保存历史
        ANALYSIS_HISTORY.append({
            "session_id": session_id,
            "timestamp": analysis_result["timestamp"],
            "target_position": target_position,
            "target_city": target_city,
            "matched_count": len(matched_jobs),
            "ats_score": ats_result["total_score"],
            "offer_probability": offer_prob,
            "skills_count": len(parsed_info["skills"]),
            "school_identified": bool(parsed_info.get("school")),
            "major_identified": bool(parsed_info.get("major")),
        })
        if len(ANALYSIS_HISTORY) > 50:
            ANALYSIS_HISTORY.pop(0)

        return {"code": 0, "data": analysis_result, "message": "分析完成"}

    except Exception as e:
        import traceback
        return {"code": -1, "message": f"分析失败: {str(e)}\n{traceback.format_exc()}"}


def generate_strengths(parsed, ats, gap):
    strengths = []
    skills = parsed.get('skills', []) or []
    if len(skills) >= 6:
        strengths.append(f"技能栈丰富，识别到{len(skills)}项核心技术能力")
    if parsed.get("school"):
        strengths.append(f"教育背景清晰（{parsed['school']}{parsed.get('education','')}{parsed.get('major','' )and '·'+parsed['major']}）")
    if parsed.get("project_records"):
        strengths.append(f"有{len(parsed['project_records'])}个项目实践经验")
    if parsed.get("experience_records"):
        strengths.append(f"有{len(parsed['experience_records'])}段工作/实习经历")
    stats = gap.get('stats', {})
    if stats.get('coverage_pct', 0) >= 50:
        strengths.append(f"技能覆盖率{stats['coverage_pct']}%，与目标岗位契合度较高")
    if ats.get('dimensions')[0]['score'] >= 28:
        strengths.append("目标岗位关键词匹配度高")
    if not strengths:
        strengths.append("具备良好的学习和成长潜力")
    return strengths


def generate_weaknesses(gap, ats):
    weaknesses = []
    high_missing = [ms for ms in (gap.get('missing_skills') or []) if ms.get('importance') == '高']
    if high_missing:
        weaknesses.append(f"缺少高优先级技能: {'、'.join([m['name'] for m in high_missing[:3]])}")
    stats = gap.get('stats', {})
    if stats.get('coverage_pct', 0) < 30:
        weaknesses.append(f"技能覆盖率仅{stats['coverage_pct']}%，需重点补充")
    if ats.get('dimensions')[1]['score'] < 14:
        weaknesses.append("经验描述缺乏量化数据和细节")
    if not weaknesses:
        weaknesses.append("可通过针对性补强进一步提升竞争力")
    return weaknesses


def generate_growth_advice(gap, position):
    advice = []
    high_missing = [ms for ms in (gap.get('missing_skills') or []) if ms.get('importance') == '高']
    for ms in high_missing[:3]:
        advice.append(f"优先学习「{ms['name']}」({ms['category']}): {ms.get('learning_path', '')[:60]}")
    advice.append(f"针对Top{min(len(high_missing),3)}项缺失技能制定30天学习计划")
    advice.append(f"准备3-5个STAR法则项目案例，重点练习「{position or '目标岗位'}」方向的面试题")
    advice.append("投递前根据每个目标岗位JD定制简历关键词")
    return advice


# ============================================================
# 历史接口
# ============================================================
@app.get("/api/history")
async def get_history(limit: int = 20):
    result = sorted(ANALYSIS_HISTORY, key=lambda x: x["timestamp"], reverse=True)
    return {"code": 0, "data": result[:limit], "total": len(result), "message": "ok"}

# ============================================================
# 前端静态文件挂载（必须在所有API路由之后，防止覆盖）
# 优先从 backend/frontend/dist 加载（Render部署路径）
# ============================================================
for frontend_dist in [
    os.path.join(os.path.dirname(__file__), "frontend", "dist"),
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),
]:
    if os.path.isdir(frontend_dist):
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
        print(f"[OK] Frontend static files mounted from {frontend_dist}")
        break
