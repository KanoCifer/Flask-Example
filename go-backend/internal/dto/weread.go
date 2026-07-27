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

// WereadShelfBook 书架上的单本书 —— 对齐 Python shelf.py get_user_shelf 的 book_data 字段。
type WereadShelfBook struct {
	BookId         string `json:"bookId"`
	Title          string `json:"title"`
	Author         string `json:"author"`
	Cover          string `json:"cover"`
	Category       string `json:"category"`
	ReadUpdateTime int64  `json:"readUpdateTime"`
	UpdateTime     int64  `json:"updateTime"`
	FinishReading  bool   `json:"finishReading"`
	Secret         bool   `json:"secret"`
	IsTop          bool   `json:"isTop"`
}

// WereadShelfArchive 书单 —— 对齐 Python Archive 模型。
type WereadShelfArchive struct {
	ArchiveId string   `json:"archiveId"`
	Name      string   `json:"name"`
	BookIds   []string `json:"bookIds"`
	AlbumIds  []string `json:"albumIds"`
}

// WereadShelfResponse /shelf/sync 回包的顶层结构，对齐 Python get_user_shelf 返回的 (book_data, archives)。
type WereadShelfResponse struct {
	Books    []WereadShelfBook    `json:"books"`
	Archives []WereadShelfArchive `json:"archives"`
}
