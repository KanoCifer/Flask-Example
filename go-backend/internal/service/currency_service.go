package service

import (
	"context"
	"fmt"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/redis/go-redis/v9"
)

const cacheKeyPrefix = "currency"

type CurrencyService struct {
	cli *CurrencyClient
}

type Currencyer interface {
	GetExchange(ctx context.Context, baseCurrency string) (*dto.ExchangeResponse, error)
}

func NewCurrencyService(http *httpclient.Client, redis *redis.Client, opts ...ClientOption) *CurrencyService {
	return &CurrencyService{
		cli: NewCurrencyClient(http, redis, opts...),
	}
}

func (c *CurrencyService) GetExchange(ctx context.Context, baseCurrency string) (*dto.ExchangeResponse, error) {
	now := time.Now().Format("2006/01/02")
	cacheKey := fmt.Sprintf("%s:%s:%s", cacheKeyPrefix, baseCurrency, now)
	raw, err := c.cli.GetExchange(ctx, baseCurrency, cacheKey, 4*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("CurrencyService failed: %w", err)
	}
	res, err := dto.ToExchangeResponse(raw)
	if err != nil {
		return nil, fmt.Errorf("CurrencyService json unmarshal failed: %w", err)
	}

	return res, nil
}
