#!/usr/bin/env python3
"""Serve a directory over loopback HTTPS for macOS update acceptance only."""

import argparse
import http.server
import os
from pathlib import Path
import ssl


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True)
    parser.add_argument("--certificate", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--port", type=int, required=True)
    options = parser.parse_args()
    directory = Path(options.directory).resolve(strict=True)
    certificate = Path(options.certificate).resolve(strict=True)
    key = Path(options.key).resolve(strict=True)
    os.chdir(directory)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", options.port), http.server.SimpleHTTPRequestHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certificate, key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
