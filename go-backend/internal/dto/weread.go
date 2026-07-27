// Package dto 定义 weread 相关的数据传输对象，对齐 Python 端响应结构。
package dto

import "time"

type WereadTokenRequest struct {
	Data string `json:"data" binding:"required"`
}

type WereadBookResponse struct {
	ID               string         `json:"id"`
	Title            string         `json:"title"`
	Author           string         `json:"author"`
	Translator       string         `json:"translator"`
	Cover            string         `json:"cover"`
	Introduction     string         `json:"introduction"`
	Category         string         `json:"category"`
	Publisher        string         `json:"publisher"`
	PublishTime      string         `json:"publishTime"`
	ISBN             string         `json:"isbn"`
	WordCount        int            `json:"wordCount"`
	NewRating        float64        `json:"newRating"`
	NewRatingCount   int            `json:"newRatingCount"`
	NewRatingDetails map[string]int `json:"newRatingDetails"`
	FetchedAt        time.Time      `json:"fetched_at"`
}

// ── 上游 /shelf/sync 原生结构（仅用于反序列化）──────────────────────────

// WereadShelfRaw 是 /shelf/sync 回包的顶层结构，与微信读书上游 API 1:1 对齐。
type WereadShelfRaw struct {
	Books       []WereadShelfBookRaw `json:"books"`
	Archive     []WereadShelfArchiveRaw `json:"archive"`
}

// WereadShelfBookRaw 是上游 books 数组中的单本书。
type WereadShelfBookRaw struct {
	BookId         string  `json:"bookId"`
	Title          string  `json:"title"`
	Author         string  `json:"author"`
	Cover          string  `json:"cover"`
	Category       *string `json:"category"`
	ReadUpdateTime int64   `json:"readUpdateTime"`
	UpdateTime     int64   `json:"updateTime"`
	FinishReading  int64   `json:"finishReading"`
	Secret         int64   `json:"secret"`
}

// WereadShelfArchiveRaw 是上游 archive 数组中的单条书单。
type WereadShelfArchiveRaw struct {
	BookIds  []string `json:"bookIds"`
	Name     string   `json:"name"`
	AlbumIds []any    `json:"albumIds"`
}

// ── 前端契约结构（对齐 Python get_user_shelf 返回给前端的形状）────────────

// WereadShelfBook 书架上的单本书 —— 对齐 Python shelf.py get_user_shelf 的 book_data 字段。
type WereadShelfBook struct {
	BookId         string `json:"bookId"`
	Title          string `json:"title"`
	Author         string `json:"author"`
	Cover          string `json:"cover"`
	Category       string `json:"category"`
	ReadUpdateTime int64  `json:"readUpdateTime"`
	UpdateTime     int64  `json:"updateTime"`
	FinishReading  int    `json:"finishReading"`
	Secret         int    `json:"secret"`
	IsTop          int    `json:"isTop"`
}

// WereadShelfArchive 书单 —— 对齐 Python Archive 模型。
type WereadShelfArchive struct {
	ArchiveId string   `json:"archiveId"`
	Name      string   `json:"name"`
	BookIds   []string `json:"bookIds"`
	AlbumIds  []string `json:"albumIds"`
}

// WereadShelfResponse 返回给前端的顶层结构，对齐 Python get_user_shelf 返回的 (book_data, archives)。
type WereadShelfResponse struct {
	Books    []WereadShelfBook    `json:"user_books"`
	Archives []WereadShelfArchive `json:"archives"`
}

// ParseShelfRaw 将上游原生结构转换为前端契约结构。
// 对齐 Python parse_shelf_books + get_user_shelf 的转换逻辑。
func ParseShelfRaw(raw WereadShelfRaw) *WereadShelfResponse {
	books := make([]WereadShelfBook, 0, len(raw.Books))
	for _, b := range raw.Books {
		cat := ""
		if b.Category != nil {
			cat = *b.Category
		}
		books = append(books, WereadShelfBook{
			BookId:         b.BookId,
			Title:          b.Title,
			Author:         b.Author,
			Cover:          b.Cover,
			Category:       cat,
			ReadUpdateTime: b.ReadUpdateTime,
			UpdateTime:     b.UpdateTime,
			FinishReading:  int(b.FinishReading),
			Secret:         int(b.Secret),
			IsTop:          0, // 上游 books 数组不含 isTop，默认 0
		})
	}

	archives := make([]WereadShelfArchive, 0, len(raw.Archive))
	for _, a := range raw.Archive {
		albumIds := make([]string, 0, len(a.AlbumIds))
		for _, v := range a.AlbumIds {
			if s, ok := v.(string); ok {
				albumIds = append(albumIds, s)
			}
		}
		archives = append(archives, WereadShelfArchive{
			Name:    a.Name,
			BookIds: a.BookIds,
			AlbumIds: albumIds,
		})
	}

	return &WereadShelfResponse{
		Books:    books,
		Archives: archives,
	}
}
