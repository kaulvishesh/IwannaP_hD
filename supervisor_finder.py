import os
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
import re
import time
from datetime import datetime

try:
    import pypdf
except ImportError:
    pypdf = None

# Configuration
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

def load_env_file():
    """Loads environment variables from .env file if it exists."""
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip("'").strip('"')
                    os.environ[key.strip()] = val

def query_gemini(prompt: str, system_prompt: str = "", model: str = DEFAULT_GEMINI_MODEL, use_search: bool = False, json_mode: bool = True) -> str:
    """Queries Gemini API with optional Google Search grounding and retry logic."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[ERROR] GEMINI_API_KEY environment variable is not set. Please add it to your .env file.")
        sys.exit(1)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    contents = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    if system_prompt:
        contents["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        
    # Standard JSON mode is incompatible with Google Search tool
    if use_search:
        contents["tools"] = [{"google_search": {}}]
    elif json_mode:
        contents["generationConfig"] = {"responseMimeType": "application/json"}

    req_data = json.dumps(contents).encode("utf-8")
    req = urllib.request.Request(
        url, 
        data=req_data, 
        headers={"Content-Type": "application/json"}
    )
    
    max_retries = 5
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req) as response:
                res = json.loads(response.read().decode("utf-8"))
                parts = res.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
                return parts[0].get("text", "").strip()
        except urllib.error.HTTPError as e:
            error_body = ""
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                pass
                
            if e.code in [503, 429] and attempt < max_retries - 1:
                sleep_time = 5.0 * (attempt + 1)
                if error_body:
                    try:
                        data = json.loads(error_body)
                        for detail in data.get("error", {}).get("details", []):
                            if detail.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
                                delay_str = detail.get("retryDelay", "")
                                if delay_str.endswith('s'):
                                    sleep_time = float(delay_str[:-1]) + 1.5
                    except Exception:
                        pass
                print(f"[!] HTTP {e.code}. Retrying in {sleep_time}s (attempt {attempt+1}/{max_retries})...")
                time.sleep(sleep_time)
                continue
                
            print(f"\n[ERROR] Failed to query Gemini API.")
            print(f"Error details: {e}")
            if error_body:
                print(f"Response body: {error_body}")
            sys.exit(1)
        except urllib.error.URLError as e:
            if attempt < max_retries - 1:
                sleep_time = 5.0 * (attempt + 1)
                print(f"[!] Connection error: {e}. Retrying in {sleep_time}s (attempt {attempt+1}/{max_retries})...")
                time.sleep(sleep_time)
                continue
            print(f"\n[ERROR] Failed to query Gemini API.")
            print(f"Error details: {e}")
            sys.exit(1)

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extracts text from a PDF file."""
    if not pypdf:
        print("[ERROR] pypdf is required to read PDF files. Install it using 'pip install pypdf'.")
        sys.exit(1)
    
    print(f"[+] Extracting text from PDF: {pdf_path}")
    text = ""
    try:
        reader = pypdf.PdfReader(pdf_path)
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"[ERROR] Could not read PDF file: {e}")
        sys.exit(1)

def load_file_content(file_path: str) -> str:
    """Helper to read text, md, or pdf files."""
    if file_path.lower().endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"[ERROR] Could not read file {file_path}: {e}")
        sys.exit(1)

def extract_json_block(text: str) -> dict:
    """Extracts and parses JSON object from a markdown code block if present."""
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    json_str = match.group(1) if match else text
    try:
        return json.loads(json_str)
    except Exception as e:
        print(f"[ERROR] Failed to parse JSON block: {e}")
        print("Raw output was:")
        print(text)
        sys.exit(1)

# --- Stage 1: Analyze Candidate Profile ---
def get_candidate_research_profile(resume_text: str) -> dict:
    print("[+] Analyzing your profile and generating search interests...")
    current_date_str = datetime.now().strftime("%B %Y")
    system_prompt = (
        f"You are an expert academic evaluator. The current date is {current_date_str}. "
        "Analyze the candidate's resume/portfolio details and construct their academic search profile. "
        "Output a JSON object containing:\n"
        "  - name: The candidate's name\n"
        "  - academic_level: Current academic stage (e.g., 'Master's Student', 'Bachelor's Student', 'Graduate')\n"
        "  - research_interests: A list of 3-5 specific academic research subfields (e.g., ['Neural Architecture Search', 'AI Safety Alignment'])\n"
        "  - key_skills: List of technical skills, programming languages, and mathematical domains\n"
        "  - project_summary: A brief 2-3 sentence summary of prior research projects or academic work\n"
        "  - search_queries: A list of 3 specific Google Search query strings designed to find university professors active in these research fields "
        "(e.g., ['site:edu \"machine learning alignment\" \"professor\" OR \"laboratory\"', 'site:ac.uk \"neural networks\" \"principal investigator\"'])"
    )
    prompt = f"Analyze this resume/portfolio text:\n\n{resume_text}"
    response = query_gemini(prompt, system_prompt, use_search=False)
    return extract_json_block(response)

