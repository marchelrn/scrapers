from ddgs import DDGS
import json
results = DDGS().text("python", max_results=1)
print(json.dumps(list(results)))
