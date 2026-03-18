$ErrorActionPreference = "Stop"

$cmake  = "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
$ninja  = "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe"
$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
$src    = "C:\Users\Joe\Desktop\Claude Coding\fps-game"
$build  = "C:\Users\Joe\Desktop\Claude Coding\fps-game\build"

if (!(Test-Path $build)) { New-Item -ItemType Directory -Path $build | Out-Null }

Write-Host "=== Step 1: Configure ===" -ForegroundColor Cyan

# Write a temp batch file that sources vcvarsall then runs cmake
$tempBat = "$env:TEMP\fps_cmake_configure.bat"
@"
@echo off
call "$vcvars" x64
if errorlevel 1 exit /b 1
"$cmake" "$src" -B "$build" -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_MAKE_PROGRAM="$ninja" -DCMAKE_C_COMPILER=cl -DCMAKE_CXX_COMPILER=cl
"@ | Set-Content $tempBat -Encoding ASCII

$proc = Start-Process cmd -ArgumentList "/c `"$tempBat`"" -NoNewWindow -Wait -PassThru
if ($proc.ExitCode -ne 0) { Write-Error "CMake configure failed"; exit 1 }

Write-Host "=== Step 2: Build ===" -ForegroundColor Cyan

$tempBat2 = "$env:TEMP\fps_cmake_build.bat"
@"
@echo off
call "$vcvars" x64
if errorlevel 1 exit /b 1
"$cmake" --build "$build" --config Release
"@ | Set-Content $tempBat2 -Encoding ASCII

$proc2 = Start-Process cmd -ArgumentList "/c `"$tempBat2`"" -NoNewWindow -Wait -PassThru
if ($proc2.ExitCode -ne 0) { Write-Error "Build failed"; exit 1 }

Write-Host "=== Build complete! ===" -ForegroundColor Green
Write-Host "Executable: $build\fps_game.exe" -ForegroundColor Yellow
