"""
import socket
import csv
import os
from datetime import datetime

# Step 1: Database (CSV file) Setup karna - Ye humara register hai
file_exists = os.path.isfile('hacker_logs.csv')

with open('hacker_logs.csv', mode='a', newline='') as file:
    writer = csv.writer(file)
    # Agar register naya hai, toh sabse upar Headings daal do
    if not file_exists:
        writer.writerow(['Date_Time', 'Hacker_IP'])

# Step 2: Trap Setup (Darwaza banana)
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#server.bind(('0.0.0.0', 2222))
server.listen(5)
print("🚨 Honeypot Active! Port 2222 par trap lag gaya hai... Data record ho raha hai.")

# Step 3: Catch and Record
while True:
    client_socket, client_address = server.accept()
    ip_address = client_address[0]
    
    # Abhi ka exact time nikalo
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print(f"\n⚠️ ALERT! Hacker pakda gaya: {ip_address} at {current_time}")

    # Step 4: Hacker ki details Register (CSV) mein save karo
    with open('hacker_logs.csv', mode='a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([current_time, ip_address]) # Data Excel mein gaya!

    # Hacker ko bhagao
    client_socket.send(b"Access Denied. You are being logged by NetGuard.\n")
    client_socket.close()
    """