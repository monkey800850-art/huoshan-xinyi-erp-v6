param(
    [int]$FrontendPort = 8000,
    [int]$BackendPort = 9090
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists git)) {
    Write-Error '未检测到 git，请先安装 Git for Windows。'
}
if (-not (Test-CommandExists node)) {
    Write-Error '未检测到 node，请先安装 Node.js LTS。'
}
if (-not (Test-CommandExists python)) {
    Write-Error '未检测到 python，请先安装 Python 3。'
}

$backendPath = Join-Path $repoRoot 'backend\m1'
$frontendPath = $repoRoot

if (-not (Test-Path (Join-Path $backendPath 'src\server.js'))) {
    Write-Error '未找到后端入口 backend/m1/src/server.js'
}
if (-not (Test-Path (Join-Path $frontendPath 'app\index.html'))) {
    Write-Error '未找到前端入口 app/index.html'
}

Write-Host '== Phoenix 开发环境启动 ==' -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host "Frontend: http://localhost:$FrontendPort/app/"
Write-Host "Backend:  http://localhost:$BackendPort/health"

# 启动后端
$backendCmd = "cd /d `"$backendPath`" && set PORT=$BackendPort && node src/server.js"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $backendCmd -WindowStyle Normal | Out-Null

# 启动前端静态服务
$frontendCmd = "cd /d `"$frontendPath`" && python -m http.server $FrontendPort"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $frontendCmd -WindowStyle Normal | Out-Null

Start-Sleep -Seconds 1
Write-Host ''
Write-Host '已启动两个终端窗口：' -ForegroundColor Green
Write-Host '1) backend/m1 Node 服务'
Write-Host '2) 前端 Python 静态服务'
Write-Host ''
Write-Host '建议验证：' -ForegroundColor Yellow
Write-Host "- 浏览器访问: http://localhost:$FrontendPort/app/"
Write-Host "- 健康检查:   http://localhost:$BackendPort/health"
Write-Host ''
Write-Host '停止方式：直接关闭对应终端窗口。'
