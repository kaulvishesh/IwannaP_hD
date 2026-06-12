import os
import sys
import json
import subprocess
import urllib.request
import urllib.parse
import urllib.error
import re
import shutil
import time
from datetime import datetime

# Load env variables
def load_env_file():
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

load_env_file()

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
api_key = os.environ.get("GEMINI_API_KEY")

def query_gemini(prompt: str, system_prompt: str = "", model: str = DEFAULT_GEMINI_MODEL, use_search: bool = False, json_mode: bool = True) -> str:
    if not api_key:
        print("[Agent Error] GEMINI_API_KEY environment variable is not set.")
        sys.exit(1)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    contents = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    if system_prompt:
        contents["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        
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
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req) as response:
                res = json.loads(response.read().decode("utf-8"))
                parts = res.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
                return parts[0].get("text", "").strip()
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise e

def extract_json_block(text: str) -> dict:
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    json_str = match.group(1) if match else text
    try:
        return json.loads(json_str)
    except Exception as e:
        print(f"[Agent Error] Failed to parse JSON block: {e}")
        print("Raw was:", text)
        return {}

def log_agent(message: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [Agent] {message}")
    sys.stdout.flush()

# --- Loop stages ---

def select_github_repo(task_description: str) -> dict:
    log_agent(f"Selecting best GitHub repository for task: '{task_description}'")
    
    system_prompt = (
        "You are an expert software architect. Find a suitable open-source GitHub repository "
        "that can be cloned and adapted to solve the user's specific request. "
        "Search for lightweight, specialized Python utilities, scrapers, or tools. "
        "Output a JSON object with the following keys:\n"
        "  - repo_name: Name of the repository\n"
        "  - clone_url: The HTTPS git clone URL (e.g. 'https://github.com/user/repo.git')\n"
        "  - reason: Why this repo is ideal for the task\n"
        "  - entry_file_or_pattern: The main entrypoint file or folder we should inspect (e.g. 'main.py' or 'scraper.py')\n"
        "  - adaptation_strategy: A brief strategy outline for what script we should write to wrap/adapt this tool."
    )
    
    prompt = f"User Request: {task_description}. Search the web/GitHub for the best tool."
    
    response = query_gemini(prompt, system_prompt, use_search=True)
    return extract_json_block(response)

def setup_cloned_repo(clone_url: str, repo_name: str) -> str:
    dest_dir = os.path.abspath(os.path.join("cloned_repos", repo_name))
    
    if os.path.exists(dest_dir):
        log_agent(f"Repo {repo_name} already exists. Cleaning up and re-cloning to ensure fresh state...")
        shutil.rmtree(dest_dir, ignore_errors=True)
        
    os.makedirs(os.path.dirname(dest_dir), exist_ok=True)
    
    log_agent(f"Cloning {clone_url} into {dest_dir}...")
    cmd = ["git", "clone", clone_url, dest_dir]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        log_agent(f"Git clone failed: {result.stderr}")
        raise RuntimeError(f"Clone failed: {result.stderr}")
        
    log_agent("Successfully cloned repository.")
    return dest_dir

def build_environment(repo_path: str):
    log_agent("Initializing virtual environment using 'uv'...")
    
    # Create venv
    result = subprocess.run(["uv", "venv"], cwd=repo_path, capture_output=True, text=True)
    if result.returncode != 0:
        log_agent(f"Failed to create venv: {result.stderr}")
        raise RuntimeError("Venv creation failed")
        
    # Check for requirements
    reqs_path = os.path.join(repo_path, "requirements.txt")
    pyproject_path = os.path.join(repo_path, "pyproject.toml")
    setup_path = os.path.join(repo_path, "setup.py")
    
    venv_python = os.path.join(repo_path, ".venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = os.path.join(repo_path, ".venv", "bin", "python")

    log_agent("Installing dependencies using uv...")
    
    if os.path.exists(reqs_path):
        log_agent("Found requirements.txt. Installing...")
        res = subprocess.run(["uv", "pip", "install", "-r", "requirements.txt"], cwd=repo_path, capture_output=True, text=True)
        log_agent(f"uv install output: {res.stdout[:150]}...")
    elif os.path.exists(pyproject_path) or os.path.exists(setup_path):
        log_agent("Found setup.py/pyproject.toml. Installing package in editable mode...")
        res = subprocess.run(["uv", "pip", "install", "-e", "."], cwd=repo_path, capture_output=True, text=True)
        log_agent(f"uv install output: {res.stdout[:150]}...")
    else:
        log_agent("No standard requirements found. Installing baseline packages (requests, bs4, lxml)...")
        # Baseline research dependencies
        res = subprocess.run(["uv", "pip", "install", "requests", "beautifulsoup4", "lxml"], cwd=repo_path, capture_output=True, text=True)
        
    return venv_python

def read_files_of_interest(repo_path: str, entry_pattern: str) -> str:
    log_agent(f"Scanning files in {repo_path} matching pattern '{entry_pattern}'...")
    
    files_info = []
    # List top level files to give agent context
    for root, dirs, files in os.walk(repo_path):
        # Avoid traversing virtual env and git folders
        dirs[:] = [d for d in dirs if d not in ['.venv', '.git', '__pycache__', 'node_modules']]
        for f in files:
            if f.endswith('.py') or f.endswith('.md') or f.endswith('.txt'):
                rel_path = os.path.relpath(os.path.join(root, f), repo_path)
                # Keep it short
                if len(files_info) < 15:
                    files_info.append(rel_path)
                    
    log_agent(f"Top files found: {', '.join(files_info[:8])}")
    
    # Read the main entry file if exists
    target_file = os.path.join(repo_path, entry_pattern)
    file_content = ""
    if os.path.exists(target_file):
        try:
            with open(target_file, "r", encoding="utf-8") as f:
                file_content = f.read()
            log_agent(f"Successfully read entry file: {entry_pattern} ({len(file_content)} bytes)")
        except Exception as e:
            log_agent(f"Failed to read entry file: {e}")
            
    context = f"Directory Files: {', '.join(files_info)}\n\nMain Entry File ({entry_pattern}) Content:\n{file_content}"
    return context

def write_solver_script(repo_path: str, context: str, task_description: str) -> str:
    log_agent("Drafting adaptation wrapper script (solve_task.py)...")
    
    system_prompt = (
        "You are an expert coder. Your task is to write a standalone Python script called 'solve_task.py' "
        "inside the cloned repository that uses the cloned repository's tools/modules to solve the user's task.\n\n"
        "RULES:\n"
        "1. Write clean, robust python code.\n"
        "2. Make sure it imports modules correctly from the current directory structure.\n"
        "3. Incorporate exception handling and print clear output or JSON structures at the end.\n"
        "4. Output ONLY the raw Python code, no markdown wrappers, no explanations."
    )
    
    prompt = (
        f"Cloned Repository Context:\n{context}\n\n"
        f"Target User Task:\n{task_description}\n\n"
        "Write the complete python code for 'solve_task.py':"
    )
    
    response = query_gemini(prompt, system_prompt, json_mode=False)
    
    # Clean output just in case
    clean_code = response.strip()
    if clean_code.startswith("```python"):
        clean_code = clean_code.split("```python", 1)[1]
    if clean_code.endswith("```"):
        clean_code = clean_code.rsplit("```", 1)[0]
    clean_code = clean_code.strip()
    
    solver_path = os.path.join(repo_path, "solve_task.py")
    with open(solver_path, "w", encoding="utf-8") as f:
        f.write(clean_code)
        
    log_agent("Successfully created solve_task.py.")
    return solver_path

def execute_and_refine(repo_path: str, venv_python: str, task_description: str, max_iterations=3):
    solver_path = os.path.join(repo_path, "solve_task.py")
    
    for i in range(1, max_iterations + 1):
        log_agent(f"Execution & Refinement Loop: Iteration {i}/{max_iterations}")
        
        cmd = [venv_python, "solve_task.py"]
        res = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True)
        
        log_agent(f"Execution finished with return code: {res.returncode}")
        
        if res.returncode == 0:
            log_agent("SUCCESS! Script completed successfully.")
            return {
                "success": True,
                "output": res.stdout,
                "code": open(solver_path, "r", encoding="utf-8").read()
            }
            
        # If errored, read error and refine
        log_agent("Script crashed. Analyzing logs and refactoring...")
        error_log = f"STDOUT:\n{res.stdout}\n\nSTDERR:\n{res.stderr}"
        
        # Read the current solve_task.py
        current_code = ""
        with open(solver_path, "r", encoding="utf-8") as f:
            current_code = f.read()
            
        system_prompt = (
            "You are an expert debugging assistant. Review the provided code, its execution crash log, "
            "and suggest a fully fixed replacement code. Output ONLY the raw Python code."
        )
        
        prompt = (
            f"Current Code in 'solve_task.py':\n```python\n{current_code}\n```\n\n"
            f"Execution Crash Log:\n{error_log}\n\n"
            f"User Original Task:\n{task_description}\n\n"
            "Please provide the updated, corrected code for 'solve_task.py' (output only python code):"
        )
        
        response = query_gemini(prompt, system_prompt, json_mode=False)
        
        clean_code = response.strip()
        if clean_code.startswith("```python"):
            clean_code = clean_code.split("```python", 1)[1]
        if clean_code.endswith("```"):
            clean_code = clean_code.rsplit("```", 1)[0]
        clean_code = clean_code.strip()
        
        with open(solver_path, "w", encoding="utf-8") as f:
            f.write(clean_code)
            
        log_agent("Refactored code saved. Re-executing...")
        
    log_agent("Max iterations reached. Failed to refine code to run error-free.")
    return {
        "success": False,
        "output": f"Execution failed.\nSTDOUT:\n{res.stdout}\n\nSTDERR:\n{res.stderr}",
        "code": open(solver_path, "r", encoding="utf-8").read() if os.path.exists(solver_path) else ""
    }

# --- Main Entry Point ---

def run_refinement_loop(task_description: str) -> dict:
    log_agent("Starting Autonomous Research & Refinement Loop...")
    
    # 1. Select repo
    repo_meta = select_github_repo(task_description)
    if not repo_meta or not repo_meta.get("clone_url"):
        log_agent("Could not identify a suitable repository for this task.")
        return {"success": False, "error": "No suitable repository found."}
        
    repo_name = repo_meta.get("repo_name", "temp_repo")
    clone_url = repo_meta.get("clone_url")
    entry_file = repo_meta.get("entry_file_or_pattern", "main.py")
    
    log_agent(f"Decided to use: {repo_name} ({clone_url})")
    log_agent(f"Rationale: {repo_meta.get('reason')}")
    
    try:
        # 2. Clone repo
        repo_path = setup_cloned_repo(clone_url, repo_name)
        
        # 3. Setup Venv
        venv_python = build_environment(repo_path)
        
        # 4. Analyze codebase
        repo_context = read_files_of_interest(repo_path, entry_file)
        
        # 5. Write adaptation script
        write_solver_script(repo_path, repo_context, task_description)
        
        # 6. Execute and Refine
        result = execute_and_refine(repo_path, venv_python, task_description)
        
        # Add metadata
        result["repo"] = repo_name
        result["clone_url"] = clone_url
        result["rationale"] = repo_meta.get("reason")
        
        # Save refinement log
        log_path = os.path.join(repo_path, "refinement_summary.json")
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
            
        log_agent("Autonomous Research & Refinement Loop complete!")
        return result
        
    except Exception as e:
        log_agent(f"Fatal error in refinement loop: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python refinement_loop.py <task_description>")
        sys.exit(1)
        
    task = sys.argv[1]
    res = run_refinement_loop(task)
    print("\n=== RESULT ===")
    print(json.dumps(res, indent=2))
