import json
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

# Select the narrowest scope that your application needs.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send"
]


flow = InstalledAppFlow.from_client_secrets_file(
    "credentials.json",
    SCOPES,
)

credentials = flow.run_local_server(
    port=0,
    access_type="offline",
    prompt="consent",
)

print("Refresh token:", credentials.refresh_token)

# Store the complete credentials securely.
with open("token.json", "w", encoding="utf-8") as token_file:
    token_file.write(credentials.to_json())

print("\nCredentials saved to token.json")