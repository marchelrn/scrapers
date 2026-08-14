import sys
import json
import importlib
import datetime
from url_validator import validate_url

# Map backend file definitions to our module names
SCRAPER_MODULES = {
    "css_scraper.py": "css_scraper",
    "xpath_scraper.py": "xpath_scraper",
    "regex_scraper.py": "regex_scraper",
    "api_scraper.py": "api_scraper",
    "headless_scraper.py": "headless_scraper",
    "keyword_scraper.py": "keyword_scraper",
    "google_search_scraper.py": "google_search_scraper",
    "google_news_scraper.py": "google_news_scraper",
}

def execute_job(python_file, config_params):
    module_name = SCRAPER_MODULES.get(python_file)
    if not module_name:
        raise ValueError(f"Unknown scraper type: {python_file}")

    target_url = config_params.get("url", "")
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    # Replace +00:00 with Z if present for stricter ISO-8601 formatting
    now_iso = now_iso.replace("+00:00", "Z")

    try:
        # Validate URL before any network request
        if target_url:
            validate_url(target_url)

        # Dynamically load the scraper module
        scraper_module = importlib.import_module(module_name)
        
        # Call the scrape function
        results = scraper_module.scrape(config_params)
        
        method_code = "google_search" if python_file in ["google_search_scraper.py", "google_news_scraper.py"] else "target_url"
        
        # Output results as JSON matching the contract
        print(json.dumps({
            "status": "success",
            "method": method_code,
            "results": results,
            "metadata": {
                "source": target_url if target_url else "google_search",
                "fetched_at": now_iso,
                "item_count": len(results) if isinstance(results, list) else 1
            },
            "error": None
        }))
    except Exception as e:
        # Avoid leaking secrets in error messages
        error_msg = str(e)
        if "_resolved_secret_value" in config_params and config_params["_resolved_secret_value"]:
            error_msg = error_msg.replace(config_params["_resolved_secret_value"], "***REDACTED***")
            
        method_code = "google_search" if python_file in ["google_search_scraper.py", "google_news_scraper.py"] else "target_url"
        print(json.dumps({
            "status": "failed",
            "method": method_code,
            "results": [],
            "metadata": {
                "source": target_url if target_url else "google_search",
                "fetched_at": now_iso,
                "item_count": 0
            },
            "error": {
                "code": "EXECUTION_ERROR",
                "message": error_msg
            }
        }))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python worker.py <python_file> '<json_config_params>'")
        sys.exit(1)
        
    p_file = sys.argv[1]
    params_str = sys.argv[2]
    
    try:
        params = json.loads(params_str)
    except json.JSONDecodeError:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        print(json.dumps({
            "status": "failed",
            "method": "target_url",
            "results": [],
            "metadata": {
                "source": "",
                "fetched_at": now_iso,
                "item_count": 0
            },
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid JSON params"
            }
        }))
        sys.exit(1)
        
    execute_job(p_file, params)
