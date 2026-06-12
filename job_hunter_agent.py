import os
import sys
import json
import urllib.request
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
TARGET_SCORE = 90
MAX_ITERATIONS = 3

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
    """Queries Gemini API directly with optional Google Search grounding and retry logic."""
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
    """Extracts text from a PDF resume file."""
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

# --- Stage 1: Analyze Candidate Resume & Extract Search Profile ---
def get_candidate_search_profile(resume_text: str) -> dict:
    print("[+] Extracting core skills and target role from your resume...")
    current_date_str = datetime.now().strftime("%B %Y")
    system_prompt = (
        f"You are an expert recruitment parser. The current date is {current_date_str}. "
        "Analyze the candidate's resume and extract their core engineering profile. "
        "Calculate years of experience relative to the current date. Output a JSON object containing:\n"
        "  - target_role: The primary job title they should search for (e.g., 'Backend Engineer')\n"
        "  - core_skills: List of top 5-7 technical skills or keywords (e.g., ['Python', 'PostgreSQL'])\n"
        "  - years_of_experience: Number of years of experience as an integer (count internships as fractional or list total experience including current role, round to nearest integer)\n"
        "  - company_pref: Suggested types of startups or companies"
    )
    prompt = f"Analyze this resume:\n\n{resume_text}"
    response = query_gemini(prompt, system_prompt, use_search=False)
    return extract_json_block(response)

