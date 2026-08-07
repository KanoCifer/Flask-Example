package db

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/model"
)

var (
	pgDB    *gorm.DB
	client  *mongo.Client   // kept for Close()/disconnect
	mongoDB *mongo.Database // resolved handle, what repos consume
	rdb     *redis.Client
)

func InitDB() error {
	var err error
	dsn := databaseURL()
	pgDB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: model.NewNamer(),
	})
	if err != nil {
		return err
	}
	return pgDB.AutoMigrate(
		&model.User{},
		&model.Profile{},
		&model.VisitorTrack{},
		&model.RssInfo{},
		&model.PasskeyCredential{},
		&model.Subscription{},
		&model.DeviceTrack{},
		&model.GalleryImage{},
		&model.Log{},
		&model.Event{},
		&model.LlmUsage{},
	)
}

func GetDB() *gorm.DB {
	return pgDB
}

func InitMongo() error {
	uri := config.Cfg.Database.MongoURI
	if uri == "" {
		slog.Error("[mongo] MONGO_URI not configured, skipping")
		return fmt.Errorf("MONGO_URI not configured")
	}
	serverAPI := options.ServerAPI(options.ServerAPIVersion1)
	opts := options.Client().ApplyURI(uri).SetServerAPIOptions(serverAPI)
	// document.Post.ID 为 string 类型，需开启此选项让 driver 将 ObjectID 解码为十六进制字符串
	opts.SetBSONOptions(&options.BSONOptions{ObjectIDAsHexString: true})
	c, err := mongo.Connect(opts)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := c.Ping(ctx, readpref.Primary()); err != nil {
		return err
	}
	client = c
	mongoDB = client.Database("readinglist")
	if mongoDB != nil {
		_, _ = mongoDB.Collection("posts").Indexes().CreateOne(
			context.Background(),
			mongo.IndexModel{
				Keys: bson.D{{Key: "title", Value: "text"}, {Key: "body", Value: "text"}},
			},
		)
	}
	return nil
}

func GetMongo() *mongo.Client {
	return client
}

func GetMongoDB() *mongo.Database {
	return mongoDB
}

func InitRedis() error {
	opts, err := redis.ParseURL(config.Cfg.Database.RedisURL)
	if err != nil {
		return err
	}
	rdb = redis.NewClient(opts)
	return rdb.Ping(context.Background()).Err()
}

func GetRedis() *redis.Client {
	return rdb
}

// databaseURL 优先从环境变量 DATABASE_URL 读取，回退到 config.Cfg。
// viper 的 AutomaticEnv 在 mapstructure 值为空字符串时不覆盖 default，
// 导致 viper 读到的 DATABASE_URL 常为空；直接从 os 读可以绕过这个问题。
func databaseURL() string {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		return url
	}
	if cfg := config.Cfg; cfg != nil && cfg.Database.DatabaseURL != "" {
		return cfg.Database.DatabaseURL
	}
	return ""
}

func Close() {
	if client != nil {
		client.Disconnect(context.Background())
	}
	if rdb != nil {
		rdb.Close()
	}
	if pgDB != nil {
		sqlDB, _ := pgDB.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}
}
