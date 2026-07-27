package mongodb

import (
	"context"
	"strconv"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type WeReadRepository struct {
	coll *mongo.Collection
}

const collectionName = "weread_user"

func NewWeReadRepository(coll *mongo.Database) *WeReadRepository {
	return &WeReadRepository{
		coll: coll.Collection(collectionName),
	}
}

func (r *WeReadRepository) GetUserToken(ctx context.Context, userID string) (string, error) {
	filter := bson.M{"user_id": userID}
	result := r.coll.FindOne(ctx, filter)
	var token string
	if err := result.Decode(&token); err != nil {
		return "", err
	}
	return token, nil
}

func (r *WeReadRepository) CreateUserToken(ctx context.Context, userID string, token string) error {
	id, err := strconv.Atoi(userID)
	if err != nil {
		return err
	}
	var wereadUser = document.WereadUser{
		UserID:    id,
		APIKey:    token,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	_, err = r.coll.InsertOne(ctx, wereadUser)
	if err != nil {
		return err
	}
	return nil
}
