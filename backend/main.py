"""
Offer Hunter Backend - 多Agent架构
====================================
Agent Architecture:
1. Resume Analyzer Agent - 简历解析
2. Job Matcher Agent - 岗位匹配
3. Gap Analysis Agent - 缺口分析
4. ATS Optimizer Agent - ATS评分与简历优化
5. Career Coach Agent - 职业发展建议
6. Offer Predictor Agent - Offer预测

Workflow:
上传简历 → Agent1解析 → Agent2匹配 → Agent3缺口分析
                                      → Agent4 ATS评分+优化
                                      → Agent5 职业建议
                                      → Agent6 Offer预测
"""

from dotenv import load_dotenv

load_dotenv()

import os
import json
import asyncio
from typing import Optional, List, Dict, Any
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from openai import OpenAI
import pdfplumber
import io
import re

# ============================================================
# 配置
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./offer_hunter.db")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-your-deepseek-api-key")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="Offer Hunter API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DeepSeek Client
deepseek_client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url=DEEPSEEK_BASE_URL
)

# ============================================================
# 数据库模型
# ============================================================

class Job(Base):
    """岗位数据库"""
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, comment="岗位名称")
    company = Column(String(200), nullable=False, comment="公司名称")
    city = Column(String(100), nullable=False, comment="城市")
    description = Column(Text, nullable=False, comment="岗位描述")
    skills_required = Column(Text, nullable=False, comment="技能要求(JSON数组)")
    education_required = Column(String(100), comment="学历要求")
    salary_min = Column(Integer, comment="最低薪资(K)")
    salary_max = Column(Integer, comment="最高薪资(K)")
    industry = Column(String(100), comment="行业")
    experience_required = Column(String(100), comment="经验要求")
    created_at = Column(DateTime, default=datetime.utcnow)


class AnalysisRecord(Base):
    """分析记录"""
    __tablename__ = "analysis_records"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True, comment="会话ID")
    resume_text = Column(Text, comment="简历原文")
    resume_parsed = Column(Text, comment="简历解析结果(JSON)")
    target_position = Column(String(200), comment="目标岗位")
    target_city = Column(String(100), comment="目标城市")
    matching_result = Column(Text, comment="匹配结果(JSON)")
    gap_analysis = Column(Text, comment="缺口分析(JSON)")
    ats_score = Column(Text, comment="ATS评分(JSON)")
    resume_optimized = Column(Text, comment="优化后简历(JSON)")
    offer_prediction = Column(Text, comment="Offer预测(JSON)")
    status = Column(String(50), default="pending", comment="状态")
    created_at = Column(DateTime, default=datetime.utcnow)


# 创建表
Base.metadata.create_all(bind=engine)


# ============================================================
# Pydantic模型
# ============================================================

class AnalysisRequest(BaseModel):
    target_position: str
    target_city: str


class ResumeParsedData(BaseModel):
    education: str = ""
    major: str = ""
    school: str = ""
    skills: List[str] = []
    projects: List[Dict] = []
    internships: List[Dict] = []
    awards: List[str] = []
    certifications: List[str] = []
    gpa: Optional[float] = None
    graduation_year: Optional[int] = None


class JobMatchResult(BaseModel):
    job_id: int
    title: str
    company: str
    city: str
    match_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    salary_range: str
    education_match: bool


class GapAnalysisResult(BaseModel):
    current_skills: List[str]
    missing_skills: List[str]
    learning_path: List[Dict]
    suggested_projects: List[str]
    priority_levels: Dict[str, str]


class ATSScoreResult(BaseModel):
    total_score: float
    keyword_score: float
    project_quality_score: float
    skill_completeness_score: float
    quantification_score: float
    issues: List[str]
    suggestions: List[str]


class OfferPredictionResult(BaseModel):
    interview_probability: float
    offer_probability: float
    competitiveness_score: float
    strengths: List[str]
    weaknesses: List[str]
    growth_advice: List[str]


class ResumeOptimization(BaseModel):
    original: str
    optimized: str
    changes: List[Dict]


# ============================================================
# Agent 1: Resume Analyzer Agent
# ============================================================

