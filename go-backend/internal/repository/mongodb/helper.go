package mongodb

import (
	"github.com/KanoCifer/kuroome-blog/internal/domain/moment/errs"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func validateObjectID(id string) (oid bson.ObjectID, err error) {
	oid, err = bson.ObjectIDFromHex(id)
	if err != nil {
		return bson.ObjectID{}, momenterrs.ErrInvalidObjectID
	}
	return oid, nil
}
