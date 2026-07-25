package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/redis/go-redis/v9"
)

// WSer 定义 handler 层依赖的 WS 能力集合。
// 由 service.WSer 实现；handler 仅依赖此接口，便于测试替换。
type WSer interface {
	ReadMsg(ctx context.Context, conn *websocket.Conn, msg interface{}) error
	HandleFirstMessage(ctx context.Context, conn *websocket.Conn, msg map[string]interface{}) (bool, error)
	RedisListener(ctx context.Context, conn *websocket.Conn) error
	WSReceiver(ctx context.Context, conn *websocket.Conn) error
	RemoveVisitor(ctx context.Context, visitorId string) error
	PublishCount(ctx context.Context) error
}

const (
	visitorHashKey = "ws:visitor:conns"
	visitorChannel = "ws:visitor_count_changed"
	visitorSetKey  = "ws:visitors"
)

type WSService struct {
	redis *redis.Client
	mu    sync.Mutex // 保护 conn 并发写（RedisListener + wsReceiver 同时 SendMsg）
}

func NewWSService(redis *redis.Client) *WSService {
	return &WSService{
		redis: redis,
	}
}

func (s *WSService) addVisitor(ctx context.Context, visitorId string) error {
	pipe := s.redis.Pipeline()
	pipe.SAdd(ctx, visitorSetKey, visitorId)
	pipe.HIncrBy(ctx, visitorHashKey, visitorId, 1)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}
	slog.InfoContext(ctx, "visitor registered", "visitor_id", visitorId)
	return nil
}

// shouldCleanupVisitor 在引用计数减一后判断是否应从集合移除。
// 独立出来便于单元测试锁定边界（归零 + 负值都清理，正数保留）。
func shouldCleanupVisitor(remaining int64) bool {
	return remaining <= 0
}

func (s *WSService) RemoveVisitor(ctx context.Context, visitorId string) error {
	remaining, err := s.redis.HIncrBy(ctx, visitorHashKey, visitorId, -1).Result()
	if err != nil {
		return err
	}
	if shouldCleanupVisitor(remaining) {
		pipe := s.redis.Pipeline()
		pipe.SRem(ctx, visitorSetKey, visitorId)
		pipe.HDel(ctx, visitorHashKey, visitorId)
		if _, err := pipe.Exec(ctx); err != nil {
			return err
		}
		slog.InfoContext(ctx, "visitor cleaned up", "visitor_id", visitorId)
		return nil
	}
	return nil
}

func (s *WSService) PublishCount(ctx context.Context) error {
	current, err := s.redis.SCard(ctx, visitorSetKey).Result()
	if err != nil {
		return err
	}
	payload, err := buildCountPayload(current)
	if err != nil {
		return err
	}
	if _, err := s.redis.Publish(ctx, visitorChannel, payload).Result(); err != nil {
		return err
	}
	return nil
}

// buildCountPayload 把访客计数序列化为 JSON 字节。
// 独立出来便于单元测试校验 wire 格式（客户端 JSON.parse 要求严格的 {"type":"count","count":N}）。
func buildCountPayload(count int64) ([]byte, error) {
	return json.Marshal(map[string]any{
		"type":  "count",
		"count": count,
	})
}

// RedisListener 订阅计数频道，逐条转发到 WebSocket 连接。
// 运行直到 ctx 取消或读取失败。
func (s *WSService) RedisListener(ctx context.Context, conn *websocket.Conn) error {
	pubsub := s.redis.Subscribe(ctx, visitorChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return nil
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			// msg.Payload 已是 PublishCount 写入的 JSON 字符串，直接作为 text frame 转发。
			if err := s.writeText(ctx, conn, []byte(msg.Payload)); err != nil {
				return err
			}
		}
	}
}

// writeText 并发安全地写入一条 text frame，与 SendMsg 共用互斥锁。
func (s *WSService) writeText(ctx context.Context, conn *websocket.Conn, p []byte) error {
	s.mu.Lock()
	err := conn.Write(ctx, websocket.MessageText, p)
	s.mu.Unlock()
	return err
}

// WSReceiver 循环读取客户端消息并处理 ping/pong。
// 运行直到读取失败（客户端断开）或 ctx 取消。
func (s *WSService) WSReceiver(ctx context.Context, conn *websocket.Conn) error {
	for {
		var msg map[string]any
		select {
		case <-ctx.Done():
			return nil
		default:
			if err := s.ReadMsg(ctx, conn, &msg); err != nil {
				return err
			}
			if err := s.HandlePing(ctx, conn, msg); err != nil {
				return err
			}
		}
	}
}

func (s *WSService) HandlePing(ctx context.Context, conn *websocket.Conn, msg map[string]any) error {
	if msg["type"] == "ping" {
		res := map[string]any{
			"type": "pong",
		}
		if err := s.SendMsg(ctx, conn, res); err != nil {
			return err
		}
	}
	return nil
}

// HandleFirstMessage 处理首条消息：如果是 visitor_id 则注册访客并广播计数。
// 返回注册后的当前总数，方便调用方回传给客户端。
func (s *WSService) HandleFirstMessage(ctx context.Context, conn *websocket.Conn, msg map[string]any) (bool, error) {
	registered := false
	if msg["type"] == "visitor_id" {
		visitorId, _ := msg["visitor_id"].(string)
		if visitorId != "" {
			if err := s.addVisitor(ctx, visitorId); err != nil {
				return false, err
			}
			registered = true
		}
	}

	if err := s.PublishCount(ctx); err != nil {
		return registered, err
	}

	current, err := s.redis.SCard(ctx, visitorSetKey).Result()
	if err != nil {
		return registered, err
	}

	res := map[string]any{
		"type":  "count",
		"count": current,
	}
	if err := s.SendMsg(ctx, conn, res); err != nil {
		return registered, err
	}

	return registered, nil
}

func (s *WSService) ReadMsg(ctx context.Context, conn *websocket.Conn, msg any) error {
	return wsjson.Read(ctx, conn, msg)
}

// SendMsg 是并发安全的写入口；多个 goroutine 可同时调用。
func (s *WSService) SendMsg(ctx context.Context, conn *websocket.Conn, msg any) error {
	s.mu.Lock()
	err := wsjson.Write(ctx, conn, msg)
	s.mu.Unlock()
	return err
}
