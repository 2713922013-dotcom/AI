"""
Offer Hunter - LLM 接入层

设计约束：
1. 零第三方依赖，只用标准库 urllib（Render 无需改动 requirements.txt）
2. 兼容 DeepSeek / OpenAI / 任意 OpenAI 兼容端点（base_url 可配）
3. 永不向上抛异常：任何失败都返回 None，由调用方回退到规则引擎
4. 未配置密钥时 enabled=False，整个系统退化为原来的纯规则模式，不会白屏

环境变量：
    DEEPSEEK_API_KEY / LLM_API_KEY  密钥（二者取其一）
    LLM_BASE_URL                    默认 https://api.deepseek.com
    LLM_MODEL                       默认 deepseek-chat
    LLM_TIMEOUT                     单次请求超时秒数，默认 45
    LLM_MAX_RETRIES                 失败重试次数，默认 1
    LLM_ENABLED                     设为 0 可强制关闭大模型
"""

import json
import os
import re
import threading
import time
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"


# ------------------------------------------------------------
# 轻量 .env 加载（本地开发用，生产环境走平台环境变量）
# ------------------------------------------------------------
def _load_dotenv():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and not os.environ.get(key):
                    os.environ[key] = value
    except Exception:
        pass


_load_dotenv()

_config = {}
_config_lock = threading.Lock()

_stats = {
    "calls": 0,
    "success": 0,
    "failed": 0,
    "total_latency_ms": 0,
    "last_error": "",
    "last_used": "",
}
_stats_lock = threading.Lock()

# 熔断器：连续失败达到阈值后暂停调用一段时间，避免无效密钥拖慢每一次请求
_breaker = {"fail_streak": 0, "open_until": 0.0}
_breaker_lock = threading.Lock()
BREAKER_THRESHOLD = 3
BREAKER_COOLDOWN = 300  # 秒


def _env_flag(name, default=True):
    value = os.getenv(name)
    if not value:
        return default
    return value.strip().lower() not in ("0", "false", "no", "off")


def _get_config():
    # 配置缓存：进程内只读一次环境变量
    if _config:
        return _config
    with _config_lock:
        if _config:
            return _config
        api_key = (os.getenv("DEEPSEEK_API_KEY") or os.getenv("LLM_API_KEY") or "").strip()
        base_url = (os.getenv("LLM_BASE_URL") or DEFAULT_BASE_URL).strip().rstrip("/")
        try:
            timeout = float(os.getenv("LLM_TIMEOUT") or 45)
        except ValueError:
            timeout = 45.0
        try:
            max_retries = int(os.getenv("LLM_MAX_RETRIES") or 1)
        except ValueError:
            max_retries = 1
        _config.update(
            {
                "api_key": api_key,
                "base_url": base_url,
                "model": (os.getenv("LLM_MODEL") or DEFAULT_MODEL).strip(),
                "timeout": timeout,
                "max_retries": max(0, max_retries),
                "enabled": _env_flag("LLM_ENABLED", True) and bool(api_key),
            }
        )
    return _config


def reload_config():
    """环境变量变更后强制重新读取（测试与热更新用）"""
    with _config_lock:
        _config.clear()
    with _breaker_lock:
        _breaker["fail_streak"] = 0
        _breaker["open_until"] = 0.0
    return _get_config()


def is_enabled():
    cfg = _get_config()
    if not cfg["enabled"]:
        return False
    with _breaker_lock:
        # 熔断期内的调用直接跳过，交给规则引擎
        return time.time() >= _breaker["open_until"]


def breaker_state():
    with _breaker_lock:
        remaining = max(0, int(_breaker["open_until"] - time.time()))
        return {"fail_streak": _breaker["fail_streak"], "cooldown_remaining_s": remaining}


