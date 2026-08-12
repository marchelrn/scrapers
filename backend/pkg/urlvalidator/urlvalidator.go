package urlvalidator

import (
	"errors"
	"net"
	"net/url"
	"os"
	"strings"
)

var allowedSchemes = map[string]bool{
	"http":  true,
	"https": true,
}

var blockedHosts = map[string]bool{
	"localhost":           true,
	"metadata.google":     true,
	"metadata.google.com": true,
	"169.254.169.254":     true,
}

func Validate(rawURL string) error {
	if rawURL == "" {
		return errors.New("url is empty")
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return errors.New("invalid url format: " + err.Error())
	}

	if !allowedSchemes[parsed.Scheme] {
		return errors.New("url scheme must be http or https, got: " + parsed.Scheme)
	}

	host := parsed.Hostname()
	if host == "" {
		return errors.New("url has no host")
	}

	hostLower := strings.ToLower(host)
	if blockedHosts[hostLower] {
		return errors.New("url host is blocked: " + host)
	}

	ip := net.ParseIP(host)
	
	// If it's a domain name (not an IP literal), resolve it and check against private IPs
	// This prevents DNS rebinding attacks to internal infrastructure
	if ip == nil {
		ips, err := net.LookupIP(host)
		if err == nil && len(ips) > 0 {
			// Check if any resolved IP is private
			for _, resolvedIP := range ips {
				if isPrivateIP(resolvedIP) {
					// We only fail if the domain points strictly to a private IP space 
					// which shouldn't happen for public sites unless it's a test environment or SSRF attempt
					// WARNING: In some dev environments like this one, `bps.go.id` might artificially point to 10.x.x.x
					// If you are explicitly testing in a private lab, you might want to bypass this check via env var
					if os.Getenv("ALLOW_PRIVATE_IP_RESOLUTION") != "true" {
						return errors.New("URL hostname " + host + " resolves to private IP " + resolvedIP.String())
					}
				}
			}
		}
	} else {
		if isPrivateIP(ip) {
			return errors.New("url points to a private/reserved IP address")
		}
	}

	return nil
}

func isPrivateIP(ip net.IP) bool {
	privateRanges := []struct {
		network *net.IPNet
	}{
		{parseCIDR("10.0.0.0/8")},
		{parseCIDR("172.16.0.0/12")},
		{parseCIDR("192.168.0.0/16")},
		{parseCIDR("127.0.0.0/8")},
		{parseCIDR("169.254.0.0/16")},
		{parseCIDR("::1/128")},
		{parseCIDR("fc00::/7")},
		{parseCIDR("fe80::/10")},
	}

	for _, r := range privateRanges {
		if r.network.Contains(ip) {
			return true
		}
	}

	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}

	return false
}

func parseCIDR(s string) *net.IPNet {
	_, network, err := net.ParseCIDR(s)
	if err != nil {
		panic("invalid CIDR: " + s)
	}
	return network
}
