import socket
import asyncio
import requests
import httpx
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
import uvicorn
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient

# ==========================================
# 🛑 CONFIGURATION & SECRET KEYS 🛑
# ==========================================
TELEGRAM_TARGETS = [
    {
        "token": "8597242822:AAEAFFyMSIlLNKCzCbeEWQl4RLcti6e8A0U",
        "chat_id": "2049658675"
    },
    {
        "token": "8777141701:AAFZNBSK2y_bs6eqxEAwmNRiO5cEoQZvvrA",
        "chat_id": "8146182301"
    }
]

GEMINI_API_KEY = "AQ.Ab8RN6KFQ2Fc-zK7TZA_WRNdv8fhAIhz8te7ZACA6_YjYGxnhQ"

MONGO_URI = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_URI)
db = client["mission_p_db"]
attacks_collection = db["hacker_logs"]

connected_frontends = []
honeypot_tasks = {}

# ==========================================
# --- UTILITY FUNCTIONS ---
# ==========================================
def send_telegram_alert(ip: str, port: int, tool: str, explanation: str, is_critical: bool = False):
    alert_type = "☢️ *CRITICAL BREACH* ☢️" if is_critical else "🚨 *NETGUARD ALERT* 🚨"
    msg = f"{alert_type}\n\n*IP:* `{ip}`\n*Target:* `{port}`\n*Tool:* `{tool}`\n\n*AI Analysis:*\n{explanation}"
    
    for target in TELEGRAM_TARGETS:
        token = target["token"]
        chat_id = target["chat_id"]
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        try:
            requests.post(url, json={"chat_id": chat_id, "text": msg, "parse_mode": "Markdown"}, timeout=5)
        except Exception as e:
            print(f"⚠️ Telegram Error for {chat_id}: {e}")

async def call_gemini_api(prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 100, "temperature": 0.6}
    }
    try:
        async with httpx.AsyncClient(timeout=4.5) as http_client:
            response = await http_client.post(url, json=payload)
            data = response.json()
            if response.status_code == 200 and "candidates" in data:
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            else:
                return f"❌ AI Error: {data.get('error', {}).get('message', 'Unknown Error')}"
    except httpx.TimeoutException:
        return "⚡ High Latency: SOC monitoring is active. Total traffic normal."
    except Exception as e:
        return f"❌ Connection Error: {str(e)}"

async def translate_threat(payload: str, port: int, tool: str) -> str:
    if payload == "Port Scan" or not payload: 
        return "Routine network reconnaissance detected."
    ai_reply = await call_gemini_api(f"Explain this cyber attack payload in 1 simple sentence for a security analyst. Port: {port}, Tool: {tool}, Payload: {payload}")
    if "❌" in ai_reply or "⚡" in ai_reply:
        return "Heuristic mismatch. Potential zero-day or obfuscated payload."
    return ai_reply

def get_location(ip: str) -> str:
    try:
        if ip in ["127.0.0.1", "localhost"]: return "🇮🇳 Navi Mumbai, India"
        res = requests.get(f"http://ip-api.com/json/{ip}", timeout=3).json()
        if res.get('status') == 'success': return f"{res.get('countryCode')} {res.get('city')}, {res.get('country')}"
        return "Unknown Location"
    except: return "Internal Network"

async def broadcast_alert(message: dict):
    for client_ws in connected_frontends[:]:
        try: await client_ws.send_json(message)
        except: 
            if client_ws in connected_frontends: connected_frontends.remove(client_ws)

