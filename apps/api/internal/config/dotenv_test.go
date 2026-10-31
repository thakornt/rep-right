package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvFindsRepoRootFile(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}
	// An empty value followed by "# comment" would read the comment as the
	// value (godotenv), which is why .env.example keeps comments on their own lines.
	env := "REPRIGHT_TEST_A=from-file   # inline comment\nREPRIGHT_TEST_B=from-file\n# note\nREPRIGHT_TEST_EMPTY=\n"
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}
	sub := filepath.Join(root, "apps", "api")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatal(err)
	}

	t.Setenv("REPRIGHT_TEST_B", "from-env") // the real environment wins
	t.Setenv("REPRIGHT_TEST_A", "")
	_ = os.Unsetenv("REPRIGHT_TEST_A")
	t.Setenv("REPRIGHT_TEST_EMPTY", "")
	_ = os.Unsetenv("REPRIGHT_TEST_EMPTY")

	got, err := LoadDotEnv(sub)
	if err != nil || got != filepath.Join(root, ".env") {
		t.Fatalf("LoadDotEnv = %q, %v", got, err)
	}
	if v := os.Getenv("REPRIGHT_TEST_A"); v != "from-file" {
		t.Errorf("A = %q, want from-file (inline comment stripped)", v)
	}
	if v := os.Getenv("REPRIGHT_TEST_B"); v != "from-env" {
		t.Errorf("B = %q, existing env must not be overridden", v)
	}
	if v := os.Getenv("REPRIGHT_TEST_EMPTY"); v != "" {
		t.Errorf("EMPTY = %q, want empty", v)
	}
}

func TestLoadDotEnvStopsAtRepoRoot(t *testing.T) {
	outer := t.TempDir()
	if err := os.WriteFile(filepath.Join(outer, ".env"), []byte("REPRIGHT_TEST_OUTSIDE=1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	repo := filepath.Join(outer, "repo")
	if err := os.MkdirAll(filepath.Join(repo, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}
	if got, err := LoadDotEnv(repo); err != nil || got != "" {
		t.Fatalf("must not read a .env outside the repo: %q, %v", got, err)
	}
}
