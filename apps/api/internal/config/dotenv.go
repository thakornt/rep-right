package config

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// LoadDotEnv loads the nearest .env file, searching from dir up to the repo
// root (the first directory containing .git). It is for local development:
// variables already set in the environment win, and a missing file is fine,
// so hosts like Render that set real env vars are unaffected. It returns the
// path it loaded, or "".
func LoadDotEnv(dir string) (string, error) {
	for {
		p := filepath.Join(dir, ".env")
		if _, err := os.Stat(p); err == nil {
			return p, godotenv.Load(p)
		} else if !errors.Is(err, fs.ErrNotExist) {
			return "", err
		}
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return "", nil // reached the repo root
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", nil
		}
		dir = parent
	}
}