# ==========================================
# --- HONEYPOT CORE LOGIC ---
# ==========================================
async def run_honeypot(port: int):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(('0.0.0.0', port))
        server.listen(5)
        server.setblocking(False)
        print(f"✅ Honeypot started on port {port}")
    except OSError as e: 
        print(f"❌ PORT ERROR: Cannot start honeypot on port {port}. Error: {e} (Maybe port is already in use by another app)")
        return

    loop = asyncio.get_event_loop()
    try:
        while True:
            client_socket, client_address = await loop.sock_accept(server)
            ip_address = client_address[0]
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            service_name = {21: "FTP", 22: "SSH", 80: "HTTP", 2222: "Custom"}.get(port, "Unknown")
            
            payload_data = "Port Scan"
            try:
                raw_payload = await asyncio.wait_for(loop.sock_recv(1024), timeout=2.0)
                if raw_payload: payload_data = raw_payload.decode('utf-8', errors='ignore').strip()
            except: pass

            tool_name = "Nmap/Masscan" if payload_data == "Port Scan" else "Custom Exploit"
            ai_explanation = await translate_threat(payload_data, port, tool_name)
            
            alert_payload = {
                "time": current_time, "ip": ip_address, "port": port, "protocol": service_name,
                "location": get_location(ip_address), "tool": tool_name, "payload": payload_data,
                "ai_explanation": ai_explanation, "is_critical": False
            }
            
            if payload_data != "Port Scan": send_telegram_alert(ip_address, port, tool_name, ai_explanation)

            try: 
                await attacks_collection.insert_one(alert_payload.copy())
                print(f"🎯 RAW SOCKET ATTACK LOGGED IN MONGODB! Target: Port {port}")
            except Exception as db_err: 
                print(f"❌ MONGODB INSERT ERROR (Raw Socket): {db_err}")
                
            await broadcast_alert(alert_payload)
            await loop.sock_sendall(client_socket, b"Connection Refused. Source Logged.\n")
            client_socket.close()
    except asyncio.CancelledError:
        server.close()

async def start_node(port: int):
    if port not in honeypot_tasks: honeypot_tasks[port] = asyncio.create_task(run_honeypot(port))

async def stop_node(port: int):
    if port in honeypot_tasks:
        honeypot_tasks[port].cancel()
        del honeypot_tasks[port]

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Honeypot Services...")
    for p in [21, 22, 80, 2222]: await start_node(p)
    yield
    print("🛑 Shutting down Honeypot Services...")
    for task in honeypot_tasks.values(): task.cancel()
    client.close()

# ==========================================
# --- FASTAPI APP INITIALIZATION ---
# ==========================================
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# ==========================================
# --- API ENDPOINTS ---
# ==========================================
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def admin_login(req: LoginRequest):
    if req.username == "PRS" and req.password == "2405":
        return {"status": "success", "token": "netguard-prs-session-2405"}
    return {"status": "error", "message": "Invalid Credentials! Access Denied."}

class ChatQuery(BaseModel):
    message: str

@app.post("/api/soc-chat")
async def soc_chat_assistant(query: ChatQuery):
    user_msg = query.message.strip()
    if not user_msg: return {"status": "success", "response": "Please enter a query."}

    total_count, critical_count = await asyncio.gather(
        attacks_collection.count_documents({}),
        attacks_collection.count_documents({"is_critical": True})
    )
    
    recent_logs = []
    async for doc in attacks_collection.find({}, {"ip": 1, "port": 1, "tool": 1}).sort("_id", -1).limit(2):
        recent_logs.append(f"{doc.get('ip')}:{doc.get('port')}({doc.get('tool')})")

    system_prompt = f"""
    You are NetGuard AI SOC Assistant. 
    Metrics: {total_count} total, {critical_count} critical.
    Logs: {recent_logs}.
    User message: "{user_msg}"
    
    Instructions:
    - If user says a greeting (hi, hey), just reply politely. DO NOT mention stats.
    - If user asks about attacks, provide a short 1-2 sentence summary.
    """
    ai_response = await call_gemini_api(system_prompt)
    return {"status": "success", "response": ai_response}

