package dto

type WorkerError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type WorkerMetadata struct {
	Source    string `json:"source"`
	FetchedAt string `json:"fetched_at"`
	ItemCount int    `json:"item_count"`
}

type WorkerResult struct {
	Status   string         `json:"status"`
	Method   string         `json:"method"`
	Results  []interface{}  `json:"results"`
	Metadata WorkerMetadata `json:"metadata"`
	Error    *WorkerError   `json:"error"`
}