def _record(success, latency_ms, error=""):
    with _stats_lock:
        _stats["calls"] += 1
        if success:
            _stats["success"] += 1
            _stats["total_latency_ms"] += latency_ms
        else:
            _stats["failed"] += 1
            _stats["last_error"] = error[:300]
    with _breaker_lock:
        if success:
            _breaker["fail_streak"] = 0
            _breaker["open_until"] = 0.0
        else:
            _breaker["fail_streak"] += 1
            if _breaker["fail_streak"] >= BREAKER_THRESHOLD:
                _breaker["open_until"] = time.time() + BREAKER_COOLDOWN


def health():
    cfg = _get_config()
    with _stats_lock:
        stats = dict(_stats)
    avg = 0
    if stats["success"]:
        avg = int(stats["total_latency_ms"] / stats["success"])
    state = breaker_state()
    return {
        "enabled": cfg["enabled"],
        "available": is_enabled(),
        "model": cfg["model"] if cfg["enabled"] else None,
        "base_url": cfg["base_url"] if cfg["enabled"] else None,
        "calls": stats["calls"],
        "success": stats["success"],
        "failed": stats["failed"],
        "avg_latency_ms": avg,
        "last_error": stats["last_error"],
        "cooldown_remaining_s": state["cooldown_remaining_s"],
    }


def _extract_json(text):
    """从模型输出里抠出 JSON，容忍 ```json 围栏和前后废话"""
    if not text:
        return None
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json|JSON)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    # 退一步：截取第一个 { 或 [ 到最后一个配对的闭合符号
    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        start = cleaned.find(open_ch)
        end = cleaned.rfind(close_ch)
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except Exception:
                continue
    return None


def chat(system, user, max_tokens=1200, temperature=0.3, json_mode=False, timeout=None, tag=""):
    """
    单轮对话，返回文本；失败返回 None（不抛异常）。
    """
    cfg = _get_config()
    if not cfg["enabled"]:
        return None

    payload = {
        "model": cfg["model"],
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    url = cfg["base_url"] + "/chat/completions"
    attempts = cfg["max_retries"] + 1
    last_error = ""

    for attempt in range(attempts):
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + cfg["api_key"],
                "Accept": "application/json",
            },
            method="POST",
        )
        started = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout or cfg["timeout"]) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw)
            choices = data.get("choices") or []
            content = ""
            if choices:
                content = (choices[0].get("message") or {}).get("content") or ""
            latency = int((time.time() - started) * 1000)
            if not content.strip():
                last_error = "empty content from " + str(tag or "llm")
                _record(False, latency, last_error)
                return None
            _record(True, latency)
            with _stats_lock:
                _stats["last_used"] = tag or cfg["model"]
            return content
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8", errors="replace")[:200]
            except Exception:
                pass
            last_error = "HTTP %s: %s" % (e.code, detail or e.reason)
            _record(False, int((time.time() - started) * 1000), last_error)
            # 4xx（除 429）重试无意义
            if 400 <= e.code < 500 and e.code != 429:
                return None
        except Exception as e:
            last_error = "%s: %s" % (type(e).__name__, e)
            _record(False, int((time.time() - started) * 1000), last_error)

        if attempt < attempts - 1:
            time.sleep(1.2 * (attempt + 1))

    return None


def chat_json(system, user, max_tokens=1200, temperature=0.3, timeout=None, tag=""):
    """要求模型返回 JSON，解析成功返回 dict/list，失败返回 None"""
    text = chat(
        system,
        user,
        max_tokens=max_tokens,
        temperature=temperature,
        json_mode=True,
        timeout=timeout,
        tag=tag,
    )
    if not text:
        return None
    parsed = _extract_json(text)
    if parsed is None:
        with _stats_lock:
            _stats["last_error"] = "JSON parse failed (%s)" % (tag or "llm")
        return None
    return parsed


def ping():
    """真实探测一次，用于部署后自检"""
    text = chat("你是一个连通性探针。", "只回复两个字：在线", max_tokens=8, temperature=0, tag="ping")
    return {"ok": bool(text), "response": (text or "").strip()[:20]}
