package handler

import (
	"log/slog"
	"net/http"

	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service"
	"github.com/gin-gonic/gin"
)

type CurrencyHandler struct {
	svc service.Currencyer
}

func NewCurrencyHandler(
	svc service.Currencyer,
) *CurrencyHandler {
	return &CurrencyHandler{svc: svc}
}

func (h *CurrencyHandler) GetExchangeRate(c *gin.Context) {
	base := c.Query("base")
	if base == "" {
		response.APIError(c, "Need Base Currency", http.StatusBadRequest)
		return
	}
	res, err := h.svc.GetExchange(c.Request.Context(), base)

	if err != nil {
		slog.ErrorContext(c.Request.Context(), "GetExchangeRate failed", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}

	response.Success(c, res, "汇率获取成功")

}

func (h *CurrencyHandler) RegisterRoutes(r *gin.RouterGroup, mw ...gin.HandlerFunc) {
	r.GET("/currency", append(mw, h.GetExchangeRate)...)
}