# --- Stage 2: Search for Academic Supervisors ---
def search_for_supervisors(profile: dict) -> list:
    print(f"\n[+] Searching the web for active research supervisors matching interests...")
    interests = profile.get("research_interests", [])
    queries = profile.get("search_queries", [])
    
    # Run a synthesized search grounding prompt using Google Search
    prompt = (
        f"Search Google to identify 5 active research supervisors (Professors, Associate Professors, or Assistant Professors) "
        f"worldwide working on the following research interests: {', '.join(interests)}. "
        f"For each supervisor, you must find their: name, university, lab/department name, official website URL, "
        f"and contact email address (if publicly available; otherwise, their university profile or contact page URL).\n\n"
        f"Query context keywords: {', '.join(queries)}\n\n"
        "You MUST respond ONLY with a JSON object wrapped in a markdown code block matching this schema:\n"
        "```json\n"
        "{\n"
        "  \"supervisors\": [\n"
        "    {\n"
        "      \"id\": 1,\n"
        "      \"name\": \"Professor Name\",\n"
        "      \"university\": \"University Name\",\n"
        "      \"department_or_lab\": \"Department or Lab Name\",\n"
        "      \"website\": \"Lab Website URL or Profile URL\",\n"
        "      \"email\": \"Email Address or Contact Page URL\",\n"
        "      \"research_summary\": \"A short description of their specific focus and recent projects.\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "```"
    )
    
    response = query_gemini(prompt, use_search=True)
    parsed = extract_json_block(response)
    return parsed.get("supervisors", [])

# --- Stage 3: Enrich with OpenAlex Publications ---
def enrich_professor_via_openalex(prof_name: str, university: str) -> dict:
    print(f"[+] Querying OpenAlex academic index for {prof_name} ({university})...")
    query = urllib.parse.quote(prof_name)
    url = f"https://api.openalex.org/authors?search={query}"
    
    # Setup standard request with user agent
    req = urllib.request.Request(
        url, 
        headers={"User-Agent": "ScholarFlow/1.0 (mailto:scholarflow@example.com)"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            results = data.get("results", [])
            if not results:
                return {}
            
            # Select best matching author by institution overlap
            selected_author = results[0]
            for res in results:
                inst = res.get("last_known_institution", {})
                if inst and university.lower() in inst.get("display_name", "").lower():
                    selected_author = res
                    break
            
            author_id = selected_author.get("id")
            h_index = selected_author.get("summary_stats", {}).get("h_index", 0)
            works_count = selected_author.get("works_count", 0)
            citations_count = selected_author.get("cited_by_count", 0)
            
            # Fetch top 3 publications sorted by publication year (recent first)
            works_url = f"https://api.openalex.org/works?filter=author.id:{author_id}&sort=publication_year:desc&per_page=3"
            works_req = urllib.request.Request(
                works_url, 
                headers={"User-Agent": "ScholarFlow/1.0 (mailto:scholarflow@example.com)"}
            )
            
            recent_papers = []
            try:
                with urllib.request.urlopen(works_req) as w_response:
                    w_data = json.loads(w_response.read().decode("utf-8"))
                    for work in w_data.get("results", []):
                        recent_papers.append({
                            "title": work.get("title"),
                            "publication_year": work.get("publication_year"),
                            "cited_by_count": work.get("cited_by_count"),
                            "journal": work.get("primary_location", {}).get("source", {}).get("display_name") if work.get("primary_location") and work.get("primary_location").get("source") else "Unknown/Conference"
                        })
            except Exception as e:
                print(f"    [!] Failed to load works for {prof_name}: {e}")
                
            return {
                "openalex_id": author_id,
                "h_index": h_index,
                "works_count": works_count,
                "citations": citations_count,
                "recent_papers": recent_papers
            }
    except Exception as e:
        print(f"    [!] OpenAlex search error for {prof_name}: {e}")
        return {}

# --- Stage 4: Compatibility Matcher & Cold Outreach Drafter ---
def match_and_draft_outreach(candidate_profile: dict, supervisor: dict) -> dict:
    print(f"[+] Analyzing compatibility and drafting cold outreach for {supervisor.get('name')}...")
    
    system_prompt = (
        "You are an academic advisor helping students apply for research positions (PhD/Postdoc/Master's thesis). "
        "Analyze the candidate's profile and the professor's details (research summary and recent papers). "
        "Output a JSON object containing:\n"
        "  - score: An integer score from 0 to 100 representing research compatibility.\n"
        "  - research_overlap: 2-3 sentences outlining common areas of interest and methodology.\n"
        "  - custom_research_direction: A short proposal (3-4 sentences) outlining a potential project the student could propose working on in the professor's lab.\n"
        "  - email_subject: A short, high-open-rate professional subject line referencing their specific work (no generic titles).\n"
        "  - email_body: A highly customized, polished cold email draft. Cite at least one of the professor's recent paper titles naturally. "
        "Show direct understanding of the paper's challenge and link it to the candidate's technical skills or projects. Keep it concise (under 250 words) and professional."
    )
    
    prompt = (
        f"Candidate Research Profile:\n{json.dumps(candidate_profile, indent=2)}\n\n"
        f"Supervisor Details:\n{json.dumps(supervisor, indent=2)}"
    )
    
    response = query_gemini(prompt, system_prompt, use_search=False)
    return extract_json_block(response)

def generate_professor_deep_dive(prof_name: str, university: str) -> dict:
    """Conduct a deep-dive investigation into a professor's public profile (socials, testimony, alumni careers, values)."""
    print(f"    [+] Conducting comprehensive deep dive for {prof_name}...")
    
    system_prompt = (
        "You are an academic intelligence analyst. Conduct a deep-dive investigation into a professor's public profile "
        "to help a prospective PhD applicant evaluate them. "
        "Search the web to research their:\n"
        "  1. Social Presence: Activity on LinkedIn, Twitter/X, ResearchGate, personal blogs.\n"
        "  2. Student Testimony: Sentiment on RateMyProfessors, Reddit, or student reviews.\n"
        "  3. Careers: Placements of their PhD graduates / alumni (academia vs big tech/industry).\n"
        "  4. Personal Beliefs: Public opinions, values, and stance on research directions (e.g., AI alignment, open-source, scaling, ethical issues).\n\n"
        "Generate a score (0 to 10) for each metric representing engagement/sentiment/strength, along with a 2-3 sentence description.\n"
        "Output ONLY a JSON object matching this schema:\n"
        "```json\n"
        "{\n"
        "  \"social_presence\": {\"score\": 8, \"description\": \"...\"},\n"
        "  \"student_testimony\": {\"score\": 9, \"description\": \"...\"},\n"
        "  \"career_placements\": {\"score\": 7, \"description\": \"...\"},\n"
        "  \"personal_beliefs\": {\"score\": 8, \"description\": \"...\"}\n"
        "}\n"
        "```"
    )
    
    prompt = f"Conduct a deep dive on Professor {prof_name} at {university}. Search the web for their social media, student reviews, career placements, and public opinions/beliefs."
    
    try:
        response = query_gemini(prompt, system_prompt, use_search=True)
        return extract_json_block(response)
    except Exception as e:
        print(f"    [!] Failed to generate deep dive for {prof_name}: {e}")
        return {
            "social_presence": {"score": 0, "description": "Information not found or search failed."},
            "student_testimony": {"score": 0, "description": "Information not found or search failed."},
            "career_placements": {"score": 0, "description": "Information not found or search failed."},
            "personal_beliefs": {"score": 0, "description": "Information not found or search failed."}
        }

