@echo off
title Offer Hunter 一键启动

echo ================================
echo   启动 Offer Hunter 项目
echo ================================

:: 启动后端
start cmd /k "cd /d C:\Users\qq271\Desktop\TEST\offer-hunter\backend && uvicorn main:app --reload"

:: 等待后端启动
timeout /t 5 >nul

:: 启动前端
start cmd /k "cd /d C:\Users\qq271\Desktop\TEST\offer-hunter\frontend && npm run dev"

echo.
echo 🚀 前后端已启动！
echo 后端: http://127.0.0.1:8000
echo 前端: http://localhost:3000
pause