import os
import sys
import json
import urllib.request
import urllib.error
import time
from datetime import datetime

# Ensure dependencies are available (pypdf is optional but highly recommended for PDFs)
try:
    import pypdf
except ImportError:
    print("[INFO] pypdf library is not installed. To parse PDF resumes, run: pip install pypdf")
    pypdf = None

def load_env_file():
    """Loads environment variables from .env file if it exists in the workspace."""
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

# Configuration
OLLAMA_HOST = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "gemma2"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
TARGET_SCORE = 90
MAX_ITERATIONS = 3

def query_gemini(prompt: str, system_prompt: str = "", model: str = DEFAULT_GEMINI_MODEL, json_mode: bool = False) -> str:
    """Helper to query the Gemini API directly using urllib (zero dependencies)."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[ERROR] GEMINI_API_KEY environment variable is not set.")
        print("Please set it in your terminal:")
        print("  Windows CMD:  set GEMINI_API_KEY=your_key_here")
        print("  PowerShell:   $env:GEMINI_API_KEY=\"your_key_here\"")
        sys.exit(1)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    contents = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    if system_prompt:
        contents["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        
    generation_config = {}
    if json_mode:
        generation_config["responseMimeType"] = "application/json"
        
    if generation_config:
        contents["generationConfig"] = generation_config

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


def query_ollama(prompt: str, system_prompt: str = "", model: str = DEFAULT_OLLAMA_MODEL, json_mode: bool = False) -> str:
    """Helper function to send queries to local Ollama instance."""
    url = f"{OLLAMA_HOST}/api/generate"
    data = {
        "model": model,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
    }
    if json_mode:
        data["format"] = "json"

    req_data = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url, 
        data=req_data, 
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode("utf-8"))
            return res.get("response", "").strip()
    except urllib.error.URLError as e:
        print(f"\n[ERROR] Failed to connect to Ollama at {OLLAMA_HOST}.")
        print("Please verify Ollama is running and you have pulled the model:")
        print(f"  ollama run {model}")
        print(f"Error details: {e}")
        sys.exit(1)

def query_llm(prompt: str, system_prompt: str = "", provider: str = "ollama", model: str = "", json_mode: bool = False) -> str:
    """Dispatches queries to either Gemini or Ollama depending on configuration."""
    if provider == "gemini":
        model_name = model if model else DEFAULT_GEMINI_MODEL
        return query_gemini(prompt, system_prompt, model_name, json_mode)
    else:
        model_name = model if model else DEFAULT_OLLAMA_MODEL
        return query_ollama(prompt, system_prompt, model_name, json_mode)

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

# --- Agent 1: Job Description Analyzer ---
def analyze_job_description(jd_text: str, provider: str, model: str) -> dict:
    print("[+] Agent 1: Analyzing Job Description...")
    system_prompt = (
        "You are an expert ATS (Applicant Tracking System) parser and Job Recruiter. "
        "Analyze the job description and output a JSON object with the following keys:\n"
        "  - job_title: The title of the role\n"
        "  - key_keywords: A list of 10-15 crucial keywords/phrases (skills, tools, frameworks)\n"
        "  - required_experience: Brief summary of years of experience and core requirements\n"
        "  - soft_skills: Top 5 soft skills desired"
    )
    prompt = f"Analyze this job description:\n\n{jd_text}"
    
    response = query_llm(prompt, system_prompt, provider, model, json_mode=True)
    try:
        return json.loads(response)
    except Exception:
        print("[!] JSON parsing failed for Job Analysis. Attempting raw parsing.")
        return {
            "job_title": "Target Role",
            "key_keywords": [word.strip() for word in jd_text.split() if len(word) > 5][:10],
            "required_experience": "Detected from description",
            "soft_skills": []
        }

# --- Agent 2: ATS Critic (The Evaluator) ---
def evaluate_resume(resume_text: str, jd_analysis: dict, provider: str, model: str) -> dict:
    print("[+] Agent 2: Evaluating Resume & ATS Scoring...")
    current_date_str = datetime.now().strftime("%B %Y")
    system_prompt = (
        f"You are an elite Tech Recruiter and ATS Evaluator. The current date is {current_date_str}. "
        "Evaluate the candidate's resume against the target job description requirements. "
        "Calculate experience duration relative to the current date (so dates up to the current date are NOT in the future). "
        "You MUST respond with a JSON object containing:\n"
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
    
    response = query_llm(prompt, system_prompt, provider, model, json_mode=True)
    try:
        return json.loads(response)
    except Exception:
        print("[!] JSON parsing failed for evaluation. Retrying...")
        return {
            "score": 60,
            "matched_keywords": [],
            "missing_keywords": jd_analysis.get("key_keywords", []),
            "critique": ["Failed to extract JSON. Please refine resume format."],
            "target_areas": ["All sections"]
        }

# --- Agent 3: Resume Writer (The Generator) ---
def rewrite_resume(resume_text: str, critique_report: dict, jd_analysis: dict, provider: str, model: str) -> str:
    print("[+] Agent 3: Optimizing & Tailoring Resume Content...")
    current_date_str = datetime.now().strftime("%B %Y")
    system_prompt = (
        f"You are a professional Resume Writer and Career Coach. The current date is {current_date_str}. "
        "Your task is to rewrite the provided resume to maximize its alignment with the job description, "
        "directly addressing the critique and missing keywords.\n\n"
        "CRITICAL RULES:\n"
        "1. DO NOT invent or fabricate certifications, degrees, companies, or years of experience. Keep the core facts identical.\n"
        "2. Optimize the phrasing of accomplishments. Use strong action verbs (e.g., 'Designed', 'Orchestrated', 'Optimized') and quantify achievements where possible.\n"
        "3. Naturally weave in missing keywords from the JD analysis where appropriate based on the candidate's existing background.\n"
        "4. Format the final output cleanly in Markdown format. Keep it extremely professional and ready for print."
    )
    
    prompt = (
        f"Original Resume:\n{resume_text}\n\n"
        f"Job Keywords & Details:\n{json.dumps(jd_analysis, indent=2)}\n\n"
        f"Recruiter Critique and Focus Areas:\n{json.dumps(critique_report, indent=2)}\n\n"
        "Please provide the complete, updated resume in beautiful Markdown format:"
    )
    
    return query_llm(prompt, system_prompt, provider, model, json_mode=False)


def run_optimization_pipeline(resume_path: str, jd_path: str, provider: str, model: str):
    print(f"\n==========================================")
    print(f"Starting Resume Optimization Agent Pipeline")
    print(f"Provider: {provider}")
    print(f"Model: {model if model else 'Default'}")
    print(f"Target Score: {TARGET_SCORE}/100")
    print(f"==========================================\n")
    
    # Load files
    resume_text = load_file_content(resume_path)
    jd_text = load_file_content(jd_path)
    
    # Step 1: Analyze Job Description
    jd_analysis = analyze_job_description(jd_text, provider, model)
    print(f"[i] Job Title Detected: {jd_analysis.get('job_title')}")
    print(f"[i] Key Keywords Selected: {', '.join(jd_analysis.get('key_keywords', []))}\n")
    
    current_resume = resume_text
    optimization_history = []
    
    # Iterative Self-Refinement loop (Continuous Improvement / RL Loop)
    for iteration in range(1, MAX_ITERATIONS + 1):
        print(f"\n--- Iteration {iteration} / {MAX_ITERATIONS} ---")
        
        # Step 2: Critic Agent Evaluates the current resume
        evaluation = evaluate_resume(current_resume, jd_analysis, provider, model)
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
        
        # Check stop criteria
        if current_score >= TARGET_SCORE:
            print(f"\n[+] Success! Target score of {TARGET_SCORE} met/exceeded with {current_score}/100.")
            break
            
        if iteration == MAX_ITERATIONS:
            print(f"\n[-] Reached maximum iterations ({MAX_ITERATIONS}). Ending optimization loop.")
            break
            
        # Step 3: Generator Agent rewrites based on feedback
        current_resume = rewrite_resume(current_resume, evaluation, jd_analysis, provider, model)
        print("[+] Draft updated by Writer Agent. Re-evaluating next...")

    # Write final outputs
    output_resume_path = "optimized_resume.md"
    with open(output_resume_path, "w", encoding="utf-8") as f:
        f.write(current_resume)
    print(f"\n[+] Saved optimized resume to: {output_resume_path}")
    
    # Generate the optimization log report
    log_content = f"# Resume Optimization Log\n\n"
    log_content += f"**Target Role:** {jd_analysis.get('job_title')}\n"
    log_content += f"**LLM Provider:** {provider}\n"
    log_content += f"**Model Used:** {model if model else 'Default'}\n\n"
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
        
    output_log_path = "improvement_report.md"
    with open(output_log_path, "w", encoding="utf-8") as f:
        f.write(log_content)
    print(f"[+] Saved improvement report to: {output_log_path}")
    print("\nOptimization pipeline complete!")

if __name__ == "__main__":
    load_env_file()
    if len(sys.argv) < 3:
        print("Usage: python resume_optimizer.py <path_to_resume> <path_to_job_description> [provider] [model_name]")
        print("Examples:")
        print("  Using Ollama: python resume_optimizer.py sample_resume.txt sample_job_desc.txt ollama gemma2")
        print("  Using Gemini: python resume_optimizer.py sample_resume.txt sample_job_desc.txt gemini gemini-1.5-flash")
        sys.exit(1)
        
    resume_file = sys.argv[1]
    jd_file = sys.argv[2]
    provider = sys.argv[3] if len(sys.argv) > 3 else "ollama"
    model_name = sys.argv[4] if len(sys.argv) > 4 else ""
    
    # Auto-detect if provider is omitted but GEMINI_API_KEY is present
    if len(sys.argv) == 3 and os.environ.get("GEMINI_API_KEY"):
        provider = "gemini"
        
    run_optimization_pipeline(resume_file, jd_file, provider, model_name)
