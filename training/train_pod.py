#!/usr/bin/env python
"""Run an SDXL LoRA training job on a temporary RunPod pod.

The dataset rides along base64-encoded in the start command rather than being
uploaded separately: 30 images at 1024px is a few megabytes, and it saves
standing up a transfer channel for a pod that lives under an hour.

The trained LoRA lands on the network volume under models/loras, which is where
the serverless workers already look — so it is usable the moment training ends.

    python training/train_pod.py --dataset training/dataset --name mhprop-v1
"""
import argparse, base64, io, json, os, sys, tarfile, time, urllib.request

API = "https://rest.runpod.io/v1/pods"
VOLUME_ID = "k8k9vfi4d0"
DATACENTER = "EU-RO-1"


def req(url, key, data=None, method=None):
    r = urllib.request.Request(
        url,
        data=json.dumps(data).encode() if data else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(r, timeout=180) as resp:
        body = resp.read()
    return json.loads(body) if body else {}


def pack(folder: str) -> str:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(folder, arcname="dataset")
    return base64.b64encode(buf.getvalue()).decode()


SETUP = r"""
set -e
apt-get update && apt-get install -y --no-install-recommends git python3-venv
python3 -c "import base64,sys;open('/tmp/ds.tgz','wb').write(base64.b64decode(sys.argv[1]))" __DS__
mkdir -p /workspace && tar -xzf /tmp/ds.tgz -C /workspace
git clone --depth 1 -b sd3 https://github.com/kohya-ss/sd-scripts /workspace/sd-scripts
cd /workspace/sd-scripts
pip install --no-cache-dir -r requirements.txt bitsandbytes xformers
python3 -c "import base64,sys;open('/workspace/config.toml','wb').write(base64.b64decode(sys.argv[1]))" __CFG__
mkdir -p /runpod-volume/models/loras /runpod-volume/status
accelerate launch --num_cpu_threads_per_process 4 sdxl_train_network.py \
  --config_file /workspace/config.toml 2>&1 | tee /runpod-volume/status/train.log
echo done > /runpod-volume/status/TRAIN_DONE
sleep infinity
"""


def main() -> int:
    key = os.environ.get("RUNPOD_API_KEY")
    if not key:
        return fail("set RUNPOD_API_KEY")

    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--name", default="mhprop-v1")
    ap.add_argument("--gpu", default="NVIDIA GeForce RTX 4090")
    ap.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "sdxl_lora.toml"))
    a = ap.parse_args()

    if not os.path.isdir(a.dataset):
        return fail(f"no dataset at {a.dataset} — run prepare_dataset.py first")

    cfg = open(a.config, "rb").read().replace(b"mhprop-v1", a.name.encode())
    start = (SETUP
             .replace("__DS__", pack(a.dataset))
             .replace("__CFG__", base64.b64encode(cfg).decode()))

    pod = req(API, key, {
        "name": f"myhim-train-{a.name}",
        # A plain python image runs dockerStartCmd; images with their own
        # ENTRYPOINT swallow it and the pod sits there billing for nothing.
        "imageName": "pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel",
        "gpuTypeIds": [a.gpu],
        "gpuCount": 1,
        "dataCenterIds": [DATACENTER],
        "networkVolumeId": VOLUME_ID,
        "volumeMountPath": "/runpod-volume",
        "containerDiskInGb": 60,
        "ports": ["8188/http"],
        "dockerStartCmd": ["bash", "-lc", start],
    })
    pid = pod.get("id")
    print("POD", pid)
    print("log:   /runpod-volume/status/train.log")
    print("done:  /runpod-volume/status/TRAIN_DONE")
    print(f"\nSTOP IT WHEN FINISHED — it bills until deleted:\n"
          f"  curl -X DELETE -H 'Authorization: Bearer $RUNPOD_API_KEY' {API}/{pid}")
    return 0


def fail(msg: str) -> int:
    print("error:", msg, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
