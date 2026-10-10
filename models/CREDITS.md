# Model credits

All six models are from Sketchfab under **CC BY 4.0**, fetched through the
[Objaverse](https://huggingface.co/datasets/allenai/objaverse) archive
(2026-10-10). Everything except the monitor was shrunk with
`gltf-transform optimize` (meshopt, WebP textures at 1024 px); the monitor is
the original file, because `yashRoom.js` cuts its stand off by coordinates.

| File | Model | Author | Source |
| --- | --- | --- | --- |
| `monitor.glb` | Monitor | microsoft | https://sketchfab.com/3d-models/d80755755dba4169a9605f591296f53e |
| `pc.glb` | Fractal Design Meshify C - PC Case | MUSHROOM_BUILDS | https://sketchfab.com/3d-models/a46526af2ac84fa098edc3f01c012450 |
| `chair.glb` | Ergonomic mesh office chair | guillaumecrz | https://sketchfab.com/3d-models/cd5ef0305d8545dd8cd934ebb99cf7d5 |
| `keyboard.glb` | Logitech mechanical gaming keyboard | blackcube4 | https://sketchfab.com/3d-models/c775d45baf854606931584404d7b9109 |
| `mouse.glb` | Logitech G603 | Adityakm | https://sketchfab.com/3d-models/43861f9af252411d987afafbc84357a4 |
| `macbook.glb` | MacBook Pro 16" 2021 | rtql8d | https://sketchfab.com/3d-models/8ac16bda501c4bcc8ba93ac3eb63a8e1 |

Changes made when loading (`yashRoom.js`): each model is scaled to its real
size; the chair's and mouse's light parts are repainted graphite; the
monitor gets a wallpaper on its screen and, on the monitor arm, loses its
stand; the MacBook's screen is lit.