class ResumeAnalyzerAgent:
    """简历解析Agent - 从PDF简历中提取结构化信息"""
    
    SYSTEM_PROMPT = """你是一个专业的简历解析专家。你的任务是从简历文本中提取结构化信息。

请严格按照以下JSON格式输出，不要添加任何其他内容：
{
  "education": "学历层次(博士/硕士/本科/大专)",
  "major": "专业名称",
  "school": "学校名称",
  "skills": ["技能1", "技能2"],
  "projects": [
    {"name": "项目名称", "description": "项目描述", "tech_stack": ["技术1", "技术2"]}
  ],
  "internships": [
    {"company": "公司名称", "position": "职位", "duration": "时长", "description": "工作描述"}
  ],
  "awards": ["奖项1", "奖项2"],
  "certifications": ["证书1", "证书2"],
  "gpa": 3.5,
  "graduation_year": 2025
}

注意事项：
1. 如果某项信息不存在，使用空数组[]或空字符串""
2. 技能要尽可能完整提取，包括编程语言、框架、工具等
3. 项目经历要提取技术栈
4. gpa和graduation_year如果找不到，使用null"""
    
    def __init__(self):
        self.client = deepseek_client
    
    def extract_text_from_pdf(self, pdf_content: bytes) -> str:
        """从PDF提取文本并使用pdfplumber清洗"""
        try:
            text = ""
            with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            if not text.strip():
                raise ValueError("PDF中未检测到可提取的文本，可能是扫描版PDF")
            return self._clean_text(text)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF解析失败: {str(e)}")
    
    def _clean_text(self, text: str) -> str:
        """清洗PDF提取的文本"""
        text = re.sub(r'Page \d+ of \d+', '', text)     # 去掉页码
        text = re.sub(r'\n{3,}', '\n\n', text)          # 多个换行变2个
        text = re.sub(r'[ \t]{2,}', ' ', text)          # 多空格/制表符变1个
        text = re.sub(r'[^\S\n]{2,}', ' ', text)        # 多余空白（保留换行）
        text = text.strip()
        return text
    
    async def analyze(self, resume_text: str) -> ResumeParsedData:
        """调用AI解析简历"""
        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": f"请解析以下简历文本：\n\n{resume_text[:4000]}"}
                ],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return ResumeParsedData(**result)
        except Exception as e:
            # Fallback: 返回基础解析
            print(f"AI解析失败，使用基础解析: {e}")
            return self._basic_parse(resume_text)
    
    def _basic_parse(self, text: str) -> ResumeParsedData:
        """基础关键词解析（AI不可用时的降级方案）"""
        skills_keywords = [
            "Python", "Java", "JavaScript", "C++", "Go", "Rust", "SQL", "MySQL",
            "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS",
            "React", "Vue", "Angular", "Node.js", "Spring", "Django", "Flask",
            "FastAPI", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn",
            "Git", "Linux", "HTML", "CSS", "TypeScript", "R", "MATLAB",
            "Tableau", "PowerBI", "Excel", "Spark", "Hadoop", "Kafka",
            "Figma", "Photoshop", "JIRA", "Agile", "Scrum"
        ]
        
        found_skills = [s for s in skills_keywords if s.lower() in text.lower()]
        
        return ResumeParsedData(
            education="本科",
            major="",
            school="",
            skills=found_skills,
            projects=[],
            internships=[],
            awards=[],
            certifications=[]
        )


# ============================================================
# Agent 2: Job Matcher Agent
# ============================================================

