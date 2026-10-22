package manifest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func provider() Provider {
	return Provider{
		DeviceName: func() string { return "Home Mac" },
		Services: func() []Service {
			return []Service{{ID: "docs", Name: "Docs", Protocol: ProtocolTCP, Port: 47847, Available: true}}
		},
	}
}

func TestManifestPublishesOnlyEnabledServiceWithoutTarget(t *testing.T) {
	t.Parallel()
	request := httptest.NewRequest(http.MethodGet, "/vela/v1/manifest", nil)
	response := httptest.NewRecorder()
	provider().Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d", response.Code)
	}
	var document Document
	if err := json.Unmarshal(response.Body.Bytes(), &document); err != nil {
		t.Fatal(err)
	}
	if document.Version != 2 || len(document.Services) != 1 || document.Services[0].ID != "docs" || document.Services[0].Port != 47847 || document.Services[0].Protocol != "tcp" {
		t.Fatalf("document=%#v", document)
	}
	if strings.Contains(response.Body.String(), "127.0.0.1") || strings.Contains(response.Body.String(), "49374") {
		t.Fatalf("manifest leaked local target: %s", response.Body.String())
	}
}

func TestManifestRejectsIncompatibleVersion(t *testing.T) {
	t.Parallel()
	request := httptest.NewRequest(http.MethodGet, "/vela/v1/manifest", nil)
	request.Header.Set("Vela-Protocol-Version", "1")
	response := httptest.NewRecorder()
	provider().Handler().ServeHTTP(response, request)
	if response.Code != http.StatusUpgradeRequired || !strings.Contains(response.Body.String(), "unsupported_version") {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestHealthContract(t *testing.T) {
	t.Parallel()
	request := httptest.NewRequest(http.MethodGet, "/vela/v1/health", nil)
	response := httptest.NewRecorder()
	provider().Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"version":2`) {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
}
