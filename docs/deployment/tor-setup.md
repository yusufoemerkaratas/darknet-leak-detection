# Tor Setup Guide

This document describes how to install, configure, and run the Tor service required by the `TorManager` collector.

---

## 1. Installation

### Debian / Ubuntu
```bash
sudo apt update
sudo apt install tor
```

### Arch Linux / CachyOS
```bash
sudo pacman -S tor
```

### macOS
```bash
brew install tor
```

---

## 2. torrc Configuration

Edit `/etc/tor/torrc` (Linux) or `/usr/local/etc/tor/torrc` (macOS) and add/uncomment the following lines:

```
# SOCKS proxy for outgoing requests
SocksPort 9050

# Control port for Stem (circuit management)
ControlPort 9051

# Authentication — choose one:

# Option A: No password (only safe on localhost)
CookieAuthentication 0

# Option B: Password (recommended for shared systems)
# Generate hash with: tor --hash-password "your_password"
# HashedControlPassword 16:XXXXX...
```

After editing, restart Tor:

```bash
# Linux (systemd)
sudo systemctl restart tor
sudo systemctl enable tor   # start on boot

# macOS
brew services restart tor
```

Verify the service is running:
```bash
ss -tlnp | grep -E '9050|9051'
# or
netstat -tlnp | grep -E '9050|9051'
```

---

## 3. Python Dependencies

All required packages are in `collectors/requirements.txt`. Install into the project venv:

```bash
# From project root
source venv/bin/activate
pip install -r collectors/requirements.txt
```

Key packages:
| Package | Purpose |
|---------|---------|
| `stem` | Tor control protocol (circuit management, NEWNYM signal) |
| `requests` | HTTP client |
| `PySocks` | SOCKS5 proxy support for requests |
| `certifi` | Mozilla CA bundle for SSL verification |

---

## 4. Usage

```python
from collectors.tor_manager import TorManager

# Basic usage — auto-rotates circuit every 50 requests
tor = TorManager(
    socks_port=9050,
    control_port=9051,
    control_password=None,   # set if HashedControlPassword is configured
    rotate_every=50
)

# Verify connection
ip = tor.verify_tor()

# Fetch a page
response = tor.fetch("https://example.com")

# Manually rotate circuit (e.g. after a block)
tor.get_new_circuit()

# Always close when done
tor.close()
```

### Circuit Auto-Rotation

`TorManager` tracks the number of requests internally. Once `rotate_every` (default: 50) requests are made, it automatically:
1. Waits for the NEWNYM rate-limit window (`controller.get_newnym_wait()`)
2. Sends the `NEWNYM` signal to Tor
3. Closes the existing `requests.Session` (drops Keep-Alive connections)
4. Opens a new session so the next request uses the new exit node

### Reconnect Behavior

If the Tor control port connection drops (e.g. service restart), `TorManager` automatically attempts to reconnect up to 3 times with exponential back-off (3s, 6s, 9s) before giving up and returning `None` from the request.

---

## 5. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `ModuleNotFoundError: No module named 'stem'` | venv not activated | `source venv/bin/activate` |
| `Failed to connect to Tor` | Tor service not running | `sudo systemctl start tor` |
| `Authentication failed` | Wrong / missing password | Check `torrc` `HashedControlPassword` and `control_password=` arg |
| `[SSL: CERTIFICATE_VERIFY_FAILED]` | CA bundle missing | `pip install certifi` |
| IP doesn't change after rotation | Keep-Alive reusing old connection | Fixed in `get_new_circuit()` — session is recreated after NEWNYM |
| `Connection refused` on port 9051 | `ControlPort` not enabled | Add `ControlPort 9051` to `torrc` and restart Tor |

---

## 6. Running the Integration Test

```bash
# From project root (with venv active)
source venv/bin/activate
python test_tor.py
```

Expected output:
```
✓ Connection established
✓ Current IP: <Tor exit node IP>
✓ Status Code: 200
✓ Circuit rotation requested
✓ New IP: <different IP>
✓ IP Changed: True
✓ POST Status: 200
✅ ALL TESTS COMPLETED SUCCESSFULLY
```
