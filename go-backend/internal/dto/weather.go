package dto

import (
	"encoding/json"
)

type TideResponse struct {
	Data      json.RawMessage `json:"data"`
	FromCache bool            `json:"fromCache"`
}

type FullWeatherData struct {
	Current      json.RawMessage `json:"current"`
	Hourly       json.RawMessage `json:"hourly"`
	Daily        json.RawMessage `json:"daily"`
	Tide         json.RawMessage `json:"tide"`
	Indices      json.RawMessage `json:"indices"`
	LocationName string          `json:"locationName"`
	POIID        string          `json:"poiId"`
}

func ToTideResponse(data json.RawMessage, fromCache bool) TideResponse {
	return TideResponse{Data: data, FromCache: fromCache}
}
