import os
import json
import urllib.request
import urllib.error
import re

# Load .env
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'").strip('"')

api_key = os.environ.get("GEMINI_API_KEY")
model = "gemini-2.5-flash"
url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

prompt = (
    "Search the web for 2 active job openings for a Python backend engineer "
    "at YC startups or tech startups. Respond with a JSON object containing "
    "a list of jobs, each with keys: title, company, url, and description.\n\n"
    "Ensure your entire response is ONLY valid JSON, wrapped in a markdown code block like this:\n"
    "```json\n"
    "{\n"
    "  \"jobs\": [...]\n"
    "}\n"
    "```"
)

payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "tools": [{"google_search": {}}]
}

req_data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})

print("[+] Querying Gemini with Google Search tool (standard text mode)...")
try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode("utf-8"))
        text = res['candidates'][0]['content']['parts'][0]['text']
        print("\n=== RAW RESPONSE ===")
        print(text)
        
        # Extract JSON from code block
        match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            json_text = match.group(1)
            parsed_json = json.loads(json_text)
            print("\n=== PARSED JSON ===")
            print(json.dumps(parsed_json, indent=2))
        else:
            print("\n[!] Could not find JSON block in response.")
            
        metadata = res['candidates'][0].get('groundingMetadata')
        if metadata:
            print("\n=== GROUNDING METADATA SOURCES ===")
            for chunk in metadata.get('groundingChunks', []):
                web = chunk.get('web')
                if web:
                    print(f"- {web.get('title')}: {web.get('uri')}")
except Exception as e:
    print(f"[ERROR] Request failed: {e}")
    if hasattr(e, 'read'):
        print(f"Error body: {e.read().decode('utf-8')}")
