# Offer捕手 (Offer Hunter)

## AI求职匹配与简历优化助手

基于多Agent架构的AI求职智能体，帮助学生完成：简历解析 → 岗位匹配 → ATS评分 → 简历优化 → Offer预测

---

## 🏗️ 系统架构

### 多Agent架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Offer Hunter 系统架构                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户上传PDF简历 ──► 分析工作流编排器 (AnalysisWorkflow)               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Agent 工作流                               │  │
│  │                                                              │  │
│  │  Step 1    Step 2        Step 3 & 4 (并行)    Step 5 & 6     │  │
│  │  ┌──────┐  ┌──────────┐  ┌────────────┐      ┌──────────┐   │  │
│  │  │Agent1│─►│  Agent2  │─►│ Agent3 缺口 │─────►│ Agent5   │   │  │
│  │  │简历  │  │ 岗位匹配  │  │ 分析       │      │ 职业教练  │   │  │
│  │  │解析  │  │          │  ├────────────┤      └──────────┘   │  │
│  │  └──────┘  └──────────┘  │ Agent4 ATS │      ┌──────────┐   │  │
│  │                           │ 评分+优化   │─────►│ Agent6   │   │  │
│  │                           └────────────┘      │ Offer预测 │   │  │
│  │                                               └──────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  数据层: SQLite ◄──► SQLAlchemy ORM                                │
│  AI引擎: DeepSeek API (deepseek-chat)                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 6大Agent说明

| Agent | 名称 | 职责 | 核心能力 |
|-------|------|------|----------|
| Agent 1 | Resume Analyzer | 简历解析 | PDF提取 + AI结构化解析，输出学历/技能/项目/实习 |
| Agent 2 | Job Matcher | 岗位匹配 | 规则+AI双重匹配，计算技能/学历/经验匹配度 |
| Agent 3 | Gap Analysis | 缺口分析 | 聚合缺失技能，生成学习路径和项目建议 |
| Agent 4 | ATS Optimizer | ATS评分+优化 | 模拟ATS评分，STAR法则改写简历 |
| Agent 5 | Career Coach | 职业教练 | 提供职业路径、技能发展计划、面试准备 |
| Agent 6 | Offer Predictor | Offer预测 | 多维度预测面试/Offer概率，竞争力评分 |

---

## 📁 项目结构

```
offer-hunter/
├── backend/
│   ├── main.py              # FastAPI主程序 (所有Agent + API路由)
│   ├── requirements.txt     # Python依赖
│   └── render.yaml          # Render部署配置
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── main.jsx         # 入口文件
│   │   ├── App.jsx          # 路由配置
│   │   ├── index.css        # 全局样式 (TailwindCSS)
│   │   ├── components/
│   │   │   └── Header.jsx   # 顶部导航
│   │   ├── pages/
│   │   │   ├── HomePage.jsx    # 首页 (简历上传+求职意向)
│   │   │   └── Dashboard.jsx   # 分析仪表盘 (6个Tab展示)
│   │   └── services/
│   │       └── api.js       # API调用封装
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vercel.json          # Vercel部署配置
└── README.md
```

---

## 🚀 快速启动

### 1. 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 设置DeepSeek API Key
# Windows PowerShell:
$env:DEEPSEEK_API_KEY="sk-your-deepseek-api-key"

# Linux/Mac:
export DEEPSEEK_API_KEY="sk-your-deepseek-api-key"

# 启动服务
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

访问 http://localhost:8000/docs 查看API文档

### 2. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 3. 使用流程

1. 打开首页，上传PDF简历
2. 输入目标岗位（如：数据分析师）
3. 输入目标城市（如：北京）
4. 点击"开始分析"
5. 自动跳转到分析仪表盘，查看6大模块结果

---

## 🔌 API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/analyze | 上传简历并执行完整分析 |
| GET | /api/jobs | 获取岗位列表 |
| GET | /api/history | 获取分析历史 |
| GET | /api/history/{session_id} | 获取分析详情 |

---

## 🗄️ 数据库设计

