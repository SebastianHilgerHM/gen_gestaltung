# ComfyUI via Docker (CPU)

Setzt ComfyUI im CPU-Modus auf, mit einem kleinen Node-Proxy zwischen App und ComfyUI.

## Dienste

| Dienst   | Port | Beschreibung                                  |
|----------|------|-----------------------------------------------|
| comfyui  | 8188 | ComfyUI (CPU, `--cpu`)                         |
| proxy    | 8189 | Node-Proxy, leitet `/comfy/*` an ComfyUI weiter |

## Voraussetzungen

Docker Desktop muss **laufen**. Falls es nicht startet, fehlt evtl. WSL2:

```powershell
wsl --install
```

(Danach Neustart, dann Docker Desktop starten.)

## Starten

```powershell
docker compose up --build
```

Erster Build dauert lange (ComfyUI + PyTorch CPU werden geladen).

- ComfyUI UI:   http://localhost:8188
- Proxy-Health: http://localhost:8189/health
- Proxy → ComfyUI: http://localhost:8189/comfy/...

## Modelle

Checkpoints etc. kommen in die gemounteten Ordner (bleiben außerhalb des Containers):

```
comfyui/models/checkpoints/   <- .safetensors / .ckpt hier ablegen
comfyui/models/vae/
comfyui/models/loras/
comfyui/input/                <- Eingabebilder
comfyui/output/               <- generierte Bilder
```

Bei 4 GB VRAM bzw. CPU-only: kleine SD1.5-Modelle nehmen, niedrige Auflösung
(512px), wenige Steps. SDXL/Flux sind hier nicht praktikabel.

## Nächste Schritte (Workflow → API)

1. In ComfyUI einen Workflow bauen.
2. Settings → "Enable Dev mode Options" aktivieren.
3. "Save (API Format)" → JSON exportieren.
4. JSON per POST an `http://localhost:8189/comfy/prompt` schicken, dann
   `/comfy/history/<prompt_id>` pollen und das Bild aus `/comfy/view` holen.

Aktuell ist nur die Infrastruktur + Passthrough da; die Workflow-Endpunkte
können später im Proxy (`server/index.js`) gekapselt werden.
