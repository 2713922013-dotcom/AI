"""
岗位数据存储层 —— 唯一的数据出入口。

为什么要有这一层：
    原来的岗位数据是 job_crawler.py 里一个 1020 条的常量列表，
    重复率 91%（90 个模板 × 56 家公司），改一条要动代码、加一条要发版。
    而且数据只读，用户没法把自己真正想投的岗位放进来。

现在的约定：
    - 所有岗位读写都走本模块，业务代码不再直接碰列表
    - 默认 SQLite（backend/data/jobs.db），零配置、开箱即用
    - 想换 Supabase / Postgres 时，只要新写一个类实现同样的方法，替换 _store 即可，
      上层 API 一行都不用改

数据可信度用 source_type 标记，前端据此显示来源徽章：
    seed        —— 人工核验过的真实岗位，带可点击的来源链接
    user_import —— 用户从招聘网站复制粘贴的 JD，原文解析而来

collected_at 是采集日期。超过 STALE_DAYS 天不更新的岗位会被标记为可能过期，
前端灰显提示，而不是假装它还在招。
"""
import hashlib
import json
import os
import sqlite3
import threading
from datetime import date, datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "data", "jobs.db")
SEED_PATH = os.path.join(BASE_DIR, "seed_jobs.json")

STALE_DAYS = 90          # 超过这个天数标记为可能过期
MAX_IMPORT_LEN = 20000   # 单条 JD 原文上限，防止超长文本打爆库

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT    NOT NULL,
    company             TEXT    NOT NULL DEFAULT '',
    city                TEXT    NOT NULL DEFAULT '',
    description         TEXT    NOT NULL DEFAULT '',
    skills_required     TEXT    NOT NULL DEFAULT '[]',
    education_required  TEXT    NOT NULL DEFAULT '',
    salary_min          INTEGER,
    salary_max          INTEGER,
    industry            TEXT    NOT NULL DEFAULT '',
    experience_required TEXT    NOT NULL DEFAULT '',
    source_url          TEXT    NOT NULL DEFAULT '',
    source_type         TEXT    NOT NULL DEFAULT 'seed',
    collected_at        TEXT    NOT NULL,
    created_at          TEXT    NOT NULL,
    fingerprint         TEXT    NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_jobs_title       ON jobs(title);
