package handler

import (
	"context"
	"log/slog"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/service"
	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
)

type WSHandler struct {
	Svc service.WSer
}

func NewWSHandler(svc service.WSer) *WSHandler {
	return &WSHandler{
		Svc: svc,
	}
}

func (h *WSHandler) HandleWS(c *gin.Context) {
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "failed to accept websocket", "error", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "Connection closed")

	reqCtx := c.Request.Context()
	slog.InfoContext(reqCtx, "websocket connected", "remote", c.Request.RemoteAddr)

	readCtx, readCancel := context.WithTimeout(reqCtx, 10*time.Second)
	defer readCancel()

	var msg map[string]interface{}
	if err := h.Svc.ReadMsg(readCtx, conn, &msg); err != nil {
		if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
			slog.InfoContext(reqCtx, "client closed before first message")
		} else {
			slog.ErrorContext(reqCtx, "failed to read first message", "error", err)
		}
		return
	}

	registered, err := h.Svc.HandleFirstMessage(readCtx, conn, msg)
	if err != nil {
		if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
			slog.InfoContext(reqCtx, "client closed during handshake")
		} else {
			slog.ErrorContext(reqCtx, "failed to handle first message", "error", err)
		}
		return
	}

	// 提取 visitor_id 用于断开时清理
	visitorId, _ := msg["visitor_id"].(string)
	slog.InfoContext(reqCtx, "visitor registered", "visitor_id", visitorId, "registered", registered)

	// 连接生命周期 context：任一 goroutine 结束即取消，驱动另一方退出
	ctx, cancel := context.WithCancel(reqCtx)
	defer cancel()

	errc := make(chan error, 2)
	go func() {
		errc <- h.Svc.RedisListener(ctx, conn)
	}()
	go func() {
		errc <- h.Svc.WSReceiver(ctx, conn)
	}()

	slog.InfoContext(reqCtx, "ws goroutines started")

	// 等待任一任务结束（连接断开或出错），然后取消上下文让另一个也退出
	<-errc
	cancel()
	<-errc

	slog.InfoContext(reqCtx, "websocket disconnected", "visitor_id", visitorId)

	// 清理访客计数并广播更新
	if registered && visitorId != "" {
		cleanupCtx, cleanupCancel := context.WithTimeout(reqCtx, 5*time.Second)
		defer cleanupCancel()
		if err := h.Svc.RemoveVisitor(cleanupCtx, visitorId); err != nil {
			slog.ErrorContext(reqCtx, "failed to remove visitor", "error", err, "visitor_id", visitorId)
			return
		}
		if err := h.Svc.PublishCount(cleanupCtx); err != nil {
			slog.ErrorContext(reqCtx, "failed to broadcast count after disconnect", "error", err)
			return
		}
		slog.InfoContext(reqCtx, "visitor cleaned up", "visitor_id", visitorId)
	}
}

func (h *WSHandler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/public/ws", h.HandleWS)
}
