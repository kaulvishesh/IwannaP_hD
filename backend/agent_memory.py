import os
import json
from datetime import datetime

class AgentMemory:
    def __init__(self, memory_file=None):
        if memory_file is None:
            # Locate agent_memory.json inside backend folder
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            memory_file = os.path.join(backend_dir, "agent_memory.json")
        self.memory_file = memory_file
        self.nodes = {}
        self.edges = []
        self.load_memory()

    def load_memory(self):
        if os.path.exists(self.memory_file):
            try:
                with open(self.memory_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.nodes = data.get("nodes", {})
                    self.edges = data.get("edges", [])
            except Exception:
                self.nodes = {}
                self.edges = []
        else:
            self.nodes = {}
            self.edges = []

    def save_memory(self):
        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump({
                "nodes": self.nodes,
                "edges": self.edges,
                "updated_at": datetime.now().isoformat()
            }, f, indent=2)

    def add_node(self, node_id, label, properties):
        self.nodes[node_id] = {
            "id": node_id,
            "label": label,
            "properties": properties
        }

    def add_edge(self, source, target, relation):
        edge = {
            "source": source,
            "target": target,
            "relation": relation
        }
        if edge not in self.edges:
            self.edges.append(edge)

    def integrate_search_run(self, candidate, matches):
        # Add Candidate node
        cand_name = candidate.get("name", "Vishesh Kaul")
        cand_id = f"cand_{cand_name.lower().replace(' ', '_')}"
        self.add_node(cand_id, "Candidate", {
            "name": cand_name,
            "academic_level": candidate.get("academic_level", "")
        })

        # Add Research Interests and links
        for interest in candidate.get("research_interests", []):
            interest_id = f"interest_{interest.lower().replace(' ', '_')}"
            self.add_node(interest_id, "Interest", {"name": interest})
            self.add_edge(cand_id, interest_id, "INTERESTED_IN")

        # Add matches
        for prof in matches:
            prof_name = prof.get("name", "")
            prof_id = f"prof_{prof_name.lower().replace(' ', '_')}"
            
            uni = prof.get("university", "")
            uni_id = f"uni_{uni.lower().replace(' ', '_')}"

            # Add university node
            self.add_node(uni_id, "University", {"name": uni})

            # Add professor node
            self.add_node(prof_id, "Professor", {
                "name": prof_name,
                "department": prof.get("department_or_lab", ""),
                "citations": str(prof.get("citations", "—")),
                "h_index": str(prof.get("h_index", "—"))
            })

            # Add edges
            self.add_edge(prof_id, uni_id, "AFFILIATED_WITH")
            self.add_edge(cand_id, prof_id, f"MATCHED_WITH_{prof.get('match_analysis', {}).get('score', 0)}%")
            
            # Link professor to interests they work on
            for interest in candidate.get("research_interests", []):
                interest_id = f"interest_{interest.lower().replace(' ', '_')}"
                overlap_text = prof.get("match_analysis", {}).get("research_overlap", "").lower()
                if interest.lower() in overlap_text:
                    self.add_edge(prof_id, interest_id, "WORKS_ON")

        self.save_memory()
