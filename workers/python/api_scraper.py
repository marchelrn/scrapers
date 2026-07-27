import requests

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
    
    if not url:
        raise ValueError("Missing 'url' in config parameters")

    response = requests.request(method, url, headers=headers, timeout=10)
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
