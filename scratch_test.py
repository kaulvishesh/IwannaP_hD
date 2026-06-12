import os
import urllib.request
import urllib.error
import json

if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'").strip('"')

api_key = os.environ.get("GEMINI_API_KEY")
print(f"Loaded API key: {api_key[:6]}...{api_key[-6:] if len(api_key) > 6 else ''}")

# Testing new models
tests = [
    ("v1beta", "gemini-2.5-flash"),
    ("v1beta", "gemini-3.5-flash"),
    ("v1beta", "gemini-2.0-flash"),
]

for version, model in tests:
    url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent?key={api_key}"
    print(f"\nTesting {version} with model {model}...")
    
    data = {
        "contents": [{"parts": [{"text": "Hello, respond with exactly 'Success'"}]}]
    }
    req_data = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode("utf-8"))
            text = res['candidates'][0]['content']['parts'][0]['text']
            print(f"-> SUCCESS: {text.strip()}")
    except urllib.error.HTTPError as e:
        print(f"-> FAILED with HTTP Status {e.code}")
        try:
            error_body = e.read().decode("utf-8")
            print(f"   Error Body: {error_body}")
        except Exception:
            pass
    except Exception as e:
        print(f"-> FAILED with error: {e}")