@app.get("/api/trace")
async def simulate_attack(payload: str, request: Request):
    ip_address = request.client.host
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ai_explanation = await translate_threat(payload, 80, "Web Browser")
    is_critical = any(x in payload.lower() for x in ["select", "script", "drop", "delete", "fetch", "exec"])
    
    alert_payload = {
        "time": current_time, "ip": ip_address, "port": 80, "protocol": "HTTP/Web",
        "location": get_location(ip_address), "tool": "Web Browser", "payload": payload,
        "ai_explanation": ai_explanation, "is_critical": is_critical
    }
    
    try: 
        await attacks_collection.insert_one(alert_payload.copy())
        print(f"🎯 WEB ATTACK LOGGED IN MONGODB! Payload: {payload[:20]}...")
    except Exception as db_err: 
        print(f"❌ MONGODB INSERT ERROR (Web Trace): {db_err}")
    
    await broadcast_alert(alert_payload)
    if is_critical: send_telegram_alert(ip_address, 80, "Browser Injection", ai_explanation, True)
    return {"status": "Intercepted", "diagnosis": ai_explanation}

@app.get("/hidden/aws_keys.csv")
async def honeyfile_trap(request: Request):
    ip_address = request.client.host
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    explanation = "CRITICAL: Attempted exfiltration of decoy credentials."
    
    alert_payload = {
        "time": current_time, "ip": ip_address, "port": 80, "protocol": "HTTP",
        "location": get_location(ip_address), "tool": "Browser/Curl", "payload": "GET /hidden/aws_keys.csv",
        "ai_explanation": explanation, "is_critical": True 
    }
    
    try: 
        await attacks_collection.insert_one(alert_payload.copy())
        print(f"🎯 HONEYFILE ATTACK LOGGED IN MONGODB!")
    except Exception as db_err: 
        print(f"❌ MONGODB INSERT ERROR (Honeyfile): {db_err}")
        
    await broadcast_alert(alert_payload)
    send_telegram_alert(ip_address, 80, "Decoy Access", explanation, True)
    return "ACCESS DENIED"

@app.get("/api/logs")
async def get_logs(search: Optional[str] = None):
    query = {"$or": [{"ip": {"$regex": search, "$options": "i"}}, {"payload": {"$regex": search, "$options": "i"}}]} if search else {}
    logs = []
    async for doc in attacks_collection.find(query).sort("_id", -1).limit(50):
        doc["_id"] = str(doc["_id"])
        logs.append(doc)
    return {"status": "success", "data": logs}

@app.get("/api/stats")
async def get_analytics():
    total = await attacks_collection.count_documents({})
    malicious = await attacks_collection.count_documents({"payload": {"$ne": "Port Scan"}})
    
    port_cursor = attacks_collection.aggregate([{"$group": {"_id": "$port", "count": {"$sum": 1}}}])
    port_dist = {str(doc["_id"]): doc["count"] async for doc in port_cursor}
    
    ip_cursor = attacks_collection.aggregate([{"$group": {"_id": "$ip", "count": {"$sum": 1}, "location": {"$first": "$location"}}}, {"$sort": {"count": -1}}, {"$limit": 5}])
    top_ips = [{"ip": doc["_id"], "count": doc["count"], "location": doc.get("location", "Unknown")} async for doc in ip_cursor]
    
    return {"status": "success", "data": {"total": total, "malicious": malicious, "port_distribution": port_dist, "top_attackers": top_ips}}

@app.get("/api/nodes")
async def get_nodes_status():
    return {"status": "success", "data": [{"port": p, "service": s, "status": "Online" if p in honeypot_tasks else "Offline"} for p, s in [(21, "FTP Trap"), (22, "SSH Decoy"), (80, "HTTP Honeypot"), (2222, "Custom Vector")]]}

class NodeAction(BaseModel): 
    port: int
    action: str

@app.post("/api/nodes/toggle")
async def toggle_node(req: NodeAction):
    await start_node(req.port) if req.action == "start" else await stop_node(req.port)
    return {"status": "success"}

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_frontends.append(websocket)
    try:
        while True: await websocket.receive_text() 
    except WebSocketDisconnect:
        if websocket in connected_frontends: connected_frontends.remove(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)