package urlvalidator

import (
	"errors"
	"net"
	"net/url"
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
	if ip != nil {
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