class JobMatcherAgent:
    """岗位匹配Agent - 计算简历与岗位的匹配度"""
    
    SYSTEM_PROMPT = """你是一个专业的岗位匹配专家。根据候选人的简历信息和岗位要求，计算匹配度。

匹配规则：
1. 技能匹配：核心技能每匹配一个+15分，辅助技能每匹配一个+5分
2. 学历匹配：满足要求+10分，超过要求+5分
3. 经验匹配：有相关经验+10分
4. 城市匹配：目标城市有岗位+5分
5. 项目相关性：项目与岗位相关+10分

请为每个岗位输出JSON：
{
  "match_score": 85,
  "matched_skills": ["Python", "SQL"],
  "missing_skills": ["PowerBI", "Tableau"],
  "match_details": {
    "skill_match": 45,
    "education_match": 15,
    "experience_match": 10,
    "location_match": 5,
    "project_relevance": 10
  },
  "recommendation_reason": "推荐理由"
}"""
    
    def __init__(self, db: Session):
        self.db = db
        self.client = deepseek_client
    
    def get_jobs(self, position: str, city: str, limit: int = 50) -> List[Job]:
        """查询岗位"""
        query = self.db.query(Job)
        if position:
            query = query.filter(Job.title.ilike(f"%{position}%"))
        if city:
            query = query.filter(Job.city.ilike(f"%{city}%"))
        return query.limit(limit).all()
    
    def _calculate_match_score(self, parsed: ResumeParsedData, job: Job) -> float:
        """基于规则计算基础匹配分数"""
        score = 0.0
        job_skills = json.loads(job.skills_required) if job.skills_required else []
        
        if not job_skills:
            return 50.0
        
        candidate_skills_lower = [s.lower() for s in parsed.skills]
        
        # 技能匹配
        matched = 0
        for js in job_skills:
            if js.lower() in candidate_skills_lower:
                matched += 1
        
        skill_score = (matched / len(job_skills)) * 60 if job_skills else 30
        
        # 学历匹配
        edu_score = 10 if parsed.education else 5
        
        # 经验匹配
        exp_score = 10 if parsed.internships else 0
        
        # 项目匹配
        proj_score = 10 if parsed.projects else 0
        
        # 城市匹配
        city_score = 10
        
        score = skill_score + edu_score + exp_score + proj_score + city_score
        return min(round(score, 1), 100.0)
    
    async def match(self, parsed: ResumeParsedData, position: str, city: str) -> List[Dict]:
        """执行岗位匹配"""
        jobs = self.get_jobs(position, city)
        results = []
        
        for job in jobs:
            base_score = self._calculate_match_score(parsed, job)
            job_skills = json.loads(job.skills_required) if job.skills_required else []
            candidate_skills_lower = [s.lower() for s in parsed.skills]
            
            matched_skills = [s for s in job_skills if s.lower() in candidate_skills_lower]
            missing_skills = [s for s in job_skills if s.lower() not in candidate_skills_lower]
            
            salary_range = f"{job.salary_min}K-{job.salary_max}K" if job.salary_min and job.salary_max else "面议"
            
            results.append({
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "city": job.city,
                "match_score": base_score,
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
                "salary_range": salary_range,
                "education_match": parsed.education == job.education_required if job.education_required else True,
                "description": job.description[:200]
            })
        
        # AI增强匹配（异步优化Top10的匹配分数）
        if results and len(results) >= 1:
            top_jobs = sorted(results, key=lambda x: x["match_score"], reverse=True)[:10]
            try:
                enhanced = await self._ai_enhance_matching(parsed, top_jobs)
                # 合并AI结果
                for i, job in enumerate(top_jobs):
                    if i < len(enhanced):
                        job["match_score"] = enhanced[i].get("match_score", job["match_score"])
                        job["matched_skills"] = enhanced[i].get("matched_skills", job["matched_skills"])
                        job["missing_skills"] = enhanced[i].get("missing_skills", job["missing_skills"])
                        job["recommendation_reason"] = enhanced[i].get("recommendation_reason", "")
            except Exception:
                pass
            
            return sorted(top_jobs, key=lambda x: x["match_score"], reverse=True)
        
        return sorted(results, key=lambda x: x["match_score"], reverse=True)[:10]
    
    async def _ai_enhance_matching(self, parsed: ResumeParsedData, jobs: List[Dict]) -> List[Dict]:
        """使用AI增强匹配精度"""
        candidate_info = {
            "education": parsed.education,
            "major": parsed.major,
            "skills": parsed.skills,
            "projects": [p.get("name", "") for p in parsed.projects],
            "internships": [i.get("company", "") + " " + i.get("position", "") for i in parsed.internships]
        }
        
        job_list = []
        for j in jobs[:5]:
            job_list.append({
                "id": j["job_id"],
                "title": j["title"],
                "company": j["company"],
                "required_skills": j["matched_skills"] + j["missing_skills"]
            })
        
        prompt = f"""候选人信息：{json.dumps(candidate_info, ensure_ascii=False)}
岗位列表：{json.dumps(job_list, ensure_ascii=False)}

请为每个岗位重新计算匹配分数(0-100)并返回JSON数组：
[{{"job_id": 1, "match_score": 85, "matched_skills": ["skill1"], "missing_skills": ["skill2"], "recommendation_reason": "理由"}}]"""
        
        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return result if isinstance(result, list) else result.get("results", [])
        except Exception:
            return jobs


# ============================================================
# Agent 3: Gap Analysis Agent
# ============================================================

