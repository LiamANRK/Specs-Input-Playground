/*
# Interaction Techniques Overview

This document outlines several interaction patterns designed for AR experiences, particularly on devices with limited gesture fidelity, narrow field of view, and constrained tracking.

---

## Diegetic Buttons

Diegetic buttons are anchored directly to world surfaces, rather than floating in front of the user. This makes interaction feel more physical and integrated with the environment.

Occlusion enables buttons to appear naturally behind real objects, while tweens provide clear pressed and idle states.

Because hand tracking can occasionally misfire, a press cooldown is used to prevent multiple activations in rapid succession. This avoids accidental double triggers and makes it simpler to connect buttons to gameplay logic.

---

## “Eye Gaze” Follow

For follow-style elements, it is important to restrict motion to a controlled region. In AR, especially with a limited field of view, objects that follow head rotation too literally tend to drift or become difficult to track.

In this pattern, the object loosely follows the user’s forward direction but remains constrained to a fixed zone (for example, a small region in front of the chest). This preserves responsiveness without letting UI drift out of view.

---

## “Eye Gaze” Select

Gaze-based selection works both as an accessibility feature and an alternative input method. It functions similarly to subtitles—initially intended for accessibility, but widely useful across many everyday contexts.

In AR, large hand gestures or repeated pinching can feel socially awkward or become tiring. Gaze-based selection allows the user to target and activate UI elements simply by looking at them for a short dwell time.

This benefits users with limited hand mobility, unreliable hand tracking, or situations where subtle interaction is preferred.

---

## Body Left / Right Movement

Lateral body movement is an effective way to introduce exertion and physicality without requiring full-body tracking.

By measuring the horizontal position of the user’s head, the system can infer which "lane" the player is in. This supports mechanics such as:

- Leaning left or right to switch lanes  
- Weaving as a rhythm or dodging action  

This provides meaningful physical engagement while relying only on head tracking, which is reliable on current AR devices.

---

## Proximity-Based Hand Interaction

Precise pinching or closed-fist gestures are not always practical. Users may find sustained poses uncomfortable, and tracking can be affected by tattoos, lighting, or partial occlusion.

Proximity-based interaction triggers when the hand moves close enough to an object. This allows relaxed, open-hand gestures while still feeling responsive. It reduces the number of strict poses the user must maintain and improves reliability in variable tracking conditions.

---

## No-Depth Collision

Some gameplay elements require fast, forgiving interaction. Traditional ray-based targeting can be slow: the user must aim, align, and then perform a selection gesture.

A no-depth collision approach solves this by casting a ray or sphere between an object and the player. Interaction occurs whenever the hand intersects that path, regardless of depth.

For example, in an enemy system, a ray is cast from each enemy toward the camera. If a hand crosses that ray, the enemy is considered “hit.”

This allows quick swatting motions without precise alignment and supports smooth, continuous gameplay.

---

## Jump / Squat Detection

Jump and squat detection use vertical head movement only. A baseline height is captured while the user is standing still. Movements above a threshold count as a jump; movements below count as a squat.

For stability, it’s helpful to include:

- A brief grace period after landing  
- Hysteresis around the threshold  

This prevents small head bobs from being misinterpreted as repeated jumps or squats, keeping the system simple, robust, and responsive.

---
*/