# --- Stage 2: Search for Job Openings (Web Grounding) ---
def search_for_jobs(profile: dict) -> list:
    yoe = profile.get('years_of_experience', 0)
    # Be explicit about seeking junior, mid, or senior roles to avoid matching senior positions to fresh grads.
    if yoe <= 1:
        exp_filter = "junior, entry level, associate, early career, or graduate (0-2 years of experience)"
    elif yoe <= 3:
        exp_filter = "mid level (2-4 years of experience)"
    else:
        exp_filter = f"senior level ({yoe}+ years of experience)"
        
    print(f"\n[+] Searching the web for active job listings matching: {profile.get('target_role')} ({exp_filter})...")
    
    prompt = (
        f"Search Google for active job listings for a '{profile.get('target_role')}' suitable for a candidate with {exp_filter} experience. "
        f"The candidate's core skills are: {', '.join(profile.get('core_skills', []))}. "
        "Search specifically for active roles at YC (Y Combinator) startups, other tech startups, or MNCs.\n\n"
        "Respond with a list of 4 relevant active job listings. For each job, provide a detailed description and the source URL.\n\n"
        "You MUST respond ONLY with a JSON object wrapped in a markdown code block, matching this schema:\n"
        "```json\n"
        "{\n"
        "  \"jobs\": [\n"
        "    {\n"
        "      \"id\": 1,\n"
        "      \"title\": \"Job Title\",\n"
        "      \"company\": \"Company Name\",\n"
        "      \"url\": \"Source Job URL\",\n"
        "      \"description\": \"Detailed description of the job requirements, responsibilities, and key skills needed.\",\n"
        "      \"match_rationale\": \"Why this is a good match for the candidate.\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "```"
    )
    
    response = query_gemini(prompt, use_search=True)
    parsed = extract_json_block(response)
    return parsed.get("jobs", [])

# --- Stage 3: Job Description Analyzer ---
def analyze_job_description(jd_text: str) -> dict:
    print("\n[+] Analyzing Job Description for ATS optimization...")
    system_prompt = (
        "You are an expert ATS parser and Job Recruiter. "
        "Analyze the job description and output a JSON object with the following keys:\n"
        "  - job_title: The title of the role\n"
        "  - key_keywords: A list of 10-15 crucial keywords/phrases (skills, tools, frameworks)\n"
        "  - required_experience: Brief summary of experience requirements\n"
        "  - soft_skills: Top 5 soft skills desired"
    )
    prompt = f"Analyze this job description:\n\n{jd_text}"
    response = query_gemini(prompt, system_prompt, use_search=False)
    return extract_json_block(response)

# --- Stage 4: ATS Critic (The Evaluator) ---
def evaluate_resume(resume_text: str, jd_analysis: dict) -> dict:
    print("[+] Evaluating Resume against JD & ATS Scoring...")
    current_date_str = datetime.now().strftime("%B %Y")
    system_prompt = (
        f"You are an elite Tech Recruiter and ATS Evaluator. The current date is {current_date_str}. "
        "Evaluate the candidate's resume against the target job description requirements. "
        "Calculate experience duration relative to the current date (so dates up to the current date are NOT in the future). "
        "Respond with a JSON object containing:\n"
        "  - score: An integer score from 0 to 100 representing how well the resume matches the JD.\n"
        "  - matched_keywords: List of key keywords from the JD that are already well represented.\n"
        "  - missing_keywords: List of key keywords/skills from the JD that are missing or weak.\n"
        "  - critique: A detailed bulleted list of critique, indicating specific sections or bullet points that need refinement or stronger action verbs.\n"
        "  - target_areas: List of top 3 sections that must be improved in the next iteration."
    )
    prompt = (
        f"Target Job Requirements:\n{json.dumps(jd_analysis, indent=2)}\n\n"
        f"Current Resume Text:\n{resume_text}"
    )
    response = query_gemini(prompt, system_prompt, use_search=False)
    return extract_json_block(response)

def rewrite_resume(resume_text: str, critique_report: dict, jd_analysis: dict) -> str:
    print("[+] Optimizing & Tailoring Resume Content...")
    current_date_str = datetime.now().strftime("%B %Y")
    system_prompt = (
        f"You are a professional Resume Writer and Career Coach. The current date is {current_date_str}. Rewrite "
        "the provided resume to maximize its alignment with the job description, directly addressing the critique and missing keywords.\n\n"
        "CRITICAL RULES:\n"
        "1. DO NOT invent or fabricate credentials, degrees, companies, or years of experience.\n"
        "2. Optimize achievements using strong action verbs and quantify outcomes where possible.\n"
        "3. Naturally weave in missing keywords from the JD.\n"
        "4. Output the complete, updated resume in beautiful, ready-to-print Markdown format."
    )
    
    prompt = (
        f"Original Resume:\n{resume_text}\n\n"
        f"Job Keywords & Details:\n{json.dumps(jd_analysis, indent=2)}\n\n"
        f"Recruiter Critique and Focus Areas:\n{json.dumps(critique_report, indent=2)}\n\n"
        "Please provide the complete, updated resume in beautiful Markdown format:"
    )
    return query_gemini(prompt, system_prompt, json_mode=False)


def run_pipeline(resume_path: str):
    load_env_file()
    if not os.environ.get("GEMINI_API_KEY"):
        print("[ERROR] GEMINI_API_KEY not found in environment or .env file.")
        sys.exit(1)
        
    resume_text = load_file_content(resume_path)
    
    # 1. Parse Profile
    profile = get_candidate_search_profile(resume_text)
    print(f"\n==========================================")
    print(f"Profile Extracted:")
    print(f"  Target Role: {profile.get('target_role')}")
    print(f"  Experience:  {profile.get('years_of_experience')} years")
    print(f"  Core Skills: {', '.join(profile.get('core_skills', []))}")
    print(f"==========================================")
    
    # 2. Crawler search
    jobs = search_for_jobs(profile)
    if not jobs:
        print("[-] No jobs found on the web. Try modifying your resume keywords.")
        return
        
    print(f"\n==========================================")
    print(f"Found {len(jobs)} Matching Job Listings:")
    print(f"==========================================\n")
    for job in jobs:
        print(f"[{job.get('id')}] {job.get('title')} at {job.get('company')}")
        print(f"    URL:   {job.get('url')}")
        print(f"    Match Rationale: {job.get('match_rationale')}")
        print(f"    Brief: {job.get('description')[:140]}...")
        print("-" * 50)
        
    # 3. Interactive selection
    selected_id = None
    while selected_id is None:
        try:
            choice = input("\nEnter the ID of the job you want to target (or 'q' to quit): ").strip()
            if choice.lower() == 'q':
                print("Exiting.")
                return
            selected_id = int(choice)
            if not any(job.get('id') == selected_id for job in jobs):
                print("[!] Invalid ID. Please select from the listed IDs.")
                selected_id = None
        except ValueError:
            print("[!] Please enter a valid number.")
            
    selected_job = next(job for job in jobs if job.get('id') == selected_id)
    print(f"\n[+] Selected: {selected_job.get('title')} at {selected_job.get('company')}")
    
    # 4. Tailor Resume to Selected JD
    jd_analysis = analyze_job_description(selected_job.get("description"))
    print(f"[i] Key Keywords Selected: {', '.join(jd_analysis.get('key_keywords', []))}\n")
    
    current_resume = resume_text
    optimization_history = []
    
    # Iterative Critique Loop
    for iteration in range(1, MAX_ITERATIONS + 1):
        print(f"\n--- Tailoring Iteration {iteration} / {MAX_ITERATIONS} ---")
        
        evaluation = evaluate_resume(current_resume, jd_analysis)
        current_score = int(evaluation.get("score", 0))
        
        print(f"[*] ATS Alignment Score: {current_score}/100")
        print(f"[*] Matched Keywords: {', '.join(evaluation.get('matched_keywords', []))}")
        print(f"[*] Missing Keywords: {', '.join(evaluation.get('missing_keywords', []))}")
        print(f"[*] Critique Highlight: {evaluation.get('critique', ['No feedback provided'])[0]}")
        
        optimization_history.append({
            "iteration": iteration,
            "score": current_score,
            "critique": evaluation.get("critique", []),
            "missing_keywords": evaluation.get("missing_keywords", [])
        })
        
        if current_score >= TARGET_SCORE:
            print(f"\n[+] Success! Target score of {TARGET_SCORE} met/exceeded with {current_score}/100.")
            break
            
        if iteration == MAX_ITERATIONS:
            print(f"\n[-] Reached maximum iterations ({MAX_ITERATIONS}). Ending optimization.")
            break
            
        current_resume = rewrite_resume(current_resume, evaluation, jd_analysis)
        print("[+] Draft updated by Writer Agent. Re-evaluating next...")

    # Write tailored resume
    output_filename = f"tailored_resume_{selected_job.get('company').replace(' ', '_').lower()}.md"
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(current_resume)
    print(f"\n[+] Saved tailored resume to: {output_filename}")
    
    # Generate report
    log_content = f"# Resume Optimization Log\n\n"
    log_content += f"**Target Role:** {selected_job.get('title')} at {selected_job.get('company')}\n"
    log_content += f"**Job URL:** {selected_job.get('url')}\n"
    log_content += f"**Model Used:** {DEFAULT_GEMINI_MODEL}\n\n"
    log_content += "## Score Progression\n\n"
    for hist in optimization_history:
        log_content += f"- **Iteration {hist['iteration']}:** Score: `{hist['score']}/100`\n"
    
    log_content += "\n## Iteration Details & Critiques\n\n"
    for hist in optimization_history:
        log_content += f"### Iteration {hist['iteration']} (Score: {hist['score']}/100)\n"
        log_content += "**Missing Keywords Identified:**\n"
        for kw in hist['missing_keywords']:
            log_content += f"- {kw}\n"
        log_content += "\n**Critique Highlights:**\n"
        for crit in hist['critique']:
            log_content += f"- {crit}\n"
        log_content += "\n"
        
    output_log_path = f"improvement_report_{selected_job.get('company').replace(' ', '_').lower()}.md"
    with open(output_log_path, "w", encoding="utf-8") as f:
        f.write(log_content)
    print(f"[+] Saved improvement report to: {output_log_path}")
    print("\nJob Hunt & Resume Tailoring complete!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python job_hunter_agent.py <path_to_your_resume>")
        print("Example: python job_hunter_agent.py my_resume.pdf")
        sys.exit(1)
        
    resume_file = sys.argv[1]
    run_pipeline(resume_file)