CREATE INDEX IF NOT EXISTS idx_jobs_city        ON jobs(city);
CREATE INDEX IF NOT EXISTS idx_jobs_source_type ON jobs(source_type);
"""


def make_fingerprint(title, company, city):
    """去重指纹：同一家公司、同一个城市、同一个岗位名，视为同一条。

    故意不含薪资和描述 —— 同一个岗位重新抓一次时薪资可能变了，
    但那仍然是一个岗位，不应该在库里出现两条。
    """
    raw = "|".join([
        (title or "").strip().lower(),
        (company or "").strip().lower(),
        (city or "").strip().lower(),
    ])
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _today():
    return date.today().isoformat()


def _is_stale(collected_at):
    """采集日期超过 STALE_DAYS 天，或格式无法解析，都算过期"""
    if not collected_at:
        return True
    try:
        d = datetime.strptime(collected_at[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return True
    return (date.today() - d) > timedelta(days=STALE_DAYS)


def _row_to_job(row):
    job = dict(row)
    try:
        skills = json.loads(job.get("skills_required") or "[]")
    except (json.JSONDecodeError, TypeError):
        skills = []
    job["skills_required"] = skills if isinstance(skills, list) else []
    job["is_stale"] = _is_stale(job.get("collected_at"))
    job["stale_days"] = _age_days(job.get("collected_at"))
    return job


def _age_days(collected_at):
    if not collected_at:
        return None
    try:
        d = datetime.strptime(collected_at[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    return (date.today() - d).days


class JobStore:
    """SQLite 实现。所有方法线程安全（每次操作独立连接 + 写锁）。"""

    def __init__(self, db_path=None):
        self.db_path = db_path or os.environ.get("JOB_DB_PATH") or DEFAULT_DB_PATH
        self._write_lock = threading.Lock()
        self._init_db()

    # ---------- 内部 ----------
    def _connect(self):
        parent = os.path.dirname(os.path.abspath(self.db_path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        conn = sqlite3.connect(self.db_path, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    # ---------- 读 ----------
    def all_jobs(self):
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM jobs ORDER BY id").fetchall()
        return [_row_to_job(r) for r in rows]

    def get(self, job_id):
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _row_to_job(row) if row else None

    def count(self):
        with self._connect() as conn:
            return conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]

    def stats(self):
        jobs = self.all_jobs()
        return {
            "total_jobs": len(jobs),
            "seed_jobs": sum(1 for j in jobs if j["source_type"] == "seed"),
            "imported_jobs": sum(1 for j in jobs if j["source_type"] == "user_import"),
            "stale_jobs": sum(1 for j in jobs if j["is_stale"]),
            "industries": sorted({j["industry"] for j in jobs if j["industry"]}),
            "cities": sorted({j["city"] for j in jobs if j["city"]}),
            "companies": sorted({j["company"] for j in jobs if j["company"]}),
        }

    # ---------- 写 ----------
    def add(self, job, source_type="user_import"):
        """新增一条岗位。

        返回 {"ok": True, "id": 新 id} 或 {"ok": False, "reason": "duplicate", "id": 已有 id}。
        重复判定用 fingerprint，不靠调用方自觉。
        """
        title = (job.get("title") or "").strip()
        if not title:
            return {"ok": False, "reason": "missing_title"}

        company = (job.get("company") or "").strip()
        city = (job.get("city") or "").strip()
        fingerprint = make_fingerprint(title, company, city)

        skills = job.get("skills_required") or []
        if not isinstance(skills, list):
            skills = []
        # 去重但保留顺序
        seen = set()
        skills = [s for s in skills if s and not (s in seen or seen.add(s))]

        description = (job.get("description") or "")[:MAX_IMPORT_LEN]
        now = datetime.now().isoformat(timespec="seconds")

        with self._write_lock, self._connect() as conn:
            existing = conn.execute(
                "SELECT id FROM jobs WHERE fingerprint = ?", (fingerprint,)
            ).fetchone()
            if existing:
                return {"ok": False, "reason": "duplicate", "id": existing["id"]}

            cur = conn.execute(
                """INSERT INTO jobs
                   (title, company, city, description, skills_required,
                    education_required, salary_min, salary_max, industry,
                    experience_required, source_url, source_type,
                    collected_at, created_at, fingerprint)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    title, company, city, description,
                    json.dumps(skills, ensure_ascii=False),
                    (job.get("education_required") or "").strip(),
                    job.get("salary_min"), job.get("salary_max"),
                    (job.get("industry") or "").strip(),
                    (job.get("experience_required") or "").strip(),
                    (job.get("source_url") or "").strip(),
                    source_type if source_type in ("seed", "user_import") else "user_import",
                    (job.get("collected_at") or _today())[:10],
                    now, fingerprint,
                ),
            )
            return {"ok": True, "id": cur.lastrowid}

    def delete(self, job_id, only_user_import=True):
        """删除岗位。默认只允许删用户导入的，种子数据受保护。"""
        with self._write_lock, self._connect() as conn:
            row = conn.execute(
                "SELECT source_type FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
            if not row:
                return {"ok": False, "reason": "not_found"}
            if only_user_import and row["source_type"] != "user_import":
                return {"ok": False, "reason": "protected"}
            conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
            return {"ok": True}

    def seed_from_file(self, path=None, force=False):
        """从 seed_jobs.json 灌入种子数据。

        默认只在库为空时执行，避免每次重启都覆盖。
        force=True 时按 fingerprint 补新增（已存在的不动）。
        """
        path = path or SEED_PATH
        if not os.path.exists(path):
            return {"loaded": 0, "skipped": 0, "reason": "seed_file_missing"}
        if self.count() > 0 and not force:
            return {"loaded": 0, "skipped": 0, "reason": "already_seeded"}

        try:
            with open(path, encoding="utf-8") as f:
                items = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            return {"loaded": 0, "skipped": 0, "reason": f"seed_read_error: {e}"}

        loaded = skipped = 0
        for item in items:
            res = self.add({**item, "source_type": "seed"}, source_type="seed")
            loaded += 1 if res["ok"] else 0
            skipped += 0 if res["ok"] else 1
        return {"loaded": loaded, "skipped": skipped, "reason": "ok"}


_store = None


def get_store():
    """惰性单例，方便测试时替换 db_path"""
    global _store
    if _store is None:
        _store = JobStore()
        _store.seed_from_file()
    return _store
