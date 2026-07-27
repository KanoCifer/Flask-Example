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
	Books   []WereadShelfBookRaw    `json:"books"`
	Archive []WereadShelfArchiveRaw `json:"archive"`
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

// ── 阅读统计快照（/readdata/detail）──────────────────────────────────────
// 单一扁平结构 = ReadDetailOverallRaw 超集，指针 + omitempty。
// 与 Python weread_detail_raw.py ReadDetailOverallRaw 和前端 TS ReadDetailOverallRaw 对齐。

// ReadDetailSnapshot 是 /readdata/detail 四种 mode 的统一返回类型。
type ReadDetailSnapshot struct {
	// ── 元数据 ──────────────────────────────────────────────────────-
	UserID    int    `json:"user_id"`
	Mode      string `json:"mode"`
	BaseTime  int    `json:"baseTime"`
	FetchedAt string `json:"fetched_at"`

	// ── Weekly ──────────────────────────────────────────────────────-
	ReadTimes          map[string]int    `json:"readTimes,omitempty"`
	ReadDays           *int              `json:"readDays,omitempty"`
	ReadLongest        []ReadLongestItem `json:"readLongest,omitempty"`
	Rank               *ReadRank         `json:"rank,omitempty"`
	Compare            *float64          `json:"compare,omitempty"`
	DayAverageReadTime *int              `json:"dayAverageReadTime,omitempty"`
	TotalReadTime      *int              `json:"totalReadTime,omitempty"`

	// ── Monthly 附加 ────────────────────────────────────────────────-
	PreferCategory     []ReadCategoryItem `json:"preferCategory,omitempty"`
	PreferCategoryWord *string            `json:"preferCategoryWord,omitempty"`
	ReadStat           []ReadStatItem     `json:"readStat,omitempty"`

	// ── Annually 附加 ────────────────────────────────────────────────
	PreferAuthor    []ReadAuthorItem    `json:"preferAuthor,omitempty"`
	AuthorCount     *int                `json:"authorCount,omitempty"`
	PreferPublisher []ReadPublisherItem `json:"preferPublisher,omitempty"`
	ReadRate        *int                `json:"readRate,omitempty"`
	WrReadTime      *int                `json:"wrReadTime,omitempty"`
	WrListenTime    *int                `json:"wrListenTime,omitempty"`

	// ── Overall 附加 ────────────────────────────────────────────────-
	PreferTime     []int   `json:"preferTime,omitempty"`
	PreferTimeWord *string `json:"preferTimeWord,omitempty"`
}

// ReadLongestItem 是 readLongest 数组项。
type ReadLongestItem struct {
	Book      *ReadDetailBook `json:"book,omitempty"`
	AlbumInfo map[string]any  `json:"albumInfo,omitempty"`
	ReadTime  int             `json:"readTime"`
	Tags      []string        `json:"tags,omitempty"`
}

// ReadDetailBook 是 readLongest 数组项中的 book 字段。
type ReadDetailBook struct {
	BookId     *string `json:"bookId,omitempty"`
	Title      *string `json:"title,omitempty"`
	Author     *string `json:"author,omitempty"`
	Translator *string `json:"translator,omitempty"`
	Intro      *string `json:"intro,omitempty"`
	Cover      *string `json:"cover,omitempty"`
}

// ReadRank 是仅 Weekly 返回的 rank。
type ReadRank struct {
	Text   string `json:"text"`
	Scheme string `json:"scheme,omitempty"`
}

// ReadStatItem 是 readStat 数组项（Monthly 及以上）。
type ReadStatItem struct {
	Stat   string `json:"stat"`
	Counts string `json:"counts"`
}

// ReadCategoryItem 是 preferCategory 数组项（Monthly 及以上）。
type ReadCategoryItem struct {
	CategoryTitle string `json:"categoryTitle"`
	ReadingCount  int    `json:"readingCount"`
	ReadingTime   int    `json:"readingTime"`
}

// ReadAuthorItem 是 preferAuthor 数组项（Annually 及以上）。
type ReadAuthorItem struct {
	Name     *string `json:"name,omitempty"`
	Count    *int    `json:"count,omitempty"`
	ReadTime *string `json:"readTime,omitempty"`
}

// ReadPublisherItem 是 preferPublisher 数组项。
type ReadPublisherItem struct {
	Name  *string `json:"name,omitempty"`
	Count int     `json:"count"`
}

// WereadYearlyHeatmap 是 /read-progress?perDay=true 的响应结构。
type WereadYearlyHeatmap struct {
	ReadTimes map[string]int `json:"readTimes"`
}

// BookRecommendItem 是 /book/recommend 的响应数组项。
// 对齐 Python recommend.py RecommendResponse。
type BookRecommendItem struct {
	BookId       string  `json:"bookId"`
	Title        string  `json:"title"`
	Author       string  `json:"author"`
	Cover        *string `json:"cover,omitempty"`
	Reason       string  `json:"reason"`
	ReadingCount int     `json:"readingCount"`
	SearchIdx    int     `json:"searchIdx"`
	NewRating    int     `json:"newRating"`
}

// WereadBookProgress 是单本书的阅读进度。
// 字段对齐 Python models/weread/documents.py ReadProgress，
// 其中 IsStartReading 在前端契约里是 string|null(upstream 原始为 "0"/"1")。
type WereadBookProgress struct {
	ChapterUid     *int   `json:"chapterUid,omitempty"`
	ChapterOffset  *int   `json:"chapterOffset,omitempty"`
	Progress       *int   `json:"progress,omitempty"`
	UpdateTime     *int   `json:"updateTime,omitempty"`
	ReadingTime    int    `json:"readingTime"`
	FinishTime     *int   `json:"finishTime,omitempty"`
	IsStartReading string `json:"isStartReading,omitempty"`
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
			Name:     a.Name,
			BookIds:  a.BookIds,
			AlbumIds: albumIds,
		})
	}

	return &WereadShelfResponse{
		Books:    books,
		Archives: archives,
	}
}
