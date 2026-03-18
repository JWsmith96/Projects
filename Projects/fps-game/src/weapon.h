#pragma once
#include "raylib.h"
#include "raymath.h"
#include "target.h"
#include "player.h"
#include "map.h"
#include <vector>
#include <string>

struct HitResult {
    bool        hit       = false;
    int         score     = 0;
    std::string zone;       // "HEAD", "TORSO", "LEGS"
    bool        killed    = false;
};

struct Weapon {
    float fireCooldown    = 0.0f;   // seconds until next shot allowed
    float muzzleTimer     = 0.0f;   // muzzle-flash duration remaining
    float hitMarkerTimer  = 0.0f;
    HitResult lastHit;

    static constexpr float FIRE_RATE    = 0.12f;  // seconds between shots
    static constexpr float MUZZLE_TIME  = 0.06f;
    static constexpr float HITMARK_TIME = 0.4f;

    void Update(float dt);
    HitResult TryFire(const Player& player, std::vector<Target>& targets, const Map& map);
    void DrawGun() const;
    void DrawMuzzleFlash() const;
};
