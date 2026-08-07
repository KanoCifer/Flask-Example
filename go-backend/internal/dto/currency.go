package dto

import "encoding/json"

type ExchangeResponse struct {
	TimeStamp int64              `json:"timestamp"`
	Base      string             `json:"base"`
	Rates     map[string]float64 `json:"rates"`
}

func ToExchangeResponse(raw json.RawMessage) (*ExchangeResponse, error) {
	var resp ExchangeResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}
