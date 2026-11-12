// Package program lists the weekly programs a user can pick. The programs
// themselves (days, muscle groups) are static content in the web app; the
// API only stores which one a user chose, so it only needs the ids.
package program

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

// Valid reports whether id is a known program.
func Valid(id string) bool {
	for _, k := range IDs {
		if k == id {
			return true
		}
	}
	return false
}
