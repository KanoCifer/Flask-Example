package dto

// ToResponseSlice 通用批量转换函数，将 []T 通过 conv 映射为 []R。
// 用于统一各列表转换函数（如 ToDevTaskList、ToMomentList、ToPostList）的实现。
func ToResponseSlice[T, R any](items []T, conv func(T) R) []R {
	out := make([]R, len(items))
	for i, item := range items {
		out[i] = conv(item)
	}
	return out
}
