package methods

import (
	"bytes"
	"context"
	"encoding/json"
	"math/rand"
	"os"
	"os/exec"
	"time"

	"github.com/marchelrn/scrapers/dto"
)

const (
	// Batas ukuran output worker; melindungi backend dari halaman raksasa.
	maxOutputBytes = 5 * 1024 * 1024

	// Percobaan ulang di sini HANYA untuk kegagalan proses (worker mati sebelum
	// berhasil mencetak output contract). Kegagalan tingkat HTTP -- 403, 429,
	// halaman verifikasi WAF -- ditangani beserta backoff-nya di dalam
	// workers/python/fetcher.py.
	maxProcessAttempts = 2
)

// workerEnv menyiapkan environment untuk proses Python.
//
// os.Environ() sudah memuat HTTP_PROXY/HTTPS_PROXY bila diset pada backend, jadi
// tidak perlu disalin manual seperti pada versi sebelumnya.
func workerEnv() []string {
	return os.Environ()
}

// parseWorkerContract mencoba membaca output contract dari stdout worker.
//
// Output dibaca dengan CombinedOutput, sehingga peringatan yang bocor ke stderr
// bisa mendahului JSON. Karena itu percobaan kedua dilakukan pada baris terakhir
// yang tidak kosong -- worker selalu mencetak contract sebagai baris terakhir.
func parseWorkerContract(output []byte) (*dto.WorkerResult, bool) {
	trimmed := bytes.TrimSpace(output)
	if len(trimmed) == 0 {
		return nil, false
	}

	var result dto.WorkerResult
	if err := json.Unmarshal(trimmed, &result); err == nil && result.Status != "" {
		return &result, true
	}

	lines := bytes.Split(trimmed, []byte("\n"))
	for i := len(lines) - 1; i >= 0; i-- {
		line := bytes.TrimSpace(lines[i])
		if len(line) == 0 || line[0] != '{' {
			continue
		}
		var candidate dto.WorkerResult
		if err := json.Unmarshal(line, &candidate); err == nil && candidate.Status != "" {
			return &candidate, true
		}
	}
	return nil, false
}

// processRetryBackoff memberi jeda dengan jitter agar percobaan ulang tidak
// serempak ketika banyak job gagal bersamaan.
func processRetryBackoff(attempt int) time.Duration {
	base := time.Duration(attempt+1) * time.Second
	jitter := time.Duration(rand.Int63n(int64(500 * time.Millisecond)))
	return base + jitter
}

func failedResult(methodCode, source, code, message string) *dto.WorkerResult {
	return &dto.WorkerResult{
		Status:  "failed",
		Method:  methodCode,
		Results: []interface{}{},
		Metadata: dto.WorkerMetadata{
			Source:    source,
			FetchedAt: time.Now().UTC().Format(time.RFC3339),
			ItemCount: 0,
		},
		Error: &dto.WorkerError{Code: code, Message: message},
	}
}

// runWorker menjalankan satu job pada worker Python dan mengembalikan output
// contract-nya. Dipakai oleh kedua metode (target_url dan google_news) agar
// perilaku eksekusi, batas ukuran, dan penanganan timeout tidak pernah berbeda.
func runWorker(ctx context.Context, methodCode, pythonFile, paramsJSON, source string) (*dto.WorkerResult, error) {
	var output []byte
	var lastErr error
	var contract *dto.WorkerResult

	for attempt := 0; attempt < maxProcessAttempts; attempt++ {
		cmd := exec.CommandContext(ctx, GetPythonExecutable(), GetWorkerScriptPath(), pythonFile, paramsJSON)
		cmd.Env = workerEnv()

		output, lastErr = cmd.CombinedOutput()

		if ctx.Err() != nil {
			break
		}

		// Worker sudah melapor lewat output contract -- termasuk ketika statusnya
		// "failed". Laporannya dihormati apa adanya: mengulangi permintaan ke
		// situs yang baru saja menolak kita hanya memperkuat pemblokiran.
		if parsed, ok := parseWorkerContract(output); ok {
			contract = parsed
			break
		}

		if lastErr == nil {
			break
		}

		if attempt < maxProcessAttempts-1 {
			time.Sleep(processRetryBackoff(attempt))
		}
	}

	if ctx.Err() != nil {
		return failedResult(methodCode, source, "TIMEOUT",
			"Worker process execution timed out or was terminated: "+ctx.Err().Error()), nil
	}

	if len(output) > maxOutputBytes {
		return failedResult(methodCode, source, "OUTPUT_LIMIT_EXCEEDED",
			"Worker output exceeded 5MB limit"), nil
	}

	if contract == nil {
		if parsed, ok := parseWorkerContract(output); ok {
			contract = parsed
		}
	}

	if contract == nil {
		msg := "Invalid worker output contract"
		if lastErr != nil {
			msg += " | Error: " + lastErr.Error()
		}
		return failedResult(methodCode, source, "EXECUTION_ERROR",
			msg+"\nOutput: "+string(output)), nil
	}

	return contract, nil
}
