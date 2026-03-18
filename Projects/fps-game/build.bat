@echo off
setlocal

echo ===================================================
echo  FPS Game Builder
echo ===================================================

set VS_CMAKE="C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
set VS_NINJA="C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe"
set VCVARS="C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"

echo [1/3] Setting up MSVC environment...
call %VCVARS% x64
if %errorlevel% neq 0 (
    echo ERROR: Failed to set up MSVC environment.
    pause
    exit /b 1
)

if not exist build mkdir build
cd build

echo [2/3] Configuring with CMake (downloads Raylib - first run takes a minute)...
%VS_CMAKE% .. -G "Ninja" ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_MAKE_PROGRAM=%VS_NINJA% ^
    -DCMAKE_C_COMPILER=cl ^
    -DCMAKE_CXX_COMPILER=cl

if %errorlevel% neq 0 (
    echo ERROR: CMake configure failed.
    cd ..
    pause
    exit /b 1
)

echo [3/3] Building...
%VS_CMAKE% --build . --config Release

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo  Build successful!
    echo  Run the game: build\fps_game.exe
    echo ===================================================
    cd ..
    fps_game.exe 2>nul || build\fps_game.exe
) else (
    echo ERROR: Build failed.
    cd ..
    pause
    exit /b 1
)

endlocal
