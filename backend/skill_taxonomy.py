"""
技能词典与标准化 —— 全项目单一来源。

被两处共用：
  1. main.py        —— 解析简历时识别候选人技能
  2. jd_parser.py   —— 解析用户粘贴的 JD 时识别岗位要求技能

放在独立模块里，是为了让两边的技能名一定对得上。
如果词典各写一份，简历里写 "React"，JD 里解析成 "reactjs"，
匹配算法就会认为候选人不会 React —— 这类 bug 极难排查。
"""

# ============================================================
# 技能名称标准化映射表（别名 -> 标准名）
# key 一律小写、去掉空格和连字符后比对
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
# 完整技能关键词库（用于扫描简历与 JD 原文）
# 顺序无关，但同一技能只保留第一次出现，避免重复计数
# ============================================================
FULL_SKILL_KEYWORDS = [
    "Python", "Java", "C++", "C#", "Go", "Rust", "JavaScript", "TypeScript",
    "React", "Vue", "Angular", "Node.js", "Spring Boot", "Django", "Flask", "FastAPI",
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "NoSQL",
    "Docker", "Kubernetes", "AWS", "Linux", "Git", "CI/CD", "GitHub",
    "机器学习", "深度学习", "NLP", "计算机视觉", "PyTorch", "TensorFlow", "LLM", "Transformer",
    "数据分析", "Data Analysis", "Spark", "Hadoop", "Tableau", "Power BI", "ETL", "Data Warehouse",
    "微服务", "分布式", "消息队列", "Kafka", "RabbitMQ", "RocketMQ",
    "Unity", "Unreal Engine", "Shader", "OpenGL", "游戏开发", "Cocos", "3D",
    "Flutter", "React Native", "Android", "iOS", "Swift", "Kotlin",
    "产品设计", "User Research", "Axure", "Figma", "Sketch", "UI Design", "UX Design",
    "Photoshop", "Premiere", "After Effects", "Illustrator",
    "自动化测试", "Selenium", "性能测试", "安全测试", "JMeter",
    "活动策划", "用户运营", "内容运营", "新媒体运营", "社群运营", "电商运营",
    "品牌策划", "数值策划", "系统策划", "关卡策划", "剧情策划", "文案策划", "游戏策划",
    "产品运营", "用户增长", "A/B测试", "竞品分析", "SEO", "SEM",
    "商业化", "项目管理", "用户分层", "增长策略", "活动执行",
    "品牌营销", "整合营销", "公关传播", "社交媒体", "短视频", "直播",
    "Excel/PPT", "SPSS", "PR", "文案撰写", "脚本撰写", "视频剪辑",
    "数据监控", "效果复盘", "用户调研", "需求文档", "原型设计",
    "版本管理", "持续集成", "负载均衡", "容器化", "服务网格",
    "Agile", "Scrum", "Project Management", "Office",
]


def _key(raw):
    """归一化比对键：小写 + 去空格 + 去连字符"""
    return raw.strip().lower().replace(' ', '').replace('-', '')


def normalize_skill(raw_name):
    """把任意写法的技能名映射到标准名；无法识别时原样返回（过滤单字符）"""
    if not raw_name:
        return None
    key = _key(raw_name)
    if key in SKILL_NORMALIZE_MAP:
        return SKILL_NORMALIZE_MAP[key]
    for std in FULL_SKILL_KEYWORDS:
        if raw_name.strip().lower() == std.lower():
            return std
        if key == _key(std):
            return std
    return raw_name.strip() if len(raw_name.strip()) > 1 else None
