package dto

import (
	"testing"

	"github.com/KanoCifer/kuroome-blog/internal/model"
)

func TestFromUser(t *testing.T) {
	u := &model.User{Username: "alice"}
	u.ID = 1
	got := FromUser(u, true)
	if got.ID != 1 {
		t.Errorf("ID = %d, want 1", got.ID)
	}
	if got.Username != "alice" {
		t.Errorf("Username = %q, want %q", got.Username, "alice")
	}
	if !got.IsAdmin {
		t.Error("IsAdmin = false, want true")
	}
}

func TestFromUser_ZeroValues(t *testing.T) {
	got := FromUser(&model.User{}, false)
	if got.ID != 0 || got.Username != "" || got.IsAdmin {
		t.Errorf("zero-value FromUser = %+v, want {0 \"\" false}", got)
	}
}
