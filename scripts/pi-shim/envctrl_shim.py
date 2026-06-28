#!/usr/bin/env python3
"""
envctrl-shim: privileged helper for envctrl, called via sudo from Node.

Protocol: line-delimited JSON over stdio.

  Request (single line):  {"sub": "list-serial", "args": {...}}
  Response (single line): {"ok": true, "data": ...}
                           {"ok": false, "error": "..."}

The shim refuses to execute unless invoked via sudo (UID 0). It also refuses
any sub not in the WHITELIST.

Install: see scripts/pi-shim/setup.sh
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any, Callable, Dict

WHITELIST: Dict[str, Callable[[Dict[str, Any]], Any]] = {}


def register(sub: str):
    def deco(fn):
        WHITELIST[sub] = fn
        return fn
    return deco


# ---- subcommands ----------------------------------------------------------

@register("read-config")
def read_config(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path", "/boot/firmware/config.txt")
    if not os.path.exists(path):
        return {"path": path, "content": "", "exists": False}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return {"path": path, "content": f.read(), "exists": True}


@register("write-config")
def write_config(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args["path"]
    content = args["content"]
    backup = bool(args.get("backup", True))
    if backup and os.path.exists(path):
        import datetime, shutil
        ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(path, f"{path}.bak-{ts}")
        backup_path = f"{path}.bak-{ts}"
    else:
        backup_path = None
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return {"path": path, "backup": backup_path}


@register("reload-udev")
def reload_udev(args: Dict[str, Any]) -> Dict[str, Any]:
    subprocess.run(["udevadm", "control", "--reload-rules"], check=True)
    subprocess.run(["udevadm", "trigger"], check=True)
    return {"reloaded": True}


@register("install-udev")
def install_udev(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args["path"]
    content = args["content"]
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return {"installed": path}


@register("list-serial")
def list_serial(args: Dict[str, Any]) -> Dict[str, Any]:
    devs = []
    base = "/dev"
    if os.path.isdir(base):
        for entry in sorted(os.listdir(base)):
            if entry.startswith(("ttyUSB", "ttyACM", "ttyAMA")):
                devs.append(f"/dev/{entry}")
    return {"devices": devs}


@register("list-gpiochip")
def list_gpiochip(args: Dict[str, Any]) -> Dict[str, Any]:
    devs = []
    base = "/dev"
    if os.path.isdir(base):
        for entry in sorted(os.listdir(base)):
            if entry.startswith("gpiochip"):
                devs.append(f"/dev/{entry}")
    return {"devices": devs}


@register("dmesg-tail")
def dmesg_tail(args: Dict[str, Any]) -> Dict[str, Any]:
    lines = int(args.get("lines", 100))
    p = subprocess.run(
        ["dmesg", "-T", "--level=err,warn", "--nopager"],
        capture_output=True, text=True, timeout=5,
    )
    out = "\n".join(p.stdout.splitlines()[-lines:])
    return {"output": out}


@register("journalctl")
def journalctl(args: Dict[str, Any]) -> Dict[str, Any]:
    unit = args.get("unit", "")
    lines = int(args.get("lines", 200))
    cmd = ["journalctl", "-n", str(lines), "--no-pager"]
    if unit:
        cmd += ["-u", unit]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    return {"output": p.stdout}


@register("systemctl")
def systemctl(args: Dict[str, Any]) -> Dict[str, Any]:
    action = args["action"]
    unit = args["unit"]
    allowed = {"status", "start", "stop", "restart", "enable", "disable"}
    if action not in allowed:
        raise ValueError(f"action not allowed: {action}")
    p = subprocess.run(
        ["systemctl", action, unit],
        capture_output=True, text=True, timeout=15,
    )
    return {"exit": p.returncode, "stdout": p.stdout, "stderr": p.stderr}


@register("vcgencmd")
def vcgencmd(args: Dict[str, Any]) -> Dict[str, Any]:
    argv = args.get("args", [])
    p = subprocess.run(["vcgencmd", *argv], capture_output=True, text=True, timeout=5)
    return {"output": p.stdout.strip(), "stderr": p.stderr.strip()}


@register("reboot")
def reboot_cmd(args: Dict[str, Any]) -> Dict[str, Any]:
    delay = int(args.get("delay", 0))
    if delay > 0:
        subprocess.Popen(["shutdown", "-r", f"+{delay // 60 or 1}"])
        return {"scheduled_in": delay}
    subprocess.Popen(["reboot"])
    return {"rebooting": True}


# ---- main loop ------------------------------------------------------------

def main() -> int:
    # sudo enforcement: must be running as root (EUID 0)
    if os.geteuid() != 0:
        sys.stderr.write("envctrl-shim: must be invoked via sudo (not root)\n")
        return 77  # EX_NOPERM

    raw = sys.stdin.readline()
    if not raw:
        return 0
    try:
        req = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"invalid json: {e}"}))
        return 1
    sub = req.get("sub")
    args = req.get("args", {})
    if sub not in WHITELIST:
        print(json.dumps({"ok": False, "error": f"unknown sub: {sub}"}))
        return 1
    try:
        result = WHITELIST[sub](args or {})
        print(json.dumps({"ok": True, "data": result}))
    except subprocess.CalledProcessError as e:
        print(json.dumps({"ok": False, "error": f"subprocess failed: {e}"}))
        return 2
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())