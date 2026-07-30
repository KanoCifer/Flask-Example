package dto

import "time"

// WereadBookRaw 是微信读书 /book/info 原生响应的字段结构。
// 字段名与 API 返回一致，再经 ToDTO 映射为前端/契约字段（对齐 Python map_book_info）。
type WereadBookRaw struct {
	BookId           string         `json:"bookId"`
	Title            string         `json:"title"`
	Author           string         `json:"author"`
	Translator       string         `json:"translator"`
	Cover            string         `json:"cover"`
	Intro            string         `json:"intro"`
	Category         string         `json:"category"`
	Publisher        string         `json:"publisher"`
	PublishTime      string         `json:"publishTime"`
	ISBN             string         `json:"isbn"`
	WordCount        int            `json:"wordCount"`
	NewRating        float64        `json:"newRating"`
	NewRatingCount   int            `json:"newRatingCount"`
	NewRatingDetails map[string]any `json:"newRatingDetail"`
}

// ToDTO 将原生响应映射为前端契约 DTO（bookId→id、intro→introduction、newRatingDetail→newRatingDetails）。
func (r WereadBookRaw) ToDTO(fetchedAt time.Time) *WereadBookResponse {
	return &WereadBookResponse{
		ID:               r.BookId,
		Title:            r.Title,
		Author:           r.Author,
		Translator:       r.Translator,
		Cover:            r.Cover,
		Introduction:     r.Intro,
		Category:         r.Category,
		Publisher:        r.Publisher,
		PublishTime:      r.PublishTime,
		ISBN:             r.ISBN,
		WordCount:        r.WordCount,
		NewRating:        r.NewRating,
		NewRatingCount:   r.NewRatingCount,
		NewRatingDetails: r.NewRatingDetails,
		FetchedAt:        fetchedAt,
	}
}
