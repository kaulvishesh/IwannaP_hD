import os
import sys
import json
import asyncio
import shutil
import urllib.request
import urllib.error
import re
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="ScholarFlow Backend")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify front-end origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
MATCHES_FILE = os.path.join(WORKSPACE_DIR, "supervisor_matches.json")

class TaskRequest(BaseModel):
    task: str


@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "has_matches": os.path.exists(MATCHES_FILE)
    }

@app.get("/api/supervisors")
async def get_supervisors():
    if not os.path.exists(MATCHES_FILE):
        return {"candidate": {}, "matches": []}
    try:
        with open(MATCHES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading matches: {str(e)}")

@app.get("/api/memory")
async def get_memory():
    memory_file = os.path.join(WORKSPACE_DIR, "agent_memory.json")
    if not os.path.exists(memory_file):
        return {"nodes": {}, "edges": [], "updated_at": None}
    try:
        with open(memory_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading memory: {str(e)}")

@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use PDF, TXT, or MD.")
        
    save_path = os.path.join(WORKSPACE_DIR, f"uploaded_resume{ext}")
    
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": filename, "saved_path": f"uploaded_resume{ext}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")

# WebSocket log-streaming subprocess helper
async def run_subprocess_and_stream(cmd: list, websocket: WebSocket):
    # Execute the command in an async subprocess
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=WORKSPACE_DIR
    )
    
    # Read stdout and stderr concurrently
    async def read_stream(stream, prefix):
        while True:
            line = await stream.readline()
            if not line:
                break
            text = line.decode("utf-8").strip()
            if text:
                await websocket.send_json({"type": "log", "message": text})
                
    # Gather logs
    await asyncio.gather(
        read_stream(process.stdout, "stdout"),
        read_stream(process.stderr, "stderr")
    )
    
    returncode = await process.wait()
    return returncode

@app.websocket("/ws/run-search")
async def websocket_run_search(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        params = json.loads(data)
        resume_filename = params.get("resume_filename", "uploaded_resume.pdf")
        
        resume_path = os.path.join(WORKSPACE_DIR, resume_filename)
        if not os.path.exists(resume_path):
            # Fallback to any uploaded resume
            for name in ["uploaded_resume.pdf", "uploaded_resume.txt", "uploaded_resume.md"]:
                if os.path.exists(os.path.join(WORKSPACE_DIR, name)):
                    resume_path = os.path.join(WORKSPACE_DIR, name)
                    resume_filename = name
                    break
            else:
                await websocket.send_json({"type": "error", "message": "No resume found. Please upload one first."})
                await websocket.close()
                return
                
        await websocket.send_json({"type": "status", "message": f"Starting supervisor finder on {resume_filename}..."})
        
        cmd = [sys.executable, "supervisor_finder.py", resume_filename]
        returncode = await run_subprocess_and_stream(cmd, websocket)
        
        if returncode == 0:
            # Send the result content
            if os.path.exists(MATCHES_FILE):
                with open(MATCHES_FILE, "r", encoding="utf-8") as f:
                    results = json.load(f)
                await websocket.send_json({"type": "complete", "data": results})
            else:
                await websocket.send_json({"type": "error", "message": "Search completed, but matches file was not generated."})
        else:
            await websocket.send_json({"type": "error", "message": f"Search failed with code {returncode}."})
            
    except WebSocketDisconnect:
        print("[WS] Client disconnected from run-search")
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass

@app.websocket("/ws/run-refine")
async def websocket_run_refine(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        params = json.loads(data)
        task_desc = params.get("task", "")
        
        if not task_desc:
            await websocket.send_json({"type": "error", "message": "Empty task description."})
            await websocket.close()
            return
            
        await websocket.send_json({"type": "status", "message": f"Initializing Research & Refinement loop for: '{task_desc}'"})
        
        cmd = [sys.executable, "refinement_loop.py", task_desc]
        returncode = await run_subprocess_and_stream(cmd, websocket)
        
        if returncode == 0:
            # Find the cloned folder's refinement_summary.json
            # Find the cloned_repos directory and search for recently updated refinement_summary.json
            cloned_dir = os.path.join(WORKSPACE_DIR, "cloned_repos")
            summary_data = {"success": True, "output": "Refinement completed successfully."}
            
            # Look for refinement_summary.json in cloned repos
            found_summary = False
            if os.path.exists(cloned_dir):
                for root, dirs, files in os.walk(cloned_dir):
                    if "refinement_summary.json" in files:
                        try:
                            with open(os.path.join(root, "refinement_summary.json"), "r", encoding="utf-8") as sf:
                                summary_data = json.load(sf)
                                found_summary = True
                                break
                        except Exception:
                            pass
                            
            await websocket.send_json({"type": "complete", "data": summary_data})
        else:
            await websocket.send_json({"type": "error", "message": f"Refinement loop failed with exit code {returncode}."})
            
    except WebSocketDisconnect:
        print("[WS] Client disconnected from run-refine")
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend_server:app", host="0.0.0.0", port=8000, reload=True)
