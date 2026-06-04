#!/usr/bin/env python3
# Patch /handler.py to also handle VHS_VideoCombine "gifs" outputs
# (worker-comfyui v5 ignores anything that isn't in the "images" key).
#
# Inserts a gif-handling block right before the "other_keys" check, and
# excludes "gifs" from the "unhandled keys" warning.

from pathlib import Path

HANDLER = Path("/handler.py")
src = HANDLER.read_text()

MARKER = '            # Check for other output types\n            other_keys = [k for k in node_output.keys() if k != "images"]'

PATCH = '''            # PATCH: also extract 'gifs' (VHS_VideoCombine mp4/webm output)
            if "gifs" in node_output:
                print(
                    f"worker-comfyui - Node {node_id} contains {len(node_output['gifs'])} gif/video file(s)"
                )
                for gif_info in node_output["gifs"]:
                    g_filename = gif_info.get("filename")
                    g_subfolder = gif_info.get("subfolder", "")
                    g_type = gif_info.get("type")
                    if g_type == "temp" or not g_filename:
                        continue
                    g_bytes = get_image_data(g_filename, g_subfolder, g_type)
                    if g_bytes:
                        try:
                            base64_video = base64.b64encode(g_bytes).decode("utf-8")
                            output_data.append({
                                "filename": g_filename,
                                "type": "base64",
                                "data": base64_video,
                            })
                            print(f"worker-comfyui - Encoded video {g_filename} as base64")
                        except Exception as e:
                            errors.append(f"Error encoding {g_filename} to base64: {e}")
                    else:
                        errors.append(f"Failed to fetch video data for {g_filename}")

            # Check for other output types
            other_keys = [k for k in node_output.keys() if k not in ("images", "gifs")]'''

if PATCH.split("\n")[0].strip() in src:
    print("patch-handler: already applied, skipping")
elif MARKER in src:
    new_src = src.replace(MARKER, PATCH, 1)
    HANDLER.write_text(new_src)
    print("patch-handler: applied gif/video output handling")
else:
    raise SystemExit("patch-handler: marker not found, upstream handler.py changed")
