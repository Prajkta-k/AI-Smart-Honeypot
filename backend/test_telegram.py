import requests

# Yahan apni ASLI details daal
TOKEN = "YOUR_TELEGRAM_TOKEN_HERE" 
CHAT_ID = "YOUR_CHAT_ID_HERE"

url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
payload = {
    "chat_id": CHAT_ID, 
    "text": "🚀 MISSION P TEST: Agar ye aaya matlab Telegram 100% working hai!"
}

print("Bhej raha hu...")
response = requests.post(url, json=payload)

# Ye humein asli error batayega terminal par
print("Result:", response.json())