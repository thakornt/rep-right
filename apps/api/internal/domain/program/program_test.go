package program

import (
	"os"
	"regexp"
	"slices"
	"testing"
)

// The web app owns the program content; this keeps the API's list of ids in
// step with it.
func TestIDsMatchWebPrograms(t *testing.T) {
	src, err := os.ReadFile("../../../../web/src/content/programs.ts")
	if err != nil {
		t.Fatal(err)
	}
	var web []string
	for _, m := range regexp.MustCompile(`(?m)^    id: "([a-z0-9-]+)",$`).FindAllSubmatch(src, -1) {
		web = append(web, string(m[1]))
	}
	if len(web) == 0 {
		t.Fatal("found no program ids in programs.ts; has its layout changed?")
	}
	if !slices.Equal(web, IDs) {
		t.Errorf("program ids differ:\n web: %v\n api: %v", web, IDs)
	}
}

func TestValid(t *testing.T) {
	if !Valid("ppl-2") {
		t.Error("ppl-2 should be valid")
	}
	for _, bad := range []string{"", "PPL-2", "ppl-3", "ppl-2 "} {
		if Valid(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}
