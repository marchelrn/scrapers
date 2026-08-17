package methods

import (
	"os"
	"os/exec"
)

// GetPythonExecutable returns the executable path or command name to run Python worker scripts.
// Resolution order:
// 1. PYTHON_PATH environment variable
// 2. PYTHON_BIN environment variable
// 3. Existing virtual environment paths
// 4. System "python3" from PATH
// 5. System "python" from PATH
// 6. Fallback default "python3"
func GetPythonExecutable() string {
	if custom := os.Getenv("PYTHON_PATH"); custom != "" {
		return custom
	}
	if custom := os.Getenv("PYTHON_BIN"); custom != "" {
		return custom
	}

	candidates := []string{
		"workers/python/venv/bin/python",
		"../workers/python/venv/bin/python",
		"../../workers/python/venv/bin/python",
		"venv/bin/python",
		"backend/workers/python/venv/bin/python",
		"../backend/workers/python/venv/bin/python",
		"/home/lerch/GolandProjects/scrapers/backend/workers/python/venv/bin/python",
		".venv/bin/python",
		"/tmp/opencode/scrapers-worker-venv/bin/python",
	}

	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			return path
		}
	}

	if path, err := exec.LookPath("python3"); err == nil {
		return path
	}
	if path, err := exec.LookPath("python"); err == nil {
		return path
	}

	return "python3"
}

// GetWorkerScriptPath resolves the relative or absolute path to worker.py.
func GetWorkerScriptPath() string {
	candidates := []string{
		"workers/python/worker.py",
		"../workers/python/worker.py",
		"../../workers/python/worker.py",
		"../../../workers/python/worker.py",
	}

	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			return path
		}
	}

	return "workers/python/worker.py"
}