class GapAnalysisAgent:
    """缺口分析Agent - 分析技能差距并提供学习路径"""
    
    SYSTEM_PROMPT = """你是一个职业发展顾问，专门分析候选人与目标岗位之间的技能差距。

学习路径建议应包含：
1. 具体的课程或资源
2. 实践项目建议
3. 预计学习时间
4. 优先级排序

输出JSON格式：
{
  "current_skills": ["已有技能"],
  "missing_skills": ["缺失技能"],
  "learning_path": [
    {
      "skill": "技能名",
      "priority": "高/中/低",
      "resources": ["学习资源"],
      "estimated_time": "预计时间",
      "project_suggestion": "建议做的项目"
    }
  ],
  "suggested_projects": ["项目建议"],
  "priority_levels": {
    "高": "立即学习，面试必备",
    "中": "1-2周内学习",
    "低": "了解即可"
  }
}"""
    
    def __init__(self):
        self.client = deepseek_client
    
    async def analyze(self, parsed: ResumeParsedData, matched_jobs: List[Dict]) -> GapAnalysisResult:
        """分析技能缺口"""
        # 聚合所有缺失技能
        all_missing = set()
        for job in matched_jobs[:5]:
            all_missing.update(job.get("missing_skills", []))
        
        if not all_missing:
            return GapAnalysisResult(
                current_skills=parsed.skills,
                missing_skills=[],
                learning_path=[],
                suggested_projects=[],
                priority_levels={"info": "您的技能非常匹配目标岗位"}
            )
        
        # AI增强分析
        try:
            prompt = f"""候选人当前技能：{json.dumps(parsed.skills, ensure_ascii=False)}
目标岗位缺失技能：{json.dumps(list(all_missing), ensure_ascii=False)}
候选人专业：{parsed.major}
候选人学历：{parsed.education}

请分析技能缺口并给出学习建议。"""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return GapAnalysisResult(**result)
        except Exception:
            # 降级方案
            learning_path = []
            for skill in list(all_missing)[:5]:
                learning_path.append({
                    "skill": skill,
                    "priority": "中",
                    "resources": [f"在线课程学习{skill}", f"{skill}官方文档", f"{skill}实战项目"],
                    "estimated_time": "2-4周",
                    "project_suggestion": f"完成一个{skill}相关项目"
                })
            
            return GapAnalysisResult(
                current_skills=parsed.skills,
                missing_skills=list(all_missing),
                learning_path=learning_path,
                suggested_projects=[lp["project_suggestion"] for lp in learning_path],
                priority_levels={"高": "立即学习", "中": "1-2周内学习", "低": "了解即可"}
            )


# ============================================================
# Agent 4: ATS Optimizer Agent
# ============================================================

class ATSOptimizerAgent:
    """ATS评分与简历优化Agent"""
    
    ATS_SYSTEM_PROMPT = """你是一个企业级ATS（Applicant Tracking System）评分系统模拟器。

评分维度（总分100）：
1. 关键词匹配（30分）：简历中的关键词与岗位描述的匹配程度
2. 项目质量（25分）：项目描述的清晰度、技术深度、成果量化
3. 技能完整度（25分）：技能描述的完整性和相关性
4. 成果量化程度（20分）：是否有具体的数据和量化成果

请输出JSON：
{
  "total_score": 85,
  "keyword_score": 25,
  "project_quality_score": 22,
  "skill_completeness_score": 21,
  "quantification_score": 17,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}"""
    
    OPTIMIZE_SYSTEM_PROMPT = """你是一个专业的简历优化顾问。请根据目标岗位要求，优化候选人的简历。

优化原则：
1. 补充缺失的关键词
2. 将模糊描述改为量化成果
3. 使用STAR法则（情境、任务、行动、结果）改写经历
4. 突出与目标岗位最相关的技能和项目
5. 使用行业标准术语

请输出JSON：
{
  "original": "优化前原文",
  "optimized": "优化后文本",
  "changes": [
    {"section": "修改部分", "original": "原文", "optimized": "优化后", "reason": "修改原因"}
  ]
}"""
    
    def __init__(self):
        self.client = deepseek_client
    
    async def score_ats(self, resume_text: str, parsed: ResumeParsedData, target_job: Dict = None) -> ATSScoreResult:
        """ATS评分"""
        try:
            job_context = json.dumps(target_job, ensure_ascii=False) if target_job else "通用岗位"
            prompt = f"""简历内容：{resume_text[:2000]}
简历解析结果：{json.dumps(parsed.dict(), ensure_ascii=False)}
目标岗位：{job_context}

请进行ATS评分。"""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": self.ATS_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return ATSScoreResult(**result)
        except Exception:
            # 降级评分
            return ATSScoreResult(
                total_score=65.0,
                keyword_score=20.0,
                project_quality_score=15.0,
                skill_completeness_score=18.0,
                quantification_score=12.0,
                issues=["建议使用AI评分获得更准确的结果"],
                suggestions=["添加更多量化成果", "补充项目技术细节"]
            )
    
    async def optimize_resume(self, resume_text: str, parsed: ResumeParsedData, 
                               target_position: str, missing_skills: List[str]) -> ResumeOptimization:
        """简历优化"""
        try:
            prompt = f"""原始简历：{resume_text[:3000]}
候选人信息：{json.dumps(parsed.dict(), ensure_ascii=False)}
目标岗位：{target_position}
缺失技能：{json.dumps(missing_skills, ensure_ascii=False)}

请优化这份简历。"""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": self.OPTIMIZE_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=3000,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return ResumeOptimization(**result)
        except Exception:
            return ResumeOptimization(
                original=resume_text[:500],
                optimized=resume_text[:500] + "\n\n[AI优化建议：请配置DeepSeek API Key后获取智能优化]",
                changes=[{"section": "整体", "original": "原始简历", "optimized": "优化后简历", "reason": "使用AI优化"}]
            )


# ============================================================
# Agent 5: Career Coach Agent
# ============================================================

