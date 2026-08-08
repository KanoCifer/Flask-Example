package middleware

import (
	"net/netip"
	"strings"

	"github.com/gin-gonic/gin"
)

// clientIPKey 保存 RealClientIPMiddleware 解析出的真实客户端 IP。
const clientIPKey = "resolved_client_ip"

// ClientIP 返回当前请求的真实客户端 IP。
//
// 优先取 RealClientIPMiddleware 写入 context 的值（穿透可信反代后的真实 IP）；
// 未注册该中间件（如部分单测直接 gin.New()）时退回 gin 默认 c.ClientIP()。
func ClientIP(c *gin.Context) string {
	if v, ok := c.Get(clientIPKey); ok {
		if s, ok := v.(string); ok && s != "" {
			return s
		}
	}
	return c.ClientIP()
}

// RealClientIPMiddleware 解析真实客户端 IP 并写入 context，供 ClientIP() 读取。
//
// 约定与 Python 端 app/api/des/limiter.py 的 client_key 一致：nginx 用
// `$proxy_add_x_forwarded_for` 把真实来源 IP 追加在 X-Forwarded-For 末段，
// 因此取**最右一个非空项**即为真实访客，客户端伪造的首段被忽略。
//
// 只有直接连接方（RemoteAddr）命中 trustedProxies 时才信任转发头；否则一律
// 按直连处理返回对端 IP，防止绕过 nginx 直连后端时伪造 XFF 冒用他人 IP。
func RealClientIPMiddleware(trustedProxies []string) gin.HandlerFunc {
	trusted := parseTrustedProxies(trustedProxies)
	return func(c *gin.Context) {
		c.Set(clientIPKey, resolveClientIP(c, trusted))
		c.Next()
	}
}

// trustedProxies 预解析后的可信代理集合（IP 或 CIDR）。
type trustedProxies struct {
	prefixes []netip.Prefix
}

// parseTrustedProxies 把 "IP" / "CIDR" 列表解析为前缀集合；非法项直接丢弃。
func parseTrustedProxies(proxies []string) trustedProxies {
	var out trustedProxies
	for _, s := range proxies {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if strings.Contains(s, "/") {
			if p, err := netip.ParsePrefix(s); err == nil {
				out.prefixes = append(out.prefixes, p)
				continue
			}
		} else if a, err := netip.ParseAddr(s); err == nil {
			out.prefixes = append(out.prefixes, netip.PrefixFrom(a, a.BitLen()))
			continue
		}
	}
	return out
}

// contains 判断 ip 是否命中任一可信前缀。
func (t trustedProxies) contains(ip string) bool {
	if ip == "" {
		return false
	}
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return false
	}
	for _, p := range t.prefixes {
		if p.Contains(addr) {
			return true
		}
	}
	return false
}

// resolveClientIP 计算真实客户端 IP（见 RealClientIPMiddleware 注释）。
func resolveClientIP(c *gin.Context, trusted trustedProxies) string {
	remote := c.RemoteIP()
	if !trusted.contains(remote) {
		// 直连或对端不在可信列表：XFF 可能被伪造，直接按对端 IP 处理。
		return remote
	}

	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		for i := len(parts) - 1; i >= 0; i-- {
			if ip := strings.TrimSpace(parts[i]); ip != "" {
				return ip
			}
		}
	}
	if xrip := strings.TrimSpace(c.GetHeader("X-Real-IP")); xrip != "" {
		return xrip
	}
	return remote
}