def verify_url(url: str) -> bool:
    """Check if the URL returns a valid status or is accessible."""
    if not url or not url.startswith("http"):
        return False
    if "google.com/search" in url or "mailto:" in url:
        return True
    try:
        req = urllib.request.Request(
            url, 
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as response:
            code = response.getcode()
            if code in [200, 301, 302, 307, 308]:
                return True
    except urllib.error.HTTPError as e:
        if e.code in [403, 401, 405]:
            return True
        return False
    except Exception:
        return False
    return False

def find_working_homepage(prof_name: str, university: str) -> str:
    """Find a correct official homepage or lab website for the professor using search grounding."""
    print(f"    [!] Website URL failed validation. Searching for correct link for {prof_name}...")
    prompt = (
        f"Find the correct, active official university homepage, lab website, or personal academic site "
        f"for Professor {prof_name} at {university}.\n"
        f"Perform a search to confirm the link exists and is working. "
        f"You MUST respond ONLY with a JSON object containing the verified URL in this format:\n"
        f"```json\n"
        f"{{\n"
        f"  \"url\": \"https://example.edu/faculty/homepage\"\n"
        f"}}\n"
        f"```"
    )
    try:
        response = query_gemini(prompt, use_search=True)
        data = extract_json_block(response)
        url = data.get("url")
        if url and url.startswith("http"):
            return url
    except Exception:
        pass
    return None

def run_supervisor_pipeline(resume_path: str):
    load_env_file()
    if not os.environ.get("GEMINI_API_KEY"):
        print("[ERROR] GEMINI_API_KEY not found in environment or .env file.")
        sys.exit(1)
        
    resume_text = load_file_content(resume_path)
    
    # 1. Parse Profile
    candidate_profile = get_candidate_research_profile(resume_text)
    print(f"\n==========================================")
    print(f"Candidate Profile Parsed:")
    print(f"  Name:           {candidate_profile.get('name')}")
    print(f"  Level:          {candidate_profile.get('academic_level')}")
    print(f"  Interests:      {', '.join(candidate_profile.get('research_interests', []))}")
    print(f"==========================================")
    
    # 2. Search for Supervisors
    supervisors = search_for_supervisors(candidate_profile)
    if not supervisors:
        print("[-] No supervisors found matching your criteria. Try adjusting your research interests.")
        return
        
    print(f"\n[+] Found {len(supervisors)} matching supervisors on the web. Enriching with OpenAlex and drafting emails...")
    
    results = []
    
    for idx, prof in enumerate(supervisors, 1):
        print(f"\n--- Processing Professor {idx}/{len(supervisors)}: {prof.get('name')} ({prof.get('university')}) ---")
        
        # Validate and fix lab link
        website = prof.get("website", "")
        if not verify_url(website):
            corrected_website = find_working_homepage(prof.get("name"), prof.get("university"))
            if corrected_website and verify_url(corrected_website):
                print(f"    [+] Corrected website to: {corrected_website}")
                prof["website"] = corrected_website
            else:
                fallback_search = f"https://www.google.com/search?q={urllib.parse.quote(prof.get('name') + ' ' + prof.get('university') + ' lab homepage')}"
                print(f"    [!] Could not verify homepage. Falling back to search query: {fallback_search}")
                prof["website"] = fallback_search
                
        # 3. Enrich via OpenAlex
        enrichment = enrich_professor_via_openalex(prof.get("name"), prof.get("university"))
        prof.update(enrichment)
        
        # 3b. Generate Deep Dive Metrics
        deep_dive = generate_professor_deep_dive(prof.get("name"), prof.get("university"))
        prof["deep_dive"] = deep_dive
        
        # 4. Generate Match Analysis & Cold Outreach
        match_details = match_and_draft_outreach(candidate_profile, prof)
        prof["match_analysis"] = match_details
        
        results.append(prof)
        
    # Save the output to JSON
    output_filename = "supervisor_matches.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump({
            "candidate": candidate_profile,
            "matches": results,
            "generated_at": datetime.now().isoformat()
        }, f, indent=2)
        
    print(f"\n==========================================")
    print(f"[+] Complete! Found and processed {len(results)} supervisors.")
    print(f"[+] Results saved to: {output_filename}")
    print(f"==========================================")
    
    # Print a quick preview of findings
    for prof in results:
        match_info = prof.get("match_analysis", {})
        print(f"\n* {prof.get('name')} ({prof.get('university')})")
        print(f"  Compatibility Score: {match_info.get('score')}/100")
        print(f"  Overlap: {match_info.get('research_overlap')}")
        print(f"  Publications Count: {prof.get('works_count', 'Unknown')}, H-Index: {prof.get('h_index', 'Unknown')}")
        print(f"  Email/Contact: {prof.get('email')}")
        print(f"  Subject Draft: {match_info.get('email_subject')}")
        print("-" * 50)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python supervisor_finder.py <path_to_your_resume_or_portfolio>")
        print("Example: python supervisor_finder.py sample_resume.txt")
        sys.exit(1)
        
    resume_file = sys.argv[1]
    run_supervisor_pipeline(resume_file)