class CareerCoachAgent:
    """职业发展建议Agent"""
    
    SYSTEM_PROMPT = """你是一位资深职业规划师，为求职者提供职业发展建议。

输出JSON：
{
  "career_path_suggestions": ["职业路径建议"],
  "skill_development_plan": {
    "short_term": ["1-3个月计划"],
    "mid_term": ["3-6个月计划"],
    "long_term": ["6-12个月计划"]
  },
  "industry_insights": "行业洞察",
  "interview_preparation": ["面试准备建议"],
  "networking_tips": ["人脉拓展建议"]
}"""
    
    def __init__(self):
        self.client = deepseek_client
    
    async def advise(self, parsed: ResumeParsedData, target_position: str, 
                     gap_analysis: GapAnalysisResult, offer_prediction: Dict) -> Dict:
        """生成职业发展建议"""
        try:
            prompt = f"""候选人背景：{json.dumps(parsed.dict(), ensure_ascii=False)}
目标岗位：{target_position}
技能缺口：{json.dumps(gap_analysis.dict(), ensure_ascii=False)}
Offer预测：{json.dumps(offer_prediction, ensure_ascii=False)}

请给出职业发展建议。"""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.6,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception:
            return {
                "career_path_suggestions": ["积累相关项目经验", "考取行业认证"],
                "skill_development_plan": {
                    "short_term": ["补充缺失的核心技能"],
                    "mid_term": ["完成2-3个实战项目"],
                    "long_term": ["成为领域专家"]
                },
                "industry_insights": "当前行业竞争激烈，建议差异化发展",
                "interview_preparation": ["准备技术面试", "练习行为面试", "准备项目介绍"],
                "networking_tips": ["参加行业会议", "维护LinkedIn资料"]
            }


# ============================================================
# Agent 6: Offer Predictor Agent
# ============================================================

class OfferPredictorAgent:
    """Offer预测Agent"""
    
    SYSTEM_PROMPT = """你是一个招聘数据分析专家，根据候选人背景预测其获得面试和Offer的概率。

预测维度：
1. 学历匹配度（20%权重）
2. 技能匹配度（30%权重）
3. 项目质量（20%权重）
4. 实习经验（15%权重）
5. 岗位竞争度（15%权重）

输出JSON：
{
  "interview_probability": 75,
  "offer_probability": 45,
  "competitiveness_score": 68,
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["劣势1", "劣势2"],
  "growth_advice": ["建议1", "建议2"],
  "analysis": {
    "education_factor": 15,
    "skill_factor": 22,
    "project_factor": 14,
    "internship_factor": 10,
    "competition_factor": 7
  }
}"""
    
    def __init__(self):
        self.client = deepseek_client
    
    def _rule_based_predict(self, parsed: ResumeParsedData, ats_score: ATSScoreResult,
                            match_results: List[Dict]) -> OfferPredictionResult:
        """基于规则的预测（降级方案）"""
        # 技能匹配度
        avg_match = sum(j.get("match_score", 0) for j in match_results[:5]) / max(len(match_results[:5]), 1)
        
        # 综合评分
        skill_factor = min(len(parsed.skills) * 3, 30)
        project_factor = min(len(parsed.projects) * 5, 20)
        internship_factor = min(len(parsed.internships) * 5, 15)
        education_factor = 20 if parsed.education in ["硕士", "博士"] else 15 if parsed.education == "本科" else 10
        competition_factor = 15  # 默认
        
        total = skill_factor + project_factor + internship_factor + education_factor + competition_factor
        
        interview_prob = min(round(total * 0.9, 1), 95.0)
        offer_prob = min(round(total * 0.5, 1), 80.0)
        
        return OfferPredictionResult(
            interview_probability=interview_prob,
            offer_probability=offer_prob,
            competitiveness_score=round(total, 1),
            strengths=[f"掌握{len(parsed.skills)}项技能"] if parsed.skills else ["基础能力扎实"],
            weaknesses=["技能覆盖面可进一步提升"] if len(parsed.skills) < 5 else ["建议增加实习经验"],
            growth_advice=["补充目标岗位所需的核心技能", "增加项目经验的量化描述", "考取行业相关认证"]
        )
    
    async def predict(self, parsed: ResumeParsedData, ats_score: ATSScoreResult,
                      match_results: List[Dict], gap_analysis: GapAnalysisResult) -> OfferPredictionResult:
        """预测Offer概率"""
        try:
            prompt = f"""候选人信息：{json.dumps(parsed.dict(), ensure_ascii=False)}
ATS评分：{ats_score.total_score}分
岗位匹配度：{sum(j.get('match_score', 0) for j in match_results[:5]) / max(len(match_results[:5]), 1):.1f}%平均
缺失技能：{json.dumps(gap_analysis.missing_skills, ensure_ascii=False)}

请预测该候选人获得面试和Offer的概率。"""
            
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return OfferPredictionResult(**result)
        except Exception:
            return self._rule_based_predict(parsed, ats_score, match_results)


