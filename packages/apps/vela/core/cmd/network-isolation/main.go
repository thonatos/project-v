// Command network-isolation verifies that starting Vela's embedded node does
// not modify macOS proxy, DNS or default-route configuration.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	velanetwork "github.com/thonatos/vela/core/internal/network"
)

type snapshot struct {
	Proxy string `json:"proxy"`
	DNS   string `json:"dns"`
	Route string `json:"route"`
}

func command(name string, args ...string) string {
	output, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return fmt.Sprintf("error:%v:%s", err, output)
	}
	return string(output)
}

func capture() snapshot {
	return snapshot{
		Proxy: command("scutil", "--proxy"),
		DNS:   command("scutil", "--dns"),
		Route: command("route", "-n", "get", "default"),
	}
}

func main() {
	if runtime.GOOS != "darwin" {
		fmt.Println("network snapshot is only applicable to macOS")
		return
	}
	before := capture()
	root := os.Getenv("VELA_TEST_TMP")
	if root == "" {
		fmt.Fprintln(os.Stderr, "VELA_TEST_TMP must name a project-local temporary directory")
		os.Exit(2)
	}
	directory, err := os.MkdirTemp(root, "snapshot-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(directory)
	node := velanetwork.NewEmbedded(filepath.Join(directory, "network"), "vela-snapshot")
	if err := node.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "tsnet start returned %v; checking system network snapshot anyway\n", err)
	}
	after := capture()
	_ = node.Close()
	if before != after {
		encoded, _ := json.MarshalIndent(map[string]snapshot{"before": before, "after": after}, "", "  ")
		fmt.Fprintln(os.Stderr, string(encoded))
		os.Exit(1)
	}
	fmt.Println("Vela embedded node startup left proxy, DNS and default route unchanged")
}
