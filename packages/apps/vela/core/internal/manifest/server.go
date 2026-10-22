// Package manifest serves Vela's versioned device and service contract.
package manifest

import (
	"encoding/json"
	"net/http"
	"strconv"
)

const (
	Version      = 2
	ControlPort  = 47844
	OpenCodePort = 47845
	DSHPort      = 47846
)

// Service protocols published in the manifest.
const (
	ProtocolHTTP = "http"
	ProtocolTCP  = "tcp"
)

// Service is safe for remote clients and intentionally excludes local targets.
type Service struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Protocol  string `json:"protocol"`
	Preset    string `json:"preset,omitempty"`
	Port      int    `json:"port"`
	Path      string `json:"path,omitempty"`
	Available bool   `json:"available"`
	Adapter   string `json:"adapter,omitempty"`
}

// Document is Vela's platform-neutral host contract.
type Document struct {
	Version  int       `json:"version"`
	Device   string    `json:"device"`
	Services []Service `json:"services"`
}

// Provider supplies a current manifest snapshot.
type Provider struct {
	DeviceName func() string
	Services   func() []Service
}

// Handler returns the v1 manifest and health endpoints.
func (provider Provider) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /vela/v1/manifest", func(writer http.ResponseWriter, request *http.Request) {
		if requested := request.Header.Get("Vela-Protocol-Version"); requested != "" && requested != strconv.Itoa(Version) {
			writeJSON(writer, http.StatusUpgradeRequired, map[string]any{"error": "unsupported_version", "supported": Version})
			return
		}
		writeJSON(writer, http.StatusOK, provider.document())
	})
	mux.HandleFunc("GET /vela/v1/health", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]any{"status": "ok", "version": Version})
	})
	return mux
}

func (provider Provider) document() Document {
	return Document{Version: Version, Device: provider.DeviceName(), Services: append([]Service(nil), provider.Services()...)}
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}
