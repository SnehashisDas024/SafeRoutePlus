import os
from pathlib import Path
from dotenv import load_dotenv

def check_env():
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        print("WARNING: .env file does not exist in backend root!")

    # Define variables and their requirement categories
    # Required: App won't function without these
    required_vars = ["DATABASE_URL", "JWT_SECRET_KEY"]
    
    # Mock mode fallback: App functions in mock mode if missing
    mock_mode_vars = [
        "TWILIO_ACCOUNT_SID", 
        "TWILIO_AUTH_TOKEN", 
        "TWILIO_FROM_NUMBER",
        "FCM_SERVICE_ACCOUNT_JSON_PATH"
    ]
    
    # Optional or has default fallback
    optional_vars = [
        "OSRM_BASE_URL",
        "CHECKIN_WINDOW_SEC",
        "ESCALATION_SUSTAINED_SEC",
        "ALERT_COOLDOWN_SEC",
        "MAPBOX_ACCESS_TOKEN",
        "MINIO_ACCESS_KEY",
        "MINIO_SECRET_KEY"
    ]

    print("=== Environment Variables Check ===")
    
    all_vars = required_vars + mock_mode_vars + optional_vars
    for var in all_vars:
        val = os.getenv(var)
        if val and val.strip():
            status = "set"
        else:
            if var in required_vars:
                status = "missing (required)"
            elif var in mock_mode_vars:
                status = "missing (mock mode)"
            else:
                status = "missing (optional/default)"
        print(f"{var}: {status}")

if __name__ == "__main__":
    check_env()

