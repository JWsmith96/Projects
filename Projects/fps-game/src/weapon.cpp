#include "weapon.h"
#include <cfloat>

void Weapon::Update(float dt) {
    if (fireCooldown  > 0.0f) fireCooldown  -= dt;
    if (muzzleTimer   > 0.0f) muzzleTimer   -= dt;
    if (hitMarkerTimer> 0.0f) hitMarkerTimer -= dt;
}

HitResult Weapon::TryFire(const Player& player,
                           std::vector<Target>& targets,
                           const Map& map) {
    HitResult res;
    if (fireCooldown > 0.0f) return res;

    fireCooldown = FIRE_RATE;
    muzzleTimer  = MUZZLE_TIME;

    // Build ray from eye position along camera forward
    Camera3D cam = player.GetCamera();
    Ray ray;
    ray.position  = cam.position;
    ray.direction = player.GetForward();

    // Check nearest wall hit — blocks shots
    float wallDist = FLT_MAX;
    map.RayHitsAny(ray, wallDist);

    // Test all target hitboxes; take nearest
    float bestDist = FLT_MAX;
    int   bestTgt  = -1;
    const Hitbox* bestBox = nullptr;

    for (int i = 0; i < (int)targets.size(); ++i) {
        if (!targets[i].alive) continue;

        // Test head, torso, legs — pick the nearest
        const Hitbox* boxes[3] = { &targets[i].head, &targets[i].torso, &targets[i].legs };
        for (const Hitbox* hb : boxes) {
            RayCollision rc = GetRayCollisionBox(ray, hb->box);
            if (rc.hit && rc.distance > 0.01f && rc.distance < bestDist) {
                bestDist = rc.distance;
                bestTgt  = i;
                bestBox  = hb;
            }
        }
    }

    // Confirm target isn't behind a wall
    if (bestTgt >= 0 && bestDist < wallDist) {
        res.hit    = true;
        res.zone   = bestBox->zone;
        res.score  = bestBox->damage;
        res.killed = bestBox->instantKill || (targets[bestTgt].hp - bestBox->damage <= 0);
        targets[bestTgt].TakeDamage(bestBox->damage, bestBox->instantKill);
        hitMarkerTimer = HITMARK_TIME;
        lastHit        = res;
    }

    return res;
}

void Weapon::DrawGun() const {
    int sw = GetScreenWidth();
    int sh = GetScreenHeight();

    // Simple 2D gun sprite (lower-right corner)
    // Grip
    DrawRectangle(sw - 130, sh - 110, 38, 80, { 60, 60, 60, 255 });
    // Barrel
    DrawRectangle(sw - 200, sh - 78, 110, 22, { 80, 80, 80, 255 });
    // Trigger guard
    DrawRectangle(sw - 130, sh - 68, 18, 28, { 50, 50, 50, 255 });
    // Barrel tip highlight
    DrawRectangle(sw - 200, sh - 78, 8, 22, { 110, 110, 110, 255 });
}

void Weapon::DrawMuzzleFlash() const {
    if (muzzleTimer <= 0.0f) return;
    int sw = GetScreenWidth();
    int sh = GetScreenHeight();
    // Bright flash near barrel end
    DrawCircle(sw - 195, sh - 67, 12, { 255, 220, 100, 180 });
    DrawCircle(sw - 195, sh - 67, 6,  { 255, 255, 255, 220 });
}
