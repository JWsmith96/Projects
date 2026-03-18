#include "player.h"
#include <algorithm>
#include <cmath>

void Player::Init() {
    position = { 0.0f, 0.0f, -9.0f };
    yaw      = 0.0f;
    pitch    = 0.0f;
}

void Player::HandleLook() {
    Vector2 delta = GetMouseDelta();
    // Clamp to prevent camera snap on focus restore
    const float MAX_D = 50.0f;
    delta.x = std::clamp(delta.x, -MAX_D, MAX_D);
    delta.y = std::clamp(delta.y, -MAX_D, MAX_D);

    yaw   -= delta.x * SENSITIVITY;
    pitch -= delta.y * SENSITIVITY;

    const float MAX_PITCH = 89.0f * DEG2RAD;
    pitch = std::clamp(pitch, -MAX_PITCH, MAX_PITCH);
}

void Player::HandleMove(float dt, const Map& map) {
    Vector3 fwd   = GetFlatForward();
    Vector3 right = GetRight();

    Vector3 move = { 0, 0, 0 };
    if (IsKeyDown(KEY_W)) move = Vector3Add(move, fwd);
    if (IsKeyDown(KEY_S)) move = Vector3Subtract(move, fwd);
    if (IsKeyDown(KEY_A)) move = Vector3Subtract(move, right);
    if (IsKeyDown(KEY_D)) move = Vector3Add(move, right);

    float len = Vector3Length(move);
    if (len < 0.001f) return;

    move = Vector3Scale(Vector3Normalize(move), MOVE_SPEED * dt);

    // Wall-slide: try X then Z independently
    Vector3 tryX = { position.x + move.x, position.y, position.z };
    if (!map.CollidesWithAny(BoundsAt(tryX))) position.x = tryX.x;

    Vector3 tryZ = { position.x, position.y, position.z + move.z };
    if (!map.CollidesWithAny(BoundsAt(tryZ))) position.z = tryZ.z;
}

void Player::Update(float dt, const Map& map) {
    HandleLook();
    HandleMove(dt, map);
}

Camera3D Player::GetCamera() const {
    Camera3D cam  = {};
    cam.position   = { position.x, position.y + EYE_HEIGHT, position.z };
    cam.target     = Vector3Add(cam.position, GetForward());
    cam.up         = { 0, 1, 0 };
    cam.fovy       = 70.0f;
    cam.projection = CAMERA_PERSPECTIVE;
    return cam;
}

BoundingBox Player::GetBounds() const { return BoundsAt(position); }

BoundingBox Player::BoundsAt(Vector3 pos) const {
    return {
        { pos.x - RADIUS, pos.y,        pos.z - RADIUS },
        { pos.x + RADIUS, pos.y + 1.8f, pos.z + RADIUS }
    };
}

Vector3 Player::GetForward() const {
    return {
        cosf(pitch) * sinf(yaw),
        sinf(pitch),
        cosf(pitch) * cosf(yaw)
    };
}

Vector3 Player::GetFlatForward() const { return { sinf(yaw), 0.0f, cosf(yaw) }; }
Vector3 Player::GetRight()       const { return { -cosf(yaw), 0.0f, sinf(yaw) }; }
