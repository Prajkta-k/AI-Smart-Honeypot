import socket
import time

print("💀 Auto-Attack Bot Started...")
try:
    # 1. Target se connect karo (Port 22 SSH)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(('localhost', 22))
    
    # 2. Honeypot ka welcome message suno
    prompt = s.recv(1024).decode('utf-8', errors='ignore')
    print(f"📡 Honeypot asked: {prompt}")
    
    # 3. Turant apna fake password bhej do (bina type kiye)
    time.sleep(1)
    s.sendall(b"Prajakta123\n")
    print("🔓 Fake Password 'Prajakta123' sent!")
    
    # 4. Honeypot ka reaction dekho
    reaction = s.recv(1024).decode('utf-8', errors='ignore')
    print(f"🛑 Honeypot reaction: {reaction}")
    
    s.close()
    print("✅ Connection successfully cut by Honeypot. Check Telegram!")
except Exception as e:
    print(f"❌ Error: {e}")