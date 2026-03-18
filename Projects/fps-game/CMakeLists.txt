cmake_minimum_required(VERSION 3.15)
project(fps_game CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(
    raylib
    GIT_REPOSITORY https://github.com/raysan5/raylib.git
    GIT_TAG        5.0
    GIT_SHALLOW    TRUE
)
set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_GAMES    OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(raylib)

set(SOURCES
    src/main.cpp
    src/player.cpp
    src/map.cpp
    src/target.cpp
    src/weapon.cpp
    src/hud.cpp
    src/game.cpp
)

add_executable(fps_game ${SOURCES})
target_include_directories(fps_game PRIVATE src)
target_link_libraries(fps_game raylib)

if(WIN32)
    target_link_libraries(fps_game winmm opengl32 gdi32)
endif()
