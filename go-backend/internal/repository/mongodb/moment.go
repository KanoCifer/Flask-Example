package mongodb

import (
	"context"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/errs"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type MomentRepo struct {
	coll *mongo.Collection
}

const MomentCollection = "moments"

func NewMomentRepo(db *mongo.Database) *MomentRepo {
	return &MomentRepo{
		coll: db.Collection(MomentCollection),
	}
}

func (r *MomentRepo) ListPublic(ctx context.Context, tag ...string) ([]document.Moment, error) {
	// 查询所有可见性为 public 的文档
	var moments []document.Moment

	query := bson.D{{Key: "visibility", Value: document.MomentPublic}}
	if len(tag) > 0 {
		query = bson.D{
			{Key: "visibility", Value: document.MomentPublic},
			{Key: "tags", Value: bson.D{{Key: "$in", Value: tag}}},
		}
	}

	opts := options.Find().SetSort(bson.D{{Key: "published_at", Value: -1}})
	cur, err := r.coll.Find(ctx, query, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	if err := cur.All(ctx, &moments); err != nil {
		return nil, err
	}

	return moments, nil
}

// CountPublic 返回可见性=public 的文档总数（可按 tag 过滤）。
// 与 ListPublic 配对用于分页响应。
func (r *MomentRepo) CountPublic(ctx context.Context, tag string) (int, error) {
	query := bson.M{"visibility": document.MomentPublic}
	if tag != "" {
		query["tags"] = bson.M{"$in": []string{tag}}
	}
	count, err := r.coll.CountDocuments(ctx, query)
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

// ListPublicPage 分页查询 public 可见性的 moment。
// 跳过 deleted_at 非空的文档（与 SoftDelete 写入逻辑对齐）。
func (r *MomentRepo) ListPublicPage(ctx context.Context, page, pageSize int, tag string) ([]document.Moment, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	query := bson.M{
		"visibility": document.MomentPublic,
		"deleted_at": nil,
	}
	if tag != "" {
		query["tags"] = bson.M{"$in": []string{tag}}
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "published_at", Value: -1}, {Key: "_id", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	var moments []document.Moment
	cur, err := r.coll.Find(ctx, query, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	if err := cur.All(ctx, &moments); err != nil {
		return nil, err
	}
	return moments, nil
}

// ListAdmin 管理员分页查询：覆盖全部 visibility / status；include_deleted=false
// 时排除已软删的文档。返回 (列表, 总数)。
func (r *MomentRepo) ListAdmin(
	ctx context.Context,
	status string,
	includeDeleted bool,
	page, pageSize int,
) ([]document.Moment, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	query := bson.M{}
	if status != "" {
		query["status"] = status
	}
	if !includeDeleted {
		query["deleted_at"] = nil
	}

	total, err := r.coll.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "updated_at", Value: -1}, {Key: "_id", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	var moments []document.Moment
	cur, err := r.coll.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)

	if err := cur.All(ctx, &moments); err != nil {
		return nil, 0, err
	}
	return moments, int(total), nil
}

// GetByIDAdmin 按 hex ID 查单条 moment，包含软删的文档（管理员视图）。
// ID 非法 → errs.ErrInvalidObjectID；不存在 → mongo.ErrNoDocuments（service 翻译）。
func (r *MomentRepo) GetByIDAdmin(ctx context.Context, id string) (*document.Moment, error) {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, errs.ErrInvalidObjectID
	}
	var m document.Moment
	if err := r.coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&m); err != nil {
		return nil, err
	}
	return &m, nil
}

// Create 插入一条 moment；_id 由 mongo-driver 自动生成 ObjectID，
// 转成 hex 字符串回填到 m.ID（与 devtask 模式一致），便于按 ID 查询 / 序列化。
// CreatedAt/UpdatedAt 由 service 层设置，repo 只负责持久化。
func (r *MomentRepo) Create(ctx context.Context, m *document.Moment) error {
	res, err := r.coll.InsertOne(ctx, m)
	if err != nil {
		return err
	}
	if oid, ok := res.InsertedID.(bson.ObjectID); ok {
		m.ID = oid.Hex()
	}
	return nil
}

// GetByID 按 hex ID 查单条 moment。
// ID 格式非法时返回 ErrInvalidID（沿用 mongo.ErrNoDocuments 的命名风格）。
func (r *MomentRepo) GetByID(ctx context.Context, id string) (*document.Moment, error) {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var m document.Moment
	if err := r.coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&m); err != nil {
		return nil, err
	}
	return &m, nil
}

// Update 部分更新；MatchedCount==0（文档不存在）→ 翻译成 errs.ErrMomentNotFound。
func (r *MomentRepo) Update(ctx context.Context, id string, fields bson.M) error {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return errs.ErrInvalidObjectID
	}
	res, err := r.coll.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": fields})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errs.ErrMomentNotFound
	}
	return nil
}

// SoftDelete 软删：filter 同时排除已删除的文档，避免重复设置 deleted_at。
// MatchedCount==0（不存在或已删除）→ errs.ErrMomentNotFound。
func (r *MomentRepo) SoftDelete(ctx context.Context, id string) error {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return errs.ErrInvalidObjectID
	}
	res, err := r.coll.UpdateOne(ctx,
		bson.M{"_id": oid, "deleted_at": nil},
		bson.M{"$set": bson.M{"deleted_at": time.Now().UTC()}})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errs.ErrMomentNotFound
	}
	return nil
}

// HardDelete 物理删除；DeletedCount==0 → errs.ErrMomentNotFound。
func (r *MomentRepo) HardDelete(ctx context.Context, id string) error {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return errs.ErrInvalidObjectID
	}
	res, err := r.coll.DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return errs.ErrMomentNotFound
	}
	return nil
}
