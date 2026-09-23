//go:build allowlistgolden

// Writes what the mailer's allow-list (sanitizeEmailHTML, internal/mailer/sanitize.go)
// makes of each input in $GOLDEN_IN, as {input, output} pairs to $GOLDEN_OUT.
// skymail-frontend keeps the result as src/lib/mail-render/testdata/server-allowlist.json:
// its JS reimplementation of the allow-list has to give the same output for every input.
//
// Run from a skymail-backend checkout:
//
//	cp <this file> internal/mailer/golden_test.go
//	GOLDEN_IN=inputs.json GOLDEN_OUT=out.json go test -tags allowlistgolden -run TestServerAllowlistGolden ./internal/mailer
package mailer

import (
	"encoding/json"
	"os"
	"testing"
)

func TestServerAllowlistGolden(t *testing.T) {
	raw, err := os.ReadFile(os.Getenv("GOLDEN_IN"))
	if err != nil {
		t.Fatal(err)
	}
	var inputs []string
	if err := json.Unmarshal(raw, &inputs); err != nil {
		t.Fatal(err)
	}
	type pair struct {
		Input  string `json:"input"`
		Output string `json:"output"`
	}
	pairs := make([]pair, len(inputs))
	for i, input := range inputs {
		pairs[i] = pair{Input: input, Output: sanitizeEmailHTML(input)}
	}
	out, err := json.MarshalIndent(pairs, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(os.Getenv("GOLDEN_OUT"), out, 0o644); err != nil {
		t.Fatal(err)
	}
}
