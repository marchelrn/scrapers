import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}
BLOCKED_HOSTS = {"localhost", "metadata.google", "metadata.google.com", "169.254.169.254"}

PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def validate_url(url):
    if not url:
        raise ValueError("URL is empty")

    parsed = urlparse(url)

    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"URL scheme must be http or https, got: {parsed.scheme}")

    host = parsed.hostname
    if not host:
        raise ValueError("URL has no host")

    if host.lower() in BLOCKED_HOSTS:
        raise ValueError(f"URL host is blocked: {host}")

    try:
        ip = ipaddress.ip_address(host)
        for network in PRIVATE_NETWORKS:
            if ip in network:
                raise ValueError("URL points to a private/reserved IP address")
        if ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError("URL points to a private/reserved IP address")
    except ValueError as e:
        if "private" in str(e).lower() or "blocked" in str(e).lower() or "reserved" in str(e).lower():
            raise
        # Not an IP, it's a hostname - try to resolve
        try:
            resolved = socket.getaddrinfo(host, None)
            for family, type_, proto, canonname, sockaddr in resolved:
                addr = sockaddr[0]
                ip = ipaddress.ip_address(addr)
                for network in PRIVATE_NETWORKS:
                    if ip in network:
                        raise ValueError(f"URL hostname {host} resolves to private IP {addr}")
                if ip.is_loopback or ip.is_link_local or ip.is_reserved:
                    raise ValueError(f"URL hostname {host} resolves to reserved IP {addr}")
        except socket.gaierror:
            pass  # Cannot resolve, let the request fail naturally
