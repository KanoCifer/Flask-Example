package service

import (
	"context"
	"log/slog"
	"sync"
)

type Result[T any] struct {
	Value T
	Error error
}

func FanOut[T any](ctx context.Context, fns ...func(ctx context.Context) (T, error)) <-chan Result[T] {
	ch := make(chan Result[T], len(fns))
	wg := sync.WaitGroup{}

	wg.Add(len(fns))
	for _, fn := range fns {
		go func() {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					slog.ErrorContext(ctx, "FanOut worker panicked",
						"panic", r,
					)
				}
			}()

			result, err := fn(ctx)
			select {
			case ch <- Result[T]{Value: result, Error: err}:
			case <-ctx.Done():

			}
		}()
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	return ch
}
