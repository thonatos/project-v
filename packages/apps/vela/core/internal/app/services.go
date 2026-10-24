package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"implements.io/vela/internal/adapters"
	velaconfig "implements.io/vela/internal/config"
	"implements.io/vela/internal/dshauth"
	"implements.io/vela/internal/services"
)

// setSharing persists the sharing choices and applies them immediately, so a
// switch in the UI changes the tailnet manifest without waiting for a poll.
func (app *App) setSharing(raw json.RawMessage) (any, error) {
	var selection velaconfig.Sharing
	if err := json.Unmarshal(raw, &selection); err != nil {
		return nil, err
	}
	if err := app.store.Update(func(config *velaconfig.Config) error { config.Sharing = selection; return nil }); err != nil {
		return nil, err
	}
	if _, _, err := app.reconcile(context.Background()); err != nil {
		app.logger.Printf("apply saved sharing selection: %v", err)
	}
	return selection, nil
}

// serviceRemove deletes one local service and republishes the rest.
func (app *App) serviceRemove(id string) (any, error) {
	if err := app.store.Update(func(config *velaconfig.Config) error {
		config.Services = slices.DeleteFunc(config.Services, func(service velaconfig.LocalService) bool { return service.ID == id })
		return nil
	}); err != nil {
		return nil, err
	}
	items, _, _ := app.reconcile(context.Background())
	return items, nil
}

// serviceUpsert validates and stores one local service, then republishes.
func (app *App) serviceUpsert(raw json.RawMessage) (any, error) {
	var payload struct {
		ID, Name, URL, Adapter, Protocol, Preset string
		Shared                                   bool
		// AuthLog is optional so callers that only toggle sharing keep it.
		AuthLog *string
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	payload.Name, payload.URL, payload.Adapter = strings.TrimSpace(payload.Name), strings.TrimSpace(payload.URL), strings.TrimSpace(payload.Adapter)
	payload.Preset = strings.ToLower(strings.TrimSpace(payload.Preset))
	payload.Protocol = strings.ToLower(strings.TrimSpace(payload.Protocol))
	if payload.Protocol == "" {
		payload.Protocol = velaconfig.ProtocolHTTP
	}
	if payload.Name == "" {
		return nil, errors.New("service name is required")
	}
	if err := services.ValidateTarget(payload.Protocol, payload.URL); err != nil {
		return nil, err
	}
	target, err := services.TargetKey(payload.Protocol, payload.URL)
	if err != nil {
		return nil, err
	}
	if payload.Adapter != "" && payload.Adapter != string(adapters.OpenCode) && payload.Adapter != string(adapters.DSH) {
		return nil, errors.New("unsupported service adapter")
	}
	if payload.Protocol == velaconfig.ProtocolTCP && payload.Adapter != "" {
		return nil, errors.New("TCP services cannot use an adapter")
	}
	validPresets := map[string]bool{"": true, "opencode": true, "dsh": true, "comfyui": true, "ssh": true, "redis": true, "mysql": true, "postgres": true}
	if !validPresets[payload.Preset] {
		return nil, errors.New("unsupported service preset")
	}
	webPreset := payload.Preset == "opencode" || payload.Preset == "dsh" || payload.Preset == "comfyui"
	tcpPreset := payload.Preset == "ssh" || payload.Preset == "redis" || payload.Preset == "mysql" || payload.Preset == "postgres"
	if (webPreset && payload.Protocol != velaconfig.ProtocolHTTP) || (tcpPreset && payload.Protocol != velaconfig.ProtocolTCP) {
		return nil, errors.New("service preset does not match protocol")
	}
	authLog := ""
	if payload.AuthLog != nil && strings.TrimSpace(*payload.AuthLog) != "" {
		if payload.Adapter != string(adapters.DSH) {
			return nil, errors.New("only DSH services can read a sign-in log")
		}
		expanded, err := dshauth.ExpandPath(*payload.AuthLog, app.home)
		if err != nil {
			return nil, err
		}
		authLog = expanded
	}
	if err := app.store.Update(func(config *velaconfig.Config) error {
		index := slices.IndexFunc(config.Services, func(service velaconfig.LocalService) bool { return service.ID == payload.ID })
		if index >= 0 {
			config.Services[index].Name, config.Services[index].URL, config.Services[index].Shared = payload.Name, payload.URL, payload.Shared
			config.Services[index].Adapter, config.Services[index].Protocol, config.Services[index].Preset = payload.Adapter, payload.Protocol, payload.Preset
			if payload.AuthLog != nil {
				config.Services[index].AuthLog = authLog
			}
			if config.Services[index].Adapter != string(adapters.DSH) {
				config.Services[index].AuthLog = ""
			}
			return nil
		}
		id, port := velaconfig.NextServiceID(*config, payload.Name), velaconfig.NextServicePort(*config)
		if payload.Adapter == string(adapters.OpenCode) {
			id, port = "opencode", velaconfig.OpenCodePort
		} else if payload.Adapter == string(adapters.DSH) {
			id, port = "dsh", velaconfig.DSHPort
		}
		if conflict := slices.IndexFunc(config.Services, func(service velaconfig.LocalService) bool {
			key, err := services.TargetKey(service.Protocol, service.URL)
			return err == nil && key == target
		}); conflict >= 0 {
			return fmt.Errorf("已经有服务指向 %s（%s），请直接编辑它", target, config.Services[conflict].Name)
		}
		if port == 0 {
			return errors.New("no Vela service ports available")
		}
		if slices.ContainsFunc(config.Services, func(service velaconfig.LocalService) bool { return service.ID == id || service.Port == port }) {
			return errors.New("service preset already exists")
		}
		config.Services = append(config.Services, velaconfig.LocalService{ID: id, Name: payload.Name, Protocol: payload.Protocol, Preset: payload.Preset, URL: payload.URL, Port: port, Shared: payload.Shared, Adapter: payload.Adapter, AuthLog: authLog})
		return nil
	}); err != nil {
		return nil, err
	}
	items, _, _ := app.reconcile(context.Background())
	return items, nil
}
