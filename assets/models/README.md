# Humanoid Models for Chromatic Resonance

## Required Models

Place the following GLB files in this directory:

| File | Description | Used By |
|------|-------------|---------|
| `humanoid-base.glb` | Standard humanoid (~1-2k tris) | Most enemies |
| `humanoid-chunky.glb` | Wider/bulkier humanoid | Verdant Slime |
| `humanoid-boss.glb` | Larger detailed humanoid | Boss enemies |

## Recommended Sources (All CC0)

### Option 1: Quaternius (Recommended)
Best for game-ready, low-poly animated characters.

1. **Universal Base Characters**: https://quaternius.itch.io/universal-base-characters
   - 13k tri humanoid rig
   - Includes multiple body types
   - Compatible with animation library

2. **Poly.Pizza Mirror**: https://poly.pizza/m/c3Ibh9I3udk
   - "Animated Human" - 1,578 tris
   - Direct GLTF download
   - Pre-animated

### Option 2: Comp-3 Interactive
Simple low-poly humanoid mesh.

- **Low Poly Human**: https://comp3interactive.itch.io/low-poly-human-mesh
  - 402 tris (very low poly)
  - No animations
  - Good for stylized look

### Option 3: Kenney
Game-ready character packs.

- **Character Assets**: https://kenney.nl/assets/category:Characters
  - Various styles
  - Some animated
  - All CC0

## How to Add Models

1. Download the GLB/GLTF file from one of the sources above
2. Rename to match the expected filename (e.g., `humanoid-base.glb`)
3. Place in this `assets/models/` directory
4. Restart the game - models will load automatically

## Model Requirements

- **Format**: GLB (binary GLTF) preferred, or GLTF
- **Orientation**: Y-up, facing -Z
- **Scale**: ~1 meter tall for base scale
- **Triangles**: Under 5k recommended for performance

## Animations (Optional)

If your model includes animations, the system will:
- Auto-play "idle" animation if found
- Support animation blending in future updates

Recommended animations:
- `idle` - Standing idle
- `walk` - Walking forward
- `attack` - Attack motion
- `death` - Death animation
