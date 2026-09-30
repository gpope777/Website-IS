# Model credits

- **robot.glb**: "RobotExpressive" by Tomás Laulhé (Quaternius), CC0. Modified by Don McCurdy. From the three.js examples.
  Player stand-in until character customization (sub-project #4).
- **fox.glb**: "Fox". Model by PixelMannen (CC0). Rigging and animation by tomkranis (CC-BY 4.0).
  glTF conversion by @AsoboStudio and @scurest (CC-BY 4.0). From KhronosGroup glTF-Sample-Assets.
  Wolf stand-in until the drawing-to-creature pipeline (sub-project #5).
- `heroe-*.glb`: KayKit Character Pack: Adventurers 1.0 by Kay Lousberg (www.kaylousberg.com), CC0. Trimmed by `scripts/prep-heroe.mjs`.

## "Suelta y listo" (V2-E, spec §9)
Optional drop-ins, loaded when present and otherwise drawn procedurally (or with the fox):
`deer.glb`, `fish.glb`, `frog.glb`, `whale.glb` (mounts), `wolf.glb` (lobos, bestias de ceniza), `brute.glb` (brutos and the dungeon brutes).
Only CC0 (or CC-BY with a line here and in the credits screen); ≤ 1 MB each after `gltf-transform optimize`. Clip names looked for: Idle, Walk, Run/Gallop, Swim, Jump, Attack, Death.
