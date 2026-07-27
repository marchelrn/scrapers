import sys
import json
import importlib

# Map backend file definitions to our module names
SCRAPER_MODULES = {
    "css_scraper.py": "css_scraper",
    "xpath_scraper.py": "xpath_scraper",
    "regex_scraper.py": "regex_scraper",
    "api_scraper.py": "api_scraper",
    "headless_scraper.py": "headless_scraper",
}

def execute_job(python_file, config_params):
    module_name = SCRAPER_MODULES.get(python_file)
    if not module_name:
        raise ValueError(f"Unknown scraper type: {python_file}")

    try:
        # Dynamically load the scraper module
        scraper_module = importlib.import_module(module_name)
        
        # Call the scrape function
        results = scraper_module.scrape(config_params)
        
        # Output results as JSON so the Go backend or calling script can parse it
        print(json.dumps({
            "status": "success",
            "results": results
        }))
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
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
        print(json.dumps({"status": "error", "message": "Invalid JSON params"}))
        sys.exit(1)
        
    execute_job(p_file, params)