# ============================================================
# 工作流编排器
# ============================================================

class AnalysisWorkflow:
    """分析工作流编排器 - 串联所有Agent"""
    
    def __init__(self, db: Session):
        self.db = db
        self.resume_agent = ResumeAnalyzerAgent()
        self.job_matcher = JobMatcherAgent(db)
        self.gap_agent = GapAnalysisAgent()
        self.ats_agent = ATSOptimizerAgent()
        self.career_agent = CareerCoachAgent()
        self.predictor = OfferPredictorAgent()
    
    async def execute(self, pdf_content: bytes, target_position: str, 
                      target_city: str, session_id: str) -> Dict[str, Any]:
        """
        执行完整分析工作流：
        Step 1: 简历解析
        Step 2: 岗位匹配 (并行)
        Step 3: 缺口分析
        Step 4: ATS评分 + 简历优化 (并行)
        Step 5: 职业建议
        Step 6: Offer预测
        """
        
        # Step 1: 提取并解析简历
        resume_text = self.resume_agent.extract_text_from_pdf(pdf_content)
        parsed = await self.resume_agent.analyze(resume_text)
        
        # Step 2: 岗位匹配
        matched_jobs = await self.job_matcher.match(parsed, target_position, target_city)
        
        # Step 3 & 4: 并行执行缺口分析和ATS评分
        top_job = matched_jobs[0] if matched_jobs else None
        
        gap_task = self.gap_agent.analyze(parsed, matched_jobs)
        ats_task = self.ats_agent.score_ats(resume_text, parsed, top_job)
        
        gap_result, ats_result = await asyncio.gather(gap_task, ats_task)
        
        # Step 4b: 简历优化
        missing_skills = gap_result.missing_skills
        optimized = await self.ats_agent.optimize_resume(
            resume_text, parsed, target_position, missing_skills
        )
        
        # Step 5 & 6: 并行执行预测和建议
        prediction = await self.predictor.predict(parsed, ats_result, matched_jobs, gap_result)
        career_advice = await self.career_agent.advise(
            parsed, target_position, gap_result, prediction.dict()
        )
        
        # 组装结果
        result = {
            "session_id": session_id,
            "resume_parsed": parsed.dict(),
            "matched_jobs": matched_jobs,
            "gap_analysis": gap_result.dict(),
            "ats_score": ats_result.dict(),
            "resume_optimized": optimized.dict(),
            "offer_prediction": prediction.dict(),
            "career_advice": career_advice,
            "status": "completed"
        }
        
        # 保存到数据库
        record = AnalysisRecord(
            session_id=session_id,
            resume_text=resume_text[:5000],
            resume_parsed=json.dumps(parsed.dict(), ensure_ascii=False),
            target_position=target_position,
            target_city=target_city,
            matching_result=json.dumps(matched_jobs, ensure_ascii=False),
            gap_analysis=json.dumps(gap_result.dict(), ensure_ascii=False),
            ats_score=json.dumps(ats_result.dict(), ensure_ascii=False),
            resume_optimized=json.dumps(optimized.dict(), ensure_ascii=False),
            offer_prediction=json.dumps(prediction.dict(), ensure_ascii=False),
            status="completed"
        )
        self.db.add(record)
        self.db.commit()
        
        return result


# ============================================================
# API路由
# ============================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Offer Hunter API", "version": "1.0.0"}


