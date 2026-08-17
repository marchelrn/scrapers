import requests
import os

def scrape(config_params):
    """
    Scrape by calling a JSON API.
    Expected config_params:
    - url: The API URL to call
    - method: (Optional) GET, POST. Default is GET.
    - json_path: (Optional) A simple key to extract from the root JSON response (e.g. "data"). 
                 If empty, returns the whole JSON.
    """
    url = config_params.get("url")
    method = config_params.get("method", "GET").upper()
    json_path = config_params.get("json_path", "")
    headers = config_params.get("headers", {})
    
    auth_type = config_params.get("auth_type", "none")
    secret_value = config_params.get("_resolved_secret_value", "")
    if isinstance(secret_value, str):
        secret_value = secret_value.strip()
    
    if auth_type == "api_key" and secret_value:
        # Simplistic approach: if no custom header name is provided for api_key, we use 'x-api-key'
        # Can be enhanced by storing both key_name and key_value in secret_value JSON
        headers["x-api-key"] = secret_value
    elif auth_type == "bearer_token" and secret_value:
        headers["Authorization"] = f"Bearer {secret_value}"
    
    if not url:
        raise ValueError("Missing 'url' in config parameters")
        
    # Build proxies dictionary from environment variables (like HTTP_PROXY/HTTPS_PROXY)
    proxies = {}
    http_proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    
    if http_proxy:
        proxies["http"] = http_proxy
    if https_proxy:
        proxies["https"] = https_proxy

    # Merge standard User-Agent header to avoid basic 403 Forbidden responses
    if "User-Agent" not in headers and "user-agent" not in headers:
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    if "Accept" not in headers and "accept" not in headers:
        headers["Accept"] = "application/json, text/plain, */*"

    # Only pass proxies arg if we have proxies configured
    req_kwargs = {"headers": headers, "timeout": 10}
    if proxies:
        req_kwargs["proxies"] = proxies

    response = requests.request(method, url, **req_kwargs)
    response.raise_for_status()

    data = response.json()
    
    if json_path:
        # Simplistic approach: just get the root key
        # In a real app, you might use JSONPath library (e.g. `jsonpath-ng`)
        if isinstance(data, dict) and json_path in data:
            data = data[json_path]
            
    # Wrap in list so it matches the expected results format
    if isinstance(data, list):
        return data
    else:
        return [data]

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://jsonplaceholder.typicode.com/todos/1"}))
