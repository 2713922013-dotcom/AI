@echo off
chcp 65001 >nul
title Offer Hunter 本地开发（改代码即时生效）

set ROOT=%~dp0
echo ================================
echo   Offer Hunter 本地开发模式
echo ================================
echo.

if not exist "%ROOT%backend\venv\Scripts\python.exe" (
  echo [错误] 找不到虚拟环境：%ROOT%backend\venv
  echo        请先在 backend 目录执行：python -m venv venv 然后 pip install -r requirements.txt
  pause
  exit /b 1
)

echo 正在启动后端（改 Python 代码会自动重启）...
start "Offer Hunter 后端" cmd /k "cd /d %ROOT%backend && venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 4 >nul

echo 正在启动前端（改页面会自动刷新）...
start "Offer Hunter 前端" cmd /k "cd /d %ROOT%frontend && npm run dev"

timeout /t 3 >nul
start http://localhost:3000

echo.
echo 本地地址：http://localhost:3000
echo 后端文档：http://127.0.0.1:8000/docs
echo.
echo 改完代码在这里看到效果后，再执行下面两条命令上线：
echo    git add -A && git commit -m "说明"
echo    git push origin main
echo.
pause