@app.post("/api/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    target_position: str = Form(...),
    target_city: str = Form(...),
    db: Session = Depends(get_db)
):
    """上传简历并执行完整分析工作流"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="仅支持PDF格式简历")
    
    # 读取PDF
    pdf_content = await file.read()
    
    # 生成会话ID
    session_id = f"session_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename[:10]}"
    
    try:
        workflow = AnalysisWorkflow(db)
        result = await workflow.execute(pdf_content, target_position, target_city, session_id)
        return JSONResponse(content={"code": 0, "data": result, "message": "分析完成"})
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"code": -1, "data": None, "message": f"分析失败: {str(e)}"}
        )


@app.get("/api/jobs")
async def list_jobs(
    position: str = "",
    city: str = "",
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """获取岗位列表"""
    try:
        query = db.query(Job)
        if position:
            query = query.filter(Job.title.ilike(f"%{position}%"))
        if city:
            query = query.filter(Job.city.ilike(f"%{city}%"))
        
        jobs = query.limit(limit).all()
        return JSONResponse(content={
            "code": 0,
            "data": [
                {
                    "id": j.id,
                    "title": j.title,
                    "company": j.company,
                    "city": j.city,
                    "description": j.description,
                    "skills_required": json.loads(j.skills_required) if j.skills_required else [],
                    "education_required": j.education_required,
                    "salary_min": j.salary_min,
                    "salary_max": j.salary_max,
                    "industry": j.industry,
                    "experience_required": j.experience_required
                }
                for j in jobs
            ],
            "message": "success"
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"code": -1, "data": None, "message": str(e)}
        )


@app.get("/api/history")
async def get_history(limit: int = 20, db: Session = Depends(get_db)):
    """获取分析历史"""
    try:
        records = db.query(AnalysisRecord).order_by(
            AnalysisRecord.created_at.desc()
        ).limit(limit).all()
        
        return JSONResponse(content={
            "code": 0,
            "data": [
                {
                    "id": r.id,
                    "session_id": r.session_id,
                    "target_position": r.target_position,
                    "target_city": r.target_city,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in records
            ],
            "message": "success"
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"code": -1, "data": None, "message": str(e)}
        )


@app.get("/api/history/{session_id}")
async def get_analysis_detail(session_id: str, db: Session = Depends(get_db)):
    """获取分析详情"""
    try:
        record = db.query(AnalysisRecord).filter(
            AnalysisRecord.session_id == session_id
        ).first()
        
        if not record:
            raise HTTPException(status_code=404, detail="记录不存在")
        
        return JSONResponse(content={
            "code": 0,
            "data": {
                "session_id": record.session_id,
                "resume_parsed": json.loads(record.resume_parsed) if record.resume_parsed else None,
                "matched_jobs": json.loads(record.matching_result) if record.matching_result else [],
                "gap_analysis": json.loads(record.gap_analysis) if record.gap_analysis else None,
                "ats_score": json.loads(record.ats_score) if record.ats_score else None,
                "resume_optimized": json.loads(record.resume_optimized) if record.resume_optimized else None,
                "offer_prediction": json.loads(record.offer_prediction) if record.offer_prediction else None,
                "status": record.status,
                "created_at": record.created_at.isoformat() if record.created_at else None
            },
            "message": "success"
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"code": -1, "data": None, "message": str(e)}
        )


# ============================================================
# 数据库初始化 - 示例岗位数据
# ============================================================

SAMPLE_JOBS = [
    {
        "title": "数据分析师",
        "company": "字节跳动",
        "city": "北京",
        "description": "负责业务数据分析，构建数据指标体系，通过数据驱动业务决策。使用SQL、Python进行数据处理和分析，输出分析报告。",
        "skills_required": ["Python", "SQL", "Excel", "Tableau", "统计学"],
        "education_required": "本科",
        "salary_min": 20,
        "salary_max": 40,
        "industry": "互联网",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "数据分析师",
        "company": "阿里巴巴",
        "city": "杭州",
        "description": "负责电商业务数据分析，包括用户行为分析、商品分析、营销效果分析等。需要熟练使用SQL和Python。",
        "skills_required": ["SQL", "Python", "Hive", "数据可视化", "统计学"],
        "education_required": "本科",
        "salary_min": 22,
        "salary_max": 45,
        "industry": "电商",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "数据科学家",
        "company": "腾讯",
        "city": "深圳",
        "description": "负责机器学习模型开发，包括推荐系统、用户画像、NLP等方向的算法研究和落地。",
        "skills_required": ["Python", "机器学习", "深度学习", "TensorFlow", "PyTorch", "SQL"],
        "education_required": "硕士",
        "salary_min": 30,
        "salary_max": 60,
        "industry": "互联网",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "Java后端开发工程师",
        "company": "美团",
        "city": "北京",
        "description": "负责后端服务开发，参与系统架构设计，优化系统性能。需要扎实的Java基础和分布式系统知识。",
        "skills_required": ["Java", "Spring Boot", "MySQL", "Redis", "微服务", "Linux"],
        "education_required": "本科",
        "salary_min": 25,
        "salary_max": 50,
        "industry": "互联网",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "前端开发工程师",
        "company": "小红书",
        "city": "上海",
        "description": "负责Web前端开发，参与组件库建设，优化页面性能和用户体验。",
        "skills_required": ["JavaScript", "React", "TypeScript", "CSS", "Vue", "Webpack"],
        "education_required": "本科",
        "salary_min": 20,
        "salary_max": 45,
        "industry": "互联网",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "产品经理",
        "company": "百度",
        "city": "北京",
        "description": "负责AI产品规划和设计，进行用户需求分析、竞品分析，推动产品迭代优化。",
        "skills_required": ["需求分析", "原型设计", "数据分析", "Axure", "SQL", "项目管理"],
        "education_required": "本科",
        "salary_min": 22,
        "salary_max": 45,
        "industry": "AI/互联网",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "算法工程师",
        "company": "华为",
        "city": "深圳",
        "description": "负责CV/NLP/推荐等方向的算法研发，包括模型训练、优化和部署。",
        "skills_required": ["Python", "C++", "深度学习", "PyTorch", "计算机视觉", "NLP"],
        "education_required": "硕士",
        "salary_min": 30,
        "salary_max": 65,
        "industry": "科技",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "软件测试工程师",
        "company": "网易",
        "city": "广州",
        "description": "负责产品质量保障，编写测试用例，进行自动化测试开发。",
        "skills_required": ["Python", "自动化测试", "Selenium", "接口测试", "性能测试", "Linux"],
        "education_required": "本科",
        "salary_min": 18,
        "salary_max": 35,
        "industry": "互联网",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "数据分析师",
        "company": "京东",
        "city": "北京",
        "description": "负责供应链和物流数据分析，优化仓储配送效率，构建数据看板。",
        "skills_required": ["SQL", "Python", "Excel", "PowerBI", "数据建模"],
        "education_required": "本科",
        "salary_min": 20,
        "salary_max": 38,
        "industry": "电商/物流",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "数据分析师",
        "company": "快手",
        "city": "北京",
        "description": "负责短视频和直播业务的数据分析，包括用户增长、内容消费、创作者生态等方向。",
        "skills_required": ["SQL", "Python", "Hive", "AB测试", "数据可视化"],
        "education_required": "本科",
        "salary_min": 22,
        "salary_max": 42,
        "industry": "短视频",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "数据工程师",
        "company": "滴滴",
        "city": "北京",
        "description": "负责大数据平台建设和数据管道开发，处理海量出行数据，保障数据质量。",
        "skills_required": ["Java", "Spark", "Hadoop", "Flink", "Kafka", "SQL"],
        "education_required": "本科",
        "salary_min": 25,
        "salary_max": 50,
        "industry": "出行",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "Python后端开发工程师",
        "company": "哔哩哔哩",
        "city": "上海",
        "description": "负责社区后端服务开发，包括用户系统、内容系统、推荐系统等核心模块。",
        "skills_required": ["Python", "Django", "FastAPI", "MySQL", "Redis", "Docker"],
        "education_required": "本科",
        "salary_min": 22,
        "salary_max": 45,
        "industry": "视频/社区",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "数据分析师",
        "company": "拼多多",
        "city": "上海",
        "description": "负责电商平台数据分析，包括用户行为、商品分析、营销ROI等。",
        "skills_required": ["SQL", "Python", "Hive", "数据可视化", "AB测试"],
        "education_required": "本科",
        "salary_min": 22,
        "salary_max": 45,
        "industry": "电商",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "全栈开发工程师",
        "company": "米哈游",
        "city": "上海",
        "description": "负责游戏相关Web平台的全栈开发，包括管理后台、数据平台等。",
        "skills_required": ["JavaScript", "React", "Node.js", "Python", "MySQL", "Docker"],
        "education_required": "本科",
        "salary_min": 25,
        "salary_max": 50,
        "industry": "游戏",
        "experience_required": "应届/1-3年"
    },
    {
        "title": "商业分析师",
        "company": "SHEIN",
        "city": "广州",
        "description": "负责跨境电商业务分析，包括市场趋势分析、用户洞察、供应链优化建议。",
        "skills_required": ["SQL", "Excel", "Python", "Tableau", "商业分析"],
        "education_required": "本科",
        "salary_min": 20,
        "salary_max": 40,
        "industry": "跨境电商",
        "experience_required": "应届/1-3年"
    }
]


def init_sample_data():
    """初始化示例岗位数据"""
    db = SessionLocal()
    try:
        existing = db.query(Job).count()
        if existing == 0:
            for job_data in SAMPLE_JOBS:
                job = Job(
                    title=job_data["title"],
                    company=job_data["company"],
                    city=job_data["city"],
                    description=job_data["description"],
                    skills_required=json.dumps(job_data["skills_required"], ensure_ascii=False),
                    education_required=job_data["education_required"],
                    salary_min=job_data["salary_min"],
                    salary_max=job_data["salary_max"],
                    industry=job_data["industry"],
                    experience_required=job_data["experience_required"]
                )
                db.add(job)
            db.commit()
            print(f"已初始化 {len(SAMPLE_JOBS)} 条示例岗位数据")
        else:
            print(f"数据库已有 {existing} 条岗位数据")
    except Exception as e:
        print(f"初始化数据失败: {e}")
        db.rollback()
    finally:
        db.close()


# 启动时初始化数据
@app.on_event("startup")
async def startup():
    init_sample_data()


if __name__ == "__main__":
    import uvicorn
    init_sample_data()
    uvicorn.run(app, host="0.0.0.0", port=8000)
