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

func TestCustomDayKindsMatchWeb(t *testing.T) {
	src, err := os.ReadFile("../../../../web/src/content/custom-program.ts")
	if err != nil {
		t.Fatal(err)
	}
	block := regexp.MustCompile(`(?s)export const DAY_KINDS = \[(.*?)\] as const;`).FindSubmatch(src)
	if block == nil {
		t.Fatal("found no DAY_KINDS in custom-program.ts; has its layout changed?")
	}
	var web []string
	for _, m := range regexp.MustCompile(`"([a-z_]+)"`).FindAllSubmatch(block[1], -1) {
		web = append(web, string(m[1]))
	}
	if !slices.Equal(web, CustomDayKinds) {
		t.Errorf("custom day kinds differ:\n web: %v\n api: %v", web, CustomDayKinds)
	}
}

func TestValid(t *testing.T) {
	for _, good := range []string{
		"ppl-2",
		"custom:push.pull.legs.rest.upper.lower.rest",
		"custom:full_body.rest.full_body.rest.full_body.rest.rest",
		"custom:core.rest.rest.rest.rest.rest.rest",
	} {
		if !Valid(good) {
			t.Errorf("%q should be valid", good)
		}
	}
	for _, bad := range []string{
		"", "PPL-2", "ppl-3", "ppl-2 ",
		"custom:",
		"custom:rest.rest.rest.rest.rest.rest.rest",        // no training day
		"custom:push.pull.legs.rest.upper.lower",           // 6 days
		"custom:push.pull.legs.rest.upper.lower.rest.rest", // 8 days
		"custom:push.pull.legs.rest.upper.lower.yoga",      // unknown kind
		"Custom:push.pull.legs.rest.upper.lower.rest",
	} {
		if Valid(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}
