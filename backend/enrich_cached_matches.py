import os
import sys
import json
from datetime import datetime

# Add current dir to path to import supervisor_finder
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from supervisor_finder import load_env_file, query_gemini_json_with_search

def generate_university_migration_details(university: str) -> dict:
    """Scrape/search funding, fees, deadlines, and cost of living for Indian students emigrating to this university."""
    print(f"[+] Conducting migration & cost analysis for: {university}...")
    
    system_prompt = (
        "You are an international education advisor helping Indian students apply to universities abroad (US, UK, Europe, etc.). "
        "Search the web to research the following details for the given university:\n"
        "  1. Application Deadlines: Major deadlines for PhD and Master's applications (specifically for Fall/Spring cycles).\n"
        "  2. Tuition Fees: Average annual tuition fees for international graduate students (specify in local currency and approximate in INR, e.g. Rs. 25-30 Lakhs/year).\n"
        "  3. Cost of Living: Monthly estimated living expenses (rent, utilities, food, health insurance) in that city (specify in local currency and approximate in INR, e.g. Rs. 1.2 Lakhs/month).\n"
        "  4. Scholarships & Funding: Highlight 2-3 major scholarships/funding options available (e.g. TA/RA stipends, Inlaks, Tata Trusts, Fulbright, university-specific fellowships) that Indian students are eligible for.\n"
        "  5. Indian Emigration Tips: 2-3 practical tips for Indian students moving to this specific campus/city (visa process, local Indian community, climate, transportation).\n\n"
        "Generate a JSON object matching this schema. Be specific and accurate; search actual current rates and estimates.\n"
        "Output ONLY a JSON object matching this schema:\n"
        "{\n"
        "  \"application_deadlines\": \"...\",\n"
        "  \"tuition_fees\": \"...\",\n"
        "  \"cost_of_living\": \"...\",\n"
        "  \"scholarships\": [\n"
        "     {\"name\": \"...\", \"description\": \"...\"},\n"
        "     {\"name\": \"...\", \"description\": \"...\"}\n"
        "  ],\n"
        "  \"emigration_tips\": [\n"
        "     \"...\",\n"
        "     \"...\"\n"
        "  ]\n"
        "}\n"
    )
    
    prompt = f"Conduct research on fees, cost of living, scholarships, and deadlines for Indian students emigrating to {university}."
    
    try:
        res = query_gemini_json_with_search(prompt, system_prompt)
        # Ensure it has all required keys
        for key in ["application_deadlines", "tuition_fees", "cost_of_living", "scholarships", "emigration_tips"]:
            if key not in res:
                res[key] = [] if "tips" in key or "scholarships" in key else "Not found"
        return res
    except Exception as e:
        print(f"    [!] Failed to generate migration details for {university}: {e}")
        return {
            "application_deadlines": "Not found (Check website)",
            "tuition_fees": "Not found (Check website)",
            "cost_of_living": "Not found (Check website)",
            "scholarships": [],
            "emigration_tips": []
        }

def enrich_cached_matches():
    load_env_file()
    matches_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "supervisor_matches.json")
    if not os.path.exists(matches_file):
        print(f"[ERROR] Matches file '{matches_file}' not found.")
        return

    with open(matches_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    matches = data.get("matches", [])
    if not matches:
        print("[!] No supervisors matches found in the file.")
        return

    uni_cache = {}
    print(f"[+] Enriching {len(matches)} supervisors with Indian emigration details...")
    
    for idx, prof in enumerate(matches):
        uni = prof.get("university")
        if not uni:
            continue
        if uni not in uni_cache:
            uni_cache[uni] = generate_university_migration_details(uni)
            
        prof["migration_details"] = uni_cache[uni]
        print(f"    -> Updated details for {prof.get('name')} at {uni}")

    # Write enriched matches back
    with open(matches_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"[+] Successfully saved enriched matches to '{matches_file}'.")

    # Integrate into memory graph
    try:
        from agent_memory import AgentMemory
        memory = AgentMemory()
        memory.integrate_search_run(data.get("candidate", {}), matches)
        print("[+] Successfully re-integrated enriched matches into Agent Memory Graph.")
    except Exception as e:
        print(f"[Warning] Failed to integrate with memory graph: {e}")

if __name__ == "__main__":
    enrich_cached_matches()
