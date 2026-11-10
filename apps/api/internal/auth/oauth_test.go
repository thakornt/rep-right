package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// lineServer fakes LINE's token and verify endpoints. claims is what verify
// returns; it also records the forms it received.
func lineServer(t *testing.T, claims map[string]any) (*httptest.Server, map[string]map[string]string) {
	t.Helper()
	got := map[string]map[string]string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		form := map[string]string{}
		for k := range r.PostForm {
			form[k] = r.PostForm.Get(k)
		}
		got[r.URL.Path] = form
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/oauth2/v2.1/token":
			if form["code"] != "good-code" {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":"invalid_grant","error_description":"invalid authorization code"}`))
				return
			}
			_, _ = w.Write([]byte(`{"access_token":"at","id_token":"line-id-token","token_type":"Bearer"}`))
		case "/oauth2/v2.1/verify":
			_ = json.NewEncoder(w).Encode(claims)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, got
}

func testLineClient(srv *httptest.Server) lineClient {
	return lineClient{channelID: "1650000000", secret: "line-secret", authURL: "https://access.line.me/oauth2/v2.1/authorize", apiURL: srv.URL, http: srv.Client()}
}

func goodClaims() map[string]any {
	return map[string]any{"iss": "https://access.line.me", "sub": "U1234", "aud": "1650000000", "nonce": "n1", "name": "Somchai", "email": "s@example.com"}
}

func TestLineLoginExchangesAndVerifies(t *testing.T) {
	srv, got := lineServer(t, goodClaims())
	id, err := testLineClient(srv).Login(context.Background(), "good-code", "https://app.example/auth/line/callback", "n1")
	if err != nil {
		t.Fatal(err)
	}
	if id != (Identity{Provider: ProviderLine, Subject: "U1234", Email: "s@example.com", Name: "Somchai"}) {
		t.Errorf("identity = %+v", id)
	}
	tok := got["/oauth2/v2.1/token"]
	if tok["grant_type"] != "authorization_code" || tok["client_id"] != "1650000000" || tok["client_secret"] != "line-secret" ||
		tok["redirect_uri"] != "https://app.example/auth/line/callback" {
		t.Errorf("token request = %v", tok)
	}
	ver := got["/oauth2/v2.1/verify"]
	if ver["id_token"] != "line-id-token" || ver["client_id"] != "1650000000" || ver["nonce"] != "n1" {
		t.Errorf("verify request = %v", ver)
	}
}

func TestLineLoginRejectsBadClaims(t *testing.T) {
	cases := map[string]func(map[string]any){
		"issuer":   func(c map[string]any) { c["iss"] = "https://evil.example" },
		"audience": func(c map[string]any) { c["aud"] = "999" },
		"nonce":    func(c map[string]any) { c["nonce"] = "replayed" },
		"subject":  func(c map[string]any) { c["sub"] = "" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			c := goodClaims()
			mutate(c)
			srv, _ := lineServer(t, c)
			if _, err := testLineClient(srv).Login(context.Background(), "good-code", "https://app/cb", "n1"); err == nil {
				t.Error("expected error")
			}
		})
	}
}

func TestLineLoginEmailIsOptional(t *testing.T) {
	c := goodClaims()
	delete(c, "email")
	srv, _ := lineServer(t, c)
	id, err := testLineClient(srv).Login(context.Background(), "good-code", "https://app/cb", "n1")
	if err != nil || id.Email != "" || id.Subject != "U1234" {
		t.Errorf("id = %+v, err = %v", id, err)
	}
}

func TestLineLoginBadCodeDoesNotLeakSecret(t *testing.T) {
	srv, _ := lineServer(t, goodClaims())
	_, err := testLineClient(srv).Login(context.Background(), "bad-code", "https://app/cb", "n1")
	if err == nil || !strings.Contains(err.Error(), "invalid_grant") {
		t.Fatalf("err = %v, want invalid_grant", err)
	}
	if strings.Contains(err.Error(), "line-secret") {
		t.Error("error message contains the channel secret")
	}
}

func TestLineAuthURL(t *testing.T) {
	u := lineClient{channelID: "165", authURL: "https://access.line.me/oauth2/v2.1/authorize"}.AuthURL("https://app/cb", "st", "no")
	for _, want := range []string{"response_type=code", "client_id=165", "redirect_uri=https%3A%2F%2Fapp%2Fcb", "state=st", "nonce=no", "scope=openid+profile+email"} {
		if !strings.Contains(u, want) {
			t.Errorf("auth URL %q missing %q", u, want)
		}
	}
}

func TestGoogleCodeExchange(t *testing.T) {
	var form map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		form = map[string]string{}
		for k := range r.PostForm {
			form[k] = r.PostForm.Get(k)
		}
		if form["code"] != "c1" {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"x","id_token":"google-id-token"}`))
	}))
	defer srv.Close()
	g := googleCodeExchanger{clientID: "cid", secret: "csecret", tokenURL: srv.URL, http: srv.Client()}

	tok, err := g.ExchangeCode(context.Background(), "c1")
	if err != nil || tok != "google-id-token" {
		t.Fatalf("ExchangeCode = %q, %v", tok, err)
	}
	if form["redirect_uri"] != "postmessage" || form["client_id"] != "cid" || form["client_secret"] != "csecret" || form["grant_type"] != "authorization_code" {
		t.Errorf("token request = %v", form)
	}
	if _, err := g.ExchangeCode(context.Background(), "nope"); err == nil {
		t.Error("expected error for a rejected code")
	}
}
