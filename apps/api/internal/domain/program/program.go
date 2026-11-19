// Package program lists the weekly programs a user can pick. The programs
// themselves (days, muscle groups) are static content in the web app; the
// API only stores which one a user chose, so it only needs the ids.
package program

import "strings"

// IDs must match the ids of PROGRAMS in apps/web/src/content/programs.ts
// (program_test.go checks this).
var IDs = []string{
	"full-body-2",
	"full-body-3",
	"upper-lower",
	"ppl-upper-lower",
	"bro-split",
	"ppl-2",
}

// CustomPrefix starts the id of a week the user planned themself on
// /programs/custom: "custom:" + 7 day kinds, Monday first, joined by "."
// (apps/web/src/content/custom-program.ts builds and reads these).
const CustomPrefix = "custom:"

// CustomDayKinds must match DAY_KINDS in apps/web/src/content/custom-program.ts
// (program_test.go checks this).
var CustomDayKinds = []string{
	"full_body", "upper", "lower", "push", "pull", "legs",
	"chest", "back", "shoulders", "arms", "core", "rest",
}

// Valid reports whether id is a known program or a well-formed custom week.
func Valid(id string) bool {
	for _, k := range IDs {
		if k == id {
			return true
		}
	}
	return validCustom(id)
}

func validCustom(id string) bool {
	rest, ok := strings.CutPrefix(id, CustomPrefix)
	if !ok {
		return false
	}
	days := strings.Split(rest, ".")
	if len(days) != 7 {
		return false
	}
	training := 0
	for _, d := range days {
		if !isDayKind(d) {
			return false
		}
		if d != "rest" {
			training++
		}
	}
	return training > 0 // a week of only rest is not a program
}

func isDayKind(k string) bool {
	for _, d := range CustomDayKinds {
		if d == k {
			return true
		}
	}
	return false
}
