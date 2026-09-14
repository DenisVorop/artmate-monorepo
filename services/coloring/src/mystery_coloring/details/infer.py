"""Disposable offline CPU inference. Only bounded RGB input and landmarks cross IPC."""

import json
import os
import struct
import sys
import threading
import time


def watch_parent(parent):
    while True:
        if os.getppid() != parent:
            os._exit(2)
        time.sleep(0.25)


def deny_network(event, _args):
    if event == "socket.connect":
        raise RuntimeError("Network is disabled in local face inference")


def main():
    parent = int(sys.argv[1])
    threading.Thread(target=watch_parent, args=(parent,), daemon=True).start()
    sys.addaudithook(deny_network)
    header = sys.stdin.buffer.read(8)
    if len(header) != 8:
        return 2
    width, height = struct.unpack("<II", header)
    if not 1 <= width <= 1600 or not 1 <= height <= 1600:
        return 2
    pixels = sys.stdin.buffer.read(width * height * 3 + 1)
    if len(pixels) != width * height * 3:
        return 2
    from mystery_coloring.details.adapters.model_assets import model_paths

    paths = model_paths()
    import cv2
    import numpy as np
    import torch
    from anime_face_detector import LandmarkDetector

    cv2.setNumThreads(1)
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    # Model initialization must not change the caller's RNG state.
    with torch.random.fork_rng(devices=[]):
        model = LandmarkDetector(paths["hrnetv2"], "yolov3", paths["yolov3"], device="cpu")
    rgb = np.frombuffer(pixels, np.uint8).reshape(height, width, 3)
    image = np.ascontiguousarray(rgb[:, :, ::-1])
    from mystery_coloring.details.adapters.views import predict_faces

    encoded = predict_faces(model, image)
    print(json.dumps(encoded, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
