package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// maxProviderBody caps what we read back from Google or LINE.
const maxProviderBody = 1 << 20

var providerHTTP = &http.Client{Timeout: 10 * time.Second}

// postForm sends an application/x-www-form-urlencoded POST and decodes a 2xx
// JSON reply into out. Non-2xx replies become errors with the provider's
// "error" / "error_description" (never the request, which holds secrets).
func postForm(ctx context.Context, client *http.Client, endpoint string, form url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("post %s: %w", endpoint, err)
	}
	defer func() { _ = res.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(res.Body, maxProviderBody))
	if err != nil {
		return fmt.Errorf("read %s: %w", endpoint, err)
	}
	if res.StatusCode/100 != 2 {
		var e struct {
			Error       string `json:"error"`
			Description string `json:"error_description"`
		}
		_ = json.Unmarshal(body, &e)
		return fmt.Errorf("%s: status %d: %s %s", endpoint, res.StatusCode, e.Error, e.Description)
	}
	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("decode %s: %w", endpoint, err)
	}
	return nil
}

const googleTokenURL = "https://oauth2.googleapis.com/token" //nolint:gosec // G101: a URL, not a credential

// googleCodeExchanger redeems codes from the GIS code client in popup mode,
// for which Google requires redirect_uri=postmessage.
type googleCodeExchanger struct {
	clientID, secret, tokenURL string
	http                       *http.Client
}

func NewGoogleCodeExchanger(clientID, secret string) GoogleCodeExchanger {
	return googleCodeExchanger{clientID: clientID, secret: secret, tokenURL: googleTokenURL, http: providerHTTP}
}

func (g googleCodeExchanger) ExchangeCode(ctx context.Context, code string) (string, error) {
	var tok struct {
		IDToken string `json:"id_token"`
	}
	err := postForm(ctx, g.http, g.tokenURL, url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"client_id":     {g.clientID},
		"client_secret": {g.secret},
		"redirect_uri":  {"postmessage"},
	}, &tok)
	if err != nil {
		return "", err
	}
	if tok.IDToken == "" {
		return "", fmt.Errorf("google token response has no id_token (is the openid scope requested?)")
	}
	return tok.IDToken, nil
}

const lineIssuer = "https://access.line.me"

// lineClient implements LINE Login v2.1 for a web app. The ID token is checked
// by LINE's verify endpoint, which validates signature, expiry, audience and
// nonce; we check issuer, audience and nonce again on the result.
type lineClient struct {
	channelID, secret string
	authURL, apiURL   string
	http              *http.Client
}

func NewLineClient(channelID, secret string) LineClient {
	return lineClient{
		channelID: channelID, secret: secret,
		authURL: "https://access.line.me/oauth2/v2.1/authorize",
		apiURL:  "https://api.line.me",
		http:    providerHTTP,
	}
}

func (l lineClient) AuthURL(redirectURI, state, nonce string) string {
	q := url.Values{
		"response_type": {"code"},
		"client_id":     {l.channelID},
		"redirect_uri":  {redirectURI},
		"state":         {state},
		"nonce":         {nonce},
		// email is only returned once the channel has email permission.
		"scope": {"openid profile email"},
	}
	return l.authURL + "?" + q.Encode()
}

func (l lineClient) Login(ctx context.Context, code, redirectURI, nonce string) (Identity, error) {
	var tok struct {
		IDToken string `json:"id_token"`
	}
	err := postForm(ctx, l.http, l.apiURL+"/oauth2/v2.1/token", url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {l.channelID},
		"client_secret": {l.secret},
	}, &tok)
	if err != nil {
		return Identity{}, err
	}
	if tok.IDToken == "" {
		return Identity{}, fmt.Errorf("line token response has no id_token")
	}
	var claims struct {
		Iss     string `json:"iss"`
		Sub     string `json:"sub"`
		Aud     string `json:"aud"`
		Nonce   string `json:"nonce"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
		Email   string `json:"email"`
	}
	err = postForm(ctx, l.http, l.apiURL+"/oauth2/v2.1/verify", url.Values{
		"id_token":  {tok.IDToken},
		"client_id": {l.channelID},
		"nonce":     {nonce},
	}, &claims)
	if err != nil {
		return Identity{}, err
	}
	switch {
	case claims.Iss != lineIssuer:
		return Identity{}, fmt.Errorf("line id token: unexpected issuer %q", claims.Iss)
	case claims.Aud != l.channelID:
		return Identity{}, fmt.Errorf("line id token: unexpected audience")
	case nonce == "" || claims.Nonce != nonce:
		return Identity{}, fmt.Errorf("line id token: nonce mismatch")
	case claims.Sub == "":
		return Identity{}, fmt.Errorf("line id token: missing subject")
	}
	return Identity{Provider: ProviderLine, Subject: claims.Sub, Email: claims.Email, Name: claims.Name, Picture: claims.Picture}, nil
}