### jobs 表 (岗位数据库)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| title | VARCHAR(200) | 岗位名称 |
| company | VARCHAR(200) | 公司名称 |
| city | VARCHAR(100) | 城市 |
| description | TEXT | 岗位描述 |
| skills_required | TEXT | 技能要求(JSON数组) |
| education_required | VARCHAR(100) | 学历要求 |
| salary_min | INTEGER | 最低薪资(K) |
| salary_max | INTEGER | 最高薪资(K) |
| industry | VARCHAR(100) | 行业 |
| experience_required | VARCHAR(100) | 经验要求 |

### analysis_records 表 (分析记录)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| session_id | VARCHAR(100) | 会话ID |
| resume_text | TEXT | 简历原文 |
| resume_parsed | TEXT | 简历解析结果(JSON) |
| target_position | VARCHAR(200) | 目标岗位 |
| target_city | VARCHAR(100) | 目标城市 |
| matching_result | TEXT | 匹配结果(JSON) |
| gap_analysis | TEXT | 缺口分析(JSON) |
| ats_score | TEXT | ATS评分(JSON) |
| resume_optimized | TEXT | 优化后简历(JSON) |
| offer_prediction | TEXT | Offer预测(JSON) |
| status | VARCHAR(50) | 状态 |
| created_at | DATETIME | 创建时间 |

---

## 🤖 Agent Prompt设计

### Agent 1: Resume Analyzer Prompt
```
角色：专业简历解析专家
任务：从简历文本中提取结构化信息
输出格式：JSON { education, major, school, skills[], projects[], internships[], awards[], certifications[], gpa, graduation_year }
关键规则：技能完整提取，项目提取技术栈，缺失信息用空值
```

### Agent 2: Job Matcher Prompt
```
角色：岗位匹配专家
任务：根据候选人简历和岗位要求计算匹配度
匹配规则：核心技能+15分/个，辅助技能+5分/个，学历匹配+10分，经验+10分，城市+5分，项目+10分
输出格式：JSON { match_score, matched_skills[], missing_skills[], match_details, recommendation_reason }
```

### Agent 3: Gap Analysis Prompt
```
角色：职业发展顾问
任务：分析技能差距，提供学习路径
输出：current_skills, missing_skills, learning_path[{skill, priority, resources, estimated_time, project_suggestion}], suggested_projects, priority_levels
优先级：高=立即学习面试必备，中=1-2周内，低=了解即可
```

### Agent 4: ATS Optimizer Prompt
```
ATS评分角色：企业ATS系统模拟器
评分维度：关键词匹配(30分)、项目质量(25分)、技能完整度(25分)、成果量化(20分)

简历优化角色：专业简历优化顾问
优化原则：补充关键词、量化成果、STAR法则、突出相关技能、行业术语
```

### Agent 5: Career Coach Prompt
```
角色：资深职业规划师
输出：career_path_suggestions, skill_development_plan{short_term, mid_term, long_term}, industry_insights, interview_preparation, networking_tips
```

### Agent 6: Offer Predictor Prompt
```
角色：招聘数据分析专家
预测维度：学历(20%)、技能(30%)、项目(20%)、实习(15%)、竞争度(15%)
输出：interview_probability, offer_probability, competitiveness_score, strengths, weaknesses, growth_advice, analysis
```

---

## 🚢 部署指南

### 后端部署到 Render

1. 在 [Render](https://render.com) 创建新的 Web Service
2. 连接GitHub仓库，指定 `backend` 目录
3. 设置环境变量：
   - `DEEPSEEK_API_KEY`: 你的DeepSeek API密钥
   - `DATABASE_URL`: `sqlite:///./offer_hunter.db`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 前端部署到 Vercel

1. 在 [Vercel](https://vercel.com) 导入项目
2. 指定 `frontend` 为根目录
3. 框架自动检测为 Vite
4. 修改 `vercel.json` 中的API代理地址为Render服务地址
5. 部署

---

## ⚙️ 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| DEEPSEEK_API_KEY | DeepSeek API密钥 | (必填) |
| DATABASE_URL | 数据库连接URL | sqlite:///./offer_hunter.db |

---

## 🎨 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite |
| UI组件 | TDesign React |
| 样式 | TailwindCSS 3 |
| 图表 | Recharts |
| 图标 | Lucide React |
| 后端框架 | FastAPI |
| ORM | SQLAlchemy |
| 数据库 | SQLite |
| AI模型 | DeepSeek Chat API |
| PDF解析 | PyPDF2 |
| 部署 | Vercel (前端) + Render (后端) |
