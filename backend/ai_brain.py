from sklearn.ensemble import IsolationForest
import numpy as np

# AI Model setup
# Contamination kam karne se AI thoda relax ho jayega
model = IsolationForest(contamination=0.1)

# Training data (hum AI ko bata rahe hain ki 1-2 pings normal baat hai)
X_train = np.array([[1], [1.5], [2], [1], [2], [0.5]])
model.fit(X_train)

ip_memory = {}

def get_threat_diagnosis(ip_address):
    if ip_address in ip_memory:
        ip_memory[ip_address] += 1
    else:
        ip_memory[ip_address] = 1
        
    attack_count = ip_memory[ip_address]
    
    # AI Prediction
    prediction = model.predict(np.array([[attack_count]]))
    
    # --- LOGIC UPDATE ---
    # Pehla attack: Low Risk
    if attack_count <= 2:
        return "🟡 Low Risk (Initial Probe)"
    
    # 3 se 5 attacks: Suspicious
    elif 3 <= attack_count <= 5:
        return "🟠 Medium Risk (Suspicious Scanning)"
    
    # 5 se zyada: Critical
    else:
        return "🔴 Critical Risk (Brute Force Detected)"